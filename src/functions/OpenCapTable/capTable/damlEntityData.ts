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

interface DecoderError {
  readonly at: string;
  readonly message: string;
}

interface EntityDataDecoder<T> {
  run(input: unknown): { readonly ok: true; readonly result: T } | { readonly ok: false; readonly error: DecoderError };
}

type EntityDataDecoderMap = {
  readonly [EntityType in OcfEntityType]: EntityDataDecoder<DamlDataTypeFor<EntityType>>;
};

/** Generated payload decoders keyed by their correlated SDK entity kind. */
const ENTITY_DATA_DECODER_MAP = {
  convertibleAcceptance: Fairmint.OpenCapTable.OCF.ConvertibleAcceptance.ConvertibleAcceptanceOcfData.decoder,
  convertibleCancellation: Fairmint.OpenCapTable.OCF.ConvertibleCancellation.ConvertibleCancellationOcfData.decoder,
  convertibleConversion: Fairmint.OpenCapTable.OCF.ConvertibleConversion.ConvertibleConversionOcfData.decoder,
  convertibleIssuance: Fairmint.OpenCapTable.OCF.ConvertibleIssuance.ConvertibleIssuanceOcfData.decoder,
  convertibleRetraction: Fairmint.OpenCapTable.OCF.ConvertibleRetraction.ConvertibleRetractionOcfData.decoder,
  convertibleTransfer: Fairmint.OpenCapTable.OCF.ConvertibleTransfer.ConvertibleTransferOcfData.decoder,
  document: Fairmint.OpenCapTable.OCF.Document.DocumentOcfData.decoder,
  equityCompensationAcceptance:
    Fairmint.OpenCapTable.OCF.EquityCompensationAcceptance.EquityCompensationAcceptanceOcfData.decoder,
  equityCompensationCancellation:
    Fairmint.OpenCapTable.OCF.EquityCompensationCancellation.EquityCompensationCancellationOcfData.decoder,
  equityCompensationExercise:
    Fairmint.OpenCapTable.OCF.EquityCompensationExercise.EquityCompensationExerciseOcfData.decoder,
  equityCompensationIssuance:
    Fairmint.OpenCapTable.OCF.EquityCompensationIssuance.EquityCompensationIssuanceOcfData.decoder,
  equityCompensationRelease:
    Fairmint.OpenCapTable.OCF.EquityCompensationRelease.EquityCompensationReleaseOcfData.decoder,
  equityCompensationRepricing:
    Fairmint.OpenCapTable.OCF.EquityCompensationRepricing.EquityCompensationRepricingOcfData.decoder,
  equityCompensationRetraction:
    Fairmint.OpenCapTable.OCF.EquityCompensationRetraction.EquityCompensationRetractionOcfData.decoder,
  equityCompensationTransfer:
    Fairmint.OpenCapTable.OCF.EquityCompensationTransfer.EquityCompensationTransferOcfData.decoder,
  issuer: Fairmint.OpenCapTable.OCF.Issuer.IssuerOcfData.decoder,
  issuerAuthorizedSharesAdjustment:
    Fairmint.OpenCapTable.OCF.IssuerAuthorizedSharesAdjustment.IssuerAuthorizedSharesAdjustmentOcfData.decoder,
  stakeholder: Fairmint.OpenCapTable.OCF.Stakeholder.StakeholderOcfData.decoder,
  stakeholderRelationshipChangeEvent:
    Fairmint.OpenCapTable.OCF.StakeholderRelationshipChangeEvent.StakeholderRelationshipChangeEventOcfData.decoder,
  stakeholderStatusChangeEvent:
    Fairmint.OpenCapTable.OCF.StakeholderStatusChangeEvent.StakeholderStatusChangeEventOcfData.decoder,
  stockAcceptance: Fairmint.OpenCapTable.OCF.StockAcceptance.StockAcceptanceOcfData.decoder,
  stockCancellation: Fairmint.OpenCapTable.OCF.StockCancellation.StockCancellationOcfData.decoder,
  stockClass: Fairmint.OpenCapTable.OCF.StockClass.StockClassOcfData.decoder,
  stockClassAuthorizedSharesAdjustment:
    Fairmint.OpenCapTable.OCF.StockClassAuthorizedSharesAdjustment.StockClassAuthorizedSharesAdjustmentOcfData.decoder,
  stockClassConversionRatioAdjustment:
    Fairmint.OpenCapTable.OCF.StockClassConversionRatioAdjustment.StockClassConversionRatioAdjustmentOcfData.decoder,
  stockClassSplit: Fairmint.OpenCapTable.OCF.StockClassSplit.StockClassSplitOcfData.decoder,
  stockConsolidation: Fairmint.OpenCapTable.OCF.StockConsolidation.StockConsolidationOcfData.decoder,
  stockConversion: Fairmint.OpenCapTable.OCF.StockConversion.StockConversionOcfData.decoder,
  stockIssuance: Fairmint.OpenCapTable.OCF.StockIssuance.StockIssuanceOcfData.decoder,
  stockLegendTemplate: Fairmint.OpenCapTable.OCF.StockLegendTemplate.StockLegendTemplateOcfData.decoder,
  stockPlan: Fairmint.OpenCapTable.OCF.StockPlan.StockPlanOcfData.decoder,
  stockPlanPoolAdjustment: Fairmint.OpenCapTable.OCF.StockPlanPoolAdjustment.StockPlanPoolAdjustmentOcfData.decoder,
  stockPlanReturnToPool: Fairmint.OpenCapTable.OCF.StockPlanReturnToPool.StockPlanReturnToPoolOcfData.decoder,
  stockReissuance: Fairmint.OpenCapTable.OCF.StockReissuance.StockReissuanceOcfData.decoder,
  stockRepurchase: Fairmint.OpenCapTable.OCF.StockRepurchase.StockRepurchaseOcfData.decoder,
  stockRetraction: Fairmint.OpenCapTable.OCF.StockRetraction.StockRetractionOcfData.decoder,
  stockTransfer: Fairmint.OpenCapTable.OCF.StockTransfer.StockTransferOcfData.decoder,
  valuation: Fairmint.OpenCapTable.OCF.Valuation.ValuationOcfData.decoder,
  vestingAcceleration: Fairmint.OpenCapTable.OCF.VestingAcceleration.VestingAccelerationOcfData.decoder,
  vestingEvent: Fairmint.OpenCapTable.OCF.VestingEvent.VestingEventOcfData.decoder,
  vestingStart: Fairmint.OpenCapTable.OCF.VestingStart.VestingStartOcfData.decoder,
  vestingTerms: Fairmint.OpenCapTable.OCF.VestingTerms.VestingTermsOcfData.decoder,
  warrantAcceptance: Fairmint.OpenCapTable.OCF.WarrantAcceptance.WarrantAcceptanceOcfData.decoder,
  warrantCancellation: Fairmint.OpenCapTable.OCF.WarrantCancellation.WarrantCancellationOcfData.decoder,
  warrantExercise: Fairmint.OpenCapTable.OCF.WarrantExercise.WarrantExerciseOcfData.decoder,
  warrantIssuance: Fairmint.OpenCapTable.OCF.WarrantIssuance.WarrantIssuanceOcfData.decoder,
  warrantRetraction: Fairmint.OpenCapTable.OCF.WarrantRetraction.WarrantRetractionOcfData.decoder,
  warrantTransfer: Fairmint.OpenCapTable.OCF.WarrantTransfer.WarrantTransferOcfData.decoder,
} as const satisfies EntityDataDecoderMap;

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
): DamlDataTypeFor<EntityType>;
export function decodeDamlEntityData(entityType: OcfEntityType, input: unknown): DamlDataTypeFor<OcfEntityType> {
  const decoded = ENTITY_DATA_DECODER_MAP[entityType].run(input);

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

  return decodeDamlEntityData(entityType, extractEntityData(entityType, createArgument));
}
