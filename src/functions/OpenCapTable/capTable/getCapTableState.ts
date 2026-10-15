/**
 * Query Canton for the state of a CapTable on **this SDK’s pinned OpenCapTable package line** (`OCP_TEMPLATES.capTable`).
 *
 * Requests use the package-name symbolic template id (`#OpenCapTable-vN:…`). The ledger may echo
 * `createdEvent.templateId` using either that form or the package-id (`hash:…`) form for the same template.
 *
 * Validation therefore uses **structured fields** from the Canton JSON API: `createdEvent.packageName` must match
 * the pinned package name parsed from `OCP_TEMPLATES.capTable`, and the **module + entity** suffix of
 * `createdEvent.templateId` (everything after the first `:`) must match the pinned template. The SDK returns the
 * raw ledger `templateId` string unchanged for downstream commands.
 *
 * This is **not** a global “does this issuer have any CapTable on any package line?” API. Ledger filters use
 * the pinned template id; contracts on other OpenCapTable package versions are outside this query and are neither
 * loaded nor classified here.
 *
 * `classifyIssuerCapTables` / `getCapTableState` therefore answer only: “is there an active CapTable **on the
 * current package line** for this issuer?” A `none` / `null` result means the filtered query returned no matching row,
 * not that the issuer has zero CapTable-shaped contracts in Canton overall. Whether it is safe to create a new
 * CapTable is a separate DAML / operations concern.
 *
 * Rows that fail package-name or module-path checks throw `SCHEMA_MISMATCH`.
 *
 * @module getCapTableState
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';

import type { JsGetActiveContractsResponseItem } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/state';
import { OcpContractError, OcpErrorCodes } from '../../../errors';
import { isJsActiveContractItem, type ActiveContractCreatedEvent } from '../../../utils/activeContracts';
import {
  classifyContractReadFailure,
  contractReadFailureCode,
  createDiagnosedContractReadError,
} from '../../../utils/contractReadDiagnostics';
import { ledgerReadScope } from '../../../utils/readScope';
import { parseDamlMap } from '../../../utils/typeConversions';
import { readCapTablePositionFields } from '../positions/capTablePositionFields';
import {
  buildCapTablePositionState,
  POSITION_VESTING_RECORD_TYPES,
  queryActiveTemplateRows,
  readLedgerEndOffset,
  STOCK_POSITION_TEMPLATE_ID,
} from '../positions/positionLedger';
import type { CapTablePositionState, PositionContext } from '../positions/positionTypes';
import { ENTITY_TEMPLATE_ID_MAP, FIELD_TO_ENTITY_TYPE, SECURITY_ID_FIELD_TO_ENTITY_TYPE } from './batchTypes';
import type { OcfEntityType } from './entityTypes';

/** CapTable template ID this SDK treats as current (package-name symbolic form; used for ledger queries). */
const CURRENT_CAP_TABLE_TEMPLATE_ID = OCP_TEMPLATES.capTable;

/**
 * Pinned package line + module path from {@link CURRENT_CAP_TABLE_TEMPLATE_ID} (`#PackageName:Module:Entity`).
 * Used to validate `getActiveContracts` rows without requiring `createdEvent.templateId` to match the full string.
 */
const PINNED_CAP_TABLE_PACKAGE_LINE = (() => {
  const full = CURRENT_CAP_TABLE_TEMPLATE_ID;
  if (!full.startsWith('#')) {
    throw new Error(`Invalid pinned CapTable template id (expected # prefix): ${full}`);
  }
  const withoutHash = full.slice(1);
  const firstColon = withoutHash.indexOf(':');
  if (firstColon < 0) {
    throw new Error(`Invalid pinned CapTable template id (expected :): ${full}`);
  }
  const packageName = withoutHash.slice(0, firstColon);
  const moduleEntityPath = withoutHash.slice(firstColon + 1);
  return { packageName, moduleEntityPath };
})();

/**
 * Current state of a CapTable on Canton, with all canonical object IDs grouped by entity type.
 */
