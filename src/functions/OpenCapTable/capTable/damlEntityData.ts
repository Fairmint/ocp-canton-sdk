import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import { extractAndDecodeAcceptanceData, isAcceptanceEntityType } from './acceptanceContractData';
import {
  ENTITY_DATA_FIELD_FALLBACK_MAP,
  ENTITY_DATA_FIELD_MAP,
  ENTITY_TEMPLATE_ID_MAP,
  type DamlDataTypeFor,
  type OcfEntityType,
} from './batchTypes';
import { extractAndDecodeCancellationData, isCancellationEntityType } from './cancellationContractData';
import { findLosslessCodecMismatch } from './damlCodecLosslessness';
import {
  extractAndDecodeTransferData,
  isTransferEntityType,
  validateTransferDamlDataInput,
} from './transferContractData';

interface DecoderError {
  readonly at: string;
  readonly message: string;
}

interface EntityDataDecoder<T> {
  run(input: unknown): { readonly ok: true; readonly result: T } | { readonly ok: false; readonly error: DecoderError };
}

interface EntityDataCodec<T> {
  readonly decoder: EntityDataDecoder<T>;
  readonly encode: (value: T) => unknown;
}

type EntityDataCodecMap = {
  readonly [EntityType in OcfEntityType]: EntityDataCodec<DamlDataTypeFor<EntityType>>;
};

/** Generated payload codecs keyed by their correlated SDK entity kind. */
const ENTITY_DATA_CODEC_MAP: EntityDataCodecMap = {
  convertibleAcceptance: Fairmint.OpenCapTable.OCF.ConvertibleAcceptance.ConvertibleAcceptanceOcfData,
  convertibleCancellation: Fairmint.OpenCapTable.OCF.ConvertibleCancellation.ConvertibleCancellationOcfData,
  convertibleConversion: Fairmint.OpenCapTable.OCF.ConvertibleConversion.ConvertibleConversionOcfData,
  convertibleIssuance: Fairmint.OpenCapTable.OCF.ConvertibleIssuance.ConvertibleIssuanceOcfData,
  convertibleRetraction: Fairmint.OpenCapTable.OCF.ConvertibleRetraction.ConvertibleRetractionOcfData,
  convertibleTransfer: Fairmint.OpenCapTable.OCF.ConvertibleTransfer.ConvertibleTransferOcfData,
  document: Fairmint.OpenCapTable.OCF.Document.DocumentOcfData,
  equityCompensationAcceptance:
    Fairmint.OpenCapTable.OCF.EquityCompensationAcceptance.EquityCompensationAcceptanceOcfData,
  equityCompensationCancellation:
    Fairmint.OpenCapTable.OCF.EquityCompensationCancellation.EquityCompensationCancellationOcfData,
  equityCompensationExercise: Fairmint.OpenCapTable.OCF.EquityCompensationExercise.EquityCompensationExerciseOcfData,
  equityCompensationIssuance: Fairmint.OpenCapTable.OCF.EquityCompensationIssuance.EquityCompensationIssuanceOcfData,
  equityCompensationRelease: Fairmint.OpenCapTable.OCF.EquityCompensationRelease.EquityCompensationReleaseOcfData,
  equityCompensationRepricing: Fairmint.OpenCapTable.OCF.EquityCompensationRepricing.EquityCompensationRepricingOcfData,
  equityCompensationRetraction:
    Fairmint.OpenCapTable.OCF.EquityCompensationRetraction.EquityCompensationRetractionOcfData,
  equityCompensationTransfer: Fairmint.OpenCapTable.OCF.EquityCompensationTransfer.EquityCompensationTransferOcfData,
  issuer: Fairmint.OpenCapTable.OCF.Issuer.IssuerOcfData,
  issuerAuthorizedSharesAdjustment:
    Fairmint.OpenCapTable.OCF.IssuerAuthorizedSharesAdjustment.IssuerAuthorizedSharesAdjustmentOcfData,
  stakeholder: Fairmint.OpenCapTable.OCF.Stakeholder.StakeholderOcfData,
  stakeholderRelationshipChangeEvent:
    Fairmint.OpenCapTable.OCF.StakeholderRelationshipChangeEvent.StakeholderRelationshipChangeEventOcfData,
  stakeholderStatusChangeEvent:
    Fairmint.OpenCapTable.OCF.StakeholderStatusChangeEvent.StakeholderStatusChangeEventOcfData,
  stockAcceptance: Fairmint.OpenCapTable.OCF.StockAcceptance.StockAcceptanceOcfData,
  stockCancellation: Fairmint.OpenCapTable.OCF.StockCancellation.StockCancellationOcfData,
  stockClass: Fairmint.OpenCapTable.OCF.StockClass.StockClassOcfData,
  stockClassAuthorizedSharesAdjustment:
    Fairmint.OpenCapTable.OCF.StockClassAuthorizedSharesAdjustment.StockClassAuthorizedSharesAdjustmentOcfData,
  stockClassConversionRatioAdjustment:
    Fairmint.OpenCapTable.OCF.StockClassConversionRatioAdjustment.StockClassConversionRatioAdjustmentOcfData,
  stockClassSplit: Fairmint.OpenCapTable.OCF.StockClassSplit.StockClassSplitOcfData,
  stockConsolidation: Fairmint.OpenCapTable.OCF.StockConsolidation.StockConsolidationOcfData,
  stockConversion: Fairmint.OpenCapTable.OCF.StockConversion.StockConversionOcfData,
  stockIssuance: Fairmint.OpenCapTable.OCF.StockIssuance.StockIssuanceOcfData,
  stockLegendTemplate: Fairmint.OpenCapTable.OCF.StockLegendTemplate.StockLegendTemplateOcfData,
  stockPlan: Fairmint.OpenCapTable.OCF.StockPlan.StockPlanOcfData,
  stockPlanPoolAdjustment: Fairmint.OpenCapTable.OCF.StockPlanPoolAdjustment.StockPlanPoolAdjustmentOcfData,
  stockPlanReturnToPool: Fairmint.OpenCapTable.OCF.StockPlanReturnToPool.StockPlanReturnToPoolOcfData,
  stockReissuance: Fairmint.OpenCapTable.OCF.StockReissuance.StockReissuanceOcfData,
  stockRepurchase: Fairmint.OpenCapTable.OCF.StockRepurchase.StockRepurchaseOcfData,
  stockRetraction: Fairmint.OpenCapTable.OCF.StockRetraction.StockRetractionOcfData,
  stockTransfer: Fairmint.OpenCapTable.OCF.StockTransfer.StockTransferOcfData,
  valuation: Fairmint.OpenCapTable.OCF.Valuation.ValuationOcfData,
  vestingAcceleration: Fairmint.OpenCapTable.OCF.VestingAcceleration.VestingAccelerationOcfData,
  vestingEvent: Fairmint.OpenCapTable.OCF.VestingEvent.VestingEventOcfData,
  vestingStart: Fairmint.OpenCapTable.OCF.VestingStart.VestingStartOcfData,
  vestingTerms: Fairmint.OpenCapTable.OCF.VestingTerms.VestingTermsOcfData,
  warrantAcceptance: Fairmint.OpenCapTable.OCF.WarrantAcceptance.WarrantAcceptanceOcfData,
  warrantCancellation: Fairmint.OpenCapTable.OCF.WarrantCancellation.WarrantCancellationOcfData,
  warrantExercise: Fairmint.OpenCapTable.OCF.WarrantExercise.WarrantExerciseOcfData,
  warrantIssuance: Fairmint.OpenCapTable.OCF.WarrantIssuance.WarrantIssuanceOcfData,
  warrantRetraction: Fairmint.OpenCapTable.OCF.WarrantRetraction.WarrantRetractionOcfData,
  warrantTransfer: Fairmint.OpenCapTable.OCF.WarrantTransfer.WarrantTransferOcfData,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwnField(record: Readonly<Record<string, unknown>>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, field);
}

