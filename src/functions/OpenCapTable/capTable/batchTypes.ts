/**
 * Type definitions for the batch cap table update API.
 *
 * These types provide a type-safe interface for the UpdateCapTable choice, which supports atomic batch creates, edits,
 * and deletes of OCF entities.
 */

import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type {
  OcfConvertibleAcceptance,
  OcfConvertibleCancellation,
  OcfConvertibleConversion,
  OcfConvertibleIssuance,
  OcfConvertibleRetraction,
  OcfConvertibleTransfer,
  OcfDocument,
  OcfEquityCompensationAcceptance,
  OcfEquityCompensationCancellation,
  OcfEquityCompensationExercise,
  OcfEquityCompensationIssuance,
  OcfEquityCompensationRelease,
  OcfEquityCompensationRepricing,
  OcfEquityCompensationRetraction,
  OcfEquityCompensationTransfer,
  OcfIssuer,
  OcfIssuerAuthorizedSharesAdjustment,
  OcfObjectType,
  OcfStakeholder,
  OcfStakeholderRelationshipChangeEvent,
  OcfStakeholderStatusChangeEvent,
  OcfStockAcceptance,
  OcfStockCancellation,
  OcfStockClass,
  OcfStockClassAuthorizedSharesAdjustment,
  OcfStockClassConversionRatioAdjustment,
  OcfStockClassSplit,
  OcfStockConsolidation,
  OcfStockConversion,
  OcfStockIssuance,
  OcfStockLegendTemplate,
  OcfStockPlan,
  OcfStockPlanPoolAdjustment,
  OcfStockPlanReturnToPool,
  OcfStockReissuance,
  OcfStockRepurchase,
  OcfStockRetraction,
  OcfStockTransfer,
  OcfValuation,
  OcfVestingAcceleration,
  OcfVestingEvent,
  OcfVestingStart,
  OcfVestingTerms,
  OcfWarrantAcceptance,
  OcfWarrantCancellation,
  OcfWarrantExercise,
  OcfWarrantIssuance,
  OcfWarrantRetraction,
  OcfWarrantTransfer,
} from '../../../types';

// Re-export DAML types for convenience
export type OcfCreateData = Fairmint.OpenCapTable.CapTable.OcfCreateData;
export type OcfEditData = Fairmint.OpenCapTable.CapTable.OcfEditData;
export type OcfDeleteData = Fairmint.OpenCapTable.CapTable.OcfDeleteData;
export type UpdateCapTableResult = Fairmint.OpenCapTable.CapTable.UpdateCapTableResult;

/**
 * Result of executing a CapTableBatch.
 *
 * Extends the DAML choice result with transaction metadata from the ledger.
 * This includes all properties from UpdateCapTableResult plus the updateId.
 */
export type CapTableBatchExecuteResult = UpdateCapTableResult & {
  /** The update ID (transaction ID) from the Canton ledger */
  updateId: string;
};

/**
 * Type mapping from entity type string to native OCF data type.
 */
// A closed alias prevents module augmentation from widening OcfEntityType beyond ENTITY_REGISTRY.
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type OcfEntityDataMap = {
  convertibleAcceptance: OcfConvertibleAcceptance;
  convertibleCancellation: OcfConvertibleCancellation;
  convertibleConversion: OcfConvertibleConversion;
  convertibleIssuance: OcfConvertibleIssuance;
  convertibleRetraction: OcfConvertibleRetraction;
  convertibleTransfer: OcfConvertibleTransfer;
  document: OcfDocument;
  equityCompensationAcceptance: OcfEquityCompensationAcceptance;
  equityCompensationCancellation: OcfEquityCompensationCancellation;
  equityCompensationExercise: OcfEquityCompensationExercise;
  equityCompensationIssuance: OcfEquityCompensationIssuance;
  equityCompensationRelease: OcfEquityCompensationRelease;
  equityCompensationRepricing: OcfEquityCompensationRepricing;
  equityCompensationRetraction: OcfEquityCompensationRetraction;
  equityCompensationTransfer: OcfEquityCompensationTransfer;
  /** Issuer is edit-only (no create/delete) - created with CapTable via IssuerAuthorization */
  issuer: OcfIssuer;
  issuerAuthorizedSharesAdjustment: OcfIssuerAuthorizedSharesAdjustment;
  stakeholder: OcfStakeholder;
  stakeholderRelationshipChangeEvent: OcfStakeholderRelationshipChangeEvent;
  stakeholderStatusChangeEvent: OcfStakeholderStatusChangeEvent;
  stockAcceptance: OcfStockAcceptance;
  stockCancellation: OcfStockCancellation;
  stockClass: OcfStockClass;
  stockClassAuthorizedSharesAdjustment: OcfStockClassAuthorizedSharesAdjustment;
  stockClassConversionRatioAdjustment: OcfStockClassConversionRatioAdjustment;
  stockClassSplit: OcfStockClassSplit;
  stockConsolidation: OcfStockConsolidation;
  stockConversion: OcfStockConversion;
  stockIssuance: OcfStockIssuance;
  stockLegendTemplate: OcfStockLegendTemplate;
  stockPlan: OcfStockPlan;
  stockPlanPoolAdjustment: OcfStockPlanPoolAdjustment;
  stockPlanReturnToPool: OcfStockPlanReturnToPool;
  stockReissuance: OcfStockReissuance;
  stockRepurchase: OcfStockRepurchase;
  stockRetraction: OcfStockRetraction;
  stockTransfer: OcfStockTransfer;
  valuation: OcfValuation;
  vestingAcceleration: OcfVestingAcceleration;
  vestingEvent: OcfVestingEvent;
  vestingStart: OcfVestingStart;
  vestingTerms: OcfVestingTerms;
  warrantAcceptance: OcfWarrantAcceptance;
  warrantCancellation: OcfWarrantCancellation;
  warrantExercise: OcfWarrantExercise;
  warrantIssuance: OcfWarrantIssuance;
  warrantRetraction: OcfWarrantRetraction;
  warrantTransfer: OcfWarrantTransfer;
};