export interface CapTableState {
  /** Contract ID of the CapTable contract. */
  capTableContractId: string;

  /** Contract ID of the Issuer contract (referenced by the CapTable). */
  issuerContractId: string;

  /**
   * Map of entity type to canonical object IDs currently on-chain.
   * Each entry contains all object IDs of that type in the CapTable.
   */
  entities: Map<OcfEntityType, Set<string>>;

  /**
   * Map of entity type to (canonical object ID → Contract ID) for fetching individual contracts.
   * Useful for deep verification where contract data needs to be compared.
   */
  contractIds: Map<OcfEntityType, Map<string, string>>;

  /**
   * Map of issuance entity type to security_ids currently on-chain.
   *
   * Only populated for issuance types that enforce security_id uniqueness:
   * stockIssuance, convertibleIssuance, equityCompensationIssuance, warrantIssuance.
   *
   * Used by computeReplicationDiff to detect duplicate security_id conflicts before
   * submitting batch commands (avoiding DAML "security_id already exists" errors).
   */
  securityIds: Map<OcfEntityType, Set<string>>;

  /**
   * Whether the CapTable has positions, as the reader found it. Set on every state `getCapTableState` and
   * `classifyIssuerCapTables` return, so that root writers can tell "no positions" from "not checked":
   *
   * - `null`: the CapTable has no position fields (every OpenCapTable-v34 0.0.3 root), and its state is exactly the
   *   root maps.
   * - a {@link CapTablePositionState}: the CapTable has position registries (OpenCapTable-v34 0.0.4
   *   `EnablePositions`), read with the root at one ledger offset. The root maps are then no longer the whole book:
   *   `PositionRegistry` choices write `StockTransfer`, `StockIssuance`, `VestingStart`, `VestingEvent` and
   *   `VestingAcceleration` records outside them, and `entities`, `contractIds` and `securityIds` also list those
   *   records (see {@link CapTablePositionState.registryRecords}), so an OCF export replays to the positions' balances
   *   and holds the vesting history behind their snapshots.
   *
   * A state built by hand must say which: `computeReplicationDiff` throws when the field is missing, and
   * `CapTableBatch` then reads the CapTable instead of trusting the state.
   */
  positionState: CapTablePositionState | null;
}

/** CapTable state plus fields needed for ArchiveCapTable / batch commands. */
export interface CapTableWithArchiveContext extends CapTableState {
  templateId: string;
  systemOperatorPartyId: string;
}

/**
 * CapTable presence **for the pinned package line only** (see module doc; query uses `OCP_TEMPLATES.capTable`).
 * `none` means the filtered ledger query found no row on that template, not “no CapTable exists on any package.”
 */
export type IssuerCapTableStatus = 'current' | 'none';

export interface IssuerCapTableClassification {
  status: IssuerCapTableStatus;
  /** Populated when `status` is `current` (exactly one CapTable on the pinned package line). */
  current: CapTableWithArchiveContext | null;
}

function requireObjectRecord(value: unknown, message: string, contractId: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new OcpContractError(message, {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId,
    });
  }
  return value as Record<string, unknown>;
}

function requireIssuerCanonicalObjectId(eventsResponse: unknown, issuerContractId: string): string {
  const response = requireObjectRecord(
    eventsResponse,
    'Issuer contract events response must be an object',
    issuerContractId
  );
  const created = requireObjectRecord(
    response.created,
    'Issuer contract events response missing created payload',
    issuerContractId
  );
  const createdEvent = requireObjectRecord(
    created.createdEvent,
    'Issuer contract events response missing created.createdEvent',
    issuerContractId
  );
  const createArgument = requireObjectRecord(
    createdEvent.createArgument,
    'Issuer contract events response missing created.createdEvent.createArgument',
    issuerContractId
  );
  const issuerData = requireObjectRecord(
    createArgument.issuer_data,
    'Issuer contract createArgument.issuer_data must be an object',
    issuerContractId
  );
  const issuerId = issuerData.id;

  if (typeof issuerId !== 'string' || issuerId.length === 0) {
    throw new OcpContractError('Issuer contract createArgument.issuer_data.id must be a non-empty string', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId: issuerContractId,
    });
  }

  return issuerId;
}

