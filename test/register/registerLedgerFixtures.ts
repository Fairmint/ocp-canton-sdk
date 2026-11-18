/**
 * Canned Ledger API data for the register reader and key index: created events as the active contract set and
 * ledger-effects transactions deliver them (package-id template IDs, package name, signatories, interface views), for
 * one small but consistent OpenCapTable-v35 book.
 *
 * The book (`CONTEXT`, cap table `test-1`) holds an issuer, a stakeholder, a stock class and its epoch, a stock
 * issuance with its state, an acceptance and a settlement hold on that security, and the 256 initial shards, one of
 * which holds the stakeholder ID's claim.
 */

import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { ENTITY_REGISTRY } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import type { OcfEditableEntityType, OcfEntityType } from '../../src/functions/OpenCapTable/capTable/entityTypes';
import { convertToDamlData } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { recordSecurityIds } from '../../src/register/admissionRules';
import { claimHash, coveringShardPrefix, INITIAL_SHARD_PREFIXES } from '../../src/register/ids';
import { BUNDLED_OPEN_CAP_TABLE_PACKAGE_ID } from '../../src/register/templates';
import type { RegisterContext } from '../../src/types/register';
import { loadFixture } from '../utils/productionFixtures';
import { CONTEXT } from './registerFixtures';

export { CONTEXT };

/** The same cap table under another transfer agent: a foreign context. */
export const FOREIGN_CONTEXT: RegisterContext = { ...CONTEXT, transfer_agent: 'other-transfer-agent::1220' };

export const OCF_OBJECT_INTERFACE_ID = Fairmint.OpenCapTableApi.OcfObject.OcfObject.templateIdWithPackageId;
export const REGISTER_CONTRACT_INTERFACE_ID =
  Fairmint.OpenCapTableApi.RegisterContract.RegisterContract.templateIdWithPackageId;

/** A package-name template ID in the package-id form the Ledger API returns. */
export function packageIdForm(templateId: string, packageId = BUNDLED_OPEN_CAP_TABLE_PACKAGE_ID): string {
  return `${packageId}:${templateId.slice(templateId.indexOf(':') + 1)}`;
}

export function signatoriesOf(context: RegisterContext): string[] {
  return [context.issuer, context.system_operator, context.transfer_agent];
}

/** A JSON-wire copy, as the Ledger API returns values. */
function wire<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export interface CreatedEventOverrides {
  offset?: number;
  signatories?: string[];
  packageName?: string;
  templateId?: string;
  interfaceViews?: unknown[];
}

/** A Ledger API created event. */
export function createdEvent(
  contractId: string,
  templateId: string,
  createArgument: unknown,
  interfaceViews: unknown[],
  context: RegisterContext,
  overrides: CreatedEventOverrides = {}
): Record<string, unknown> {
  return {
    offset: overrides.offset ?? 10,
    nodeId: 0,
    contractId,
    templateId: overrides.templateId ?? packageIdForm(templateId),
    createArgument: wire(createArgument),
    createdEventBlob: '',
    interfaceViews: overrides.interfaceViews ?? interfaceViews,
    witnessParties: [context.issuer],
    signatories: overrides.signatories ?? signatoriesOf(context),
    observers: [],
    createdAt: '2026-10-01T00:00:00Z',
    packageName: overrides.packageName ?? 'OpenCapTable-v35',
  };
}

function view(interfaceId: string, viewValue: unknown): Record<string, unknown> {
  return {
    interfaceId,
    viewStatus: { code: 0, message: '', details: [] },
    viewValue,
    implementationPackageId: BUNDLED_OPEN_CAP_TABLE_PACKAGE_ID,
  };
}

export function ocfObjectView(value: {
  cap_table_id: string;
  object_type: string;
  object_id: string;
  security_ids: string[];
}): Record<string, unknown> {
  return view(OCF_OBJECT_INTERFACE_ID, value);
}

export function registerContractView(value: {
  cap_table_id: string;
  kind: string;
  key: string;
}): Record<string, unknown> {
  return view(REGISTER_CONTRACT_INTERFACE_ID, value);
}

