/**
 * A small OpenCapTable-v35 book built straight into a key index, for the inputs-resolution and batch-sizing tests: OCF
 * records as the reader admits them (their writer-chosen IDs claimed in the shards), stock states, class epochs and the
 * shard partition those claims leave.
 */

import { ENTITY_REGISTRY } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import type { OcfDataTypeFor, OcfEntityType } from '../../src/functions/OpenCapTable/capTable/entityTypes';
import { recordSecurityIds } from '../../src/register/admissionRules';
import {
  claimHash,
  coveringShardPrefix,
  INITIAL_SHARD_PREFIXES,
  isDerivedForm,
  simulateClaim,
} from '../../src/register/ids';
import { RegisterIndex } from '../../src/register/registerIndex';
import type {
  OcfDocument,
  OcfFinancing,
  OcfStakeholder,
  OcfStockAcceptance,
  OcfStockClass,
  OcfStockClassSplit,
  OcfStockIssuance,
  OcfStockPlan,
  OcfStockTransfer,
  OcfVestingStart,
  OcfVestingTerms,
  OcfWarrantIssuance,
} from '../../src/types/native';
import type { IdNamespace, RecordedSplit, RegisterRecord, StockSecurityState } from '../../src/types/register';
import { CONTEXT, stockState } from './registerFixtures';

export { CONTEXT, stockState };

export function stakeholder(id: string): OcfStakeholder {
  return { object_type: 'STAKEHOLDER', id, name: { legal_name: `Holder ${id}` }, stakeholder_type: 'INDIVIDUAL' };
}

export function stockClass(id: string): OcfStockClass {
  return {
    object_type: 'STOCK_CLASS',
    id,
    name: `Class ${id}`,
    class_type: 'COMMON',
    default_id_prefix: 'CS-',
    initial_shares_authorized: '20000000',
    seniority: '1',
    votes_per_share: '1',
    conversion_rights: [],
  };
}

export function stockIssuance(overrides: Partial<OcfStockIssuance> = {}): OcfStockIssuance {
  return {
    object_type: 'TX_STOCK_ISSUANCE',
    id: 'ISS-A1',
    date: '2024-01-01',
    security_id: 'S-A1',
    custom_id: 'CS-A1',
    stakeholder_id: 'SH-A',
    stock_class_id: 'CLS-A',
    share_price: { amount: '1', currency: 'USD' },
    quantity: '600',
    stock_legend_ids: [],
    security_law_exemptions: [],
    ...overrides,
  };
}

export function stockPlan(id: string, stockClassIds: OcfStockPlan['stock_class_ids']): OcfStockPlan {
  return {
    object_type: 'STOCK_PLAN',
    id,
    plan_name: `Plan ${id}`,
    initial_shares_reserved: '1000000',
    stock_class_ids: stockClassIds,
  };
}

/** Vesting terms with a start condition (`start`) and an event condition (`milestone`). */
export function vestingTerms(id: string): OcfVestingTerms {
  return {
    object_type: 'VESTING_TERMS',
    id,
    name: 'Start and milestone',
    description: 'A start condition and an event condition',
    allocation_type: 'CUMULATIVE_ROUNDING',
    vesting_conditions: [
      { id: 'start', trigger: { type: 'VESTING_START_DATE' }, quantity: '0', next_condition_ids: ['milestone'] },
      { id: 'milestone', trigger: { type: 'VESTING_EVENT' }, quantity: '100', next_condition_ids: [] },
    ],
  };
}

export function warrantIssuance(
  id: string,
  securityId: string,
  overrides: Partial<OcfWarrantIssuance> = {}
): OcfWarrantIssuance {
  return {
    object_type: 'TX_WARRANT_ISSUANCE',
    id,
    date: '2024-03-01',
    security_id: securityId,
    custom_id: `W-${id}`,
    stakeholder_id: 'SH-A',
    quantity: '1000',
    quantity_source: 'UNSPECIFIED',
    purchase_price: { amount: '100', currency: 'USD' },
    exercise_triggers: [],
    security_law_exemptions: [],
    ...overrides,
  };
}

export function vestingStart(id: string, securityId: string, conditionId = 'start'): OcfVestingStart {
  return {
    object_type: 'TX_VESTING_START',
    id,
    date: '2024-06-01',
    security_id: securityId,
    vesting_condition_id: conditionId,
  };
}

export function stockAcceptance(id: string, securityId: string, date = '2024-02-01'): OcfStockAcceptance {
  return { object_type: 'TX_STOCK_ACCEPTANCE', id, date, security_id: securityId };
}

export function stockTransfer(overrides: Partial<OcfStockTransfer> = {}): OcfStockTransfer {
  return {
    object_type: 'TX_STOCK_TRANSFER',
    id: 'TR-1',
    date: '2024-03-01',
    security_id: 'S-A1',
    quantity: '600',
    resulting_security_ids: ['S-B1'],
    ...overrides,
  };
}

export function stockClassSplit(id: string, stockClassId: string, date: string): OcfStockClassSplit {
  return {
    object_type: 'TX_STOCK_CLASS_SPLIT',
    id,
    date,
    stock_class_id: stockClassId,
    split_ratio: { numerator: '2', denominator: '1' },
  };
}

export function financing(id: string, issuanceIds: string[]): OcfFinancing {
  return { object_type: 'FINANCING', id, name: `Financing ${id}`, issuance_ids: issuanceIds, date: '2024-01-15' };
}

