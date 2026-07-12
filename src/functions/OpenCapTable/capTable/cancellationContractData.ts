import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import { validatePartyId } from '../../../utils/validation';
import { ENTITY_TEMPLATE_ID_MAP, type OcfEntityType } from './batchTypes';
import { decodeLosslessGeneratedDamlValue, type ReadonlyGeneratedDaml } from './damlCodecLosslessness';

export type CancellationEntityType = Extract<
  OcfEntityType,
  'convertibleCancellation' | 'equityCompensationCancellation' | 'stockCancellation' | 'warrantCancellation'
>;

export function isCancellationEntityType(entityType: OcfEntityType): entityType is CancellationEntityType {
  return (
    entityType === 'convertibleCancellation' ||
    entityType === 'equityCompensationCancellation' ||
    entityType === 'stockCancellation' ||
    entityType === 'warrantCancellation'
  );
}

interface CancellationCreateArgumentMap {
  convertibleCancellation: Fairmint.OpenCapTable.OCF.ConvertibleCancellation.ConvertibleCancellation;
  equityCompensationCancellation: Fairmint.OpenCapTable.OCF.EquityCompensationCancellation.EquityCompensationCancellation;
  stockCancellation: Fairmint.OpenCapTable.OCF.StockCancellation.StockCancellation;
  warrantCancellation: Fairmint.OpenCapTable.OCF.WarrantCancellation.WarrantCancellation;
}

interface DecoderError {
  readonly at: string;
  readonly message: string;
}

interface CancellationCreateArgumentCodec<T> {
  readonly decoder: {
    run(
      input: unknown
    ): { readonly ok: true; readonly result: T } | { readonly ok: false; readonly error: DecoderError };
  };
  encode(value: T): unknown;
}

type CancellationDataFor<EntityType extends CancellationEntityType> =
  CancellationCreateArgumentMap[EntityType]['cancellation_data'];

type CancellationCreateArgumentDecoderMap = {
  readonly [EntityType in CancellationEntityType]: (
    createArgument: unknown
  ) => ReadonlyGeneratedDaml<CancellationDataFor<EntityType>>;
};

function cancellationCreateArgumentError(
  entityType: CancellationEntityType,
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

/** Build one exact, lossless generated-template decoder while retaining its cancellation-family correlation. */
function createCancellationCreateArgumentDecoder<const EntityType extends CancellationEntityType>(
  entityType: EntityType,
  codec: CancellationCreateArgumentCodec<CancellationCreateArgumentMap[EntityType]>
): (createArgument: unknown) => ReadonlyGeneratedDaml<CancellationDataFor<EntityType>> {
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
            throw cancellationCreateArgumentError(
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

    return decoded.cancellation_data as ReadonlyGeneratedDaml<CancellationDataFor<EntityType>>;
  };
}

/** Generated full-template codecs correlated with each supported cancellation family. */
const CANCELLATION_CREATE_ARGUMENT_DECODER_MAP = {
  convertibleCancellation: createCancellationCreateArgumentDecoder(
    'convertibleCancellation',
    Fairmint.OpenCapTable.OCF.ConvertibleCancellation.ConvertibleCancellation
  ),
  equityCompensationCancellation: createCancellationCreateArgumentDecoder(
    'equityCompensationCancellation',
    Fairmint.OpenCapTable.OCF.EquityCompensationCancellation.EquityCompensationCancellation
  ),
  stockCancellation: createCancellationCreateArgumentDecoder(
    'stockCancellation',
    Fairmint.OpenCapTable.OCF.StockCancellation.StockCancellation
  ),
  warrantCancellation: createCancellationCreateArgumentDecoder(
    'warrantCancellation',
    Fairmint.OpenCapTable.OCF.WarrantCancellation.WarrantCancellation
  ),
} as const satisfies CancellationCreateArgumentDecoderMap;

/** Decode the exact generated contract wrapper and return its correlated cancellation payload. */
export function extractAndDecodeCancellationData<const EntityType extends CancellationEntityType>(
  entityType: EntityType,
  createArgument: unknown
): ReadonlyGeneratedDaml<CancellationDataFor<EntityType>> {
  return CANCELLATION_CREATE_ARGUMENT_DECODER_MAP[entityType](createArgument) as ReadonlyGeneratedDaml<
    CancellationDataFor<EntityType>
  >;
}
