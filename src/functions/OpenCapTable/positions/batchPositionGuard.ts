/**
 * Check an `UpdateCapTable` batch against the ledger's root guard for position-managed holdings before it is
 * submitted, the way the ledger checks it: the proposed version of every create and edit, and the stored version of
 * every record an edit replaces or a delete removes, against the root's position fields.
 *
 * @module batchPositionGuard
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import { ledgerReadScope } from '../../../utils/readScope';
import { isRecord, parseDamlMap } from '../../../utils/typeConversions';
import { ENTITY_DATA_FIELD_MAP, ENTITY_TEMPLATE_ID_MAP, FIELD_TO_ENTITY_TYPE } from '../capTable/batchTypes';
import type { OcfEntityType } from '../capTable/entityTypes';
import type { CapTableState } from '../capTable/getCapTableState';
import { readSingleContract } from '../shared/singleContractRead';
import { readCapTablePositionFields } from './capTablePositionFields';
import { isCompletePositionState, isRegistryRecord } from './positionLedger';
import type { CapTablePositionFields } from './positionTypes';
import {
  checkPositionRecordVersion,
  checkStockClassDelete,
  isPositionGuardedEntityType,
  positionRecordRefs,
  securitiesNeedingStockClass,
  type PositionRecordRefs,
  type PositionWriteRefusal,
  type PositionWriteViolation,
} from './positionWriteGuard';

/** One operation of a batch, with the data it writes (DAML or OCF field names; absent for deletes). */
export interface PositionGuardBatchItem {
  readonly operation: 'create' | 'edit' | 'delete';
  readonly entityType: OcfEntityType;
  readonly id: string;
  readonly data?: unknown;
}

/** Where the guard reads the CapTable from. */
export interface PositionGuardTarget {
  readonly capTableContractId: string;
  /** Template ID of the CapTable as the ledger returned it; defaults to the pinned package-name template. */
  readonly capTableTemplateId?: string;
  /**
   * Parties every read is scoped to, besides the client's own party. Name the parties that submit the batch (its
   * `actAs` and `readAs`): the client's party need not be a stakeholder of the CapTable.
   */
  readonly readAs?: string[];
  /**
   * The CapTable's state from `getCapTableState`. Used instead of reading the CapTable contract when it describes the
   * same contract ID and says whether it has positions: `positionState` is `null`, or a whole position state read from
   * that contract. Otherwise (the field missing, deserialized from JSON, or from another contract) the CapTable is
   * read.
   */
  readonly capTableState?: CapTableState;
}

/** The ledger state the guard needs, from a CapTableState or from the CapTable payload. */
interface GuardView {
  readonly fields: CapTablePositionFields;
  /** Contract ID of the root record an edit or delete addresses, if the root lists it. */
  readonly rootContractId: (entityType: OcfEntityType, id: string) => string | undefined;
  /** Whether a position registry wrote this record outside the root maps. */
  readonly isRegistryRecord: (entityType: OcfEntityType, id: string) => boolean;
  /** Stock class of each security's root stock issuance, where the root lists one (as the ledger guard reads it). */
  readonly stockClasses: (securityIds: readonly string[]) => Promise<ReadonlyMap<string, string>>;
}

/** Ledger reads the guard keeps in flight at once. */
const READ_CONCURRENCY = 8;

/** Map with at most `limit` calls in flight, keeping the input order. */
async function mapWithConcurrency<T, R>(
  inputs: readonly T[],
  limit: number,
  fn: (input: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(inputs.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < inputs.length) {
      const index = next;
      next += 1;
      results[index] = await fn(inputs[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, inputs.length) }, worker));
  return results;
}

const CAP_TABLE_FIELD_BY_ENTITY_TYPE = new Map(
  Object.entries(FIELD_TO_ENTITY_TYPE).map(([field, entityType]) => [entityType, field])
);

const NO_POSITIONS: CapTablePositionFields = {
  enabled: false,
  registries: new Map(),
  migratedSecurityIds: new Map(),
};

async function readContractData(
  client: LedgerJsonApiClient,
  entityType: OcfEntityType,
  contractId: string,
  readAs: string[] | undefined
): Promise<unknown> {
  const { createArgument } = await readSingleContract(
    client,
    { contractId, ...ledgerReadScope({ readAs }) },
    { operation: `positionGuard.storedVersion(${entityType})`, expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType] }
  );
  return createArgument[ENTITY_DATA_FIELD_MAP[entityType]];
}

/**
 * The state's view of the CapTable, when it describes `capTableContractId` and says whether it has positions; else
 * `undefined`, and the CapTable must be read.
 */
function trustedStateView(state: CapTableState | undefined, capTableContractId: string): GuardView | undefined {
  if (state?.capTableContractId !== capTableContractId) return undefined;
  // Read as unknown: a state built by hand or deserialized may lack the field or hold plain objects for its maps.
  const { positionState }: { positionState?: unknown } = state;
  if (positionState === null) return viewFromState(state);
  return isCompletePositionState(positionState) && positionState.capTableContractId === capTableContractId
    ? viewFromState(state)
    : undefined;
}

