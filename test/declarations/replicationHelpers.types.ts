/** Built-declaration contracts for entity-correlated Canton replication data. */

import {
  CantonOcfDataMap,
  computeReplicationDiff,
  type CantonOcfDataEntry,
  type CapTableState,
  type OcfEntityType,
  type OcfStakeholder,
  type OcfStockClass,
  type ReadonlyOcfEntityData,
  type ReplicationCreateItem,
  type ReplicationDiff,
  type ReplicationItem,
  type SourceReplicationItem,
} from '../../dist';

declare const stakeholder: OcfStakeholder;
declare const stockClass: OcfStockClass;
declare const cantonState: CapTableState;

const cantonData = new CantonOcfDataMap();
cantonData.set('stakeholder', new Map([['stakeholder-1', stakeholder]]));

const stakeholderData: ReadonlyMap<string, ReadonlyOcfEntityData<'stakeholder'>> | undefined =
  cantonData.get('stakeholder');

// @ts-expect-error the entity key determines the exact canonical value shape
cantonData.set('stakeholder', new Map([['stock-class-1', stockClass]]));

declare const widenedKind: 'stakeholder' | 'stockClass';
declare const widenedData: ReadonlyMap<string, ReadonlyOcfEntityData<typeof widenedKind>>;

// @ts-expect-error union-valued keys cannot pair with union-valued maps and poison a later narrowed get
cantonData.set(widenedKind, widenedData);

// @ts-expect-error returned buckets are readonly snapshots, not mutable Map aliases
stakeholderData?.set('stock-class-2', stockClass);

const frozenStakeholder = stakeholderData?.get('stakeholder-1');
if (frozenStakeholder !== undefined) {
  // @ts-expect-error snapshot values are deeply readonly
  frozenStakeholder.name.legal_name = 'mutated';
  // @ts-expect-error nested snapshot arrays are readonly
  frozenStakeholder.comments?.push('mutated');
}

function setCorrelatedEntry<EntityType extends OcfEntityType>(
  data: CantonOcfDataMap,
  entry: CantonOcfDataEntry<EntityType>
): void {
  data.set(...entry);
}

setCorrelatedEntry(cantonData, ['stakeholder', new Map([['stakeholder-2', stakeholder]])]);
setCorrelatedEntry(cantonData, ['stockClass', new Map([['stock-class-2', stockClass]])]);

const sourceItems = [
  { entityType: 'stakeholder', data: stakeholder },
  { entityType: 'stockClass', data: stockClass },
] as const satisfies readonly SourceReplicationItem[];
computeReplicationDiff(sourceItems, cantonState);

// @ts-expect-error source entity discriminators must match their canonical payloads
const invalidSourceItem: SourceReplicationItem = { entityType: 'stakeholder', data: stockClass };

type StakeholderCreateData = Extract<ReplicationCreateItem, { entityType: 'stakeholder' }>['data'];
const stakeholderCreateData: StakeholderCreateData = stakeholder;
// @ts-expect-error replication result payloads remain correlated with their entity discriminator
const invalidStakeholderCreateData: StakeholderCreateData = stockClass;

declare const replicationItem: ReplicationItem;
if (replicationItem.operation === 'delete') {
  // @ts-expect-error delete operations deliberately carry no stale data payload
  replicationItem.data;
} else if (replicationItem.entityType === 'stakeholder') {
  const correlatedData: OcfStakeholder = replicationItem.data;
  void correlatedData;
}

declare const replicationDiff: ReplicationDiff;
const createOperation: 'create' = replicationDiff.creates[0]!.operation;
const editOperation: 'edit' = replicationDiff.edits[0]!.operation;
const deleteOperation: 'delete' = replicationDiff.deletes[0]!.operation;
// @ts-expect-error delete result buckets do not expose data
replicationDiff.deletes[0]!.data;

void stakeholderData;
void invalidSourceItem;
void stakeholderCreateData;
void invalidStakeholderCreateData;
void createOperation;
void editOperation;
void deleteOperation;
