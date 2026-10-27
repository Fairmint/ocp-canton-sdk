/**
 * The state a stock record ended, read back from the ledger. A restatement that deletes a security's consuming record
 * recreates the security's state with a `seq` above the ended state's, or a later event would derive an ID that
 * already exists. Snapshots and restatements advance a state's `seq` with no OCF record, so only the ledger knows it,
 * and the ledger cannot see an ended state: the writer reads it.
 *
 * The consuming record's created offset names the transaction that ended the state. In that transaction (read with
 * ledger effects) the state is a consumed `StockSecurity`, whose payload `getEventsByContractId` returns, and the
 * operations of the same `CapTable_Apply` before the consuming one may have advanced it further (an acceptance, a
 * vesting record, a snapshot): the book flushes once, at the end of the write. When no consumed state carries the
 * security, the state was created in that same write and never stored, and its `seq` is the number of those
 * operations. A record a restatement edited since was created again by that restatement: the read follows it back to
 * the version the restatement consumed.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint, OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpError, OcpErrorCodes, OcpNetworkError } from '../../errors';
import type { RegisterContext, RegisterRecord, StockSecurityState } from '../../types/register';
import { decodeGeneratedDaml, generatedCodec } from '../../utils/generatedDamlValidation';
import { sameContext } from '../admissionRules';
import { decodeStockSecurityPayload, stockSecurityToNative } from '../codec';
import { subjectSecurity } from '../references';
import { moduleEntityOf } from '../templates';

const UPDATE_BY_OFFSET_PATH = '/v2/updates/update-by-offset';
const EVENTS_BY_CONTRACT_ID_PATH = '/v2/events/events-by-contract-id';

/** How many restatements of one record the read follows back before it gives up. */
const MAX_VERSIONS = 64;

const STOCK_SECURITY = moduleEntityOf(OCP_TEMPLATES.stockSecurity);
const CAP_TABLE = moduleEntityOf(OCP_TEMPLATES.capTable);

/** What the ledger shows of the state a record ended. */
export interface EndedState {
  /** Its `seq` when the record ended it */
  seq: number;
  /** The stored contract it was, when it was one; `null` when the write that ended it also created it */
  state: StockSecurityState | null;
}

/** Where to read an ended state. */
export interface ReadEndedStateOptions {
  context: RegisterContext;
  /** The record that consumed the security, as the book holds it */
  consumer: RegisterRecord;
  securityId: string;
  /** The party to read as: one that sees the book */
  readAs: string;
}

type DamlApplyOperation = Fairmint.OpenCapTable.Apply.ApplyOperation;

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readFailure(what: string, endpoint: string, error: unknown): OcpError {
  if (error instanceof OcpError) return error;
  return new OcpNetworkError(`Failed to read ${what}: ${error instanceof Error ? error.message : String(error)}`, {
    endpoint,
    classification: 'ended_state_read_failed',
    ...(error instanceof Error ? { cause: error } : {}),
  });
}

function notFound(message: string, options: ReadEndedStateOptions): OcpContractError {
  return new OcpContractError(message, {
    code: OcpErrorCodes.CONTRACT_NOT_FOUND,
    classification: 'ended_state_not_found',
    context: {
      capTableId: options.context.cap_table_id,
      securityId: options.securityId,
      consumer: options.consumer.objectId,
    },
  });
}

async function readTransactionAt(
  client: LedgerJsonApiClient,
  offset: number,
  readAs: string
): Promise<Array<Record<string, unknown>>> {
  let response: unknown;
  try {
    response = await client.getUpdateByOffset({
      offset,
      updateFormat: {
        includeTransactions: {
          eventFormat: {
            filtersByParty: {
              [readAs]: {
                cumulative: [{ identifierFilter: { WildcardFilter: { value: { includeCreatedEventBlob: false } } } }],
              },
            },
            verbose: false,
          },
          transactionShape: 'TRANSACTION_SHAPE_LEDGER_EFFECTS',
        },
      },
    });
  } catch (error) {
    throw readFailure(`the update at offset ${offset}`, UPDATE_BY_OFFSET_PATH, error);
  }
  const update = isRecordObject(response) ? response.update : undefined;
  const transaction =
    isRecordObject(update) && isRecordObject(update.Transaction) ? update.Transaction.value : undefined;
  if (!isRecordObject(transaction) || !Array.isArray(transaction.events)) {
    throw new OcpNetworkError(`The update at offset ${offset} is not a transaction`, {
      endpoint: UPDATE_BY_OFFSET_PATH,
      classification: 'ended_state_read_failed',
    });
  }
  return (transaction.events as unknown[]).filter(isRecordObject);
}

async function createdEventOf(
  client: LedgerJsonApiClient,
  contractId: string,
  readAs: string
): Promise<Record<string, unknown> | null> {
  let response: unknown;
  try {
    response = await client.getEventsByContractId({ contractId, readAs: [readAs] });
  } catch (error) {
    throw readFailure(`the events of contract ${contractId}`, EVENTS_BY_CONTRACT_ID_PATH, error);
  }
  const created = isRecordObject(response) ? response.created : undefined;
  const event = isRecordObject(created) ? created.createdEvent : undefined;
  return isRecordObject(event) ? event : null;
}

