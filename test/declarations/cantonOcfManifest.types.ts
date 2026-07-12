/** Built-declaration contracts for exact OCF manifests and type-preserving sorting. */

import {
  sortTransactions,
  type OcfEntityDataMap,
  type OcfIssuer,
  type OcfManifest,
  type OcfObject,
  type OcfStakeholder,
  type OcfStockClass,
  type OcfTransaction,
  type SortableOcfTransaction,
} from '../../dist';

type Assert<Condition extends true> = Condition;
type EntityMapTransaction = {
  [EntityType in keyof OcfEntityDataMap]: OcfEntityDataMap[EntityType]['object_type'] extends
    | `TX_${string}`
    | `CE_${string}`
    ? OcfEntityDataMap[EntityType]
    : never;
}[keyof OcfEntityDataMap];

type TransactionCoversEntityMap = Assert<EntityMapTransaction extends OcfTransaction ? true : false>;
type EntityMapCoversTransaction = Assert<OcfTransaction extends EntityMapTransaction ? true : false>;
type TransactionBelongsToObjectUnion = Assert<OcfTransaction extends OcfObject ? true : false>;
type LegacyPlanSecurityExcluded = Assert<
  Extract<OcfTransaction, { object_type: 'TX_PLAN_SECURITY_ISSUANCE' }> extends never ? true : false
>;
type LegacyStakeholderEventExcluded = Assert<
  Extract<OcfTransaction, { object_type: 'TX_STAKEHOLDER_STATUS_CHANGE_EVENT' }> extends never ? true : false
>;

declare const issuer: OcfIssuer;
declare const stakeholder: OcfStakeholder;
declare const stockClass: OcfStockClass;
declare const transaction: OcfTransaction;
declare const manifest: OcfManifest;

manifest.stakeholders.push(stakeholder);
manifest.stockClasses.push(stockClass);
manifest.transactions.push(transaction);

// @ts-expect-error manifest categories cannot contain another canonical object kind
manifest.stakeholders.push(stockClass);
// @ts-expect-error core objects are not transactions
manifest.transactions.push(issuer);

const readonlyTransactions = [
  {
    id: 'transfer',
    date: '2025-01-01',
    object_type: 'TX_STOCK_TRANSFER',
    customMarker: 'transfer-marker',
  },
  {
    id: 'issuance',
    date: '2025-01-01',
    object_type: 'TX_STOCK_ISSUANCE',
    customMarker: 'issuance-marker',
  },
] as const;
const sortedTransactions = sortTransactions(readonlyTransactions);
const preservedId: 'transfer' | 'issuance' = sortedTransactions[0]!.id;
const preservedMarker: 'transfer-marker' | 'issuance-marker' = sortedTransactions[0]!.customMarker;

const sortableConsolidation = {
  id: 'consolidation',
  date: '2025-01-01',
  object_type: 'TX_STOCK_CONSOLIDATION',
  resulting_security_id: 'consolidated-security',
} as const satisfies SortableOcfTransaction;
const consolidationTransactions = sortTransactions([
  sortableConsolidation,
  {
    id: 'result-issuance',
    date: '2025-01-01',
    object_type: 'TX_STOCK_ISSUANCE',
    security_id: 'consolidated-security',
  },
] as const);
const preservedConsolidationId: 'consolidation' | 'result-issuance' = consolidationTransactions[0]!.id;

// @ts-expect-error public sorting requires a date that can produce a deterministic key
sortTransactions([{ id: 'missing-date', object_type: 'TX_STOCK_ISSUANCE' }] as const);
// @ts-expect-error public sorting accepts transaction/event discriminators, not core objects
sortTransactions([{ id: 'stakeholder', date: '2025-01-01', object_type: 'STAKEHOLDER' }] as const);
// @ts-expect-error public sorting accepts only canonical transaction/event discriminators
sortTransactions([{ id: 'unknown', date: '2025-01-01', object_type: 'TX_UNKNOWN_TYPE' }] as const);

void (0 as unknown as TransactionCoversEntityMap);
void (0 as unknown as EntityMapCoversTransaction);
void (0 as unknown as TransactionBelongsToObjectUnion);
void (0 as unknown as LegacyPlanSecurityExcluded);
void (0 as unknown as LegacyStakeholderEventExcluded);
void preservedId;
void preservedMarker;
void preservedConsolidationId;
