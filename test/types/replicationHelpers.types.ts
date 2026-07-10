/** Compile-time contracts for entity-correlated Canton replication data. */

import type { OcfStakeholder, OcfStockClass } from '../../src/types/native';
import { CantonOcfDataMap } from '../../src/utils/replicationHelpers';

declare const stakeholder: OcfStakeholder;
declare const stockClass: OcfStockClass;

const cantonData = new CantonOcfDataMap();
cantonData.set('stakeholder', new Map([['stakeholder-1', stakeholder]]));

const stakeholderData: Map<string, OcfStakeholder> | undefined = cantonData.get('stakeholder');

// @ts-expect-error the entity key determines the exact canonical value shape
cantonData.set('stakeholder', new Map([['stock-class-1', stockClass]]));

void stakeholderData;
