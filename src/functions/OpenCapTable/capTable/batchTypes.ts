/**
 * Entity registry and read-side type helpers for the OCF entity kinds.
 *
 * The registry is the single source of truth for per-entity metadata: canonical OCF `object_type`, the generated
 * DAML template identity, the create-argument field that holds the entity data, and the generated codec for that
 * data. The generated DAML types stay behind this module; the public entity types live in `./entityTypes`.
 */

import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { OcfObjectType } from '../../../types/native';
import type { OcfDataTypeFor, OcfEntityDataMap, OcfEntityType } from './entityTypes';

export {
  isOcfCreatableEntityType,
  isOcfDeletableEntityType,
  isOcfEditableEntityType,
  isOcfEntityType,
  isOcfReadableObjectType,
  mapOcfObjectTypeToEntityType,
  OCF_OBJECT_TYPE_TO_ENTITY_TYPE,
  type OcfCreatableEntityType,
  type OcfDataTypeFor,
  type OcfDeletableEntityType,
  type OcfEditableEntityType,
  type OcfEntityDataMap,
  type OcfEntityType,
  type OcfEntityTypeForObjectType,
  type OcfReadableDataForObjectType,
  type OcfReadableObjectType,
} from './entityTypes';

/** Generated codec for one entity's DAML data record (`<Name>OcfData`). */
export interface OcfDataCodec {
  readonly decoder: { runWithException(json: unknown): unknown };
  readonly encode: (value: never) => unknown;
}

/** Shared registry entry for all OCF entity metadata used by read, schema, and replication code. */
export interface OcfEntityRegistryEntry {
  /** Canonical OCF object_type accepted by schema validation. */
  objectType: OcfObjectType;
  /** Generated DAML template identity required when reading this entity from the ledger. */
  templateId: string;
  /** Field containing entity data in DAML contract create arguments. */
  dataField: string;
  /** Generated codec for the DAML entity-data record stored in {@link OcfEntityRegistryEntry.dataField}. */
  dataCodec: OcfDataCodec;
}

type OcfEntityRegistry = {
  [EntityType in OcfEntityType]: Omit<OcfEntityRegistryEntry, 'objectType'> & {
    objectType: OcfEntityDataMap[EntityType]['object_type'];
  };
};

/**
 * Single source of truth for entity-level metadata.
 *
 * Schema-supported PlanSecurity objects normalize to the canonical EquityCompensation family
 * before reaching typed conversions.
 */
