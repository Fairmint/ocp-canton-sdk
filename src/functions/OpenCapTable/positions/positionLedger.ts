/**
 * Ledger reads for the position register: the issuer's `StockPosition` contracts and the create-only OCF records that
 * `PositionRegistry` choices write outside the CapTable root.
 *
 * Templates are queried by package-name template ID (`#OpenCapTable-v34:…`), so the ledger resolves them in whichever
 * vetted package version defines them. `StockPosition` exists from OpenCapTable-v34 0.0.4 on; callers query it only
 * for a CapTable whose position fields are set, which only a 0.0.4 root can have.
 *
 * @module positionLedger
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes, OcpParseError } from '../../../errors';
import { isJsActiveContractItem, type ActiveContractCreatedEvent } from '../../../utils/activeContracts';
import { assertTemplateIdentity } from '../../../utils/templateIdentity';
import { isRecord } from '../../../utils/typeConversions';
import { ENTITY_DATA_FIELD_MAP } from '../capTable/batchTypes';
import type { OcfEntityType } from '../capTable/entityTypes';
import { decodeStockPosition } from './decodeStockPosition';
import { summarizeStockPosition } from './positionQuantities';
import type {
  CapTablePositionFields,
  CapTablePositionState,
  ConflictingPositionRecord,
  PositionContext,
  PositionReferencedObjectType,
  PositionRegistryRecordType,
  PositionVestingRecordType,
  StockPositionState,
  UnattributedPositionRecord,
} from './positionTypes';

/** Package reference of the pinned OpenCapTable line (`#OpenCapTable-v34`), taken from the CapTable template ID. */
const OCP_PACKAGE_REF = OCP_TEMPLATES.capTable.slice(0, OCP_TEMPLATES.capTable.indexOf(':'));

/** Package-name template ID of `Fairmint.OpenCapTable.Positions:StockPosition` on the pinned OpenCapTable line. */
export const STOCK_POSITION_TEMPLATE_ID = `${OCP_PACKAGE_REF}:Fairmint.OpenCapTable.Positions:StockPosition`;

/** The OCF vesting records `Registry_RecordVesting` writes, with their template names, in the order they are read. */
export const POSITION_VESTING_RECORD_TYPES: ReadonlyMap<PositionVestingRecordType, string> = new Map([
  ['vestingStart', 'VestingStart'],
  ['vestingEvent', 'VestingEvent'],
  ['vestingAcceleration', 'VestingAcceleration'],
]);

const POSITION_REGISTRY_RECORD_TYPES: ReadonlySet<OcfEntityType> = new Set<PositionRegistryRecordType>([
  'stockIssuance',
  'stockTransfer',
  ...POSITION_VESTING_RECORD_TYPES.keys(),
]);

/** Whether a position registry can write records of this entity type. */
function isPositionRegistryRecordType(entityType: OcfEntityType): entityType is PositionRegistryRecordType {
  return POSITION_REGISTRY_RECORD_TYPES.has(entityType);
}

/** An active contract row whose template identity was checked. */
interface ActiveTemplateRow {
  createdEvent: ActiveContractCreatedEvent;
  templateId: string;
}

/** Current ledger end, to read several templates as of one offset. */
export async function readLedgerEndOffset(client: LedgerJsonApiClient): Promise<number> {
  const response: unknown = await client.getLedgerEnd({});
  const offset = isRecord(response) ? response.offset : undefined;
  if (typeof offset !== 'number' || !Number.isSafeInteger(offset) || offset < 0) {
    throw new OcpParseError('Ledger end response has no valid offset', {
      source: 'getLedgerEnd',
      code: OcpErrorCodes.INVALID_RESPONSE,
      classification: 'invalid_ledger_end',
      context: { receivedValue: offset },
    });
  }
  return offset;
}

/**
 * Active contracts of one template visible to `party` at `offset`, each checked to be that template (module path and
 * package name).
 */
export async function queryActiveTemplateRows(
  client: LedgerJsonApiClient,
  party: string,
  templateId: string,
  offset: number
): Promise<ActiveTemplateRow[]> {
  const items = await client.getActiveContracts({
    parties: [party],
    templateIds: [templateId],
    activeAtOffset: offset,
  });
  return items.map((item) => {
    if (!isJsActiveContractItem(item)) {
      throw new OcpContractError(`Invalid ${templateId} contract response: expected JsActiveContract entry`, {
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        contractId: 'unknown',
        templateId,
      });
    }
    const { createdEvent } = item.contractEntry.JsActiveContract;
    const identity = assertTemplateIdentity(
      { templateId: createdEvent.templateId, packageName: createdEvent.packageName },
      templateId,
      { contractId: createdEvent.contractId, operation: 'queryActiveTemplateRows' }
    );
    return { createdEvent, templateId: identity.templateId };
  });
}