export function document(id: string, stakeholderIds: string[], comments: string[] = []): OcfDocument {
  return {
    object_type: 'DOCUMENT',
    id,
    md5: 'd41d8cd98f00b204e9800998ecf8427e',
    path: `/documents/${id}.pdf`,
    related_objects: stakeholderIds.map((objectId) => ({ object_type: 'STAKEHOLDER', object_id: objectId })),
    ...(comments.length > 0 ? { comments } : {}),
  };
}

const ISSUANCE_TYPES = new Set<OcfEntityType>([
  'stockIssuance',
  'warrantIssuance',
  'convertibleIssuance',
  'equityCompensationIssuance',
]);

/**
 * A book built into a key index. Each record's writer-chosen IDs (its object ID, an issuance's security ID) are claimed,
 * as the ledger claimed them, in the 256 initial shards; `index()` adds the shards those claims leave.
 */
export class TestBook {
  private readonly built = new RegisterIndex({ context: CONTEXT, offset: 1 });
  private readonly claims: Array<[IdNamespace, string]> = [];
  private sealed = false;

  record<EntityType extends OcfEntityType>(
    entityType: EntityType,
    data: OcfDataTypeFor<EntityType>,
    contractId = `cid-${data.id}`
  ): this {
    const entry = ENTITY_REGISTRY[entityType];
    const securityIds = recordSecurityIds(entityType, data);
    const contract = {
      contractId,
      templateId: entry.templateId,
      createdOffset: 1,
      entityType,
      objectId: data.id,
      objectType: entry.objectType,
      securityIds,
      data,
    } as RegisterRecord;
    this.built.add({ kind: 'record', context: CONTEXT, contract });
    if (!isDerivedForm(CONTEXT.cap_table_id, data.id)) this.claims.push(['object', data.id]);
    const [securityId] = securityIds;
    if (
      ISSUANCE_TYPES.has(entityType) &&
      securityId !== undefined &&
      !isDerivedForm(CONTEXT.cap_table_id, securityId)
    ) {
      this.claims.push(['security', securityId]);
    }
    return this;
  }

  state(state: StockSecurityState, contractId = `state-${state.security_id}`): this {
    this.built.add({
      kind: 'state',
      context: CONTEXT,
      contract: { contractId, templateId: 'state-template', createdOffset: 1, state },
    });
    return this;
  }

  epoch(
    stockClassId: string,
    options: { splits?: RecordedSplit[]; frozen?: boolean } = {},
    contractId = `epoch-${stockClassId}`
  ): this {
    this.built.add({
      kind: 'epoch',
      context: CONTEXT,
      contract: {
        contractId,
        templateId: 'epoch-template',
        createdOffset: 1,
        epoch: {
          context: CONTEXT,
          stock_class_id: stockClassId,
          frozen: options.frozen ?? false,
          splits: options.splits ?? [],
        },
      },
    });
    return this;
  }

  /** A claim with no record behind it (for instance one that fills a shard). */
  claim(namespace: IdNamespace, id: string): this {
    this.claims.push([namespace, id]);
    return this;
  }

  /** The index, with the shards that the claims leave; call once. */
  index(): RegisterIndex {
    if (this.sealed) throw new Error('TestBook.index() was already called');
    this.sealed = true;
    let shards: Map<string, ReadonlySet<string>> = new Map(INITIAL_SHARD_PREFIXES.map((prefix) => [prefix, new Set()]));
    for (const [namespace, id] of this.claims) ({ shards } = simulateClaim(shards, claimHash(namespace, id)));
    for (const [prefix, claimed] of shards) {
      this.built.add({
        kind: 'shard',
        context: CONTEXT,
        contract: {
          contractId: `shard-${prefix}`,
          templateId: 'shard-template',
          createdOffset: 1,
          shard: { context: CONTEXT, prefix, claimed: [...claimed].sort() },
        },
      });
    }
    return this.built;
  }
}

/** The contract ID `TestBook` gives the shard that covers an ID's claim in a partition of initial shards. */
export function initialShardOf(namespace: IdNamespace, id: string): string {
  return `shard-${coveringShardPrefix(claimHash(namespace, id), new Set(INITIAL_SHARD_PREFIXES)) ?? ''}`;
}

/** IDs `<stem>-<n>` whose object claims all fall in the initial shard of `target`'s, as many as asked for. */
export function idsInShardOf(namespace: IdNamespace, target: string, count: number, stem = 'fill'): string[] {
  const shard = initialShardOf(namespace, target);
  const ids: string[] = [];
  for (let n = 0; ids.length < count; n++) {
    const id = `${stem}-${n}`;
    if (id !== target && initialShardOf(namespace, id) === shard) ids.push(id);
  }
  return ids;
}

/** The book most tests start from: stakeholders SH-A and SH-B, class CLS-A with its epoch, issuance ISS-A1 of S-A1. */
export function baseBook(state: Partial<StockSecurityState> = {}): TestBook {
  return new TestBook()
    .record('stakeholder', stakeholder('SH-A'))
    .record('stakeholder', stakeholder('SH-B'))
    .record('stockClass', stockClass('CLS-A'))
    .epoch('CLS-A')
    .record('stockIssuance', stockIssuance())
    .state(stockState(state));
}
