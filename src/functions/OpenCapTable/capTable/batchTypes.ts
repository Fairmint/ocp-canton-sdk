/**
 * Type definitions for the batch cap table update API.
 *
 * These types provide a type-safe interface for the UpdateCapTable choice, which supports atomic batch creates, edits,
 * and deletes of OCF entities.
 */

import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
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
  OcfPlanSecurityAcceptance,
  OcfPlanSecurityCancellation,
  OcfPlanSecurityExercise,
  OcfPlanSecurityIssuance,
  OcfPlanSecurityRelease,
  OcfPlanSecurityRetraction,
  OcfPlanSecurityTransfer,
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
 * All supported OCF entity types for batch operations.
 * Maps to the OcfCreateData/OcfEditData/OcfDeleteData union tags.
 *
 * Note: `planSecurity*` types are aliases for their `equityCompensation*` equivalents.
 * The SDK accepts both type families and normalizes PlanSecurity to EquityCompensation internally.
 *
 * Note: `issuer` is edit-only (no create/delete). Issuers are created with the CapTable
 * via IssuerAuthorization.CreateCapTable and cannot be deleted.
 */
export type OcfEntityType =
  | 'convertibleAcceptance'
  | 'convertibleCancellation'
  | 'convertibleConversion'
  | 'convertibleIssuance'
  | 'convertibleRetraction'
  | 'convertibleTransfer'
  | 'document'
  | 'equityCompensationAcceptance'
  | 'equityCompensationCancellation'
  | 'equityCompensationExercise'
  | 'equityCompensationIssuance'
  | 'equityCompensationRelease'
  | 'equityCompensationRepricing'
  | 'equityCompensationRetraction'
  | 'equityCompensationTransfer'
  | 'issuer'
  | 'issuerAuthorizedSharesAdjustment'
  // PlanSecurity types are aliases for EquityCompensation types
  | 'planSecurityAcceptance'
  | 'planSecurityCancellation'
  | 'planSecurityExercise'
  | 'planSecurityIssuance'
  | 'planSecurityRelease'
  | 'planSecurityRetraction'
  | 'planSecurityTransfer'
  | 'stakeholder'
  | 'stakeholderRelationshipChangeEvent'
  | 'stakeholderStatusChangeEvent'
  | 'stockAcceptance'
  | 'stockCancellation'
  | 'stockClass'
  | 'stockClassAuthorizedSharesAdjustment'
  | 'stockClassConversionRatioAdjustment'
  | 'stockClassSplit'
  | 'stockConsolidation'
  | 'stockConversion'
  | 'stockIssuance'
  | 'stockLegendTemplate'
  | 'stockPlan'
  | 'stockPlanPoolAdjustment'
  | 'stockPlanReturnToPool'
  | 'stockReissuance'
  | 'stockRepurchase'
  | 'stockRetraction'
  | 'stockTransfer'
  | 'valuation'
  | 'vestingAcceleration'
  | 'vestingEvent'
  | 'vestingStart'
  | 'vestingTerms'
  | 'warrantAcceptance'
  | 'warrantCancellation'
  | 'warrantExercise'
  | 'warrantIssuance'
  | 'warrantRetraction'
  | 'warrantTransfer';

/**
 * Type mapping from entity type string to native OCF data type.
 *
 * Note: PlanSecurity types map to their equivalent OCF PlanSecurity interfaces,
 * which are compatible with the EquityCompensation types they alias.
 */
export interface OcfEntityDataMap {
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
  // PlanSecurity types - these are aliases for EquityCompensation types
  planSecurityAcceptance: OcfPlanSecurityAcceptance;
  planSecurityCancellation: OcfPlanSecurityCancellation;
  planSecurityExercise: OcfPlanSecurityExercise;
  planSecurityIssuance: OcfPlanSecurityIssuance;
  planSecurityRelease: OcfPlanSecurityRelease;
  planSecurityRetraction: OcfPlanSecurityRetraction;
  planSecurityTransfer: OcfPlanSecurityTransfer;
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
}

/** Helper type to get the native OCF data type for a given entity type. */
export type OcfDataTypeFor<T extends OcfEntityType> = OcfEntityDataMap[T];

/** Shared registry entry for all OCF entity metadata used by batch, read, schema, and state code. */
export interface OcfEntityRegistryEntry {
  /** Canonical OCF object_type accepted by schema validation. */
  objectType: string;
  /** Field containing entity data in DAML contract create arguments. */
  dataField: string;
  /** Alternate create-argument fields accepted for older template payloads. */
  dataFieldFallbacks?: readonly string[];
  /** CapTable map field that stores object-id to contract-id entries. */
  capTableField?: string;
  /** CapTable map field that stores security-id uniqueness entries. */
  securityIdField?: string;
  /** DAML union suffix used to derive `OcfCreateX`, `OcfEditX`, and `OcfDeleteX` tags. */
  batchName: string;
  /** False for edit-only entities such as issuer. */
  supportsCreate?: boolean;
  /** False for non-deletable entities such as issuer. */
  supportsDelete?: boolean;
}

