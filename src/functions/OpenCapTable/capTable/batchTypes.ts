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
  OcfIssuerAuthorizedSharesAdjustment,
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

/** All supported OCF entity types for batch operations. Maps to the OcfCreateData/OcfEditData/OcfDeleteData union tags. */
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
  | 'issuerAuthorizedSharesAdjustment'
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

/** Type mapping from entity type string to native OCF data type. */
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
}

/** Helper type to get the native OCF data type for a given entity type. */
export type OcfDataTypeFor<T extends OcfEntityType> = OcfEntityDataMap[T];

/** Mapping from entity type to DAML tag names. */
export const ENTITY_TAG_MAP: Record<OcfEntityType, { create: string; edit: string; delete: string }> = {
  convertibleAcceptance: {
    create: 'OcfCreateConvertibleAcceptance',
    edit: 'OcfEditConvertibleAcceptance',
    delete: 'OcfDeleteConvertibleAcceptance',
  },
  convertibleCancellation: {
    create: 'OcfCreateConvertibleCancellation',
    edit: 'OcfEditConvertibleCancellation',
    delete: 'OcfDeleteConvertibleCancellation',
  },
  convertibleConversion: {
    create: 'OcfCreateConvertibleConversion',
    edit: 'OcfEditConvertibleConversion',
    delete: 'OcfDeleteConvertibleConversion',
  },
  convertibleIssuance: {
    create: 'OcfCreateConvertibleIssuance',
    edit: 'OcfEditConvertibleIssuance',
    delete: 'OcfDeleteConvertibleIssuance',
  },
  convertibleRetraction: {
    create: 'OcfCreateConvertibleRetraction',
    edit: 'OcfEditConvertibleRetraction',
    delete: 'OcfDeleteConvertibleRetraction',
  },
  convertibleTransfer: {
    create: 'OcfCreateConvertibleTransfer',
    edit: 'OcfEditConvertibleTransfer',
    delete: 'OcfDeleteConvertibleTransfer',
  },
  document: {
    create: 'OcfCreateDocument',
    edit: 'OcfEditDocument',
    delete: 'OcfDeleteDocument',
  },
  equityCompensationAcceptance: {
    create: 'OcfCreateEquityCompensationAcceptance',
    edit: 'OcfEditEquityCompensationAcceptance',
    delete: 'OcfDeleteEquityCompensationAcceptance',
  },
  equityCompensationCancellation: {
    create: 'OcfCreateEquityCompensationCancellation',
    edit: 'OcfEditEquityCompensationCancellation',
    delete: 'OcfDeleteEquityCompensationCancellation',
  },
  equityCompensationExercise: {
    create: 'OcfCreateEquityCompensationExercise',
    edit: 'OcfEditEquityCompensationExercise',
    delete: 'OcfDeleteEquityCompensationExercise',
  },
  equityCompensationIssuance: {
    create: 'OcfCreateEquityCompensationIssuance',
    edit: 'OcfEditEquityCompensationIssuance',
    delete: 'OcfDeleteEquityCompensationIssuance',
  },
  equityCompensationRelease: {
    create: 'OcfCreateEquityCompensationRelease',
    edit: 'OcfEditEquityCompensationRelease',
    delete: 'OcfDeleteEquityCompensationRelease',
  },
  equityCompensationRepricing: {
    create: 'OcfCreateEquityCompensationRepricing',
    edit: 'OcfEditEquityCompensationRepricing',
    delete: 'OcfDeleteEquityCompensationRepricing',
  },
  equityCompensationRetraction: {
    create: 'OcfCreateEquityCompensationRetraction',
    edit: 'OcfEditEquityCompensationRetraction',
    delete: 'OcfDeleteEquityCompensationRetraction',
  },
  equityCompensationTransfer: {
    create: 'OcfCreateEquityCompensationTransfer',
    edit: 'OcfEditEquityCompensationTransfer',
    delete: 'OcfDeleteEquityCompensationTransfer',
  },
  issuerAuthorizedSharesAdjustment: {
    create: 'OcfCreateIssuerAuthorizedSharesAdjustment',
    edit: 'OcfEditIssuerAuthorizedSharesAdjustment',
    delete: 'OcfDeleteIssuerAuthorizedSharesAdjustment',
  },
  stakeholder: {
    create: 'OcfCreateStakeholder',
    edit: 'OcfEditStakeholder',
    delete: 'OcfDeleteStakeholder',
  },
  stakeholderRelationshipChangeEvent: {
    create: 'OcfCreateStakeholderRelationshipChangeEvent',
    edit: 'OcfEditStakeholderRelationshipChangeEvent',
    delete: 'OcfDeleteStakeholderRelationshipChangeEvent',
  },
  stakeholderStatusChangeEvent: {
    create: 'OcfCreateStakeholderStatusChangeEvent',
    edit: 'OcfEditStakeholderStatusChangeEvent',
    delete: 'OcfDeleteStakeholderStatusChangeEvent',
  },
  stockAcceptance: {
    create: 'OcfCreateStockAcceptance',
    edit: 'OcfEditStockAcceptance',
    delete: 'OcfDeleteStockAcceptance',
  },
  stockCancellation: {
    create: 'OcfCreateStockCancellation',
    edit: 'OcfEditStockCancellation',
    delete: 'OcfDeleteStockCancellation',
  },
  stockClass: {
    create: 'OcfCreateStockClass',
    edit: 'OcfEditStockClass',
    delete: 'OcfDeleteStockClass',
  },
  stockClassAuthorizedSharesAdjustment: {
    create: 'OcfCreateStockClassAuthorizedSharesAdjustment',
    edit: 'OcfEditStockClassAuthorizedSharesAdjustment',
    delete: 'OcfDeleteStockClassAuthorizedSharesAdjustment',
  },
  stockClassConversionRatioAdjustment: {
    create: 'OcfCreateStockClassConversionRatioAdjustment',
    edit: 'OcfEditStockClassConversionRatioAdjustment',
    delete: 'OcfDeleteStockClassConversionRatioAdjustment',
  },
  stockClassSplit: {
    create: 'OcfCreateStockClassSplit',
    edit: 'OcfEditStockClassSplit',
    delete: 'OcfDeleteStockClassSplit',
  },
  stockConsolidation: {
    create: 'OcfCreateStockConsolidation',
    edit: 'OcfEditStockConsolidation',
    delete: 'OcfDeleteStockConsolidation',
  },
  stockConversion: {
    create: 'OcfCreateStockConversion',
    edit: 'OcfEditStockConversion',
    delete: 'OcfDeleteStockConversion',
  },
  stockIssuance: {
    create: 'OcfCreateStockIssuance',
    edit: 'OcfEditStockIssuance',
    delete: 'OcfDeleteStockIssuance',
  },
  stockLegendTemplate: {
    create: 'OcfCreateStockLegendTemplate',
    edit: 'OcfEditStockLegendTemplate',
    delete: 'OcfDeleteStockLegendTemplate',
  },
  stockPlan: {
    create: 'OcfCreateStockPlan',
    edit: 'OcfEditStockPlan',
    delete: 'OcfDeleteStockPlan',
  },
  stockPlanPoolAdjustment: {
    create: 'OcfCreateStockPlanPoolAdjustment',
    edit: 'OcfEditStockPlanPoolAdjustment',
    delete: 'OcfDeleteStockPlanPoolAdjustment',
  },
  stockPlanReturnToPool: {
    create: 'OcfCreateStockPlanReturnToPool',
    edit: 'OcfEditStockPlanReturnToPool',
    delete: 'OcfDeleteStockPlanReturnToPool',
  },
  stockReissuance: {
    create: 'OcfCreateStockReissuance',
    edit: 'OcfEditStockReissuance',
    delete: 'OcfDeleteStockReissuance',
  },
  stockRepurchase: {
    create: 'OcfCreateStockRepurchase',
    edit: 'OcfEditStockRepurchase',
    delete: 'OcfDeleteStockRepurchase',
  },
  stockRetraction: {
    create: 'OcfCreateStockRetraction',
    edit: 'OcfEditStockRetraction',
    delete: 'OcfDeleteStockRetraction',
  },
  stockTransfer: {
    create: 'OcfCreateStockTransfer',
    edit: 'OcfEditStockTransfer',
    delete: 'OcfDeleteStockTransfer',
  },
  valuation: {
    create: 'OcfCreateValuation',
    edit: 'OcfEditValuation',
    delete: 'OcfDeleteValuation',
  },
  vestingAcceleration: {
    create: 'OcfCreateVestingAcceleration',
    edit: 'OcfEditVestingAcceleration',
    delete: 'OcfDeleteVestingAcceleration',
  },
  vestingEvent: {
    create: 'OcfCreateVestingEvent',
    edit: 'OcfEditVestingEvent',
    delete: 'OcfDeleteVestingEvent',
  },
  vestingStart: {
    create: 'OcfCreateVestingStart',
    edit: 'OcfEditVestingStart',
    delete: 'OcfDeleteVestingStart',
  },
  vestingTerms: {
    create: 'OcfCreateVestingTerms',
    edit: 'OcfEditVestingTerms',
    delete: 'OcfDeleteVestingTerms',
  },
  warrantAcceptance: {
    create: 'OcfCreateWarrantAcceptance',
    edit: 'OcfEditWarrantAcceptance',
    delete: 'OcfDeleteWarrantAcceptance',
  },
  warrantCancellation: {
    create: 'OcfCreateWarrantCancellation',
    edit: 'OcfEditWarrantCancellation',
    delete: 'OcfDeleteWarrantCancellation',
  },
  warrantExercise: {
    create: 'OcfCreateWarrantExercise',
    edit: 'OcfEditWarrantExercise',
    delete: 'OcfDeleteWarrantExercise',
  },
  warrantIssuance: {
    create: 'OcfCreateWarrantIssuance',
    edit: 'OcfEditWarrantIssuance',
    delete: 'OcfDeleteWarrantIssuance',
  },
  warrantRetraction: {
    create: 'OcfCreateWarrantRetraction',
    edit: 'OcfEditWarrantRetraction',
    delete: 'OcfDeleteWarrantRetraction',
  },
  warrantTransfer: {
    create: 'OcfCreateWarrantTransfer',
    edit: 'OcfEditWarrantTransfer',
    delete: 'OcfDeleteWarrantTransfer',
  },
};