export const ENTITY_REGISTRY = {
  convertibleAcceptance: {
    objectType: 'TX_CONVERTIBLE_ACCEPTANCE',
    templateId: Fairmint.OpenCapTable.OCF.ConvertibleAcceptance.ConvertibleAcceptance.templateId,
    dataField: 'acceptance_data',
    dataCodec: Fairmint.OpenCapTable.OCF.ConvertibleAcceptance.ConvertibleAcceptanceOcfData,
  },
  convertibleCancellation: {
    objectType: 'TX_CONVERTIBLE_CANCELLATION',
    templateId: Fairmint.OpenCapTable.OCF.ConvertibleCancellation.ConvertibleCancellation.templateId,
    dataField: 'cancellation_data',
    dataCodec: Fairmint.OpenCapTable.OCF.ConvertibleCancellation.ConvertibleCancellationOcfData,
  },
  convertibleConversion: {
    objectType: 'TX_CONVERTIBLE_CONVERSION',
    templateId: Fairmint.OpenCapTable.OCF.ConvertibleConversion.ConvertibleConversion.templateId,
    dataField: 'conversion_data',
    dataCodec: Fairmint.OpenCapTable.OCF.ConvertibleConversion.ConvertibleConversionOcfData,
  },
  convertibleIssuance: {
    objectType: 'TX_CONVERTIBLE_ISSUANCE',
    templateId: Fairmint.OpenCapTable.OCF.ConvertibleIssuance.ConvertibleIssuance.templateId,
    dataField: 'issuance_data',
    dataCodec: Fairmint.OpenCapTable.OCF.ConvertibleIssuance.ConvertibleIssuanceOcfData,
  },
  convertibleRetraction: {
    objectType: 'TX_CONVERTIBLE_RETRACTION',
    templateId: Fairmint.OpenCapTable.OCF.ConvertibleRetraction.ConvertibleRetraction.templateId,
    dataField: 'retraction_data',
    dataCodec: Fairmint.OpenCapTable.OCF.ConvertibleRetraction.ConvertibleRetractionOcfData,
  },
  convertibleTransfer: {
    objectType: 'TX_CONVERTIBLE_TRANSFER',
    templateId: Fairmint.OpenCapTable.OCF.ConvertibleTransfer.ConvertibleTransfer.templateId,
    dataField: 'transfer_data',
    dataCodec: Fairmint.OpenCapTable.OCF.ConvertibleTransfer.ConvertibleTransferOcfData,
  },
  document: {
    objectType: 'DOCUMENT',
    templateId: Fairmint.OpenCapTable.OCF.Document.Document.templateId,
    dataField: 'document_data',
    dataCodec: Fairmint.OpenCapTable.OCF.Document.DocumentOcfData,
  },
  equityCompensationAcceptance: {
    objectType: 'TX_EQUITY_COMPENSATION_ACCEPTANCE',
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationAcceptance.EquityCompensationAcceptance.templateId,
    dataField: 'acceptance_data',
    dataCodec: Fairmint.OpenCapTable.OCF.EquityCompensationAcceptance.EquityCompensationAcceptanceOcfData,
  },
  equityCompensationCancellation: {
    objectType: 'TX_EQUITY_COMPENSATION_CANCELLATION',
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationCancellation.EquityCompensationCancellation.templateId,
    dataField: 'cancellation_data',
    dataCodec: Fairmint.OpenCapTable.OCF.EquityCompensationCancellation.EquityCompensationCancellationOcfData,
  },
  equityCompensationExercise: {
    objectType: 'TX_EQUITY_COMPENSATION_EXERCISE',
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationExercise.EquityCompensationExercise.templateId,
    dataField: 'exercise_data',
    dataCodec: Fairmint.OpenCapTable.OCF.EquityCompensationExercise.EquityCompensationExerciseOcfData,
  },
  equityCompensationIssuance: {
    objectType: 'TX_EQUITY_COMPENSATION_ISSUANCE',
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationIssuance.EquityCompensationIssuance.templateId,
    dataField: 'issuance_data',
    dataCodec: Fairmint.OpenCapTable.OCF.EquityCompensationIssuance.EquityCompensationIssuanceOcfData,
  },
  equityCompensationRelease: {
    objectType: 'TX_EQUITY_COMPENSATION_RELEASE',
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationRelease.EquityCompensationRelease.templateId,
    dataField: 'release_data',
    dataCodec: Fairmint.OpenCapTable.OCF.EquityCompensationRelease.EquityCompensationReleaseOcfData,
  },
  equityCompensationRepricing: {
    objectType: 'TX_EQUITY_COMPENSATION_REPRICING',
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationRepricing.EquityCompensationRepricing.templateId,
    dataField: 'repricing_data',
    dataCodec: Fairmint.OpenCapTable.OCF.EquityCompensationRepricing.EquityCompensationRepricingOcfData,
  },
  equityCompensationRetraction: {
    objectType: 'TX_EQUITY_COMPENSATION_RETRACTION',
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationRetraction.EquityCompensationRetraction.templateId,
    dataField: 'retraction_data',
    dataCodec: Fairmint.OpenCapTable.OCF.EquityCompensationRetraction.EquityCompensationRetractionOcfData,
  },
  equityCompensationTransfer: {
    objectType: 'TX_EQUITY_COMPENSATION_TRANSFER',
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationTransfer.EquityCompensationTransfer.templateId,
    dataField: 'transfer_data',
    dataCodec: Fairmint.OpenCapTable.OCF.EquityCompensationTransfer.EquityCompensationTransferOcfData,
  },
  financing: {
    objectType: 'FINANCING',
    templateId: Fairmint.OpenCapTable.OCF.Financing.Financing.templateId,
    dataField: 'financing_data',
    dataCodec: Fairmint.OpenCapTable.OCF.Financing.FinancingOcfData,
  },
  issuer: {
    objectType: 'ISSUER',
    templateId: Fairmint.OpenCapTable.OCF.Issuer.Issuer.templateId,
    dataField: 'issuer_data',
    dataCodec: Fairmint.OpenCapTable.OCF.Issuer.IssuerOcfData,
  },
  issuerAuthorizedSharesAdjustment: {
    objectType: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
    templateId: Fairmint.OpenCapTable.OCF.IssuerAuthorizedSharesAdjustment.IssuerAuthorizedSharesAdjustment.templateId,
    dataField: 'adjustment_data',
    dataCodec: Fairmint.OpenCapTable.OCF.IssuerAuthorizedSharesAdjustment.IssuerAuthorizedSharesAdjustmentOcfData,
  },
  stakeholder: {
    objectType: 'STAKEHOLDER',
    templateId: Fairmint.OpenCapTable.OCF.Stakeholder.Stakeholder.templateId,
    dataField: 'stakeholder_data',
    dataCodec: Fairmint.OpenCapTable.OCF.Stakeholder.StakeholderOcfData,
  },
  stakeholderRelationshipChangeEvent: {
    objectType: 'CE_STAKEHOLDER_RELATIONSHIP',
    templateId:
      Fairmint.OpenCapTable.OCF.StakeholderRelationshipChangeEvent.StakeholderRelationshipChangeEvent.templateId,
    dataField: 'event_data',
    dataCodec: Fairmint.OpenCapTable.OCF.StakeholderRelationshipChangeEvent.StakeholderRelationshipChangeEventOcfData,
  },
  stakeholderStatusChangeEvent: {
    objectType: 'CE_STAKEHOLDER_STATUS',
    templateId: Fairmint.OpenCapTable.OCF.StakeholderStatusChangeEvent.StakeholderStatusChangeEvent.templateId,
    dataField: 'event_data',
    dataCodec: Fairmint.OpenCapTable.OCF.StakeholderStatusChangeEvent.StakeholderStatusChangeEventOcfData,
  },
  stockAcceptance: {
    objectType: 'TX_STOCK_ACCEPTANCE',
    templateId: Fairmint.OpenCapTable.OCF.StockAcceptance.StockAcceptance.templateId,
    dataField: 'acceptance_data',
    dataCodec: Fairmint.OpenCapTable.OCF.StockAcceptance.StockAcceptanceOcfData,
  },
  stockCancellation: {
    objectType: 'TX_STOCK_CANCELLATION',
    templateId: Fairmint.OpenCapTable.OCF.StockCancellation.StockCancellation.templateId,
    dataField: 'cancellation_data',
    dataCodec: Fairmint.OpenCapTable.OCF.StockCancellation.StockCancellationOcfData,
  },
  stockClass: {
    objectType: 'STOCK_CLASS',
    templateId: Fairmint.OpenCapTable.OCF.StockClass.StockClass.templateId,
    dataField: 'stock_class_data',
    dataCodec: Fairmint.OpenCapTable.OCF.StockClass.StockClassOcfData,
  },
  stockClassAuthorizedSharesAdjustment: {
    objectType: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
    templateId:
      Fairmint.OpenCapTable.OCF.StockClassAuthorizedSharesAdjustment.StockClassAuthorizedSharesAdjustment.templateId,
    dataField: 'adjustment_data',
    dataCodec:
      Fairmint.OpenCapTable.OCF.StockClassAuthorizedSharesAdjustment.StockClassAuthorizedSharesAdjustmentOcfData,
  },
  stockClassConversionRatioAdjustment: {
    objectType: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
    templateId:
      Fairmint.OpenCapTable.OCF.StockClassConversionRatioAdjustment.StockClassConversionRatioAdjustment.templateId,
    dataField: 'adjustment_data',
    dataCodec: Fairmint.OpenCapTable.OCF.StockClassConversionRatioAdjustment.StockClassConversionRatioAdjustmentOcfData,
  },
  stockClassSplit: {
    objectType: 'TX_STOCK_CLASS_SPLIT',
    templateId: Fairmint.OpenCapTable.OCF.StockClassSplit.StockClassSplit.templateId,
    dataField: 'split_data',
    dataCodec: Fairmint.OpenCapTable.OCF.StockClassSplit.StockClassSplitOcfData,
  },
  stockConsolidation: {
    objectType: 'TX_STOCK_CONSOLIDATION',
    templateId: Fairmint.OpenCapTable.OCF.StockConsolidation.StockConsolidation.templateId,
    dataField: 'consolidation_data',
    dataCodec: Fairmint.OpenCapTable.OCF.StockConsolidation.StockConsolidationOcfData,
  },
  stockConversion: {
    objectType: 'TX_STOCK_CONVERSION',
    templateId: Fairmint.OpenCapTable.OCF.StockConversion.StockConversion.templateId,
    dataField: 'conversion_data',
    dataCodec: Fairmint.OpenCapTable.OCF.StockConversion.StockConversionOcfData,
  },
  stockIssuance: {
    objectType: 'TX_STOCK_ISSUANCE',
    templateId: Fairmint.OpenCapTable.OCF.StockIssuance.StockIssuance.templateId,
    dataField: 'issuance_data',
    dataCodec: Fairmint.OpenCapTable.OCF.StockIssuance.StockIssuanceOcfData,
  },
  stockLegendTemplate: {
    objectType: 'STOCK_LEGEND_TEMPLATE',
    templateId: Fairmint.OpenCapTable.OCF.StockLegendTemplate.StockLegendTemplate.templateId,
    dataField: 'template_data',
    dataCodec: Fairmint.OpenCapTable.OCF.StockLegendTemplate.StockLegendTemplateOcfData,
  },
  stockPlan: {
    objectType: 'STOCK_PLAN',
    templateId: Fairmint.OpenCapTable.OCF.StockPlan.StockPlan.templateId,
    dataField: 'plan_data',
    dataCodec: Fairmint.OpenCapTable.OCF.StockPlan.StockPlanOcfData,
  },
  stockPlanPoolAdjustment: {
    objectType: 'TX_STOCK_PLAN_POOL_ADJUSTMENT',
    templateId: Fairmint.OpenCapTable.OCF.StockPlanPoolAdjustment.StockPlanPoolAdjustment.templateId,
    dataField: 'adjustment_data',
    dataCodec: Fairmint.OpenCapTable.OCF.StockPlanPoolAdjustment.StockPlanPoolAdjustmentOcfData,
  },
  stockPlanReturnToPool: {
    objectType: 'TX_STOCK_PLAN_RETURN_TO_POOL',
    templateId: Fairmint.OpenCapTable.OCF.StockPlanReturnToPool.StockPlanReturnToPool.templateId,
    dataField: 'return_data',
    dataCodec: Fairmint.OpenCapTable.OCF.StockPlanReturnToPool.StockPlanReturnToPoolOcfData,
  },
  stockReissuance: {
    objectType: 'TX_STOCK_REISSUANCE',
    templateId: Fairmint.OpenCapTable.OCF.StockReissuance.StockReissuance.templateId,
    dataField: 'reissuance_data',
    dataCodec: Fairmint.OpenCapTable.OCF.StockReissuance.StockReissuanceOcfData,
  },
  stockRepurchase: {
    objectType: 'TX_STOCK_REPURCHASE',
    templateId: Fairmint.OpenCapTable.OCF.StockRepurchase.StockRepurchase.templateId,
    dataField: 'repurchase_data',
    dataCodec: Fairmint.OpenCapTable.OCF.StockRepurchase.StockRepurchaseOcfData,
  },
  stockRetraction: {
    objectType: 'TX_STOCK_RETRACTION',
    templateId: Fairmint.OpenCapTable.OCF.StockRetraction.StockRetraction.templateId,
    dataField: 'retraction_data',
    dataCodec: Fairmint.OpenCapTable.OCF.StockRetraction.StockRetractionOcfData,
  },
  stockTransfer: {
    objectType: 'TX_STOCK_TRANSFER',
    templateId: Fairmint.OpenCapTable.OCF.StockTransfer.StockTransfer.templateId,
    dataField: 'transfer_data',
    dataCodec: Fairmint.OpenCapTable.OCF.StockTransfer.StockTransferOcfData,
  },
  valuation: {
    objectType: 'VALUATION',
    templateId: Fairmint.OpenCapTable.OCF.Valuation.Valuation.templateId,
    dataField: 'valuation_data',
    dataCodec: Fairmint.OpenCapTable.OCF.Valuation.ValuationOcfData,
  },
  vestingAcceleration: {
    objectType: 'TX_VESTING_ACCELERATION',
    templateId: Fairmint.OpenCapTable.OCF.VestingAcceleration.VestingAcceleration.templateId,
    dataField: 'acceleration_data',
    dataCodec: Fairmint.OpenCapTable.OCF.VestingAcceleration.VestingAccelerationOcfData,
  },
  vestingEvent: {
    objectType: 'TX_VESTING_EVENT',
    templateId: Fairmint.OpenCapTable.OCF.VestingEvent.VestingEvent.templateId,
    dataField: 'vesting_data',
    dataCodec: Fairmint.OpenCapTable.OCF.VestingEvent.VestingEventOcfData,
  },
  vestingStart: {
    objectType: 'TX_VESTING_START',
    templateId: Fairmint.OpenCapTable.OCF.VestingStart.VestingStart.templateId,
    dataField: 'vesting_data',
    dataCodec: Fairmint.OpenCapTable.OCF.VestingStart.VestingStartOcfData,
  },
  vestingTerms: {
    objectType: 'VESTING_TERMS',
    templateId: Fairmint.OpenCapTable.OCF.VestingTerms.VestingTerms.templateId,
    dataField: 'vesting_terms_data',
    dataCodec: Fairmint.OpenCapTable.OCF.VestingTerms.VestingTermsOcfData,
  },
  warrantAcceptance: {
    objectType: 'TX_WARRANT_ACCEPTANCE',
    templateId: Fairmint.OpenCapTable.OCF.WarrantAcceptance.WarrantAcceptance.templateId,
    dataField: 'acceptance_data',
    dataCodec: Fairmint.OpenCapTable.OCF.WarrantAcceptance.WarrantAcceptanceOcfData,
  },
  warrantCancellation: {
    objectType: 'TX_WARRANT_CANCELLATION',
    templateId: Fairmint.OpenCapTable.OCF.WarrantCancellation.WarrantCancellation.templateId,
    dataField: 'cancellation_data',
    dataCodec: Fairmint.OpenCapTable.OCF.WarrantCancellation.WarrantCancellationOcfData,
  },
  warrantExercise: {
    objectType: 'TX_WARRANT_EXERCISE',
    templateId: Fairmint.OpenCapTable.OCF.WarrantExercise.WarrantExercise.templateId,
    dataField: 'exercise_data',
    dataCodec: Fairmint.OpenCapTable.OCF.WarrantExercise.WarrantExerciseOcfData,
  },
  warrantIssuance: {
    objectType: 'TX_WARRANT_ISSUANCE',
    templateId: Fairmint.OpenCapTable.OCF.WarrantIssuance.WarrantIssuance.templateId,
    dataField: 'issuance_data',
    dataCodec: Fairmint.OpenCapTable.OCF.WarrantIssuance.WarrantIssuanceOcfData,
  },
  warrantRetraction: {
    objectType: 'TX_WARRANT_RETRACTION',
    templateId: Fairmint.OpenCapTable.OCF.WarrantRetraction.WarrantRetraction.templateId,
    dataField: 'retraction_data',
    dataCodec: Fairmint.OpenCapTable.OCF.WarrantRetraction.WarrantRetractionOcfData,
  },
  warrantTransfer: {
    objectType: 'TX_WARRANT_TRANSFER',
    templateId: Fairmint.OpenCapTable.OCF.WarrantTransfer.WarrantTransfer.templateId,
    dataField: 'transfer_data',
    dataCodec: Fairmint.OpenCapTable.OCF.WarrantTransfer.WarrantTransferOcfData,
  },
} as const satisfies OcfEntityRegistry;

