/**
 * Public, protocol-native entity and batch types.
 *
 * This module deliberately depends only on the SDK's canonical OCF model. The
 * generated DAML codecs are an implementation detail and must not become part
 * of the package's root declaration graph.
 */

import type { DeepReadonly } from '../../../types/common';
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

/** All canonical entity kinds supported by batch operations and readers. */
export type OcfEntityType = keyof OcfEntityDataMap;

/** Canonical OCF data for one entity kind. */
export type OcfDataTypeFor<T extends OcfEntityType> = OcfEntityDataMap[T];

/** Entity kinds whose read results are recursively frozen snapshots. */
export type ImmutableOcfReadEntityType = 'stakeholder';

/** Canonical data returned by a reader, including immutable entity snapshots. */
export type OcfReadDataTypeFor<T extends OcfEntityType> = T extends ImmutableOcfReadEntityType
  ? DeepReadonly<OcfDataTypeFor<T>>
  : OcfDataTypeFor<T>;

/** Entity kinds that can be created through UpdateCapTable. */
export type OcfCreatableEntityType = Exclude<OcfEntityType, 'issuer'>;

/** Every canonical entity can be edited through UpdateCapTable. */
export type OcfEditableEntityType = OcfEntityType;

/** Entity kinds that can be deleted through UpdateCapTable. */
export type OcfDeletableEntityType = Exclude<OcfEntityType, 'issuer'>;

/** Correlated argument tuples accepted by {@link import('./CapTableBatch').CapTableBatch.create}. */
export type OcfCreateArguments = {
  [EntityType in OcfCreatableEntityType]: readonly [type: EntityType, data: OcfDataTypeFor<EntityType>];
}[OcfCreatableEntityType];

/** Correlated argument tuples accepted by {@link import('./CapTableBatch').CapTableBatch.edit}. */
export type OcfEditArguments = {
  [EntityType in OcfEditableEntityType]: readonly [type: EntityType, data: OcfDataTypeFor<EntityType>];
}[OcfEditableEntityType];

/** A create operation whose kind and payload remain correlated. */
export type OcfCreateOperation<EntityType extends OcfCreatableEntityType = OcfCreatableEntityType> =
  EntityType extends OcfCreatableEntityType ? Readonly<{ type: EntityType; data: OcfDataTypeFor<EntityType> }> : never;

/** An edit operation whose kind and payload remain correlated. */
export type OcfEditOperation<EntityType extends OcfEditableEntityType = OcfEditableEntityType> =
  EntityType extends OcfEditableEntityType ? Readonly<{ type: EntityType; data: OcfDataTypeFor<EntityType> }> : never;

/** A delete operation limited to deletable entity kinds. */
export type OcfDeleteOperation<EntityType extends OcfDeletableEntityType = OcfDeletableEntityType> =
  EntityType extends OcfDeletableEntityType ? Readonly<{ type: EntityType; id: string }> : never;

/** Native operations accepted by {@link import('./CapTableBatch').buildUpdateCapTableCommand}. */
export interface CapTableBatchOperations {
  readonly creates?: readonly OcfCreateOperation[];
  readonly edits?: readonly OcfEditOperation[];
  readonly deletes?: readonly OcfDeleteOperation[];
}

/** Contract ID returned for one OCF entity created or edited by a batch. */
export type OcfContractId = {
  [EntityType in OcfEntityType]: Readonly<{
    tag: `Cid${Capitalize<EntityType>}`;
    value: string;
  }>;
}[OcfEntityType];

/** Result of executing a fluent cap-table batch. */
export interface CapTableBatchExecuteResult {
  readonly updatedCapTableCid: string;
  readonly createdCids: readonly OcfContractId[];
  readonly editedCids: readonly OcfContractId[];
  readonly updateId: string;
}

/** Canonical OCF `object_type` to typed reader namespace. */
export const OCF_OBJECT_TYPE_TO_ENTITY_TYPE = Object.freeze({
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
} as const satisfies Record<string, OcfEntityType>);

type MappedOcfEntityType = (typeof OCF_OBJECT_TYPE_TO_ENTITY_TYPE)[keyof typeof OCF_OBJECT_TYPE_TO_ENTITY_TYPE];
const ALL_OCF_ENTITY_TYPES_ARE_MAPPED: [OcfEntityType] extends [MappedOcfEntityType] ? true : never = true;
void ALL_OCF_ENTITY_TYPES_ARE_MAPPED;

type MisalignedOcfObjectType = {
  [ObjectType in keyof typeof OCF_OBJECT_TYPE_TO_ENTITY_TYPE]: OcfEntityDataMap[(typeof OCF_OBJECT_TYPE_TO_ENTITY_TYPE)[ObjectType]]['object_type'] extends ObjectType
    ? ObjectType extends OcfEntityDataMap[(typeof OCF_OBJECT_TYPE_TO_ENTITY_TYPE)[ObjectType]]['object_type']
      ? never
      : ObjectType
    : ObjectType;
}[keyof typeof OCF_OBJECT_TYPE_TO_ENTITY_TYPE];

/** Keep every runtime discriminator mapping correlated with its canonical payload type. */
const ALL_OCF_OBJECT_TYPE_MAPPINGS_ARE_CORRELATED: [MisalignedOcfObjectType] extends [never] ? true : never = true;
void ALL_OCF_OBJECT_TYPE_MAPPINGS_ARE_CORRELATED;

/** OCF object types supported by the high-level entity readers. */
export type OcfReadableObjectType = keyof typeof OCF_OBJECT_TYPE_TO_ENTITY_TYPE;

/** Reader namespace for one canonical OCF object type. */
export type OcfEntityTypeForObjectType<T extends OcfReadableObjectType> = (typeof OCF_OBJECT_TYPE_TO_ENTITY_TYPE)[T];

/** Canonical data returned by one object-type reader. */
export type OcfReadableDataForObjectType<T extends OcfReadableObjectType> = OcfReadDataTypeFor<
  OcfEntityTypeForObjectType<T>
>;

const OCF_ENTITY_TYPES: ReadonlySet<string> = new Set(Object.values(OCF_OBJECT_TYPE_TO_ENTITY_TYPE));

/** Runtime guard for canonical SDK entity kinds. */
export function isOcfEntityType(entityType: string): entityType is OcfEntityType {
  return OCF_ENTITY_TYPES.has(entityType);
}

/** Runtime guard for entity kinds that support creation. */
export function isOcfCreatableEntityType(entityType: string): entityType is OcfCreatableEntityType {
  return entityType !== 'issuer' && isOcfEntityType(entityType);
}

/** Runtime guard for entity kinds that support edits. */
export function isOcfEditableEntityType(entityType: string): entityType is OcfEditableEntityType {
  return isOcfEntityType(entityType);
}

/** Runtime guard for entity kinds that support deletion. */
export function isOcfDeletableEntityType(entityType: string): entityType is OcfDeletableEntityType {
  return entityType !== 'issuer' && isOcfEntityType(entityType);
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