/**
 * All supported OCF entity types for batch operations.
 *
 * Derived from {@link OcfEntityDataMap} so an entity kind cannot be added to the
 * data model without also becoming part of the SDK's canonical entity-kind union.
 * Operation-specific subsets are derived from {@link ENTITY_REGISTRY} below.
 */
export type OcfEntityType = keyof OcfEntityDataMap;

/** Helper type to get the native OCF data type for a given entity type. */
export type OcfDataTypeFor<T extends OcfEntityType> = OcfEntityDataMap[T];

type OcfCreateTag = OcfCreateData['tag'];
type OcfEditTag = OcfEditData['tag'];
type OcfDeleteTag = OcfDeleteData['tag'];

type BatchNameFor<Tag extends string, Prefix extends string> = Tag extends `${Prefix}${infer Name}` ? Name : never;
type CreatableBatchName = BatchNameFor<OcfCreateTag, 'OcfCreate'>;
type EditableBatchName = BatchNameFor<OcfEditTag, 'OcfEdit'>;
type DeletableBatchName = BatchNameFor<OcfDeleteTag, 'OcfDelete'>;
type FullyMutableBatchName = CreatableBatchName & EditableBatchName & DeletableBatchName;
type BatchNameForEntity<EntityType extends OcfEntityType> = Capitalize<EntityType>;

/** Exact generated DAML tags supported by an entity in UpdateCapTable. */
export type OcfEntityOperationTags = Readonly<{
  create?: OcfCreateTag;
  edit?: OcfEditTag;
  delete?: OcfDeleteTag;
}>;

function mutableEntityOperations<const Name extends FullyMutableBatchName>(name: Name) {
  return {
    create: `OcfCreate${name}` as Extract<OcfCreateTag, `OcfCreate${Name}`>,
    edit: `OcfEdit${name}` as Extract<OcfEditTag, `OcfEdit${Name}`>,
    delete: `OcfDelete${name}` as Extract<OcfDeleteTag, `OcfDelete${Name}`>,
  } as const;
}

function editOnlyEntityOperations<const Name extends EditableBatchName>(name: Name) {
  return {
    edit: `OcfEdit${name}` as Extract<OcfEditTag, `OcfEdit${Name}`>,
  } as const;
}

/** Shared registry entry for all OCF entity metadata used by batch, read, schema, and state code. */
export interface OcfEntityRegistryEntry {
  /** Canonical OCF object_type accepted by schema validation. */
  objectType: OcfObjectType;
  /** Generated DAML template identity required when reading this entity from the ledger. */
  templateId: string;
  /** Field containing entity data in DAML contract create arguments. */
  dataField: string;
  /** Alternate create-argument fields accepted for older template payloads. */
  dataFieldFallbacks?: readonly string[];
  /** CapTable map field that stores object-id to contract-id entries. */
  capTableField?: string;
  /** CapTable map field that stores security-id uniqueness entries. */
  securityIdField?: string;
  /** Exact generated DAML union tags supported by this entity. */
  operations: OcfEntityOperationTags;
}

type MutableOperationsFor<EntityType extends OcfEntityType> = Readonly<{
  create: Extract<OcfCreateTag, `OcfCreate${BatchNameForEntity<EntityType>}`>;
  edit: Extract<OcfEditTag, `OcfEdit${BatchNameForEntity<EntityType>}`>;
  delete: Extract<OcfDeleteTag, `OcfDelete${BatchNameForEntity<EntityType>}`>;
}>;

type EditOnlyOperationsFor<EntityType extends OcfEntityType> = Readonly<{
  edit: Extract<OcfEditTag, `OcfEdit${BatchNameForEntity<EntityType>}`>;
}>;

type OcfEntityRegistry = {
  [EntityType in OcfEntityType]: Omit<OcfEntityRegistryEntry, 'objectType' | 'operations'> & {
    objectType: OcfEntityDataMap[EntityType]['object_type'];
    operations: EntityType extends 'issuer' ? EditOnlyOperationsFor<EntityType> : MutableOperationsFor<EntityType>;
  };
};

/**
 * Single source of truth for entity-level metadata.
 *
 * Schema-supported PlanSecurity objects normalize to the canonical EquityCompensation family
 * before reaching typed batch operations.
 */