/** An OCF record's created event, with its `OcfObject` view computed as its template computes it. */
export function recordEvent(
  contractId: string,
  entityType: OcfEntityType,
  ocfData: Record<string, unknown>,
  options: { context?: RegisterContext; viewOverrides?: Record<string, unknown> } & CreatedEventOverrides = {}
): Record<string, unknown> {
  const context = options.context ?? CONTEXT;
  const entry = ENTITY_REGISTRY[entityType];
  const recordView = ocfObjectView({
    cap_table_id: context.cap_table_id,
    object_type: entry.objectType,
    object_id: String(ocfData.id),
    security_ids: recordSecurityIds(entityType, ocfData),
    ...options.viewOverrides,
  });
  return createdEvent(contractId, entry.templateId, { context, ocf_data: ocfData }, [recordView], context, options);
}

/** The generated `ocf_data` of a native OCF record. */
export function damlData(entityType: OcfEditableEntityType, ocf: Record<string, unknown>): Record<string, unknown> {
  const { _source: _marker, ...record } = ocf;
  return wire<Record<string, unknown>>(convertToDamlData(entityType, record as never));
}

export function anchorEvent(
  contractId: string,
  context: RegisterContext = CONTEXT,
  options: { status?: string } & CreatedEventOverrides = {}
): Record<string, unknown> {
  return createdEvent(
    contractId,
    Fairmint.OpenCapTable.CapTable.CapTable.templateId,
    { context, status: options.status ?? 'CapTableStatusActive' },
    [registerContractView({ cap_table_id: context.cap_table_id, kind: 'CAP_TABLE', key: context.cap_table_id })],
    context,
    options
  );
}

export interface StockSecurityPayload {
  security_id: string;
  issue_date: string;
  last_event_date: string;
  origin_transaction_id: string;
  quantity: string;
  seq: string;
  split_epoch: string;
  stakeholder_id: string;
  stock_class_id: string;
  vesting: unknown;
  holds: unknown[];
  delivery: unknown;
  snapshot: unknown;
  accelerated_since_snapshot: string | null;
  derived_ids: boolean;
}

export function stateEvent(
  contractId: string,
  payload: Partial<StockSecurityPayload> = {},
  options: { context?: RegisterContext } & CreatedEventOverrides = {}
): Record<string, unknown> {
  const context = options.context ?? CONTEXT;
  const state: StockSecurityPayload = {
    security_id: FOUNDERS_SECURITY_ID,
    issue_date: '2024-01-15',
    last_event_date: '2024-02-01',
    origin_transaction_id: 'test-stock-issuance-founders-001',
    quantity: '5000000.0000000000',
    seq: '2',
    split_epoch: '0',
    stakeholder_id: 'test-stakeholder-individual-001',
    stock_class_id: COMMON_CLASS_ID,
    vesting: { tag: 'StockVestingNone', value: {} },
    holds: [
      {
        hold_id: 'hold-1',
        hold_type: 'OcfHoldTypeRegisterSettlement',
        reference: 'settlement-1',
        split_epoch: '0',
        quantity: '1500.0000000000',
      },
    ],
    delivery: null,
    snapshot: null,
    accelerated_since_snapshot: null,
    derived_ids: true,
    ...payload,
  };
  return createdEvent(
    contractId,
    Fairmint.OpenCapTable.State.StockSecurity.templateId,
    { context, ...state },
    [registerContractView({ cap_table_id: context.cap_table_id, kind: 'STOCK_SECURITY', key: state.security_id })],
    context,
    options
  );
}

export function epochEvent(
  contractId: string,
  stockClassId: string,
  splits: unknown[] = [],
  options: { context?: RegisterContext; frozen?: boolean } & CreatedEventOverrides = {}
): Record<string, unknown> {
  const context = options.context ?? CONTEXT;
  return createdEvent(
    contractId,
    Fairmint.OpenCapTable.State.StockClassEpoch.templateId,
    { context, stock_class_id: stockClassId, frozen: options.frozen ?? false, splits },
    [registerContractView({ cap_table_id: context.cap_table_id, kind: 'STOCK_CLASS_EPOCH', key: stockClassId })],
    context,
    options
  );
}