function exercisedEvents(events: ReadonlyArray<Record<string, unknown>>): Array<Record<string, unknown>> {
  return events.map((event) => event.ExercisedEvent).filter(isRecordObject);
}

function templateOf(event: Record<string, unknown>): string | null {
  return typeof event.templateId === 'string' ? moduleEntityOf(event.templateId) : null;
}

/** The event record an `ApplyOperation` writes, by object ID. */
function eventRecordId(operation: DamlApplyOperation): string | null {
  switch (operation.tag) {
    case 'ApplyRecord':
      return operation.value.value.id;
    case 'ApplyStockTransfer':
      return operation.value.transfer.id;
    case 'ApplyStockCancellation':
      return operation.value.cancellation.id;
    case 'ApplyStockRepurchase':
      return operation.value.repurchase.id;
    case 'ApplyStockConversion':
      return operation.value.conversion.id;
    case 'ApplyStockReissuance':
      return operation.value.reissuance.id;
    case 'ApplyStockConsolidation':
      return operation.value.consolidation.id;
    case 'ApplyVestingSnapshot':
    case 'ApplyPreSplitShard':
      return null;
  }
}

/**
 * How far the operations of one `CapTable_Apply` before the consuming record advanced the security's state: one for
 * each acceptance, vesting record and snapshot on it.
 */
function advancesBefore(choiceArgument: unknown, securityId: string, consumerId: string): number {
  const argument = decodeGeneratedDaml(
    choiceArgument,
    generatedCodec(Fairmint.OpenCapTable.CapTable.CapTable_Apply),
    'CapTable_Apply.choiceArgument'
  );
  let advances = 0;
  for (const operation of argument.operations) {
    if (eventRecordId(operation) === consumerId) return advances;
    if (operation.tag === 'ApplyVestingSnapshot' && operation.value.security_id === securityId) advances += 1;
    if (operation.tag === 'ApplyRecord') {
      const data = operation.value;
      const advancing =
        data.tag === 'OcfRecordDataStockAcceptance' ||
        data.tag === 'OcfRecordDataVestingStart' ||
        data.tag === 'OcfRecordDataVestingEvent' ||
        data.tag === 'OcfRecordDataVestingAcceleration';
      if (advancing && subjectSecurity(data) === securityId) advances += 1;
    }
  }
  return advances;
}

function decodedState(event: Record<string, unknown>, source: string): StockSecurityState {
  return stockSecurityToNative(decodeStockSecurityPayload(event.createArgument, source), source);
}

/**
 * Read the state a book's record ended for a security from the ledger: its `seq` when it ended, and the stored state
 * it was, if any (see the module notes).
 *
 * @throws OcpNetworkError when a read fails
 * @throws OcpContractError (`ended_state_not_found`) when the transactions do not show the state ended
 */
export async function readEndedState(client: LedgerJsonApiClient, options: ReadEndedStateOptions): Promise<EndedState> {
  const { consumer, securityId, readAs, context } = options;
  const recordTemplate = moduleEntityOf(consumer.templateId);
  let offset = consumer.createdOffset;
  for (let version = 0; version < MAX_VERSIONS; version += 1) {
    const exercised = exercisedEvents(await readTransactionAt(client, offset, readAs));
    const anchor = exercised.find((event) => templateOf(event) === CAP_TABLE && typeof event.choice === 'string');
    const choice = anchor?.choice;
    for (const event of exercised) {
      if (event.consuming !== true || templateOf(event) !== STOCK_SECURITY || typeof event.contractId !== 'string') {
        continue;
      }
      const created = await createdEventOf(client, event.contractId, readAs);
      if (created === null) continue;
      const state = decodedState(created, `StockSecurity ${event.contractId}`);
      if (state.security_id !== securityId || !sameContext(state.context, context)) continue;
      const advances =
        choice === 'CapTable_Apply' ? advancesBefore(anchor?.choiceArgument, securityId, consumer.objectId) : 0;
      return { seq: state.seq + advances, state };
    }
    if (choice === 'CapTable_Apply') {
      return { seq: advancesBefore(anchor?.choiceArgument, securityId, consumer.objectId), state: null };
    }
    if (choice !== 'CapTable_Restate') {
      throw notFound(
        `The transaction at offset ${offset} that wrote ${consumer.objectId} ended no state of security ${securityId}`,
        options
      );
    }
    // A restatement edited the record: find the version it consumed and read the transaction that created it.
    let previous: number | null = null;
    for (const event of exercised) {
      if (event.consuming !== true || templateOf(event) !== recordTemplate || typeof event.contractId !== 'string') {
        continue;
      }
      const created = await createdEventOf(client, event.contractId, readAs);
      const argument = created?.createArgument;
      const ocfData = isRecordObject(argument) ? argument.ocf_data : undefined;
      if (!isRecordObject(ocfData) || ocfData.id !== consumer.objectId) continue;
      if (typeof created?.offset === 'number') previous = created.offset;
      break;
    }
    if (previous === null || previous >= offset) {
      throw notFound(
        `The restatement at offset ${offset} wrote ${consumer.objectId} but consumed no earlier version of it`,
        options
      );
    }
    offset = previous;
  }
  throw notFound(`Record ${consumer.objectId} was restated more than ${MAX_VERSIONS} times`, options);
}