async function buildCapTableStateFromCreatedEvent(
  client: LedgerJsonApiClient,
  createdEvent: {
    contractId: string;
    createArgument: Record<string, unknown>;
    templateId?: unknown;
  },
  issuerPartyId?: string
): Promise<CapTableState> {
  const { contractId, createArgument: payload } = createdEvent;

  // Build entity maps from payload fields
  const entities = new Map<OcfEntityType, Set<string>>();
  const contractIds = new Map<OcfEntityType, Map<string, string>>();

  for (const [field, entityType] of Object.entries(FIELD_TO_ENTITY_TYPE)) {
    const fieldData = payload[field];

    if (fieldData) {
      // DAML Map is serialized as array of tuples: [[key, value], [key, value], ...]
      const entries = parseDamlMap<string, string>(fieldData);

      if (entries.length > 0) {
        const objectIds = new Set(entries.map(([key]) => key));
        entities.set(entityType, objectIds);
        contractIds.set(entityType, new Map(entries));
      }
    }
  }

  // Build security_id maps from *_by_security_id payload fields
  // These track security_id uniqueness for issuance types
  const securityIds = new Map<OcfEntityType, Set<string>>();

  for (const [field, entityType] of Object.entries(SECURITY_ID_FIELD_TO_ENTITY_TYPE)) {
    const fieldData = payload[field];

    if (fieldData) {
      const entries = parseDamlMap<string, string>(fieldData);

      if (entries.length > 0) {
        securityIds.set(entityType, new Set(entries.map(([key]) => key)));
      }
    }
  }

  // Extract issuer contract ID from payload
  const issuerContractId = typeof payload.issuer === 'string' ? payload.issuer : '';

  // Fetch issuer contract to get the canonical object ID
  // (issuer is stored as a single contract reference, not a map like other entities)
  if (issuerContractId) {
    try {
      const eventsResponse = await client.getEventsByContractId({
        contractId: issuerContractId,
        ...ledgerReadScope({ readAs: issuerPartyId ? [issuerPartyId] : undefined }),
      });
      const issuerId = requireIssuerCanonicalObjectId(eventsResponse, issuerContractId);
      entities.set('issuer', new Set([issuerId]));
      contractIds.set('issuer', new Map([[issuerId, issuerContractId]]));
    } catch (error: unknown) {
      const classification = classifyContractReadFailure(error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (classification !== 'not_found') {
        throw createDiagnosedContractReadError({
          message: `Failed to fetch issuer contract events (${classification})`,
          code: contractReadFailureCode(classification),
          contractId: issuerContractId,
          cause: error instanceof Error ? error : new Error(String(error)),
          diagnostics: {
            classification,
            operation: 'getEventsByContractId',
            entityType: 'issuer',
            contractId: issuerContractId,
            ...(issuerPartyId ? { issuerPartyId } : {}),
          },
        });
      }

      // eslint-disable-next-line no-console -- Intentional warning for operational visibility
      console.warn('[getCapTableState] Issuer contract unavailable; continuing without issuer entity', {
        issuerContractId,
        classification,
        errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Continue without adding issuer to entities - issuerContractId is still available
    }
  }

  return {
    capTableContractId: contractId,
    issuerContractId,
    entities,
    contractIds,
    securityIds,
    positionState: null,
  };
}

function requireCapTableTemplateIdString(templateId: unknown, contractId: string): string {
  if (typeof templateId !== 'string' || templateId.length === 0) {
    throw new OcpContractError('CapTable contract templateId must be a non-empty string', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId,
    });
  }
  return templateId;
}

/** Module + entity path after the package reference (first `:`), for `#pkg:Mod:Ent` or `hash:Mod:Ent`. */
function damlTemplateModuleEntityPath(templateId: string, contractId: string): string {
  const i = templateId.indexOf(':');
  if (i < 0) {
    throw new OcpContractError('CapTable contract templateId is missing package or module path', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId,
      templateId,
    });
  }
  const path = templateId.slice(i + 1);
  if (path.length === 0) {
    throw new OcpContractError('CapTable contract templateId is missing module path after package reference', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId,
      templateId,
    });
  }
  return path;
}