/** Extract the entity-specific data object from a ledger create argument. */
export function extractEntityData(entityType: OcfEntityType, createArgument: unknown): Record<string, unknown> {
  if (!isRecord(createArgument)) {
    throw new OcpParseError('Invalid createArgument: expected an object', {
      source: entityType,
      code: OcpErrorCodes.INVALID_RESPONSE,
    });
  }

  const dataFieldName = ENTITY_DATA_FIELD_MAP[entityType];
  const fallbackFieldNames = ENTITY_DATA_FIELD_FALLBACK_MAP[entityType] ?? [];
  const resolvedDataFieldName = hasOwnField(createArgument, dataFieldName)
    ? dataFieldName
    : fallbackFieldNames.find((fieldName) => hasOwnField(createArgument, fieldName));

  if (!resolvedDataFieldName) {
    const expectedFields = [dataFieldName, ...fallbackFieldNames].join("', '");
    throw new OcpParseError(
      `Expected field '${expectedFields}' not found in contract create argument for ${entityType}`,
      {
        source: entityType,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
      }
    );
  }

  const entityData = createArgument[resolvedDataFieldName];
  if (!isRecord(entityData)) {
    throw new OcpParseError(`Entity data field '${resolvedDataFieldName}' is not an object for ${entityType}`, {
      source: entityType,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

  return entityData;
}

/** Decode unknown ledger JSON into the exact generated DAML payload for an entity kind. */
export function decodeDamlEntityData<const EntityType extends OcfEntityType>(
  entityType: EntityType,
  input: unknown
): DamlDataTypeFor<EntityType> {
  if (isTransferEntityType(entityType)) {
    validateTransferDamlDataInput(entityType, input);
  }
  const codec = ENTITY_DATA_CODEC_MAP[entityType];
  const decoded = codec.decoder.run(input);

  if (!decoded.ok) {
    const { at: decoderPath, message: decoderMessage } = decoded.error;
    throw new OcpParseError(`Invalid DAML data for ${entityType} at ${decoderPath}: ${decoderMessage}`, {
      source: `damlEntityData.${entityType}`,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: {
        entityType,
        expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType],
        decoderPath,
        decoderMessage,
      },
    });
  }

  const mismatch = findLosslessCodecMismatch(input, codec.encode(decoded.result));
  if (mismatch) {
    const { decoderPath, decoderMessage } = mismatch;
    throw new OcpParseError(`Invalid DAML data for ${entityType} at ${decoderPath}: ${decoderMessage}`, {
      source: `damlEntityData.${entityType}`,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: {
        entityType,
        expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType],
        decoderPath,
        decoderMessage,
      },
    });
  }

  return decoded.result;
}

/** Extract and decode one correlated generated DAML entity payload from a ledger create argument. */
export function extractAndDecodeDamlEntityData<const EntityType extends OcfEntityType>(
  entityType: EntityType,
  createArgument: unknown
): DamlDataTypeFor<EntityType>;
export function extractAndDecodeDamlEntityData(
  entityType: OcfEntityType,
  createArgument: unknown
): DamlDataTypeFor<OcfEntityType> {
  if (isAcceptanceEntityType(entityType)) {
    return extractAndDecodeAcceptanceData(entityType, createArgument);
  }

  if (isCancellationEntityType(entityType)) {
    return extractAndDecodeCancellationData(entityType, createArgument);
  }

  if (isTransferEntityType(entityType)) {
    return extractAndDecodeTransferData(entityType, createArgument);
  }

  return decodeDamlEntityData(entityType, extractEntityData(entityType, createArgument));
}
