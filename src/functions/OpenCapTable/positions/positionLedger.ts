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
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import type { OcfEntityType } from '../capTable/entityTypes';
import { decodeStockPosition } from './decodeStockPosition';
import { summarizeStockPosition } from './positionQuantities';
import type {
  CapTablePositionFields,
  CapTablePositionState,
  PositionContext,
  PositionRegistryRecordType,
  StockPositionState,
  UnattributedPositionRecord,
} from './positionTypes';

/** Package reference of the pinned OpenCapTable line (`#OpenCapTable-v34`), taken from the CapTable template ID. */
const OCP_PACKAGE_REF = OCP_TEMPLATES.capTable.slice(0, OCP_TEMPLATES.capTable.indexOf(':'));

/** Package-name template ID of `Fairmint.OpenCapTable.Positions:StockPosition` on the pinned OpenCapTable line. */
export const STOCK_POSITION_TEMPLATE_ID = `${OCP_PACKAGE_REF}:Fairmint.OpenCapTable.Positions:StockPosition`;

/** An active contract row whose template identity was checked. */
export interface ActiveTemplateRow {
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

/** Decode and summarize the `StockPosition` rows of one cap table's context, in ledger order. */
export function stockPositionStates(
  rows: readonly ActiveTemplateRow[],
  context: PositionContext
): StockPositionState[] {
  return rows
    .filter((row) => hasContext(row.createdEvent.createArgument, context))
    .map((row) =>
      summarizeStockPosition(
        row.createdEvent.contractId,
        row.templateId,
        decodeStockPosition(row.createdEvent.createArgument, row.createdEvent.contractId)
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
  };
}

/** The securities a stock transfer results in: its resulting securities and its balance security, if any. */
function transferResults(row: ActiveTemplateRow): { id: string; results: string[] } {
  const { contractId } = row.createdEvent;
  const data = recordData(row, 'transfer_data', 'StockTransfer');
  const resulting = Array.isArray(data.resulting_security_ids) ? data.resulting_security_ids : [];
  const balance = data.balance_security_id;
  return {
    id: recordText(data, 'id', 'StockTransfer.transfer_data', contractId),
    results: [
      ...resulting.filter((value): value is string => typeof value === 'string'),
      ...(typeof balance === 'string' ? [balance] : []),
    ],
  };
}

function duplicateRecordError(entityType: OcfEntityType, id: string, contractIds: string[]): OcpContractError {
  return new OcpContractError(
    `Position registry ${entityType} ${id} reuses an OCF ID already on the cap table; OCF IDs written by a registry must be unique`,
    {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId: contractIds.join(','),
      classification: 'duplicate_position_record_id',
      context: { entityType, id },
    }
  );
}

/** Inputs of {@link buildCapTablePositionState}, all read at one offset. */
export interface CapTablePositionSnapshot {
  capTableContractId: string;
  offset: number;
  context: PositionContext;
  fields: CapTablePositionFields;
  /** The root maps, as `CapTableState.contractIds`: entity type → (OCF object ID → contract ID). */
  rootContractIds: ReadonlyMap<OcfEntityType, ReadonlyMap<string, string>>;
  positions: ActiveTemplateRow[];
  stockIssuances: ActiveTemplateRow[];
  stockTransfers: ActiveTemplateRow[];
}

/**
 * Classify the cap table's active stock issuances and transfers into root records, records a position registry wrote,
 * and records nothing accounts for, and collect what root writers must not touch.
 *
 * A registry-written issuance is an issuance of the cap table's context in a position-managed class that the root
 * maps do not list. A registry-written transfer is an unlisted transfer whose resulting and balance securities are
 * all securities of registry-written issuances (`Registry_Transfer` writes both in one transaction).
 *
 * @throws OcpContractError when a root-listed issuance is not active at the offset, or a registry record reuses an
 *   OCF ID of the cap table
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
  const registryIssuances = new Map<string, string>();
  const registryTransfers = new Map<string, string>();
  const registrySecurityIds = new Set<string>();
  const unattributedRecords: UnattributedPositionRecord[] = [];
  const seenRootIssuanceCids = new Set<string>();

  const addRegistryRecord = (
    entityType: PositionRegistryRecordType,
    records: Map<string, string>,
    rootRecords: ReadonlyMap<string, string>,
    id: string,
    contractId: string
  ): void => {
    const existing = rootRecords.get(id) ?? records.get(id);
    if (existing !== undefined) throw duplicateRecordError(entityType, id, [existing, contractId]);
    records.set(id, contractId);
  };

  for (const row of snapshot.stockIssuances) {
    if (!hasContext(row.createdEvent.createArgument, context)) continue;
    const record = issuanceRecord(row);
    if (rootIssuanceCids.has(record.contractId)) {
      seenRootIssuanceCids.add(record.contractId);
      stockClassBySecurityId.set(record.securityId, record.stockClassId);
      if (fields.migratedSecurityIds.has(record.securityId)) {
        supersededStockIssuances.set(record.id, record.securityId);
      }
    } else if (fields.registries.has(record.stockClassId)) {
      addRegistryRecord('stockIssuance', registryIssuances, rootIssuances, record.id, record.contractId);
      registrySecurityIds.add(record.securityId);
      stockClassBySecurityId.set(record.securityId, record.stockClassId);
      referencedStakeholderIds.add(record.stakeholderId);
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
    const { id, results } = transferResults(row);
    if (results.length > 0 && results.every((securityId) => registrySecurityIds.has(securityId))) {
      addRegistryRecord('stockTransfer', registryTransfers, rootTransfers, id, contractId);
    } else {
      unattributedRecords.push({ entityType: 'stockTransfer', id, contractId });
    }
  }

  const positions = stockPositionStates(snapshot.positions, context);
  for (const position of positions) {
    referencedStakeholderIds.add(position.position.stakeholder_id);
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
    ]),
    stockClassBySecurityId,
    referencedStakeholderIds,
    unattributedRecords,
  };
}

/** Template IDs of the create-only records, as the SDK's entity registry pins them. */
export const POSITION_RECORD_TEMPLATE_IDS: Readonly<Record<PositionRegistryRecordType, string>> = {
  stockIssuance: ENTITY_TEMPLATE_ID_MAP.stockIssuance,
  stockTransfer: ENTITY_TEMPLATE_ID_MAP.stockTransfer,
};