export const ENTITY_REGISTRY = {
  convertibleAcceptance: {
    objectType: 'TX_CONVERTIBLE_ACCEPTANCE',
    templateId: Fairmint.OpenCapTable.OCF.ConvertibleAcceptance.ConvertibleAcceptance.templateId,
    dataField: 'acceptance_data',
    capTableField: 'convertible_acceptances',
    operations: mutableEntityOperations('ConvertibleAcceptance'),
  },
  convertibleCancellation: {
    objectType: 'TX_CONVERTIBLE_CANCELLATION',
    templateId: Fairmint.OpenCapTable.OCF.ConvertibleCancellation.ConvertibleCancellation.templateId,
    dataField: 'cancellation_data',
    capTableField: 'convertible_cancellations',
    operations: mutableEntityOperations('ConvertibleCancellation'),
  },
  convertibleConversion: {
    objectType: 'TX_CONVERTIBLE_CONVERSION',
    templateId: Fairmint.OpenCapTable.OCF.ConvertibleConversion.ConvertibleConversion.templateId,
    dataField: 'conversion_data',
    capTableField: 'convertible_conversions',
    operations: mutableEntityOperations('ConvertibleConversion'),
  },
  convertibleIssuance: {
    objectType: 'TX_CONVERTIBLE_ISSUANCE',
    templateId: Fairmint.OpenCapTable.OCF.ConvertibleIssuance.ConvertibleIssuance.templateId,
    dataField: 'issuance_data',
    capTableField: 'convertible_issuances',
    securityIdField: 'convertible_issuances_by_security_id',
    operations: mutableEntityOperations('ConvertibleIssuance'),
  },
  convertibleRetraction: {
    objectType: 'TX_CONVERTIBLE_RETRACTION',
    templateId: Fairmint.OpenCapTable.OCF.ConvertibleRetraction.ConvertibleRetraction.templateId,
    dataField: 'retraction_data',
    capTableField: 'convertible_retractions',
    operations: mutableEntityOperations('ConvertibleRetraction'),
  },
  convertibleTransfer: {
    objectType: 'TX_CONVERTIBLE_TRANSFER',
    templateId: Fairmint.OpenCapTable.OCF.ConvertibleTransfer.ConvertibleTransfer.templateId,
    dataField: 'transfer_data',
    capTableField: 'convertible_transfers',
    operations: mutableEntityOperations('ConvertibleTransfer'),
  },
  document: {
    objectType: 'DOCUMENT',
    templateId: Fairmint.OpenCapTable.OCF.Document.Document.templateId,
    dataField: 'document_data',
    capTableField: 'documents',
    operations: mutableEntityOperations('Document'),
  },
  equityCompensationAcceptance: {
    objectType: 'TX_EQUITY_COMPENSATION_ACCEPTANCE',
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationAcceptance.EquityCompensationAcceptance.templateId,
    dataField: 'acceptance_data',
    capTableField: 'equity_compensation_acceptances',
    operations: mutableEntityOperations('EquityCompensationAcceptance'),
  },
  equityCompensationCancellation: {
    objectType: 'TX_EQUITY_COMPENSATION_CANCELLATION',
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationCancellation.EquityCompensationCancellation.templateId,
    dataField: 'cancellation_data',
    capTableField: 'equity_compensation_cancellations',
    operations: mutableEntityOperations('EquityCompensationCancellation'),
  },
  equityCompensationExercise: {
    objectType: 'TX_EQUITY_COMPENSATION_EXERCISE',
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationExercise.EquityCompensationExercise.templateId,
    dataField: 'exercise_data',
    capTableField: 'equity_compensation_exercises',
    operations: mutableEntityOperations('EquityCompensationExercise'),
  },
  equityCompensationIssuance: {
    objectType: 'TX_EQUITY_COMPENSATION_ISSUANCE',
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationIssuance.EquityCompensationIssuance.templateId,
    dataField: 'issuance_data',
    capTableField: 'equity_compensation_issuances',
    securityIdField: 'equity_compensation_issuances_by_security_id',
    operations: mutableEntityOperations('EquityCompensationIssuance'),
  },
  equityCompensationRelease: {
    objectType: 'TX_EQUITY_COMPENSATION_RELEASE',
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationRelease.EquityCompensationRelease.templateId,
    dataField: 'release_data',
    capTableField: 'equity_compensation_releases',
    operations: mutableEntityOperations('EquityCompensationRelease'),
  },
  equityCompensationRepricing: {
    objectType: 'TX_EQUITY_COMPENSATION_REPRICING',
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationRepricing.EquityCompensationRepricing.templateId,
    dataField: 'repricing_data',
    capTableField: 'equity_compensation_repricings',
    operations: mutableEntityOperations('EquityCompensationRepricing'),
  },
  equityCompensationRetraction: {
    objectType: 'TX_EQUITY_COMPENSATION_RETRACTION',
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationRetraction.EquityCompensationRetraction.templateId,
    dataField: 'retraction_data',
    capTableField: 'equity_compensation_retractions',
    operations: mutableEntityOperations('EquityCompensationRetraction'),
  },
  equityCompensationTransfer: {
    objectType: 'TX_EQUITY_COMPENSATION_TRANSFER',
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationTransfer.EquityCompensationTransfer.templateId,
    dataField: 'transfer_data',
    capTableField: 'equity_compensation_transfers',
    operations: mutableEntityOperations('EquityCompensationTransfer'),
  },
  issuer: {
    objectType: 'ISSUER',
    templateId: Fairmint.OpenCapTable.OCF.Issuer.Issuer.templateId,
    dataField: 'issuer_data',
    operations: editOnlyEntityOperations('Issuer'),
  },
  issuerAuthorizedSharesAdjustment: {
    objectType: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
    templateId: Fairmint.OpenCapTable.OCF.IssuerAuthorizedSharesAdjustment.IssuerAuthorizedSharesAdjustment.templateId,
    dataField: 'adjustment_data',
    capTableField: 'issuer_authorized_shares_adjustments',
    operations: mutableEntityOperations('IssuerAuthorizedSharesAdjustment'),
  },
  stakeholder: {
    objectType: 'STAKEHOLDER',
    templateId: Fairmint.OpenCapTable.OCF.Stakeholder.Stakeholder.templateId,
    dataField: 'stakeholder_data',
    capTableField: 'stakeholders',
    operations: mutableEntityOperations('Stakeholder'),
  },
  stakeholderRelationshipChangeEvent: {
    objectType: 'CE_STAKEHOLDER_RELATIONSHIP',
    templateId:
      Fairmint.OpenCapTable.OCF.StakeholderRelationshipChangeEvent.StakeholderRelationshipChangeEvent.templateId,
    dataField: 'relationship_change_data',
    dataFieldFallbacks: ['event_data'],
    capTableField: 'stakeholder_relationship_change_events',
    operations: mutableEntityOperations('StakeholderRelationshipChangeEvent'),
  },
  stakeholderStatusChangeEvent: {
    objectType: 'CE_STAKEHOLDER_STATUS',
    templateId: Fairmint.OpenCapTable.OCF.StakeholderStatusChangeEvent.StakeholderStatusChangeEvent.templateId,
    dataField: 'status_change_data',
    dataFieldFallbacks: ['event_data'],
    capTableField: 'stakeholder_status_change_events',
    operations: mutableEntityOperations('StakeholderStatusChangeEvent'),
  },
  stockAcceptance: {
    objectType: 'TX_STOCK_ACCEPTANCE',
    templateId: Fairmint.OpenCapTable.OCF.StockAcceptance.StockAcceptance.templateId,
    dataField: 'acceptance_data',
    capTableField: 'stock_acceptances',
    operations: mutableEntityOperations('StockAcceptance'),
  },
  stockCancellation: {
    objectType: 'TX_STOCK_CANCELLATION',
    templateId: Fairmint.OpenCapTable.OCF.StockCancellation.StockCancellation.templateId,
    dataField: 'cancellation_data',
    capTableField: 'stock_cancellations',
    operations: mutableEntityOperations('StockCancellation'),
  },
  stockClass: {
    objectType: 'STOCK_CLASS',
    templateId: Fairmint.OpenCapTable.OCF.StockClass.StockClass.templateId,
    dataField: 'stock_class_data',
    capTableField: 'stock_classes',
    operations: mutableEntityOperations('StockClass'),
  },
  stockClassAuthorizedSharesAdjustment: {
    objectType: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
    templateId:
      Fairmint.OpenCapTable.OCF.StockClassAuthorizedSharesAdjustment.StockClassAuthorizedSharesAdjustment.templateId,
    dataField: 'adjustment_data',
    capTableField: 'stock_class_authorized_shares_adjustments',
    operations: mutableEntityOperations('StockClassAuthorizedSharesAdjustment'),
  },
  stockClassConversionRatioAdjustment: {
    objectType: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
    templateId:
      Fairmint.OpenCapTable.OCF.StockClassConversionRatioAdjustment.StockClassConversionRatioAdjustment.templateId,
    dataField: 'adjustment_data',
    capTableField: 'stock_class_conversion_ratio_adjustments',
    operations: mutableEntityOperations('StockClassConversionRatioAdjustment'),
  },
  stockClassSplit: {
    objectType: 'TX_STOCK_CLASS_SPLIT',
    templateId: Fairmint.OpenCapTable.OCF.StockClassSplit.StockClassSplit.templateId,
    dataField: 'split_data',
    capTableField: 'stock_class_splits',
    operations: mutableEntityOperations('StockClassSplit'),
  },
  stockConsolidation: {
    objectType: 'TX_STOCK_CONSOLIDATION',
    templateId: Fairmint.OpenCapTable.OCF.StockConsolidation.StockConsolidation.templateId,
    dataField: 'consolidation_data',
    capTableField: 'stock_consolidations',
    operations: mutableEntityOperations('StockConsolidation'),
  },
  stockConversion: {
    objectType: 'TX_STOCK_CONVERSION',
    templateId: Fairmint.OpenCapTable.OCF.StockConversion.StockConversion.templateId,
    dataField: 'conversion_data',
    capTableField: 'stock_conversions',
    operations: mutableEntityOperations('StockConversion'),
  },
  stockIssuance: {
    objectType: 'TX_STOCK_ISSUANCE',
    templateId: Fairmint.OpenCapTable.OCF.StockIssuance.StockIssuance.templateId,
    dataField: 'issuance_data',
    capTableField: 'stock_issuances',
    securityIdField: 'stock_issuances_by_security_id',
    operations: mutableEntityOperations('StockIssuance'),
  },
  stockLegendTemplate: {
    objectType: 'STOCK_LEGEND_TEMPLATE',
    templateId: Fairmint.OpenCapTable.OCF.StockLegendTemplate.StockLegendTemplate.templateId,
    dataField: 'template_data',
    capTableField: 'stock_legend_templates',
    operations: mutableEntityOperations('StockLegendTemplate'),
  },
  stockPlan: {
    objectType: 'STOCK_PLAN',
    templateId: Fairmint.OpenCapTable.OCF.StockPlan.StockPlan.templateId,
    dataField: 'plan_data',
    capTableField: 'stock_plans',
    operations: mutableEntityOperations('StockPlan'),
  },
  stockPlanPoolAdjustment: {
    objectType: 'TX_STOCK_PLAN_POOL_ADJUSTMENT',
    templateId: Fairmint.OpenCapTable.OCF.StockPlanPoolAdjustment.StockPlanPoolAdjustment.templateId,
    dataField: 'adjustment_data',
    capTableField: 'stock_plan_pool_adjustments',
    operations: mutableEntityOperations('StockPlanPoolAdjustment'),
  },
  stockPlanReturnToPool: {
    objectType: 'TX_STOCK_PLAN_RETURN_TO_POOL',
    templateId: Fairmint.OpenCapTable.OCF.StockPlanReturnToPool.StockPlanReturnToPool.templateId,
    dataField: 'return_data',
    capTableField: 'stock_plan_return_to_pools',
    operations: mutableEntityOperations('StockPlanReturnToPool'),
  },
  stockReissuance: {
    objectType: 'TX_STOCK_REISSUANCE',
    templateId: Fairmint.OpenCapTable.OCF.StockReissuance.StockReissuance.templateId,
    dataField: 'reissuance_data',
    capTableField: 'stock_reissuances',
    operations: mutableEntityOperations('StockReissuance'),
  },
  stockRepurchase: {
    objectType: 'TX_STOCK_REPURCHASE',
    templateId: Fairmint.OpenCapTable.OCF.StockRepurchase.StockRepurchase.templateId,
    dataField: 'repurchase_data',
    capTableField: 'stock_repurchases',
    operations: mutableEntityOperations('StockRepurchase'),
  },
  stockRetraction: {
    objectType: 'TX_STOCK_RETRACTION',
    templateId: Fairmint.OpenCapTable.OCF.StockRetraction.StockRetraction.templateId,
    dataField: 'retraction_data',
    capTableField: 'stock_retractions',
    operations: mutableEntityOperations('StockRetraction'),
  },
  stockTransfer: {
    objectType: 'TX_STOCK_TRANSFER',
    templateId: Fairmint.OpenCapTable.OCF.StockTransfer.StockTransfer.templateId,
    dataField: 'transfer_data',
    capTableField: 'stock_transfers',
    operations: mutableEntityOperations('StockTransfer'),
  },
  valuation: {
    objectType: 'VALUATION',
    templateId: Fairmint.OpenCapTable.OCF.Valuation.Valuation.templateId,
    dataField: 'valuation_data',
    capTableField: 'valuations',
    operations: mutableEntityOperations('Valuation'),
  },
  vestingAcceleration: {
    objectType: 'TX_VESTING_ACCELERATION',
    templateId: Fairmint.OpenCapTable.OCF.VestingAcceleration.VestingAcceleration.templateId,
    dataField: 'acceleration_data',
    dataFieldFallbacks: ['vesting_acceleration_data'],
    capTableField: 'vesting_accelerations',
    operations: mutableEntityOperations('VestingAcceleration'),
  },
  vestingEvent: {
    objectType: 'TX_VESTING_EVENT',
    templateId: Fairmint.OpenCapTable.OCF.VestingEvent.VestingEvent.templateId,
    dataField: 'vesting_data',
    dataFieldFallbacks: ['vesting_event_data'],
    capTableField: 'vesting_events',
    operations: mutableEntityOperations('VestingEvent'),
  },
  vestingStart: {
    objectType: 'TX_VESTING_START',
    templateId: Fairmint.OpenCapTable.OCF.VestingStart.VestingStart.templateId,
    dataField: 'vesting_data',
    dataFieldFallbacks: ['vesting_start_data'],
    capTableField: 'vesting_starts',
    operations: mutableEntityOperations('VestingStart'),
  },
  vestingTerms: {
    objectType: 'VESTING_TERMS',
    templateId: Fairmint.OpenCapTable.OCF.VestingTerms.VestingTerms.templateId,
    dataField: 'vesting_terms_data',
    capTableField: 'vesting_terms',
    operations: mutableEntityOperations('VestingTerms'),
  },
  warrantAcceptance: {
    objectType: 'TX_WARRANT_ACCEPTANCE',
    templateId: Fairmint.OpenCapTable.OCF.WarrantAcceptance.WarrantAcceptance.templateId,
    dataField: 'acceptance_data',
    capTableField: 'warrant_acceptances',
    operations: mutableEntityOperations('WarrantAcceptance'),
  },
  warrantCancellation: {
    objectType: 'TX_WARRANT_CANCELLATION',
    templateId: Fairmint.OpenCapTable.OCF.WarrantCancellation.WarrantCancellation.templateId,
    dataField: 'cancellation_data',
    capTableField: 'warrant_cancellations',
    operations: mutableEntityOperations('WarrantCancellation'),
  },
  warrantExercise: {
    objectType: 'TX_WARRANT_EXERCISE',
    templateId: Fairmint.OpenCapTable.OCF.WarrantExercise.WarrantExercise.templateId,
    dataField: 'exercise_data',
    capTableField: 'warrant_exercises',
    operations: mutableEntityOperations('WarrantExercise'),
  },
  warrantIssuance: {
    objectType: 'TX_WARRANT_ISSUANCE',
    templateId: Fairmint.OpenCapTable.OCF.WarrantIssuance.WarrantIssuance.templateId,
    dataField: 'issuance_data',
    capTableField: 'warrant_issuances',
    securityIdField: 'warrant_issuances_by_security_id',
    operations: mutableEntityOperations('WarrantIssuance'),
  },
  warrantRetraction: {
    objectType: 'TX_WARRANT_RETRACTION',
    templateId: Fairmint.OpenCapTable.OCF.WarrantRetraction.WarrantRetraction.templateId,
    dataField: 'retraction_data',
    capTableField: 'warrant_retractions',
    operations: mutableEntityOperations('WarrantRetraction'),
  },
  warrantTransfer: {
    objectType: 'TX_WARRANT_TRANSFER',
    templateId: Fairmint.OpenCapTable.OCF.WarrantTransfer.WarrantTransfer.templateId,
    dataField: 'transfer_data',
    capTableField: 'warrant_transfers',
    operations: mutableEntityOperations('WarrantTransfer'),
  },
} as const satisfies OcfEntityRegistry;

