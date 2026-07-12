import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import { validatePartyId, validateRequiredString } from '../../../utils/validation';
import { ENTITY_TEMPLATE_ID_MAP, type OcfEntityType } from './batchTypes';
import { decodeLosslessGeneratedDamlValue, type ReadonlyGeneratedDaml } from './damlCodecLosslessness';

export type AcceptanceEntityType = Extract<
  OcfEntityType,
  'convertibleAcceptance' | 'equityCompensationAcceptance' | 'stockAcceptance' | 'warrantAcceptance'
>;

export function isAcceptanceEntityType(entityType: OcfEntityType): entityType is AcceptanceEntityType {
  return (
    entityType === 'convertibleAcceptance' ||
    entityType === 'equityCompensationAcceptance' ||
    entityType === 'stockAcceptance' ||
    entityType === 'warrantAcceptance'
  );
}

interface AcceptanceCreateArgumentMap {
  convertibleAcceptance: Fairmint.OpenCapTable.OCF.ConvertibleAcceptance.ConvertibleAcceptance;
  equityCompensationAcceptance: Fairmint.OpenCapTable.OCF.EquityCompensationAcceptance.EquityCompensationAcceptance;
  stockAcceptance: Fairmint.OpenCapTable.OCF.StockAcceptance.StockAcceptance;
  warrantAcceptance: Fairmint.OpenCapTable.OCF.WarrantAcceptance.WarrantAcceptance;
}

interface DecoderError {
  readonly at: string;
  readonly message: string;
}

interface AcceptanceCreateArgumentCodec<T> {
  readonly decoder: {
    run(
      input: unknown
    ): { readonly ok: true; readonly result: T } | { readonly ok: false; readonly error: DecoderError };
  };
  encode(value: T): unknown;
}

type AcceptanceDataFor<EntityType extends AcceptanceEntityType> =
  AcceptanceCreateArgumentMap[EntityType]['acceptance_data'];

type AcceptanceCreateArgumentDecoderMap = {
  readonly [EntityType in AcceptanceEntityType]: (
    createArgument: unknown
  ) => ReadonlyGeneratedDaml<AcceptanceDataFor<EntityType>>;
};

function acceptanceCreateArgumentError(
  entityType: AcceptanceEntityType,
  rootPath: string,
  message: string,
  context: Readonly<Record<string, unknown>>
): OcpParseError {
  return new OcpParseError(message, {
    source: rootPath,
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    classification: 'invalid_generated_create_argument',
    context: {
      entityType,
      expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType],
      ...context,
    },
  });
}

/** Build one exact, lossless generated-template decoder while retaining its entity correlation. */
function createAcceptanceCreateArgumentDecoder<const EntityType extends AcceptanceEntityType>(
  entityType: EntityType,
  codec: AcceptanceCreateArgumentCodec<AcceptanceCreateArgumentMap[EntityType]>
): (createArgument: unknown) => ReadonlyGeneratedDaml<AcceptanceDataFor<EntityType>> {
  return (createArgument) => {
    const rootPath = `damlToOcf.${entityType}.createArgument`;
    const diagnosticContext = {
      entityType,
      expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType],
    } as const;

    const decoded = decodeLosslessGeneratedDamlValue(
      {
        decoder: {
          runWithException(decoderInput) {
            const result = codec.decoder.run(decoderInput);
            if (result.ok) return result.result;
            const { at: decoderPath, message: decoderMessage } = result.error;
            throw acceptanceCreateArgumentError(
              entityType,
              rootPath,
              `Invalid generated DAML create argument for ${entityType} at ${decoderPath}: ${decoderMessage}`,
              { decoderPath, decoderMessage }
            );
          },
        },
        encode: (value) => codec.encode(value),
      },
      createArgument,
      {
        rootPath,
        description: `${entityType} create argument`,
        decodeSource: rootPath,
        context: diagnosticContext,
      }
    );

    validatePartyId(decoded.context.issuer, `${rootPath}.context.issuer`);
    validatePartyId(decoded.context.system_operator, `${rootPath}.context.system_operator`);
    const acceptanceData = decoded.acceptance_data;
    validateRequiredString(acceptanceData.id, `${rootPath}.acceptance_data.id`);
    validateRequiredString(acceptanceData.security_id, `${rootPath}.acceptance_data.security_id`);

    return acceptanceData as ReadonlyGeneratedDaml<AcceptanceDataFor<EntityType>>;
  };
}

/** Generated full-template codecs correlated with each supported acceptance family. */
const ACCEPTANCE_CREATE_ARGUMENT_DECODER_MAP = {
  convertibleAcceptance: createAcceptanceCreateArgumentDecoder(
    'convertibleAcceptance',
    Fairmint.OpenCapTable.OCF.ConvertibleAcceptance.ConvertibleAcceptance
  ),
  equityCompensationAcceptance: createAcceptanceCreateArgumentDecoder(
    'equityCompensationAcceptance',
    Fairmint.OpenCapTable.OCF.EquityCompensationAcceptance.EquityCompensationAcceptance
  ),
  stockAcceptance: createAcceptanceCreateArgumentDecoder(
    'stockAcceptance',
    Fairmint.OpenCapTable.OCF.StockAcceptance.StockAcceptance
  ),
  warrantAcceptance: createAcceptanceCreateArgumentDecoder(
    'warrantAcceptance',
    Fairmint.OpenCapTable.OCF.WarrantAcceptance.WarrantAcceptance
  ),
} as const satisfies AcceptanceCreateArgumentDecoderMap;

/** Decode the exact generated contract wrapper and return its correlated acceptance payload. */
export function extractAndDecodeAcceptanceData<const EntityType extends AcceptanceEntityType>(
  entityType: EntityType,
  createArgument: unknown
): ReadonlyGeneratedDaml<AcceptanceDataFor<EntityType>> {
  return ACCEPTANCE_CREATE_ARGUMENT_DECODER_MAP[entityType](createArgument) as ReadonlyGeneratedDaml<
    AcceptanceDataFor<EntityType>
  >;
}