/** Exact generated DAML entity-data payload decoded for one SDK entity kind. */
export type DamlDataTypeFor<EntityType extends OcfEntityType> = ReturnType<
  (typeof ENTITY_REGISTRY)[EntityType]['dataCodec']['decoder']['runWithException']
>;

/** Correlated entity-kind and generated DAML-data tuples accepted by the read dispatcher. */
export type DamlEntityArguments = {
  [EntityType in OcfEntityType]: readonly [type: EntityType, damlData: DamlDataTypeFor<EntityType>];
}[OcfEntityType];

/** Correlated entity-kind and native-data tuples accepted by the converter dispatcher. */
export type OcfEntityArguments = {
  [EntityType in OcfEntityType]: readonly [type: EntityType, data: OcfDataTypeFor<EntityType>];
}[OcfEntityType];

function entityRegistryEntries(): Array<[OcfEntityType, OcfEntityRegistryEntry]> {
  return Object.entries(ENTITY_REGISTRY) as Array<[OcfEntityType, OcfEntityRegistryEntry]>;
}

function mapRegistryValues<TValue>(
  selector: (entry: OcfEntityRegistryEntry, entityType: OcfEntityType) => TValue
): Record<OcfEntityType, TValue> {
  return Object.fromEntries(
    entityRegistryEntries().map(([entityType, entry]) => [entityType, selector(entry, entityType)])
  ) as Record<OcfEntityType, TValue>;
}

/** Mapping from entity type to its exact canonical OCF object_type. */
export const ENTITY_OBJECT_TYPE_MAP = mapRegistryValues((entry) => entry.objectType) as {
  readonly [EntityType in OcfEntityType]: OcfEntityDataMap[EntityType]['object_type'];
};

/** Mapping from entity type to the generated DAML template required at the ledger read boundary. */
export const ENTITY_TEMPLATE_ID_MAP = mapRegistryValues((entry) => entry.templateId) as {
  readonly [EntityType in OcfEntityType]: (typeof ENTITY_REGISTRY)[EntityType]['templateId'];
};

/** Mapping from entity type to DAML create-argument data field. */
export const ENTITY_DATA_FIELD_MAP = mapRegistryValues((entry) => entry.dataField);