type EntityTypeWithCapability<Capability extends keyof OcfEntityOperationTags> = {
  [EntityType in OcfEntityType]: (typeof ENTITY_REGISTRY)[EntityType]['operations'] extends Record<Capability, string>
    ? EntityType
    : never;
}[OcfEntityType];

/** Entity kinds that can be created through UpdateCapTable. */
export type OcfCreatableEntityType = EntityTypeWithCapability<'create'>;

/** Entity kinds that can be edited through UpdateCapTable. */
export type OcfEditableEntityType = EntityTypeWithCapability<'edit'>;

/** Entity kinds that can be deleted through UpdateCapTable. */
export type OcfDeletableEntityType = EntityTypeWithCapability<'delete'>;

type OcfOperationTagFor<EntityType extends OcfEntityType, Operation extends keyof OcfEntityOperationTags> =
  (typeof ENTITY_REGISTRY)[EntityType]['operations'] extends Readonly<Record<Operation, infer Tag extends string>>
    ? Tag
    : never;

/** Exact generated DAML create variant for one SDK entity kind. */
export type OcfCreateDataFor<EntityType extends OcfCreatableEntityType> = Extract<
  OcfCreateData,
  { tag: OcfOperationTagFor<EntityType, 'create'> }
>;

/** Exact generated DAML edit variant for one SDK entity kind. */
export type OcfEditDataFor<EntityType extends OcfEditableEntityType> = Extract<
  OcfEditData,
  { tag: OcfOperationTagFor<EntityType, 'edit'> }