function requireCapTablePackageNameString(
  packageName: unknown,
  contractId: string,
  templateIdForDiagnostics?: string
): string {
  if (typeof packageName !== 'string' || packageName.length === 0) {
    throw new OcpContractError('CapTable contract packageName must be a non-empty string', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId,
      ...(templateIdForDiagnostics ? { templateId: templateIdForDiagnostics } : {}),
    });
  }
  return packageName;
}

/**
 * Ensures the created event is the pinned CapTable template (same package line + module path as
 * `OCP_TEMPLATES.capTable`), regardless of whether `templateId` uses package-name or package-id form.
 * @returns Raw ledger `templateId` for downstream use.
 */
function requirePinnedCapTableCreatedEvent(createdEvent: {
  contractId: string;
  templateId?: unknown;
  packageName?: unknown;
}): string {
  const templateId = requireCapTableTemplateIdString(createdEvent.templateId, createdEvent.contractId);
  const packageName = requireCapTablePackageNameString(createdEvent.packageName, createdEvent.contractId, templateId);

  if (packageName !== PINNED_CAP_TABLE_PACKAGE_LINE.packageName) {
    throw new OcpContractError('CapTable contract packageName does not match pinned OpenCapTable package line', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId: createdEvent.contractId,
      templateId,
    });
  }

  const moduleEntityPath = damlTemplateModuleEntityPath(templateId, createdEvent.contractId);
  if (moduleEntityPath !== PINNED_CAP_TABLE_PACKAGE_LINE.moduleEntityPath) {
    throw new OcpContractError('CapTable contract template module path does not match pinned CapTable template', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId: createdEvent.contractId,
      templateId,
    });
  }

  return templateId;
}

/** The CapTable's `context.system_operator`, the party that archives it. */
function requireSystemOperatorPartyId(
  createdEvent: { contractId: string; createArgument: Record<string, unknown> },
  templateId: string
): string {
  const ctx = createdEvent.createArgument.context as Record<string, unknown> | undefined;
  const systemOperatorPartyId = typeof ctx?.system_operator === 'string' ? ctx.system_operator : '';
  if (!systemOperatorPartyId) {
    throw new OcpContractError('CapTable contract missing context.system_operator', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId: createdEvent.contractId,
      templateId,
    });
  }
  return systemOperatorPartyId;
}

async function capTableWithArchiveContext(
  client: LedgerJsonApiClient,
  createdEvent: {
    contractId: string;
    createArgument: Record<string, unknown>;
    templateId?: unknown;
  },
  templateId: string,
  issuerPartyId: string
): Promise<CapTableWithArchiveContext> {
  const base = await buildCapTableStateFromCreatedEvent(client, createdEvent, issuerPartyId);
  return { ...base, templateId, systemOperatorPartyId: requireSystemOperatorPartyId(createdEvent, templateId) };
}

/** A CapTable row of the pinned template, with the raw ledger template ID. */
interface CapTableRow {
  createdEvent: ActiveContractCreatedEvent;
  templateId: string;
}

function requireCapTableRow(contract: JsGetActiveContractsResponseItem): CapTableRow {
  if (!isJsActiveContractItem(contract)) {
    throw new OcpContractError('Invalid CapTable contract response: expected JsActiveContract entry', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId: 'unknown',
    });
  }
  const { createdEvent } = contract.contractEntry.JsActiveContract;
  return { createdEvent, templateId: requirePinnedCapTableCreatedEvent(createdEvent) };
}

/**
 * The issuer's active CapTable rows on the pinned package line (at most one), at `offset` when given, so the root can
 * be read together with other templates (positions and the create-only records) as of one point in the ledger.
 */
