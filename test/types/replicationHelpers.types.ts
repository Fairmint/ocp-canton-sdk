/** Compile-time contracts for entity-correlated Canton replication data. */

import type { OcfEntityType, OcfStakeholder, OcfStakeholderOutput, OcfStockClass } from '../../src';
import { CantonOcfDataMap, type CantonOcfDataEntry } from '../../src/utils/replicationHelpers';

declare const stakeholder: OcfStakeholder;
declare const stockClass: OcfStockClass;

const cantonData = new CantonOcfDataMap();
cantonData.set('stakeholder', new Map([['stakeholder-1', stakeholder]]));

const stakeholderData: ReadonlyMap<string, OcfStakeholderOutput> | undefined = cantonData.get('stakeholder');

// @ts-expect-error the entity key determines the exact canonical value shape
cantonData.set('stakeholder', new Map([['stock-class-1', stockClass]]));

declare const widenedKind: 'stakeholder' | 'stockClass';
declare const widenedData: ReadonlyMap<string, OcfStakeholder | OcfStockClass>;

// @ts-expect-error union-valued keys cannot pair with union-valued maps and poison a later narrowed get
cantonData.set(widenedKind, widenedData);

// @ts-expect-error returned buckets are readonly snapshots, not mutable Map aliases
stakeholderData?.set('stock-class-2', stockClass);

function setCorrelatedEntry<EntityType extends OcfEntityType>(
  data: CantonOcfDataMap,
  entry: CantonOcfDataEntry<EntityType>
): void {
  data.set(...entry);
}

setCorrelatedEntry(cantonData, ['stakeholder', new Map([['stakeholder-2', stakeholder]])]);
setCorrelatedEntry(cantonData, ['stockClass', new Map([['stock-class-2', stockClass]])]);

void stakeholderData;