>;

/** Exact generated DAML delete variant for one SDK entity kind. */
export type OcfDeleteDataFor<EntityType extends OcfDeletableEntityType> = Extract<
  OcfDeleteData,
  { tag: OcfOperationTagFor<EntityType, 'delete'> }
>;

/** Exact generated DAML entity-data payload decoded for one SDK entity kind. */
export type DamlDataTypeFor<EntityType extends OcfEntityType> = Extract<
  OcfEditData,
  { tag: OcfOperationTagFor<EntityType, 'edit'> }
>['value'];

/** Correlated entity-kind and generated DAML-data tuples accepted by the read dispatcher. */
export type DamlEntityArguments = {
  [EntityType in OcfEntityType]: readonly [type: EntityType, damlData: DamlDataTypeFor<EntityType>];
}[OcfEntityType];
/** Correlated entity-kind and native-data tuples accepted by the converter dispatcher. */
export type OcfEntityArguments = {
  [EntityType in OcfEntityType]: readonly [type: EntityType, data: OcfDataTypeFor<EntityType>];
}[OcfEntityType];

/** Correlated argument tuples accepted by {@link CapTableBatch.create}. */
export type OcfCreateArguments = {
  [EntityType in OcfCreatableEntityType]: readonly [type: EntityType, data: OcfDataTypeFor<EntityType>];
}[OcfCreatableEntityType];