export async function loadCapTableRows(
  client: LedgerJsonApiClient,
  issuerPartyId: string,
  offset?: number
): Promise<CapTableRow[]> {
  const contracts = await client.getActiveContracts({
    parties: [issuerPartyId],
    templateIds: [CURRENT_CAP_TABLE_TEMPLATE_ID],
    ...(offset === undefined ? {} : { activeAtOffset: offset }),
  });
  const rows = contracts.map(requireCapTableRow);
  if (rows.length > 1) {
    throw new OcpContractError('Multiple active CapTable contracts for issuer', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId: rows.map((r) => r.createdEvent.contractId).join(','),
    });
  }
  return rows;
}

/** The CapTable's `context` (issuer and system operator), which its positions and records carry too. */
export function capTableRowContext(row: CapTableRow): PositionContext {
  const issuer = (row.createdEvent.createArgument.context as Record<string, unknown> | undefined)?.issuer;
  if (typeof issuer !== 'string' || issuer.length === 0) {
    throw new OcpContractError('CapTable contract missing context.issuer', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId: row.createdEvent.contractId,
      templateId: row.templateId,
    });
  }
  return { issuer, system_operator: requireSystemOperatorPartyId(row.createdEvent, row.templateId) };
}

/** Add the registry-written records to the root inventory, so readers see the whole book. */
function withPositionRecords(
  base: CapTableWithArchiveContext,
  positionState: CapTablePositionState
): CapTableWithArchiveContext {
  const rootSecurityIds = base.securityIds.get('stockIssuance') ?? new Set<string>();
  for (const [entityType, records] of positionState.registryRecords) {
    if (records.size === 0) continue;
    const ids = base.entities.get(entityType) ?? new Set<string>();
    const cids = base.contractIds.get(entityType) ?? new Map<string, string>();
    for (const [id, contractId] of records) {
      ids.add(id);
      cids.set(id, contractId);
    }
    base.entities.set(entityType, ids);
    base.contractIds.set(entityType, cids);
  }
  const registrySecurityIds = [...positionState.stockClassBySecurityId.keys()].filter((id) => !rootSecurityIds.has(id));
  if (registrySecurityIds.length > 0) {
    base.securityIds.set('stockIssuance', new Set([...rootSecurityIds, ...registrySecurityIds]));
  }
  return { ...base, positionState };
}

/**
 * Read a position-enabled CapTable together with its positions and the create-only records, all at the current
 * ledger end, so the root's migrated set and the positions cannot disagree.
 */
async function loadPositionAwareCapTable(
  client: LedgerJsonApiClient,
  issuerPartyId: string
): Promise<CapTableWithArchiveContext> {
  const offset = await readLedgerEndOffset(client);
  const [row] = await loadCapTableRows(client, issuerPartyId, offset);
  if (row === undefined) {
    throw new OcpContractError(`No active CapTable contract for issuer at offset ${offset}`, {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId: 'unknown',
    });
  }
  const base = await capTableWithArchiveContext(client, row.createdEvent, row.templateId, issuerPartyId);
  const fields = readCapTablePositionFields(row.createdEvent.createArgument, base.capTableContractId);
  if (!fields.enabled) {
    return base;
  }
  const context = capTableRowContext(row);
  const vestingRecordTypes = [...POSITION_VESTING_RECORD_TYPES.keys()];
  const [positions, stockIssuances, stockTransfers, vestingRecordRows] = await Promise.all([
    queryActiveTemplateRows(client, issuerPartyId, STOCK_POSITION_TEMPLATE_ID, offset),
    queryActiveTemplateRows(client, issuerPartyId, ENTITY_TEMPLATE_ID_MAP.stockIssuance, offset),
    queryActiveTemplateRows(client, issuerPartyId, ENTITY_TEMPLATE_ID_MAP.stockTransfer, offset),
    Promise.all(
      vestingRecordTypes.map(async (entityType) =>
        queryActiveTemplateRows(client, issuerPartyId, ENTITY_TEMPLATE_ID_MAP[entityType], offset)
      )
    ),
  ]);
  const positionState = buildCapTablePositionState({
    capTableContractId: base.capTableContractId,
    offset,
    asOf: new Date(),
    context,
    fields,
    rootContractIds: base.contractIds,
    positions,
    stockIssuances,
    stockTransfers,
    vestingRecords: new Map(
      vestingRecordTypes.map((entityType, index) => [entityType, vestingRecordRows[index] ?? []])
    ),
  });
  return withPositionRecords(base, positionState);
}