function viewFromState(state: CapTableState): GuardView {
  const { positionState } = state;
  if (positionState === null) {
    return {
      fields: NO_POSITIONS,
      rootContractId: () => undefined,
      isRegistryRecord: () => false,
      stockClasses: async () => Promise.resolve(new Map()),
    };
  }
  const isRegistry = (entityType: OcfEntityType, id: string): boolean =>
    isRegistryRecord(positionState, entityType, id);
  return {
    fields: positionState,
    rootContractId: (entityType, id) =>
      isRegistry(entityType, id) ? undefined : state.contractIds.get(entityType)?.get(id),
    isRegistryRecord: isRegistry,
    // As the ledger does: the class of the root stock issuance of each security, never a registry-written one's.
    stockClasses: async (securityIds) =>
      Promise.resolve(
        new Map(
          securityIds.flatMap((securityId) => {
            const stockClassId = positionState.stockClassBySecurityId.get(securityId);
            return stockClassId === undefined ? [] : [[securityId, stockClassId] as const];
          })
        )
      ),
  };
}

async function viewFromLedger(client: LedgerJsonApiClient, target: PositionGuardTarget): Promise<GuardView> {
  const { createArgument } = await readSingleContract(
    client,
    { contractId: target.capTableContractId, ...ledgerReadScope({ readAs: target.readAs }) },
    {
      operation: 'positionGuard.capTable',
      expectedTemplateId: target.capTableTemplateId ?? OCP_TEMPLATES.capTable,
    }
  );
  const fields = readCapTablePositionFields(createArgument, target.capTableContractId);
  const rootMaps = new Map<string, ReadonlyMap<string, string>>();
  const rootMap = (field: string): ReadonlyMap<string, string> => {
    let map = rootMaps.get(field);
    if (map === undefined) {
      map = new Map(
        parseDamlMap<string, unknown>(createArgument[field]).flatMap(([key, value]) =>
          typeof value === 'string' ? [[key, value] as const] : []
        )
      );
      rootMaps.set(field, map);
    }
    return map;
  };
  return {
    fields,
    rootContractId: (entityType, id) => {
      const field = CAP_TABLE_FIELD_BY_ENTITY_TYPE.get(entityType);
      return field === undefined ? undefined : rootMap(field).get(id);
    },
    isRegistryRecord: () => false,
    // As the ledger does: the class of the root stock issuance of each security (one fetch each).
    stockClasses: async (securityIds) => {
      const issuances = rootMap('stock_issuances_by_security_id');
      const listed = securityIds.flatMap((securityId) => {
        const contractId = issuances.get(securityId);
        return contractId === undefined ? [] : [[securityId, contractId] as const];
      });
      const classes = await mapWithConcurrency(listed, READ_CONCURRENCY, async ([securityId, contractId]) => {
        const data = await readContractData(client, 'stockIssuance', contractId, target.readAs);
        return isRecord(data) && typeof data.stock_class_id === 'string'
          ? [[securityId, data.stock_class_id] as const]
          : [];
      });
      return new Map(classes.flat());
    },
  };
}

/**
 * Find every item of a batch that the ledger's root guard for position-managed holdings would reject, before the
 * batch is submitted.
 *
 * Reads the CapTable contract unless `target.capTableState` describes it (see {@link PositionGuardTarget.capTableState});
 * on a root without position fields that is the only read. Otherwise reads the stored version of each guarded record an edit or delete addresses, and the root
 * stock issuance of each security a record names outside a class, as the ledger does.
 *
 * @returns The refused items in batch order; empty when the ledger guard would accept the batch
 */
export async function findPositionManagedWrites(
  client: LedgerJsonApiClient,
  items: readonly PositionGuardBatchItem[],
  target: PositionGuardTarget
): Promise<PositionWriteRefusal[]> {
  if (items.length === 0) return [];
  const view =
    trustedStateView(target.capTableState, target.capTableContractId) ?? (await viewFromLedger(client, target));
  if (!view.fields.enabled) return [];

  // The versions each item puts to the guard: its proposed data and the stored record it replaces or removes.
  const checks = await mapWithConcurrency(items, READ_CONCURRENCY, async (item) => {
    const versions: Array<{ version: 'proposed' | 'stored'; refs: PositionRecordRefs }> = [];
    const early: PositionWriteViolation[] = [];
    if (item.operation !== 'create' && view.isRegistryRecord(item.entityType, item.id)) {
      early.push({
        reason: 'registry_record',
        message: `${item.entityType} ${item.id} was written by a position registry outside the CapTable root`,
      });
    }
    if (item.operation === 'delete') early.push(...checkStockClassDelete(item.entityType, item.id, view.fields));
    if (item.operation !== 'delete') {
      const refs = positionRecordRefs(item.entityType, item.id, item.data);
      if (refs !== null) versions.push({ version: 'proposed', refs });
    }
    if (item.operation !== 'create' && isPositionGuardedEntityType(item.entityType)) {
      const contractId = view.rootContractId(item.entityType, item.id);
      // An ID the root does not list has no stored version; UpdateCapTable rejects the write itself.
      if (contractId !== undefined) {
        const stored = await readContractData(client, item.entityType, contractId, target.readAs);
        const refs = positionRecordRefs(item.entityType, item.id, stored);
        if (refs !== null) versions.push({ version: 'stored', refs });
      }
    }
    return { item, early, versions };
  });

  const securities = [
    ...new Set(checks.flatMap((check) => check.versions.flatMap((v) => securitiesNeedingStockClass(v.refs)))),
  ];
  const stockClasses = await view.stockClasses(securities);

  return checks.flatMap(({ item, early, versions }) => {
    const violations = [
      ...early,
      ...versions.flatMap(({ version, refs }) =>
        checkPositionRecordVersion(refs, version, view.fields, (securityId) => stockClasses.get(securityId))
      ),
    ];
    return violations.length === 0
      ? []
      : [{ operation: item.operation, entityType: item.entityType, id: item.id, violations }];
  });
}
