/**
 * Entity registry and read-side type helpers for the OCF entity kinds.
 *
 * The registry is the single source of truth for per-entity metadata: canonical OCF `object_type`, the generated
 * DAML template identity, and the `OcfRecordData` / `OcfRecordCid` variant tags the register uses for the record. Every
 * v35 OCF template has the shape `{ context, ocf_data }`, so the data field is the one constant {@link OCF_DATA_FIELD}.
 * The generated DAML types stay behind this module; the public entity types live in `./entityTypes`.
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

/** Create-argument field that holds the OCF record data in every v35 OCF template (`{ context, ocf_data }`). */
export const OCF_DATA_FIELD = 'ocf_data';

type DamlOcfRecordData = Fairmint.OpenCapTable.OcfRecords.OcfRecordData;
type DamlOcfRecordCid = Fairmint.OpenCapTable.OcfRecords.OcfRecordCid;

/** Constructor tags of the generated `OcfRecordData` variant, one per OCF record kind. */
export type OcfRecordDataTag = DamlOcfRecordData['tag'];

/** Constructor tags of the generated `OcfRecordCid` variant, one per OCF record kind. */
export type OcfRecordCidTag = DamlOcfRecordCid['tag'];

/** Shared registry entry for all OCF entity metadata used by read, schema, and replication code. */
export interface OcfEntityRegistryEntry {
  /** Canonical OCF object_type accepted by schema validation. */
  objectType: OcfObjectType;
  /** Generated DAML template identity required when reading this entity from the ledger. */
  templateId: string;
  /** `OcfRecordData` constructor that carries this entity's `<Name>OcfData` payload. */
  recordTag: OcfRecordDataTag;
  /** `OcfRecordCid` constructor that carries this entity's contract id. */
  cidTag: OcfRecordCidTag;
}

