import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import { toSafeDiagnosticText } from '../../../errors/OcpError';
import {
  assertSafeGeneratedDamlJson,
  extractGeneratedCreateArgumentData,
} from '../../../utils/generatedDamlValidation';
import { validatePartyId } from '../../../utils/validation';
import { ENTITY_DATA_FIELD_MAP, ENTITY_TEMPLATE_ID_MAP, type DamlDataTypeFor, type OcfEntityType } from './batchTypes';
import { assertLosslessGeneratedDamlRoundTrip } from './damlCodecLosslessness';

export type StockCorporateActionEntityType = Extract<
  OcfEntityType,
  | 'stockClassConversionRatioAdjustment'
  | 'stockClassSplit'
  | 'stockConsolidation'
  | 'stockReissuance'
  | 'stockRepurchase'
>;

export function isStockCorporateActionEntityType(
  entityType: OcfEntityType
): entityType is StockCorporateActionEntityType {
  return (
    entityType === 'stockClassConversionRatioAdjustment' ||
    entityType === 'stockClassSplit' ||
    entityType === 'stockConsolidation' ||
    entityType === 'stockReissuance' ||
    entityType === 'stockRepurchase'
  );
}

interface GeneratedContextWrapper {
  readonly context: {
    readonly issuer: string;
    readonly system_operator: string;
  };
}

interface DecoderError {
  readonly at: string;
  readonly message: string;
}

interface GeneratedCreateArgumentCodec<T extends GeneratedContextWrapper> {
  readonly decoder: {
    run(
      input: unknown
    ): { readonly ok: true; readonly result: T } | { readonly ok: false; readonly error: DecoderError };
  };
  encode(value: T): unknown;
}

type StockCorporateActionCreateArgumentDecoderMap = {
  readonly [EntityType in StockCorporateActionEntityType]: (createArgument: unknown) => DamlDataTypeFor<EntityType>;
};

function createArgumentError(
  entityType: StockCorporateActionEntityType,
  source: string,
  message: string,
  context: Readonly<Record<string, unknown>>
): OcpParseError {
  return new OcpParseError(message, {
    source,
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    classification: 'invalid_generated_create_argument',
    context: {
      entityType,
      expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType],
      ...context,
    },
  });
}

function createStockCorporateActionCreateArgumentDecoder<
  const EntityType extends StockCorporateActionEntityType,
  CreateArgument extends GeneratedContextWrapper,
>(
  entityType: EntityType,
  codec: GeneratedCreateArgumentCodec<CreateArgument>,
  selectData: (value: CreateArgument) => DamlDataTypeFor<EntityType>
): (createArgument: unknown) => DamlDataTypeFor<EntityType> {
  return (createArgument) => {
    const rootPath = `damlToOcf.${entityType}.createArgument`;
    // This descriptor-only bounded pass runs before generated code can touch a
    // property, so proxies, accessors, cycles, and oversized inputs stay inert.
    assertSafeGeneratedDamlJson(createArgument, rootPath);
    const rawData = extractGeneratedCreateArgumentData(createArgument, rootPath, {
      dataField: ENTITY_DATA_FIELD_MAP[entityType],
    });

    const decoded = codec.decoder.run(createArgument);
    if (!decoded.ok) {
      const { at: decoderPath, message: decoderMessage } = decoded.error;
      const decoderSource = decoderPath === 'input' ? rootPath : `${rootPath}${decoderPath.slice('input'.length)}`;
      throw createArgumentError(
        entityType,
        decoderSource,
        `Invalid generated DAML create argument for ${entityType} at ${decoderPath}: ${decoderMessage}`,
        { decoderPath, decoderMessage }
      );
    }

    let encoded: unknown;
    try {
      encoded = codec.encode(decoded.result);
    } catch (error) {
      throw createArgumentError(
        entityType,
        rootPath,
        `Unable to encode generated DAML create argument for ${entityType}: ${toSafeDiagnosticText(error)}`,
        { phase: 'encode' }
      );
    }

    assertSafeGeneratedDamlJson(encoded, `${rootPath}.__encoded`);
    assertLosslessGeneratedDamlRoundTrip(createArgument, encoded, {
      rootPath,
      description: `${entityType} create argument`,
      decodeSource: rootPath,
      context: {
        entityType,
        expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType],
      },
    });

    validatePartyId(decoded.result.context.issuer, `${rootPath}.context.issuer`);
    validatePartyId(decoded.result.context.system_operator, `${rootPath}.context.system_operator`);
    // Preserve the exact raw payload for the correlated entity-data decoder.
    // That second boundary owns field-level losslessness, while this full-wrapper
    // decoder proves the generated template/context shape and Party semantics.
    void selectData(decoded.result);
    return rawData as DamlDataTypeFor<EntityType>;
  };
}

const STOCK_CORPORATE_ACTION_CREATE_ARGUMENT_DECODER_MAP = {
  stockClassConversionRatioAdjustment: createStockCorporateActionCreateArgumentDecoder(
    'stockClassConversionRatioAdjustment',
    Fairmint.OpenCapTable.OCF.StockClassConversionRatioAdjustment.StockClassConversionRatioAdjustment,
    (value) => value.adjustment_data
  ),
  stockClassSplit: createStockCorporateActionCreateArgumentDecoder(
    'stockClassSplit',
    Fairmint.OpenCapTable.OCF.StockClassSplit.StockClassSplit,
    (value) => value.split_data
  ),
  stockConsolidation: createStockCorporateActionCreateArgumentDecoder(
    'stockConsolidation',
    Fairmint.OpenCapTable.OCF.StockConsolidation.StockConsolidation,
    (value) => value.consolidation_data
  ),
  stockReissuance: createStockCorporateActionCreateArgumentDecoder(
    'stockReissuance',
    Fairmint.OpenCapTable.OCF.StockReissuance.StockReissuance,
    (value) => value.reissuance_data
  ),
  stockRepurchase: createStockCorporateActionCreateArgumentDecoder(
    'stockRepurchase',
    Fairmint.OpenCapTable.OCF.StockRepurchase.StockRepurchase,
    (value) => value.repurchase_data
  ),
} as const satisfies StockCorporateActionCreateArgumentDecoderMap;

/** Decode one exact full generated wrapper and return its correlated corporate-action payload. */
export function extractAndDecodeStockCorporateActionData<const EntityType extends StockCorporateActionEntityType>(
  entityType: EntityType,
  createArgument: unknown
): DamlDataTypeFor<EntityType> {
  const decoder = STOCK_CORPORATE_ACTION_CREATE_ARGUMENT_DECODER_MAP[entityType] as (
    value: unknown
  ) => DamlDataTypeFor<EntityType>;
  return decoder(createArgument);
}