/** Correlated argument tuples accepted by {@link CapTableBatch.edit}. */
export type OcfEditArguments = {
  [EntityType in OcfEditableEntityType]: readonly [type: EntityType, data: OcfDataTypeFor<EntityType>];
}[OcfEditableEntityType];

/** A create operation whose entity kind and payload type are correlated. */
export type OcfCreateOperation<EntityType extends OcfCreatableEntityType = OcfCreatableEntityType> =
  EntityType extends OcfCreatableEntityType
    ? Readonly<{
        type: EntityType;
        data: OcfDataTypeFor<EntityType>;
      }>
    : never;

/** An edit operation whose entity kind and payload type are correlated. */
export type OcfEditOperation<EntityType extends OcfEditableEntityType = OcfEditableEntityType> =
  EntityType extends OcfEditableEntityType
    ? Readonly<{
        type: EntityType;
        data: OcfDataTypeFor<EntityType>;
      }>
    : never;

/** A delete operation limited to entity kinds that support deletion. */
export type OcfDeleteOperation<EntityType extends OcfDeletableEntityType = OcfDeletableEntityType> =
  EntityType extends OcfDeletableEntityType
    ? Readonly<{
        type: EntityType;
        id: string;
      }>
    : never;

/** Operations accepted by {@link buildUpdateCapTableCommand}. */
export interface CapTableBatchOperations {
  readonly creates?: readonly OcfCreateOperation[];
  readonly edits?: readonly OcfEditOperation[];
  readonly deletes?: readonly OcfDeleteOperation[];
}