export function shardEvent(
  contractId: string,
  prefix: string,
  claimed: string[] = [],
  options: { context?: RegisterContext } & CreatedEventOverrides = {}
): Record<string, unknown> {
  const context = options.context ?? CONTEXT;
  return createdEvent(
    contractId,
    Fairmint.OpenCapTable.State.OcfIdShard.templateId,
    { context, prefix, claimed: { map: claimed.map((hash) => [hash, {}]) } },
    [registerContractView({ cap_table_id: context.cap_table_id, kind: 'OCF_ID_SHARD', key: prefix })],
    context,
    options
  );
}

/** An active-contracts WebSocket item for a created event. */
export function acsItem(event: unknown): Record<string, unknown> {
  return {
    workflowId: '',
    contractEntry: {
      JsActiveContract: { createdEvent: event, synchronizerId: 'global::1220', reassignmentCounter: 0 },
    },
  };
}

export const FOUNDERS_SECURITY_ID = 'test-security-founders-001';
export const COMMON_CLASS_ID = 'test-stock-class-common-001';
export const STAKEHOLDER_ID = 'test-stakeholder-individual-001';
export const STAKEHOLDER_CLAIM = claimHash('object', STAKEHOLDER_ID);
export const STAKEHOLDER_SHARD_PREFIX = coveringShardPrefix(STAKEHOLDER_CLAIM, new Set(INITIAL_SHARD_PREFIXES)) ?? '';

const issuer = damlData('issuer', loadFixture('production/issuer/basic.json'));
const stakeholder = damlData('stakeholder', loadFixture('production/stakeholder/individual.json'));
const stockClass = damlData('stockClass', loadFixture('production/stockClass/common.json'));
const issuance = damlData('stockIssuance', loadFixture('production/stockIssuance/founders-stock.json'));
const acceptance = damlData('stockAcceptance', {
  ...loadFixture<Record<string, unknown>>('synthetic/stockAcceptance.json'),
  security_id: FOUNDERS_SECURITY_ID,
  date: '2024-01-20',
});
/** A settlement hold's `StockHoldOcfData`, as the register writes it. */
export const HOLD_DATA = {
  id: 'hold-1',
  date: '2024-02-01',
  hold_type: 'OcfHoldTypeRegisterSettlement',
  reason_text: 'Shares held for the settlement of a trade at the register',
  reference: 'settlement-1',
  security_id: FOUNDERS_SECURITY_ID,
  comments: [],
  quantity: '1500.0000000000',
};

export const BOOK_DATA = { issuer, stakeholder, stockClass, issuance, acceptance };

/** The book's created events, the anchor first; `offset` is where each was created. */
export function bookEvents(context: RegisterContext = CONTEXT): Array<Record<string, unknown>> {
  return [
    anchorEvent('cid-anchor', context, { offset: 1 }),
    recordEvent('cid-issuer', 'issuer', issuer, { context, offset: 1 }),
    recordEvent('cid-stakeholder', 'stakeholder', stakeholder, { context, offset: 2 }),
    recordEvent('cid-class', 'stockClass', stockClass, { context, offset: 3 }),
    epochEvent('cid-epoch', COMMON_CLASS_ID, [], { context, offset: 3 }),
    recordEvent('cid-issuance', 'stockIssuance', issuance, { context, offset: 4 }),
    recordEvent('cid-acceptance', 'stockAcceptance', acceptance, { context, offset: 5 }),
    recordEvent('cid-hold', 'stockHold', HOLD_DATA, { context, offset: 6 }),
    stateEvent('cid-state', {}, { context, offset: 6 }),
    ...INITIAL_SHARD_PREFIXES.map((prefix) =>
      shardEvent(`cid-shard-${prefix}`, prefix, prefix === STAKEHOLDER_SHARD_PREFIX ? [STAKEHOLDER_CLAIM] : [], {
        context,
        offset: prefix === STAKEHOLDER_SHARD_PREFIX ? 2 : 1,
      })
    ),
  ];
}

/** The anchor read: the anchor events of the given books (a template filter, so no views). */
export function anchorItems(...anchors: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return anchors.map((anchor) => acsItem({ ...anchor, interfaceViews: [] }));
}