/**
 * Single source of truth for entity-level metadata.
 *
 * PlanSecurity entries intentionally use EquityCompensation object types and batch tags because the SDK normalizes
 * those aliases before writing to Canton.
 */
export const ENTITY_REGISTRY = {
  convertibleAcceptance: {
    objectType: 'TX_CONVERTIBLE_ACCEPTANCE',
    dataField: 'acceptance_data',
    capTableField: 'convertible_acceptances',
    batchName: 'ConvertibleAcceptance',
  },
  convertibleCancellation: {
    objectType: 'TX_CONVERTIBLE_CANCELLATION',
    dataField: 'cancellation_data',
    capTableField: 'convertible_cancellations',
    batchName: 'ConvertibleCancellation',
  },
  convertibleConversion: {
    objectType: 'TX_CONVERTIBLE_CONVERSION',
    dataField: 'conversion_data',
    capTableField: 'convertible_conversions',
    batchName: 'ConvertibleConversion',
  },
  convertibleIssuance: {
    objectType: 'TX_CONVERTIBLE_ISSUANCE',
    dataField: 'issuance_data',
    capTableField: 'convertible_issuances',
    securityIdField: 'convertible_issuances_by_security_id',
    batchName: 'ConvertibleIssuance',
  },
  convertibleRetraction: {
    objectType: 'TX_CONVERTIBLE_RETRACTION',
    dataField: 'retraction_data',
    capTableField: 'convertible_retractions',
    batchName: 'ConvertibleRetraction',
  },
  convertibleTransfer: {
    objectType: 'TX_CONVERTIBLE_TRANSFER',
    dataField: 'transfer_data',
    capTableField: 'convertible_transfers',
    batchName: 'ConvertibleTransfer',
  },
  document: {
    objectType: 'DOCUMENT',
    dataField: 'document_data',
    capTableField: 'documents',
    batchName: 'Document',
  },
  equityCompensationAcceptance: {
    objectType: 'TX_EQUITY_COMPENSATION_ACCEPTANCE',
    dataField: 'acceptance_data',
    capTableField: 'equity_compensation_acceptances',
    batchName: 'EquityCompensationAcceptance',
  },
  equityCompensationCancellation: {
    objectType: 'TX_EQUITY_COMPENSATION_CANCELLATION',
    dataField: 'cancellation_data',
    capTableField: 'equity_compensation_cancellations',
    batchName: 'EquityCompensationCancellation',
  },
  equityCompensationExercise: {
    objectType: 'TX_EQUITY_COMPENSATION_EXERCISE',
    dataField: 'exercise_data',
    capTableField: 'equity_compensation_exercises',
    batchName: 'EquityCompensationExercise',
  },
  equityCompensationIssuance: {
    objectType: 'TX_EQUITY_COMPENSATION_ISSUANCE',
    dataField: 'issuance_data',
    capTableField: 'equity_compensation_issuances',
    securityIdField: 'equity_compensation_issuances_by_security_id',
    batchName: 'EquityCompensationIssuance',
  },
  equityCompensationRelease: {
    objectType: 'TX_EQUITY_COMPENSATION_RELEASE',
    dataField: 'release_data',
    capTableField: 'equity_compensation_releases',
    batchName: 'EquityCompensationRelease',
  },
  equityCompensationRepricing: {
    objectType: 'TX_EQUITY_COMPENSATION_REPRICING',
    dataField: 'repricing_data',
    capTableField: 'equity_compensation_repricings',
    batchName: 'EquityCompensationRepricing',
  },
  equityCompensationRetraction: {
    objectType: 'TX_EQUITY_COMPENSATION_RETRACTION',
    dataField: 'retraction_data',
    capTableField: 'equity_compensation_retractions',
    batchName: 'EquityCompensationRetraction',
  },
  equityCompensationTransfer: {
    objectType: 'TX_EQUITY_COMPENSATION_TRANSFER',
    dataField: 'transfer_data',
    capTableField: 'equity_compensation_transfers',
    batchName: 'EquityCompensationTransfer',
  },
  issuer: {
    objectType: 'ISSUER',
    dataField: 'issuer_data',
    batchName: 'Issuer',
    supportsCreate: false,
    supportsDelete: false,
  },
  issuerAuthorizedSharesAdjustment: {
    objectType: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
    dataField: 'adjustment_data',
    capTableField: 'issuer_authorized_shares_adjustments',
    batchName: 'IssuerAuthorizedSharesAdjustment',
  },
  planSecurityAcceptance: {
    objectType: 'TX_EQUITY_COMPENSATION_ACCEPTANCE',
    dataField: 'acceptance_data',
    batchName: 'EquityCompensationAcceptance',
  },
  planSecurityCancellation: {
    objectType: 'TX_EQUITY_COMPENSATION_CANCELLATION',
    dataField: 'cancellation_data',
    batchName: 'EquityCompensationCancellation',
  },
  planSecurityExercise: {
    objectType: 'TX_EQUITY_COMPENSATION_EXERCISE',
    dataField: 'exercise_data',
    batchName: 'EquityCompensationExercise',
  },
  planSecurityIssuance: {
    objectType: 'TX_EQUITY_COMPENSATION_ISSUANCE',
    dataField: 'issuance_data',
    batchName: 'EquityCompensationIssuance',
  },
  planSecurityRelease: {
    objectType: 'TX_EQUITY_COMPENSATION_RELEASE',
    dataField: 'release_data',
    batchName: 'EquityCompensationRelease',
  },
  planSecurityRetraction: {
    objectType: 'TX_EQUITY_COMPENSATION_RETRACTION',
    dataField: 'retraction_data',
    batchName: 'EquityCompensationRetraction',
  },
  planSecurityTransfer: {
    objectType: 'TX_EQUITY_COMPENSATION_TRANSFER',
    dataField: 'transfer_data',
    batchName: 'EquityCompensationTransfer',
  },
  stakeholder: {
    objectType: 'STAKEHOLDER',
    dataField: 'stakeholder_data',
    capTableField: 'stakeholders',
    batchName: 'Stakeholder',
  },
  stakeholderRelationshipChangeEvent: {
    objectType: 'CE_STAKEHOLDER_RELATIONSHIP',
    dataField: 'relationship_change_data',
    dataFieldFallbacks: ['event_data'],
    capTableField: 'stakeholder_relationship_change_events',
    batchName: 'StakeholderRelationshipChangeEvent',
  },
  stakeholderStatusChangeEvent: {
    objectType: 'CE_STAKEHOLDER_STATUS',
    dataField: 'status_change_data',
    dataFieldFallbacks: ['event_data'],
    capTableField: 'stakeholder_status_change_events',
    batchName: 'StakeholderStatusChangeEvent',
  },
  stockAcceptance: {
    objectType: 'TX_STOCK_ACCEPTANCE',
    dataField: 'acceptance_data',
    capTableField: 'stock_acceptances',
    batchName: 'StockAcceptance',
  },
  stockCancellation: {
    objectType: 'TX_STOCK_CANCELLATION',
    dataField: 'cancellation_data',
    capTableField: 'stock_cancellations',
    batchName: 'StockCancellation',
  },
  stockClass: {
    objectType: 'STOCK_CLASS',
    dataField: 'stock_class_data',
    capTableField: 'stock_classes',
    batchName: 'StockClass',
  },
  stockClassAuthorizedSharesAdjustment: {
    objectType: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
    dataField: 'adjustment_data',
    capTableField: 'stock_class_authorized_shares_adjustments',
    batchName: 'StockClassAuthorizedSharesAdjustment',
  },
  stockClassConversionRatioAdjustment: {
    objectType: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
    dataField: 'adjustment_data',
    capTableField: 'stock_class_conversion_ratio_adjustments',
    batchName: 'StockClassConversionRatioAdjustment',
  },
  stockClassSplit: {
    objectType: 'TX_STOCK_CLASS_SPLIT',
    dataField: 'split_data',
    capTableField: 'stock_class_splits',
    batchName: 'StockClassSplit',
  },
  stockConsolidation: {
    objectType: 'TX_STOCK_CONSOLIDATION',
    dataField: 'consolidation_data',
    capTableField: 'stock_consolidations',
    batchName: 'StockConsolidation',
  },
  stockConversion: {
    objectType: 'TX_STOCK_CONVERSION',
    dataField: 'conversion_data',
    capTableField: 'stock_conversions',
    batchName: 'StockConversion',
  },
  stockIssuance: {
    objectType: 'TX_STOCK_ISSUANCE',
    dataField: 'issuance_data',
    capTableField: 'stock_issuances',
    securityIdField: 'stock_issuances_by_security_id',
    batchName: 'StockIssuance',
  },
  stockLegendTemplate: {
    objectType: 'STOCK_LEGEND_TEMPLATE',
    dataField: 'template_data',
    capTableField: 'stock_legend_templates',
    batchName: 'StockLegendTemplate',
  },
  stockPlan: {
    objectType: 'STOCK_PLAN',
    dataField: 'stock_plan_data',
    capTableField: 'stock_plans',
    batchName: 'StockPlan',
  },
  stockPlanPoolAdjustment: {
    objectType: 'TX_STOCK_PLAN_POOL_ADJUSTMENT',
    dataField: 'adjustment_data',
    capTableField: 'stock_plan_pool_adjustments',
    batchName: 'StockPlanPoolAdjustment',
  },
  stockPlanReturnToPool: {
    objectType: 'TX_STOCK_PLAN_RETURN_TO_POOL',
    dataField: 'return_data',
    capTableField: 'stock_plan_return_to_pools',
    batchName: 'StockPlanReturnToPool',
  },
  stockReissuance: {
    objectType: 'TX_STOCK_REISSUANCE',
    dataField: 'reissuance_data',
    capTableField: 'stock_reissuances',
    batchName: 'StockReissuance',
  },
  stockRepurchase: {
    objectType: 'TX_STOCK_REPURCHASE',
    dataField: 'repurchase_data',
    capTableField: 'stock_repurchases',
    batchName: 'StockRepurchase',
  },
  stockRetraction: {
    objectType: 'TX_STOCK_RETRACTION',
    dataField: 'retraction_data',
    capTableField: 'stock_retractions',
    batchName: 'StockRetraction',
  },
  stockTransfer: {
    objectType: 'TX_STOCK_TRANSFER',
    dataField: 'transfer_data',
    capTableField: 'stock_transfers',
    batchName: 'StockTransfer',
  },
  valuation: {
    objectType: 'VALUATION',
    dataField: 'valuation_data',
    capTableField: 'valuations',
    batchName: 'Valuation',
  },
  vestingAcceleration: {
    objectType: 'TX_VESTING_ACCELERATION',
    dataField: 'acceleration_data',
    dataFieldFallbacks: ['vesting_acceleration_data'],
    capTableField: 'vesting_accelerations',
    batchName: 'VestingAcceleration',
  },
  vestingEvent: {
    objectType: 'TX_VESTING_EVENT',
    dataField: 'vesting_data',
    dataFieldFallbacks: ['vesting_event_data'],
    capTableField: 'vesting_events',
    batchName: 'VestingEvent',
  },
  vestingStart: {
    objectType: 'TX_VESTING_START',
    dataField: 'vesting_data',
    dataFieldFallbacks: ['vesting_start_data'],
    capTableField: 'vesting_starts',
    batchName: 'VestingStart',
  },
  vestingTerms: {
    objectType: 'VESTING_TERMS',
    dataField: 'vesting_terms_data',
    capTableField: 'vesting_terms',
    batchName: 'VestingTerms',
  },
  warrantAcceptance: {
    objectType: 'TX_WARRANT_ACCEPTANCE',
    dataField: 'acceptance_data',
    capTableField: 'warrant_acceptances',
    batchName: 'WarrantAcceptance',
  },
  warrantCancellation: {
    objectType: 'TX_WARRANT_CANCELLATION',
    dataField: 'cancellation_data',
    capTableField: 'warrant_cancellations',
    batchName: 'WarrantCancellation',
  },
  warrantExercise: {
    objectType: 'TX_WARRANT_EXERCISE',
    dataField: 'exercise_data',
    capTableField: 'warrant_exercises',
    batchName: 'WarrantExercise',
  },
  warrantIssuance: {
    objectType: 'TX_WARRANT_ISSUANCE',
    dataField: 'issuance_data',
    capTableField: 'warrant_issuances',
    securityIdField: 'warrant_issuances_by_security_id',
    batchName: 'WarrantIssuance',
  },
  warrantRetraction: {
    objectType: 'TX_WARRANT_RETRACTION',
    dataField: 'retraction_data',
    capTableField: 'warrant_retractions',
    batchName: 'WarrantRetraction',
  },
  warrantTransfer: {
    objectType: 'TX_WARRANT_TRANSFER',
    dataField: 'transfer_data',
    capTableField: 'warrant_transfers',
    batchName: 'WarrantTransfer',
  },
} as const satisfies Record<OcfEntityType, OcfEntityRegistryEntry>;

/**
 * Canonical OCF `object_type` to SDK entity reader mapping.
 *
 * PlanSecurity aliases intentionally resolve to the EquityCompensation object types in
 * {@link ENTITY_REGISTRY}, so this map exposes the canonical ledger object types that
 * have first-class read facades.
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

/** Mapping from entity type to canonical OCF object_type. */
export const ENTITY_OBJECT_TYPE_MAP = mapRegistryValues((entry) => entry.objectType);

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
 * PlanSecurity entries derive EquityCompensation tags from ENTITY_REGISTRY because the underlying DAML unions are the
 * same.
 */
export const ENTITY_TAG_MAP = mapRegistryValues((entry) => ({
  create: entry.supportsCreate === false ? undefined : `OcfCreate${entry.batchName}`,
  edit: `OcfEdit${entry.batchName}`,
  delete: entry.supportsDelete === false ? undefined : `OcfDelete${entry.batchName}`,
}));