type OcfEntityRegistry = {
  [EntityType in OcfEntityType]: Omit<OcfEntityRegistryEntry, 'objectType' | 'recordTag' | 'cidTag'> & {
    objectType: OcfEntityDataMap[EntityType]['object_type'];
    recordTag: Extract<OcfRecordDataTag, `OcfRecordData${Capitalize<EntityType>}`>;
    cidTag: Extract<OcfRecordCidTag, `OcfRecordCid${Capitalize<EntityType>}`>;
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
    recordTag: 'OcfRecordDataConvertibleAcceptance',
    cidTag: 'OcfRecordCidConvertibleAcceptance',
  },
  convertibleCancellation: {
    objectType: 'TX_CONVERTIBLE_CANCELLATION',
    templateId: Fairmint.OpenCapTable.OCF.ConvertibleCancellation.ConvertibleCancellation.templateId,
    recordTag: 'OcfRecordDataConvertibleCancellation',
    cidTag: 'OcfRecordCidConvertibleCancellation',
  },
  convertibleConversion: {
    objectType: 'TX_CONVERTIBLE_CONVERSION',
    templateId: Fairmint.OpenCapTable.OCF.ConvertibleConversion.ConvertibleConversion.templateId,
    recordTag: 'OcfRecordDataConvertibleConversion',
    cidTag: 'OcfRecordCidConvertibleConversion',
  },
  convertibleIssuance: {
    objectType: 'TX_CONVERTIBLE_ISSUANCE',
    templateId: Fairmint.OpenCapTable.OCF.ConvertibleIssuance.ConvertibleIssuance.templateId,
    recordTag: 'OcfRecordDataConvertibleIssuance',
    cidTag: 'OcfRecordCidConvertibleIssuance',
  },
  convertibleRetraction: {
    objectType: 'TX_CONVERTIBLE_RETRACTION',
    templateId: Fairmint.OpenCapTable.OCF.ConvertibleRetraction.ConvertibleRetraction.templateId,
    recordTag: 'OcfRecordDataConvertibleRetraction',
    cidTag: 'OcfRecordCidConvertibleRetraction',
  },
  convertibleTransfer: {
    objectType: 'TX_CONVERTIBLE_TRANSFER',
    templateId: Fairmint.OpenCapTable.OCF.ConvertibleTransfer.ConvertibleTransfer.templateId,
    recordTag: 'OcfRecordDataConvertibleTransfer',
    cidTag: 'OcfRecordCidConvertibleTransfer',
  },
  document: {
    objectType: 'DOCUMENT',
    templateId: Fairmint.OpenCapTable.OCF.Document.Document.templateId,
    recordTag: 'OcfRecordDataDocument',
    cidTag: 'OcfRecordCidDocument',
  },
  equityCompensationAcceptance: {
    objectType: 'TX_EQUITY_COMPENSATION_ACCEPTANCE',
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationAcceptance.EquityCompensationAcceptance.templateId,
    recordTag: 'OcfRecordDataEquityCompensationAcceptance',
    cidTag: 'OcfRecordCidEquityCompensationAcceptance',
  },
  equityCompensationCancellation: {
    objectType: 'TX_EQUITY_COMPENSATION_CANCELLATION',
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationCancellation.EquityCompensationCancellation.templateId,
    recordTag: 'OcfRecordDataEquityCompensationCancellation',
    cidTag: 'OcfRecordCidEquityCompensationCancellation',
  },
  equityCompensationExercise: {
    objectType: 'TX_EQUITY_COMPENSATION_EXERCISE',
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationExercise.EquityCompensationExercise.templateId,
    recordTag: 'OcfRecordDataEquityCompensationExercise',
    cidTag: 'OcfRecordCidEquityCompensationExercise',
  },
  equityCompensationIssuance: {
    objectType: 'TX_EQUITY_COMPENSATION_ISSUANCE',
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationIssuance.EquityCompensationIssuance.templateId,
    recordTag: 'OcfRecordDataEquityCompensationIssuance',
    cidTag: 'OcfRecordCidEquityCompensationIssuance',
  },
  equityCompensationRelease: {
    objectType: 'TX_EQUITY_COMPENSATION_RELEASE',
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationRelease.EquityCompensationRelease.templateId,
    recordTag: 'OcfRecordDataEquityCompensationRelease',
    cidTag: 'OcfRecordCidEquityCompensationRelease',
  },
  equityCompensationRepricing: {
    objectType: 'TX_EQUITY_COMPENSATION_REPRICING',
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationRepricing.EquityCompensationRepricing.templateId,
    recordTag: 'OcfRecordDataEquityCompensationRepricing',
    cidTag: 'OcfRecordCidEquityCompensationRepricing',
  },
  equityCompensationRetraction: {
    objectType: 'TX_EQUITY_COMPENSATION_RETRACTION',
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationRetraction.EquityCompensationRetraction.templateId,
    recordTag: 'OcfRecordDataEquityCompensationRetraction',
    cidTag: 'OcfRecordCidEquityCompensationRetraction',
  },
  equityCompensationTransfer: {
    objectType: 'TX_EQUITY_COMPENSATION_TRANSFER',
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationTransfer.EquityCompensationTransfer.templateId,
    recordTag: 'OcfRecordDataEquityCompensationTransfer',
    cidTag: 'OcfRecordCidEquityCompensationTransfer',
  },
  financing: {
    objectType: 'FINANCING',
    templateId: Fairmint.OpenCapTable.OCF.Financing.Financing.templateId,
    recordTag: 'OcfRecordDataFinancing',
    cidTag: 'OcfRecordCidFinancing',
  },
  issuer: {
    objectType: 'ISSUER',
    templateId: Fairmint.OpenCapTable.OCF.Issuer.Issuer.templateId,
    recordTag: 'OcfRecordDataIssuer',
    cidTag: 'OcfRecordCidIssuer',
  },
  issuerAuthorizedSharesAdjustment: {
    objectType: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
    templateId: Fairmint.OpenCapTable.OCF.IssuerAuthorizedSharesAdjustment.IssuerAuthorizedSharesAdjustment.templateId,
    recordTag: 'OcfRecordDataIssuerAuthorizedSharesAdjustment',
    cidTag: 'OcfRecordCidIssuerAuthorizedSharesAdjustment',
  },
  stakeholder: {
    objectType: 'STAKEHOLDER',
    templateId: Fairmint.OpenCapTable.OCF.Stakeholder.Stakeholder.templateId,
    recordTag: 'OcfRecordDataStakeholder',
    cidTag: 'OcfRecordCidStakeholder',
  },
  stakeholderRelationshipChangeEvent: {
    objectType: 'CE_STAKEHOLDER_RELATIONSHIP',
    templateId:
      Fairmint.OpenCapTable.OCF.StakeholderRelationshipChangeEvent.StakeholderRelationshipChangeEvent.templateId,
    recordTag: 'OcfRecordDataStakeholderRelationshipChangeEvent',
    cidTag: 'OcfRecordCidStakeholderRelationshipChangeEvent',
  },
  stakeholderStatusChangeEvent: {
    objectType: 'CE_STAKEHOLDER_STATUS',
    templateId: Fairmint.OpenCapTable.OCF.StakeholderStatusChangeEvent.StakeholderStatusChangeEvent.templateId,
    recordTag: 'OcfRecordDataStakeholderStatusChangeEvent',
    cidTag: 'OcfRecordCidStakeholderStatusChangeEvent',
  },
  stockAcceptance: {
    objectType: 'TX_STOCK_ACCEPTANCE',
    templateId: Fairmint.OpenCapTable.OCF.StockAcceptance.StockAcceptance.templateId,
    recordTag: 'OcfRecordDataStockAcceptance',
    cidTag: 'OcfRecordCidStockAcceptance',
  },
  stockCancellation: {
    objectType: 'TX_STOCK_CANCELLATION',
    templateId: Fairmint.OpenCapTable.OCF.StockCancellation.StockCancellation.templateId,
    recordTag: 'OcfRecordDataStockCancellation',
    cidTag: 'OcfRecordCidStockCancellation',
  },
  stockClass: {
    objectType: 'STOCK_CLASS',
    templateId: Fairmint.OpenCapTable.OCF.StockClass.StockClass.templateId,
    recordTag: 'OcfRecordDataStockClass',
    cidTag: 'OcfRecordCidStockClass',
  },
  stockClassAuthorizedSharesAdjustment: {
    objectType: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
    templateId:
      Fairmint.OpenCapTable.OCF.StockClassAuthorizedSharesAdjustment.StockClassAuthorizedSharesAdjustment.templateId,
    recordTag: 'OcfRecordDataStockClassAuthorizedSharesAdjustment',
    cidTag: 'OcfRecordCidStockClassAuthorizedSharesAdjustment',
  },
  stockClassConversionRatioAdjustment: {
    objectType: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
    templateId:
      Fairmint.OpenCapTable.OCF.StockClassConversionRatioAdjustment.StockClassConversionRatioAdjustment.templateId,
    recordTag: 'OcfRecordDataStockClassConversionRatioAdjustment',
    cidTag: 'OcfRecordCidStockClassConversionRatioAdjustment',
  },
  stockClassSplit: {
    objectType: 'TX_STOCK_CLASS_SPLIT',
    templateId: Fairmint.OpenCapTable.OCF.StockClassSplit.StockClassSplit.templateId,
    recordTag: 'OcfRecordDataStockClassSplit',
    cidTag: 'OcfRecordCidStockClassSplit',
  },
  stockConsolidation: {
    objectType: 'TX_STOCK_CONSOLIDATION',
    templateId: Fairmint.OpenCapTable.OCF.StockConsolidation.StockConsolidation.templateId,
    recordTag: 'OcfRecordDataStockConsolidation',
    cidTag: 'OcfRecordCidStockConsolidation',
  },
  stockConversion: {
    objectType: 'TX_STOCK_CONVERSION',
    templateId: Fairmint.OpenCapTable.OCF.StockConversion.StockConversion.templateId,
    recordTag: 'OcfRecordDataStockConversion',
    cidTag: 'OcfRecordCidStockConversion',
  },
  stockIssuance: {
    objectType: 'TX_STOCK_ISSUANCE',
    templateId: Fairmint.OpenCapTable.OCF.StockIssuance.StockIssuance.templateId,
    recordTag: 'OcfRecordDataStockIssuance',
    cidTag: 'OcfRecordCidStockIssuance',
  },
  stockLegendTemplate: {
    objectType: 'STOCK_LEGEND_TEMPLATE',
    templateId: Fairmint.OpenCapTable.OCF.StockLegendTemplate.StockLegendTemplate.templateId,
    recordTag: 'OcfRecordDataStockLegendTemplate',
    cidTag: 'OcfRecordCidStockLegendTemplate',
  },
  stockPlan: {
    objectType: 'STOCK_PLAN',
    templateId: Fairmint.OpenCapTable.OCF.StockPlan.StockPlan.templateId,
    recordTag: 'OcfRecordDataStockPlan',
    cidTag: 'OcfRecordCidStockPlan',
  },
  stockPlanPoolAdjustment: {
    objectType: 'TX_STOCK_PLAN_POOL_ADJUSTMENT',
    templateId: Fairmint.OpenCapTable.OCF.StockPlanPoolAdjustment.StockPlanPoolAdjustment.templateId,
    recordTag: 'OcfRecordDataStockPlanPoolAdjustment',
    cidTag: 'OcfRecordCidStockPlanPoolAdjustment',
  },
  stockPlanReturnToPool: {
    objectType: 'TX_STOCK_PLAN_RETURN_TO_POOL',
    templateId: Fairmint.OpenCapTable.OCF.StockPlanReturnToPool.StockPlanReturnToPool.templateId,
    recordTag: 'OcfRecordDataStockPlanReturnToPool',
    cidTag: 'OcfRecordCidStockPlanReturnToPool',
  },
  stockReissuance: {
    objectType: 'TX_STOCK_REISSUANCE',
    templateId: Fairmint.OpenCapTable.OCF.StockReissuance.StockReissuance.templateId,
    recordTag: 'OcfRecordDataStockReissuance',
    cidTag: 'OcfRecordCidStockReissuance',
  },
  stockRepurchase: {
    objectType: 'TX_STOCK_REPURCHASE',
    templateId: Fairmint.OpenCapTable.OCF.StockRepurchase.StockRepurchase.templateId,
    recordTag: 'OcfRecordDataStockRepurchase',
    cidTag: 'OcfRecordCidStockRepurchase',
  },
  stockRetraction: {
    objectType: 'TX_STOCK_RETRACTION',
    templateId: Fairmint.OpenCapTable.OCF.StockRetraction.StockRetraction.templateId,
    recordTag: 'OcfRecordDataStockRetraction',
    cidTag: 'OcfRecordCidStockRetraction',
  },
  stockTransfer: {
    objectType: 'TX_STOCK_TRANSFER',
    templateId: Fairmint.OpenCapTable.OCF.StockTransfer.StockTransfer.templateId,
    recordTag: 'OcfRecordDataStockTransfer',
    cidTag: 'OcfRecordCidStockTransfer',
  },
  valuation: {
    objectType: 'VALUATION',
    templateId: Fairmint.OpenCapTable.OCF.Valuation.Valuation.templateId,
    recordTag: 'OcfRecordDataValuation',
    cidTag: 'OcfRecordCidValuation',
  },
  vestingAcceleration: {
    objectType: 'TX_VESTING_ACCELERATION',
    templateId: Fairmint.OpenCapTable.OCF.VestingAcceleration.VestingAcceleration.templateId,
    recordTag: 'OcfRecordDataVestingAcceleration',
    cidTag: 'OcfRecordCidVestingAcceleration',
  },
  vestingEvent: {
    objectType: 'TX_VESTING_EVENT',
    templateId: Fairmint.OpenCapTable.OCF.VestingEvent.VestingEvent.templateId,
    recordTag: 'OcfRecordDataVestingEvent',
    cidTag: 'OcfRecordCidVestingEvent',
  },
  vestingStart: {
    objectType: 'TX_VESTING_START',
    templateId: Fairmint.OpenCapTable.OCF.VestingStart.VestingStart.templateId,
    recordTag: 'OcfRecordDataVestingStart',
    cidTag: 'OcfRecordCidVestingStart',
  },
  vestingTerms: {
    objectType: 'VESTING_TERMS',
    templateId: Fairmint.OpenCapTable.OCF.VestingTerms.VestingTerms.templateId,
    recordTag: 'OcfRecordDataVestingTerms',
    cidTag: 'OcfRecordCidVestingTerms',
  },
  warrantAcceptance: {
    objectType: 'TX_WARRANT_ACCEPTANCE',
    templateId: Fairmint.OpenCapTable.OCF.WarrantAcceptance.WarrantAcceptance.templateId,
    recordTag: 'OcfRecordDataWarrantAcceptance',
    cidTag: 'OcfRecordCidWarrantAcceptance',
  },
  warrantCancellation: {
    objectType: 'TX_WARRANT_CANCELLATION',
    templateId: Fairmint.OpenCapTable.OCF.WarrantCancellation.WarrantCancellation.templateId,
    recordTag: 'OcfRecordDataWarrantCancellation',
    cidTag: 'OcfRecordCidWarrantCancellation',
  },
  warrantExercise: {
    objectType: 'TX_WARRANT_EXERCISE',
    templateId: Fairmint.OpenCapTable.OCF.WarrantExercise.WarrantExercise.templateId,
    recordTag: 'OcfRecordDataWarrantExercise',
    cidTag: 'OcfRecordCidWarrantExercise',
  },
  warrantIssuance: {
    objectType: 'TX_WARRANT_ISSUANCE',
    templateId: Fairmint.OpenCapTable.OCF.WarrantIssuance.WarrantIssuance.templateId,
    recordTag: 'OcfRecordDataWarrantIssuance',
    cidTag: 'OcfRecordCidWarrantIssuance',
  },
  warrantRetraction: {
    objectType: 'TX_WARRANT_RETRACTION',
    templateId: Fairmint.OpenCapTable.OCF.WarrantRetraction.WarrantRetraction.templateId,
    recordTag: 'OcfRecordDataWarrantRetraction',
    cidTag: 'OcfRecordCidWarrantRetraction',
  },
  warrantTransfer: {
    objectType: 'TX_WARRANT_TRANSFER',
    templateId: Fairmint.OpenCapTable.OCF.WarrantTransfer.WarrantTransfer.templateId,
    recordTag: 'OcfRecordDataWarrantTransfer',
    cidTag: 'OcfRecordCidWarrantTransfer',
  },
} as const satisfies OcfEntityRegistry;

/** Generated `OcfRecordData` variant (`{ tag, value }`) for one SDK entity kind. */
export type DamlRecordDataFor<EntityType extends OcfEntityType> = Extract<
  DamlOcfRecordData,
  { tag: (typeof ENTITY_REGISTRY)[EntityType]['recordTag'] }
>;

/** Exact generated DAML entity-data payload (`<Name>OcfData`) for one SDK entity kind. */
export type DamlDataTypeFor<EntityType extends OcfEntityType> = DamlRecordDataFor<EntityType>['value'];

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