/** Runtime guard for SDK entity kinds. */
export function isOcfEntityType(entityType: string): entityType is OcfEntityType {
  return Object.prototype.hasOwnProperty.call(ENTITY_REGISTRY, entityType);
}

/** Runtime guard for entity kinds that support create operations. */
export function isOcfCreatableEntityType(entityType: string): entityType is OcfCreatableEntityType {
  if (!isOcfEntityType(entityType)) return false;
  const entry: OcfEntityRegistryEntry = ENTITY_REGISTRY[entityType];
  return entry.operations.create !== undefined;
}

/** Runtime guard for entity kinds that support edit operations. */
export function isOcfEditableEntityType(entityType: string): entityType is OcfEditableEntityType {
  if (!isOcfEntityType(entityType)) return false;
  const entry: OcfEntityRegistryEntry = ENTITY_REGISTRY[entityType];
  return entry.operations.edit !== undefined;
}

/** Runtime guard for entity kinds that support delete operations. */
export function isOcfDeletableEntityType(entityType: string): entityType is OcfDeletableEntityType {
  if (!isOcfEntityType(entityType)) return false;
  const entry: OcfEntityRegistryEntry = ENTITY_REGISTRY[entityType];
  return entry.operations.delete !== undefined;
}

/**
 * Canonical OCF `object_type` to SDK entity reader mapping.
 *
 * Schema-supported PlanSecurity aliases normalize to EquityCompensation before reaching this map,
 * so it exposes only canonical ledger object types with first-class read facades.
 */
export const OCF_OBJECT_TYPE_TO_ENTITY_TYPE = {
  CE_STAKEHOLDER_RELATIONSHIP: 'stakeholderRelationshipChangeEvent',
  CE_STAKEHOLDER_STATUS: 'stakeholderStatusChangeEvent',
  DOCUMENT: 'document',
  ISSUER: 'issuer',
  STAKEHOLDER: 'stakeholder',
  STOCK_CLASS: 'stockClass',
  STOCK_LEGEND_TEMPLATE: 'stockLegendTemplate',
  STOCK_PLAN: 'stockPlan',
  TX_CONVERTIBLE_ACCEPTANCE: 'convertibleAcceptance',
  TX_CONVERTIBLE_CANCELLATION: 'convertibleCancellation',
  TX_CONVERTIBLE_CONVERSION: 'convertibleConversion',
  TX_CONVERTIBLE_ISSUANCE: 'convertibleIssuance',
  TX_CONVERTIBLE_RETRACTION: 'convertibleRetraction',
  TX_CONVERTIBLE_TRANSFER: 'convertibleTransfer',
  TX_EQUITY_COMPENSATION_ACCEPTANCE: 'equityCompensationAcceptance',
  TX_EQUITY_COMPENSATION_CANCELLATION: 'equityCompensationCancellation',
  TX_EQUITY_COMPENSATION_EXERCISE: 'equityCompensationExercise',
  TX_EQUITY_COMPENSATION_ISSUANCE: 'equityCompensationIssuance',
  TX_EQUITY_COMPENSATION_RELEASE: 'equityCompensationRelease',
  TX_EQUITY_COMPENSATION_REPRICING: 'equityCompensationRepricing',
  TX_EQUITY_COMPENSATION_RETRACTION: 'equityCompensationRetraction',
  TX_EQUITY_COMPENSATION_TRANSFER: 'equityCompensationTransfer',
  TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT: 'issuerAuthorizedSharesAdjustment',
  TX_STOCK_ACCEPTANCE: 'stockAcceptance',
  TX_STOCK_CANCELLATION: 'stockCancellation',
  TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT: 'stockClassAuthorizedSharesAdjustment',
  TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT: 'stockClassConversionRatioAdjustment',
  TX_STOCK_CLASS_SPLIT: 'stockClassSplit',
  TX_STOCK_CONSOLIDATION: 'stockConsolidation',
  TX_STOCK_CONVERSION: 'stockConversion',
  TX_STOCK_ISSUANCE: 'stockIssuance',
  TX_STOCK_PLAN_POOL_ADJUSTMENT: 'stockPlanPoolAdjustment',
  TX_STOCK_PLAN_RETURN_TO_POOL: 'stockPlanReturnToPool',
  TX_STOCK_REISSUANCE: 'stockReissuance',
  TX_STOCK_REPURCHASE: 'stockRepurchase',
  TX_STOCK_RETRACTION: 'stockRetraction',
  TX_STOCK_TRANSFER: 'stockTransfer',
  TX_VESTING_ACCELERATION: 'vestingAcceleration',
  TX_VESTING_EVENT: 'vestingEvent',
  TX_VESTING_START: 'vestingStart',
  TX_WARRANT_ACCEPTANCE: 'warrantAcceptance',
  TX_WARRANT_CANCELLATION: 'warrantCancellation',
  TX_WARRANT_EXERCISE: 'warrantExercise',
  TX_WARRANT_ISSUANCE: 'warrantIssuance',
  TX_WARRANT_RETRACTION: 'warrantRetraction',
  TX_WARRANT_TRANSFER: 'warrantTransfer',
  VALUATION: 'valuation',
  VESTING_TERMS: 'vestingTerms',
} as const satisfies Record<string, OcfEntityType>;