/** Active CapTable contracts for the issuer on the current pinned package line only. */
async function loadCurrentCapTables(
  client: LedgerJsonApiClient,
  issuerPartyId: string
): Promise<CapTableWithArchiveContext[]> {
  const out: CapTableWithArchiveContext[] = [];
  for (const { createdEvent, templateId } of await loadCapTableRows(client, issuerPartyId)) {
    // A CapTable without position fields (every 0.0.3 root) is read exactly as before: the root maps are the book.
    const { enabled } = readCapTablePositionFields(createdEvent.createArgument, createdEvent.contractId);
    out.push(
      enabled
        ? await loadPositionAwareCapTable(client, issuerPartyId)
        : await capTableWithArchiveContext(client, createdEvent, templateId, issuerPartyId)
    );
  }
  return out;
}

/**
 * The `context.system_operator` of the issuer's CapTable on the pinned package line, read from the CapTable row alone:
 * neither the issuer contract nor the position state is read, so what they hold cannot fail it.
 *
 * @returns The system operator party, or `null` when the issuer has no CapTable on the pinned package line
 * @throws OcpContractError — multiple active CapTables, a row that is not the pinned template, or no system operator
 */
export async function readCapTableSystemOperatorPartyId(
  client: LedgerJsonApiClient,
  issuerPartyId: string
): Promise<string | null> {
  const [row] = await loadCapTableRows(client, issuerPartyId);
  return row === undefined ? null : requireSystemOperatorPartyId(row.createdEvent, row.templateId);
}

/**
 * Classifies whether the issuer has an active CapTable on **the pinned OpenCapTable package line** (see module doc).
 *
 * @param client - Ledger JSON API client
 * @param issuerPartyId - Issuer party id to query (template-filtered active contracts)
 * @returns `'current'` with context when exactly one matching CapTable exists; `'none'` otherwise
 * @throws OcpContractError — e.g. multiple active CapTables, `SCHEMA_MISMATCH` when a row is not the pinned template
 */
export async function classifyIssuerCapTables(
  client: LedgerJsonApiClient,
  issuerPartyId: string
): Promise<IssuerCapTableClassification> {
  const currentRows = await loadCurrentCapTables(client, issuerPartyId);
  if (currentRows.length === 0) {
    return { status: 'none', current: null };
  }
  const [current] = currentRows;
  if (current === undefined) {
    throw new OcpContractError('CapTable query returned an inconsistent non-empty result', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId: 'unknown',
    });
  }
  return { status: 'current', current };
}

/**
 * Reads CapTable state **on the pinned package line only**, or `null` if the filtered query finds no such contract.
 * This does not imply the issuer has no CapTable on other templates.
 *
 * @param client - Ledger JSON API client
 * @param issuerPartyId - Issuer party id
 * @returns {@link CapTableState} for the current package-line CapTable, or `null` if {@link classifyIssuerCapTables} is `none`
 * @throws OcpContractError — same failure modes as {@link classifyIssuerCapTables} when loading the CapTable row
 */
export async function getCapTableState(
  client: LedgerJsonApiClient,
  issuerPartyId: string
): Promise<CapTableState | null> {
  const c = await classifyIssuerCapTables(client, issuerPartyId);
  if (c.status !== 'current' || !c.current) {
    return null;
  }
  const { templateId: _tid, systemOperatorPartyId: _op, ...state } = c.current;
  return state;
}