/** Whether a record's `context` is the cap table's (same issuer and system operator). */
function hasContext(createArgument: Record<string, unknown>, context: PositionContext): boolean {
  const recordContext = createArgument.context;
  return (
    isRecord(recordContext) &&
    recordContext.issuer === context.issuer &&
    recordContext.system_operator === context.system_operator
  );
}

/**
 * Decode and summarize the `StockPosition` rows of one cap table's context, in ledger order, with vested and drawable
 * quantities as of `asOf` (a `Date`, or a DAML `Time`).
 */
export function stockPositionStates(
  rows: readonly ActiveTemplateRow[],
  context: PositionContext,
  asOf: Date | string
): StockPositionState[] {
  return rows
    .filter((row) => hasContext(row.createdEvent.createArgument, context))
    .map((row) =>
      summarizeStockPosition(
        row.createdEvent.contractId,
        row.templateId,
        decodeStockPosition(row.createdEvent.createArgument, row.createdEvent.contractId),
        asOf
      )
    );
}

function recordText(data: Record<string, unknown>, field: string, source: string, contractId: string): string {
  const value = data[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new OcpParseError(`${source}.${field} must be a non-empty string`, {
      source: `${source}.${field}`,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'invalid_position_record',
      context: { contractId },
    });
  }
  return value;
}

function recordData(row: ActiveTemplateRow, field: string, source: string): Record<string, unknown> {
  const data = row.createdEvent.createArgument[field];
  if (!isRecord(data)) {
    throw new OcpParseError(`${source}.${field} must be an object`, {
      source: `${source}.${field}`,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'invalid_position_record',
      context: { contractId: row.createdEvent.contractId },
    });
  }
  return data;
}

/** What one stock issuance record says, as far as the position state needs it. */
interface IssuanceRecord {
  contractId: string;
  id: string;
  securityId: string;
  stockClassId: string;
  stakeholderId: string;
  stockLegendIds: string[];
  stockPlanId: string | null;
  vestingTermsId: string | null;
}