/** OCF object types that can be read through OpenCapTable entity readers. */
export type OcfReadableObjectType = keyof typeof OCF_OBJECT_TYPE_TO_ENTITY_TYPE;

/** SDK entity reader name for a given OCF object type. */
export type OcfEntityTypeForObjectType<T extends OcfReadableObjectType> = (typeof OCF_OBJECT_TYPE_TO_ENTITY_TYPE)[T];

/** Canonical entity data returned for a readable OCF object type. */
export type OcfReadableDataForObjectType<T extends OcfReadableObjectType> = OcfDataTypeFor<
  OcfEntityTypeForObjectType<T>
>;

export function mapOcfObjectTypeToEntityType<T extends OcfReadableObjectType>(
  objectType: T
): OcfEntityTypeForObjectType<T>;
export function mapOcfObjectTypeToEntityType(objectType: string): OcfEntityType | null;
export function mapOcfObjectTypeToEntityType(objectType: string): OcfEntityType | null {
  return isOcfReadableObjectType(objectType) ? OCF_OBJECT_TYPE_TO_ENTITY_TYPE[objectType] : null;
}

/** Runtime guard for OCF object types supported by OpenCapTable readers. */
export function isOcfReadableObjectType(objectType: string): objectType is OcfReadableObjectType {
  return Object.prototype.hasOwnProperty.call(OCF_OBJECT_TYPE_TO_ENTITY_TYPE, objectType);
}

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

function partialMapFromRegistry<TValue>(
  selector: (entry: OcfEntityRegistryEntry, entityType: OcfEntityType) => TValue | undefined
): Partial<Record<OcfEntityType, TValue>> {
  return Object.fromEntries(
    entityRegistryEntries()
      .map(([entityType, entry]) => [entityType, selector(entry, entityType)] as const)
      .filter((entry): entry is readonly [OcfEntityType, TValue] => entry[1] !== undefined)
  );
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

/** Alternate DAML field names used when the canonical field is missing. */
export const ENTITY_DATA_FIELD_FALLBACK_MAP = partialMapFromRegistry((entry) => entry.dataFieldFallbacks);

/** Mapping from CapTable contract field names to OCF entity types. */
export const FIELD_TO_ENTITY_TYPE = Object.fromEntries(
  entityRegistryEntries()
    .filter((entry): entry is [OcfEntityType, OcfEntityRegistryEntry & { capTableField: string }] => {
      const [, metadata] = entry;
      return metadata.capTableField !== undefined;
    })
    .map(([entityType, metadata]) => [metadata.capTableField, entityType])
);

/** Mapping from CapTable `*_by_security_id` fields to issuance entity types. */
export const SECURITY_ID_FIELD_TO_ENTITY_TYPE = Object.fromEntries(
  entityRegistryEntries()
    .filter((entry): entry is [OcfEntityType, OcfEntityRegistryEntry & { securityIdField: string }] => {
      const [, metadata] = entry;
      return metadata.securityIdField !== undefined;
    })
    .map(([entityType, metadata]) => [metadata.securityIdField, entityType])
);

/**
 * Mapping from entity type to DAML tag names.
 *
 * Every tag is constrained to the generated DAML union for the registry key.
 */
export const ENTITY_TAG_MAP = mapRegistryValues((entry) => entry.operations) as {
  readonly [EntityType in OcfEntityType]: (typeof ENTITY_REGISTRY)[EntityType]['operations'];
};
