/**
 * Public, protocol-native entity types.
 *
 * This module deliberately depends only on the SDK's canonical OCF model. The
 * generated DAML codecs are an implementation detail and must not become part
 * of the package's root declaration graph.
 */

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
  OcfFinancing,
  OcfIssuer,
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
  OcfStockHold,
  OcfStockHoldCancellation,
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
} from '../../../types/native';

/** Canonical native OCF data for every entity handled by the SDK. */
// A closed alias prevents module augmentation from widening the supported kinds.
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
  financing: OcfFinancing;
  /** Issuer is edit-only; it is created with the CapTable. */
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
  /** Fairmint OCF extension: written by the register's hold choices, read-only for the SDK. */
  stockHold: OcfStockHold;
  /** Fairmint OCF extension: written by the register's hold choices, read-only for the SDK. */
  stockHoldCancellation: OcfStockHoldCancellation;
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

/** All canonical entity kinds supported by the SDK's converters and readers. */
export type OcfEntityType = keyof OcfEntityDataMap;

/** Canonical OCF data for one entity kind. */
export type OcfDataTypeFor<T extends OcfEntityType> = OcfEntityDataMap[T];

/**
 * Entity kinds only the register's own choices write (the Fairmint OCF extension's hold pair, always under derived
 * IDs). The SDK reads them and never creates, edits or deletes them.
 */
export const OCF_LEDGER_WRITTEN_ENTITY_TYPES = ['stockHold', 'stockHoldCancellation'] as const;

/** Entity kinds the register writes itself: readable, never creatable, editable or deletable through the SDK. */
export type OcfLedgerWrittenEntityType = (typeof OCF_LEDGER_WRITTEN_ENTITY_TYPES)[number];

/** Entity kinds the SDK creates as records of an existing cap table (the issuer is created with the cap table). */
export type OcfCreatableEntityType = Exclude<OcfEntityType, 'issuer' | OcfLedgerWrittenEntityType>;

/** Every canonical entity the SDK writes can be edited; the register's own hold records cannot. */
export type OcfEditableEntityType = Exclude<OcfEntityType, OcfLedgerWrittenEntityType>;

/** Entity kinds that can be deleted (neither the issuer nor the register's own hold records). */
export type OcfDeletableEntityType = Exclude<OcfEntityType, 'issuer' | OcfLedgerWrittenEntityType>;

/** Canonical OCF `object_type` to typed reader namespace. */
export const OCF_OBJECT_TYPE_TO_ENTITY_TYPE = Object.freeze({
  CE_STAKEHOLDER_RELATIONSHIP: 'stakeholderRelationshipChangeEvent',
  CE_STAKEHOLDER_STATUS: 'stakeholderStatusChangeEvent',
  DOCUMENT: 'document',
  FINANCING: 'financing',
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
  TX_STOCK_HOLD: 'stockHold',
  TX_STOCK_HOLD_CANCELLATION: 'stockHoldCancellation',
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
} as const satisfies Record<string, OcfEntityType>);

type MappedOcfEntityType = (typeof OCF_OBJECT_TYPE_TO_ENTITY_TYPE)[keyof typeof OCF_OBJECT_TYPE_TO_ENTITY_TYPE];
const ALL_OCF_ENTITY_TYPES_ARE_MAPPED: [OcfEntityType] extends [MappedOcfEntityType] ? true : never = true;
void ALL_OCF_ENTITY_TYPES_ARE_MAPPED;

/** OCF object types supported by the high-level entity readers. */
export type OcfReadableObjectType = keyof typeof OCF_OBJECT_TYPE_TO_ENTITY_TYPE;

/** Reader namespace for one canonical OCF object type. */
export type OcfEntityTypeForObjectType<T extends OcfReadableObjectType> = (typeof OCF_OBJECT_TYPE_TO_ENTITY_TYPE)[T];

/** Canonical data returned by one object-type reader. */
export type OcfReadableDataForObjectType<T extends OcfReadableObjectType> = OcfDataTypeFor<
  OcfEntityTypeForObjectType<T>
>;

const OCF_ENTITY_TYPES: ReadonlySet<string> = new Set(Object.values(OCF_OBJECT_TYPE_TO_ENTITY_TYPE));

/** Runtime guard for canonical SDK entity kinds. */
export function isOcfEntityType(entityType: string): entityType is OcfEntityType {
  return OCF_ENTITY_TYPES.has(entityType);
}

/** Runtime guard for the entity kinds only the register writes (the hold pair). */
export function isOcfLedgerWrittenEntityType(entityType: string): entityType is OcfLedgerWrittenEntityType {
  return (OCF_LEDGER_WRITTEN_ENTITY_TYPES as readonly string[]).includes(entityType);
}

/** Runtime guard for entity kinds that support creation. */
export function isOcfCreatableEntityType(entityType: string): entityType is OcfCreatableEntityType {
  return entityType !== 'issuer' && isOcfEntityType(entityType) && !isOcfLedgerWrittenEntityType(entityType);
}

/** Runtime guard for entity kinds that support edits. */
export function isOcfEditableEntityType(entityType: string): entityType is OcfEditableEntityType {
  return isOcfEntityType(entityType) && !isOcfLedgerWrittenEntityType(entityType);
}

/** Runtime guard for entity kinds that support deletion. */
export function isOcfDeletableEntityType(entityType: string): entityType is OcfDeletableEntityType {
  return entityType !== 'issuer' && isOcfEntityType(entityType) && !isOcfLedgerWrittenEntityType(entityType);
}

export function mapOcfObjectTypeToEntityType<T extends OcfReadableObjectType>(
  objectType: T
): OcfEntityTypeForObjectType<T>;
export function mapOcfObjectTypeToEntityType(objectType: string): OcfEntityType | null;
export function mapOcfObjectTypeToEntityType(objectType: string): OcfEntityType | null {
  return isOcfReadableObjectType(objectType) ? OCF_OBJECT_TYPE_TO_ENTITY_TYPE[objectType] : null;
}

/** Runtime guard for OCF object types supported by high-level readers. */
export function isOcfReadableObjectType(objectType: string): objectType is OcfReadableObjectType {
  return Object.prototype.hasOwnProperty.call(OCF_OBJECT_TYPE_TO_ENTITY_TYPE, objectType);
}