function optionalRecordText(data: Record<string, unknown>, field: string): string | null {
  const value = data[field];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function issuanceRecord(row: ActiveTemplateRow): IssuanceRecord {
  const { contractId } = row.createdEvent;
  const data = recordData(row, 'issuance_data', 'StockIssuance');
  return {
    contractId,
    id: recordText(data, 'id', 'StockIssuance.issuance_data', contractId),
    securityId: recordText(data, 'security_id', 'StockIssuance.issuance_data', contractId),
    stockClassId: recordText(data, 'stock_class_id', 'StockIssuance.issuance_data', contractId),
    stakeholderId: recordText(data, 'stakeholder_id', 'StockIssuance.issuance_data', contractId),
    stockLegendIds: Array.isArray(data.stock_legend_ids)
      ? data.stock_legend_ids.filter((value): value is string => typeof value === 'string')
      : [],
    stockPlanId: optionalRecordText(data, 'stock_plan_id'),
    vestingTermsId: optionalRecordText(data, 'vesting_terms_id'),
  };
}

/**
 * The security a stock transfer draws on, and the securities it results in: its resulting securities and its balance
 * security, if any.
 */
function transferSecurities(row: ActiveTemplateRow): { id: string; source: string | null; results: string[] } {
  const { contractId } = row.createdEvent;
  const data = recordData(row, 'transfer_data', 'StockTransfer');
  const resulting = Array.isArray(data.resulting_security_ids) ? data.resulting_security_ids : [];
  const balance = data.balance_security_id;
  return {
    id: recordText(data, 'id', 'StockTransfer.transfer_data', contractId),
    source: optionalRecordText(data, 'security_id'),
    results: [
      ...resulting.filter((value): value is string => typeof value === 'string'),
      ...(typeof balance === 'string' ? [balance] : []),
    ],
  };
}

/** The OCF ID of a vesting record and the security (the lot) it names. */
function vestingRecordRef(
  row: ActiveTemplateRow,
  entityType: PositionVestingRecordType
): { id: string; securityId: string } {
  const source = POSITION_VESTING_RECORD_TYPES.get(entityType) ?? entityType;
  const dataField = ENTITY_DATA_FIELD_MAP[entityType];
  const data = recordData(row, dataField, source);
  const { contractId } = row.createdEvent;
  return {
    id: recordText(data, 'id', `${source}.${dataField}`, contractId),
    securityId: recordText(data, 'security_id', `${source}.${dataField}`, contractId),
  };
}

/** One line naming every record that carries a conflicting OCF ID or security ID. */
function describeConflictingPositionRecord(conflict: ConflictingPositionRecord): string {
  const shared = conflict.field === 'id' ? conflict.value : `security_id ${conflict.value}`;
  const registry = conflict.registryContractIds.join(', ');
  return conflict.rootContractId === null
    ? `${conflict.entityType} ${shared} is carried by registry-written records ${registry}`
    : `${conflict.entityType} ${shared} is carried by root record ${conflict.rootContractId} and registry-written record(s) ${registry}`;
}

/**
 * Refuse to run `operation` on a cap table whose registry-written records reuse OCF IDs or security IDs: which record
 * such an ID means is undecidable.
 *
 * @throws OcpContractError (classification `duplicate_position_record_id`) naming every colliding record
 */
export function assertNoConflictingPositionRecords(state: CapTablePositionState, operation: string): void {
  const conflicts = state.conflictingRecords;
  if (conflicts.length === 0) return;
  throw new OcpContractError(
    `${operation} cannot run on CapTable ${state.capTableContractId}: position registries wrote records whose OCF ` +
      `IDs or security IDs are not unique (${conflicts.map(describeConflictingPositionRecord).join('; ')})`,
    {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId: state.capTableContractId,
      classification: 'duplicate_position_record_id',
      context: {
        conflictingRecords: conflicts.map((conflict) => ({
          ...conflict,
          registryContractIds: [...conflict.registryContractIds],
        })),
      },
    }
  );
}

/** Inputs of {@link buildCapTablePositionState}, all read at one offset. */
export interface CapTablePositionSnapshot {
  capTableContractId: string;
  offset: number;
  /** The instant the positions' vested and drawable quantities are computed for. */
  asOf: Date | string;
  context: PositionContext;
  fields: CapTablePositionFields;
  /** The root maps, as `CapTableState.contractIds`: entity type → (OCF object ID → contract ID). */
  rootContractIds: ReadonlyMap<OcfEntityType, ReadonlyMap<string, string>>;
  positions: ActiveTemplateRow[];
  stockIssuances: ActiveTemplateRow[];
  stockTransfers: ActiveTemplateRow[];
  /** Active rows of each vesting record template; a type left out has none. */
  vestingRecords: ReadonlyMap<PositionVestingRecordType, readonly ActiveTemplateRow[]>;
}

/**
 * Classify the cap table's active stock issuances, transfers and vesting records into root records, records a position
 * registry wrote, and records nothing accounts for, and collect what root writers must not touch.
 *
 * A registry-written issuance is an issuance of the cap table's context in a position-managed class that the root
 * maps do not list. A registry-written transfer is an unlisted transfer that draws on a security of a position-managed
 * class (`Registry_Transfer` draws a lot of the registry's class: a migrated root security or one a registry issued)
 * and whose resulting and balance securities are all securities of registry-written issuances (`Registry_Transfer`
 * writes both in one transaction). A registry-written vesting record (start, event or acceleration) is an unlisted
 * one that names a security a lot can have: a registry-written issuance's or a migrated root issuance's
 * (`Registry_RecordVesting` checks that it names a lot of the position). These rules check consistency with what the
 * registry choices write, not provenance: the issuer and system operator, who jointly sign the root and the
 * positions, could also create such records directly, which no Fairmint code does.
 *
 * A registry record that reuses an OCF ID of the cap table, or a stock issuance security ID of another root or
 * registry issuance, is listed in `conflictingRecords`, not thrown.
 *
 * @throws OcpContractError when a root-listed issuance is not active at the offset
 */
export function buildCapTablePositionState(snapshot: CapTablePositionSnapshot): CapTablePositionState {
  const { context, fields } = snapshot;
  const rootIssuances = snapshot.rootContractIds.get('stockIssuance') ?? new Map<string, string>();
  const rootTransfers = snapshot.rootContractIds.get('stockTransfer') ?? new Map<string, string>();
  const rootIssuanceCids = new Set(rootIssuances.values());
  const rootTransferCids = new Set(rootTransfers.values());

  const stockClassBySecurityId = new Map<string, string>();
  const supersededStockIssuances = new Map<string, string>();
  const referencedStakeholderIds = new Set<string>(fields.migratedSecurityIds.values());
  const referencedObjectIds = new Map<PositionReferencedObjectType, Set<string>>([
    ['stockLegendTemplate', new Set()],
    ['stockPlan', new Set()],
    ['vestingTerms', new Set()],
  ]);
  const addReferencedObjects = (stockLegendIds: readonly string[], stockPlanId: unknown, vestingTermsId: unknown) => {
    for (const legendId of stockLegendIds) referencedObjectIds.get('stockLegendTemplate')?.add(legendId);
    if (typeof stockPlanId === 'string' && stockPlanId.length > 0)
      referencedObjectIds.get('stockPlan')?.add(stockPlanId);
    if (typeof vestingTermsId === 'string' && vestingTermsId.length > 0) {
      referencedObjectIds.get('vestingTerms')?.add(vestingTermsId);
    }
  };
  const registryIssuances = new Map<string, string>();
  const registryTransfers = new Map<string, string>();
  const unattributedRecords: UnattributedPositionRecord[] = [];
  const conflicts = new Map<string, ConflictingPositionRecord & { registryContractIds: string[] }>();
  const seenRootIssuanceCids = new Set<string>();
  const rootIssuanceBySecurityId = new Map<string, string>();
  const registryIssuancesBySecurityId = new Map<string, string[]>();

  // The root record, else the first registry record, keeps the ID; every collision is recorded, not thrown, so
  // readers that do not depend on the ID (classification, the archive context) still work.
  const addRegistryRecord = (
    entityType: PositionRegistryRecordType,
    records: Map<string, string>,
    rootRecords: ReadonlyMap<string, string>,
    id: string,
    contractId: string
  ): void => {
    const rootContractId = rootRecords.get(id);
    const firstRegistryContractId = records.get(id);
    if (rootContractId === undefined && firstRegistryContractId === undefined) {
      records.set(id, contractId);
      return;
    }
    const key = `${entityType}:${id}`;
    const conflict = conflicts.get(key) ?? {
      entityType,
      field: 'id' as const,
      value: id,
      rootContractId: rootContractId ?? null,
      registryContractIds: firstRegistryContractId === undefined ? [] : [firstRegistryContractId],
    };
    conflict.registryContractIds.push(contractId);
    conflicts.set(key, conflict);
  };

  for (const row of snapshot.stockIssuances) {
    if (!hasContext(row.createdEvent.createArgument, context)) continue;
    const record = issuanceRecord(row);
    if (rootIssuanceCids.has(record.contractId)) {
      seenRootIssuanceCids.add(record.contractId);
      rootIssuanceBySecurityId.set(record.securityId, record.contractId);
      stockClassBySecurityId.set(record.securityId, record.stockClassId);
      if (fields.migratedSecurityIds.has(record.securityId)) {
        supersededStockIssuances.set(record.id, record.securityId);
      }
    } else if (fields.registries.has(record.stockClassId)) {
      addRegistryRecord('stockIssuance', registryIssuances, rootIssuances, record.id, record.contractId);
      const sameSecurity = registryIssuancesBySecurityId.get(record.securityId);
      if (sameSecurity === undefined) registryIssuancesBySecurityId.set(record.securityId, [record.contractId]);
      else sameSecurity.push(record.contractId);
      referencedStakeholderIds.add(record.stakeholderId);
      addReferencedObjects(record.stockLegendIds, record.stockPlanId, record.vestingTermsId);
    } else {
      unattributedRecords.push({ entityType: 'stockIssuance', id: record.id, contractId: record.contractId });
    }
  }

  const missingRootIssuances = [...rootIssuanceCids].filter((cid) => !seenRootIssuanceCids.has(cid));
  if (missingRootIssuances.length > 0) {
    throw new OcpContractError(
      `CapTable lists ${missingRootIssuances.length} stock issuance contract(s) that are not active at offset ${snapshot.offset}`,
      {
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        contractId: snapshot.capTableContractId,
        classification: 'inconsistent_position_snapshot',
        context: { missingContractIds: missingRootIssuances.slice(0, 10) },
      }
    );
  }

  for (const row of snapshot.stockTransfers) {
    const { contractId } = row.createdEvent;
    if (!hasContext(row.createdEvent.createArgument, context) || rootTransferCids.has(contractId)) continue;
    const { id, source, results } = transferSecurities(row);
    const sourceClass = source === null ? undefined : stockClassBySecurityId.get(source);
    const drawsManagedLot =
      source !== null &&
      (registryIssuancesBySecurityId.has(source) || (sourceClass !== undefined && fields.registries.has(sourceClass)));
    if (
      drawsManagedLot &&
      results.length > 0 &&
      results.every((securityId) => registryIssuancesBySecurityId.has(securityId))
    ) {
      addRegistryRecord('stockTransfer', registryTransfers, rootTransfers, id, contractId);
    } else {
      unattributedRecords.push({ entityType: 'stockTransfer', id, contractId });
    }
  }

  // Registry_RecordVesting names a lot of the position: one a registry issued, or a migrated root security.
  const registryVestingRecords = new Map<PositionVestingRecordType, Map<string, string>>();
  for (const entityType of POSITION_VESTING_RECORD_TYPES.keys()) {
    const rootRecords = snapshot.rootContractIds.get(entityType) ?? new Map<string, string>();
    const rootCids = new Set(rootRecords.values());
    const records = new Map<string, string>();
    registryVestingRecords.set(entityType, records);
    for (const row of snapshot.vestingRecords.get(entityType) ?? []) {
      const { contractId } = row.createdEvent;
      if (!hasContext(row.createdEvent.createArgument, context) || rootCids.has(contractId)) continue;
      const { id, securityId } = vestingRecordRef(row, entityType);
      if (registryIssuancesBySecurityId.has(securityId) || fields.migratedSecurityIds.has(securityId)) {
        addRegistryRecord(entityType, records, rootRecords, id, contractId);
      } else {
        unattributedRecords.push({ entityType, id, contractId });
      }
    }
  }

  // Registry_Issue and Registry_Transfer check a security ID only against the lots of the position they write.
  const securityConflicts: ConflictingPositionRecord[] = [];
  for (const [securityId, registryContractIds] of registryIssuancesBySecurityId) {
    const rootContractId = rootIssuanceBySecurityId.get(securityId) ?? null;
    if (registryContractIds.length + (rootContractId === null ? 0 : 1) > 1) {
      securityConflicts.push({
        entityType: 'stockIssuance',
        field: 'security_id',
        value: securityId,
        rootContractId,
        registryContractIds,
      });
    }
  }

  const positions = stockPositionStates(snapshot.positions, context, snapshot.asOf);
  for (const position of positions) {
    referencedStakeholderIds.add(position.position.stakeholder_id);
    for (const lot of position.position.lots.values()) {
      addReferencedObjects(lot.issuance.stock_legend_ids, lot.issuance.stock_plan_id, lot.issuance.vesting_terms_id);
    }
  }

  return {
    ...fields,
    capTableContractId: snapshot.capTableContractId,
    offset: snapshot.offset,
    positions,
    supersededStockIssuances,
    registryRecords: new Map<PositionRegistryRecordType, ReadonlyMap<string, string>>([
      ['stockIssuance', registryIssuances],
      ['stockTransfer', registryTransfers],
      ...registryVestingRecords,
    ]),
    stockClassBySecurityId,
    registrySecurityIds: new Set(registryIssuancesBySecurityId.keys()),
    referencedStakeholderIds,
    referencedObjectIds,
    unattributedRecords,
    conflictingRecords: [...conflicts.values(), ...securityConflicts],
  };
}

/** Whether a position registry wrote this record outside the root maps. */
export function isRegistryRecord(state: CapTablePositionState, entityType: OcfEntityType, id: string): boolean {
  return isPositionRegistryRecordType(entityType) && state.registryRecords.get(entityType)?.has(id) === true;
}

/**
 * Whether a value is a whole {@link CapTablePositionState} as `getCapTableState` builds it, with its maps and sets
 * intact. A state deserialized from JSON (maps turned into plain objects) or assembled by hand with fields missing is
 * not, and no guard may run on it.
 */
export function isCompletePositionState(state: unknown): state is CapTablePositionState {
  if (!isRecord(state)) return false;
  return (
    typeof state.enabled === 'boolean' &&
    typeof state.capTableContractId === 'string' &&
    typeof state.offset === 'number' &&
    state.registries instanceof Map &&
    state.migratedSecurityIds instanceof Map &&
    Array.isArray(state.positions) &&
    state.supersededStockIssuances instanceof Map &&
    state.registryRecords instanceof Map &&
    state.stockClassBySecurityId instanceof Map &&
    state.registrySecurityIds instanceof Set &&
    state.referencedStakeholderIds instanceof Set &&
    state.referencedObjectIds instanceof Map &&
    Array.isArray(state.unattributedRecords) &&
    Array.isArray(state.conflictingRecords)
  );
}
