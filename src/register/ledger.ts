/**
 * The Ledger API reads a register writer makes around a submission: the ledger end, the update stream that brings a
 * key index current, the command completions that settle an unknown outcome and the transaction a completion names.
 *
 * canton-node-sdk 0.0.266 has no update-stream read over HTTP that takes an event format, and its `getUpdateById`
 * sends a wildcard filter, which carries no interface views. The writer therefore reads the update stream with its own
 * `/v2/updates` request (both reader interfaces, views included, so `RegisterIndex.applyTransaction` admits what it
 * reads) through the client's `makePostRequest`. Replace it with canton-node-sdk's interface-filtered update read on
 * the next canton-node-sdk bump.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpError, OcpErrorCodes, OcpNetworkError, OcpParseError } from '../errors';
import type { SubmitAndWaitForTransactionResponse } from '../types/common';
import type { RegisterEventFormat } from './reader';
import type { RegisterIndex } from './registerIndex';

const LEDGER_END_PATH = '/v2/state/ledger-end';
const UPDATES_PATH = '/v2/updates';
const COMPLETIONS_PATH = '/v2/commands/completions';
const UPDATE_BY_ID_PATH = '/v2/updates/update-by-id';

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function offsetOf(value: unknown): number | undefined {
  if (!isRecordObject(value)) return undefined;
  const { offset } = value;
  return typeof offset === 'number' && Number.isSafeInteger(offset) && offset >= 0 ? offset : undefined;
}

function readFailure(what: string, endpoint: string, classification: string, error: unknown): OcpError {
  if (error instanceof OcpError) return error;
  return new OcpNetworkError(`Failed to read ${what}: ${error instanceof Error ? error.message : String(error)}`, {
    endpoint,
    classification,
    ...(error instanceof Error ? { cause: error } : {}),
  });
}

/**
 * The participant's ledger end.
 *
 * @throws OcpNetworkError when the read fails, OcpParseError when the response carries no offset
 */
export async function readLedgerEnd(client: LedgerJsonApiClient): Promise<number> {
  let response: unknown;
  try {
    response = await client.getLedgerEnd({});
  } catch (error) {
    throw readFailure('the ledger end', LEDGER_END_PATH, 'ledger_end_read_failed', error);
  }
  const offset = offsetOf(response);
  if (offset === undefined) {
    throw new OcpParseError('Ledger end response did not include an offset', {
      source: 'getLedgerEnd',
      code: OcpErrorCodes.INVALID_RESPONSE,
      context: { receivedValue: response },
    });
  }
  return offset;
}

/** How to bring an index current from the update stream. */
export interface CatchUpOptions {
  /** The reader's event format (`registerEventFormat`) for a party that sees the book */
  eventFormat: RegisterEventFormat;
  /** The offset to read up to, inclusive */
  endInclusive: number;
  /** Updates per request */
  pageSize: number;
}

/**
 * Apply every transaction of the update stream after the index's offset up to `endInclusive`, in order, then mark the
 * index current there. Transactions are read in ACS-delta shape with the reader's event format, so each carries the
 * created and archived contracts of every book the party sees; the index keeps its own book's.
 *
 * A page is read from the last offset the previous one reached, and reading stops only at a page that reaches
 * `endInclusive` or brings nothing, so a server that caps pages below `pageSize` is read correctly.
 *
 * @throws OcpNetworkError when a read fails, OcpParseError when the stream does not advance
 */
export async function catchUp(
  client: LedgerJsonApiClient,
  index: RegisterIndex,
  options: CatchUpOptions
): Promise<void> {
  const { endInclusive, pageSize, eventFormat } = options;
  let cursor = index.offset;
  while (cursor < endInclusive) {
    let page: unknown;
    try {
      page = await client.makePostRequest(
        `${client.getApiUrl()}${UPDATES_PATH}?limit=${pageSize}`,
        {
          beginExclusive: cursor,
          endInclusive,
          updateFormat: { includeTransactions: { eventFormat, transactionShape: 'TRANSACTION_SHAPE_ACS_DELTA' } },
        },
        // A request built on the client's HTTP layer carries no credentials unless it asks for them
        { contentType: 'application/json', includeBearerToken: true },
        { requestSemantics: 'read' }
      );
    } catch (error) {
      throw readFailure(`the updates after offset ${cursor}`, UPDATES_PATH, 'updates_read_failed', error);
    }
    if (!Array.isArray(page)) {
      throw new OcpParseError('Updates response is not a list', {
        source: UPDATES_PATH,
        code: OcpErrorCodes.INVALID_RESPONSE,
        context: { receivedValue: page },
      });
    }
    if (page.length === 0) break;
    let reached = cursor;
    for (const item of page as readonly unknown[]) {
      const update = isRecordObject(item) ? item.update : undefined;
      if (!isRecordObject(update)) continue;
      const transaction = isRecordObject(update.Transaction) ? update.Transaction.value : undefined;
      if (transaction !== undefined) {
        index.applyTransaction(transaction as Parameters<RegisterIndex['applyTransaction']>[0]);
        reached = Math.max(reached, offsetOf(transaction) ?? reached);
        continue;
      }
      for (const other of Object.values(update)) {
        reached = Math.max(reached, offsetOf(isRecordObject(other) ? other.value : undefined) ?? reached);
      }
    }
    if (reached <= cursor) {
      throw new OcpParseError(`The update stream did not advance past offset ${cursor}`, {
        source: UPDATES_PATH,
        code: OcpErrorCodes.INVALID_RESPONSE,
        context: { beginExclusive: cursor, endInclusive, updates: page.length },
      });
    }
    cursor = reached;
  }
  index.advance(endInclusive);
}

/** A command's completion: success with the transaction's update ID, or the ledger's rejection. */
export interface CommandCompletion {
  commandId: string;
  offset: number;
  updateId: string | null;
  /** `null` for a success; the gRPC status of a rejection */
  status: { code: number; message: string } | null;
}

/** How to look for one command's completion. */
export interface FindCompletionOptions {
  /** The ledger user the command was submitted as */
  userId: string;
  /** The command's `actAs` party */
  party: string;
  /** Completions to read per request */
  pageSize: number;
  /** How long one request waits for a further completion before it returns */
  streamIdleTimeoutMs: number;
}

function completionOf(item: unknown): { completion: CommandCompletion | null; offset: number | undefined } {
  const response = isRecordObject(item) ? item.completionResponse : undefined;
  if (!isRecordObject(response)) return { completion: null, offset: undefined };
  const completion = isRecordObject(response.Completion) ? response.Completion.value : undefined;
  if (isRecordObject(completion) && typeof completion.commandId === 'string') {
    const offset = offsetOf(completion);
    const status = isRecordObject(completion.status) ? completion.status : undefined;
    const code = typeof status?.code === 'number' ? status.code : 0;
    return {
      completion: {
        commandId: completion.commandId,
        offset: offset ?? 0,
        updateId: typeof completion.updateId === 'string' && completion.updateId !== '' ? completion.updateId : null,
        status:
          code === 0 ? null : { code, message: typeof status?.message === 'string' ? status.message : 'rejected' },
      },
      offset,
    };
  }
  const checkpoint = isRecordObject(response.OffsetCheckpoint) ? response.OffsetCheckpoint.value : undefined;
  return { completion: null, offset: offsetOf(checkpoint) };
}

/**
 * Read the completions after `beginExclusive` until the one for `commandId`, or until a request brings no further
 * completion. Returns the completion, if found, and the offset read up to, for the next call to continue from.
 *
 * @throws OcpNetworkError when a read fails
 */
export async function findCompletion(
  client: LedgerJsonApiClient,
  commandId: string,
  beginExclusive: number,
  options: FindCompletionOptions
): Promise<{ completion: CommandCompletion | null; readUpTo: number }> {
  let cursor = beginExclusive;
  for (;;) {
    let page: unknown;
    try {
      page = await client.completions({
        userId: options.userId,
        parties: [options.party],
        beginExclusive: cursor,
        limit: options.pageSize,
        streamIdleTimeoutMs: options.streamIdleTimeoutMs,
      });
    } catch (error) {
      throw readFailure(`the completions after offset ${cursor}`, COMPLETIONS_PATH, 'completions_read_failed', error);
    }
    const items: readonly unknown[] = Array.isArray(page) ? page : [];
    let reached = cursor;
    for (const item of items) {
      const { completion, offset } = completionOf(item);
      if (completion?.commandId === commandId) return { completion, readUpTo: Math.max(reached, completion.offset) };
      if (offset !== undefined) reached = Math.max(reached, offset);
    }
    if (reached <= cursor) return { completion: null, readUpTo: cursor };
    cursor = reached;
  }
}

/**
 * The ledger-effects transaction of a committed update, as `submitAndWaitForTransaction` returns it, so a choice's
 * result reads from it exactly as from the submission's response.
 *
 * @throws OcpNetworkError when the read fails, OcpParseError when the update is not a transaction
 */
export async function readTransactionById(
  client: LedgerJsonApiClient,
  updateId: string,
  readAs: string
): Promise<SubmitAndWaitForTransactionResponse> {
  let response: unknown;
  try {
    response = await client.getUpdateById({ updateId, readAs: [readAs] });
  } catch (error) {
    throw readFailure(`update ${updateId}`, UPDATE_BY_ID_PATH, 'update_read_failed', error);
  }
  const update = isRecordObject(response) ? response.update : undefined;
  const transaction =
    isRecordObject(update) && isRecordObject(update.Transaction) ? update.Transaction.value : undefined;
  if (!isRecordObject(transaction) || !Array.isArray(transaction.events)) {
    throw new OcpParseError(`Update ${updateId} is not a transaction`, {
      source: UPDATE_BY_ID_PATH,
      code: OcpErrorCodes.INVALID_RESPONSE,
      context: { updateId },
    });
  }
  return { transaction } as unknown as SubmitAndWaitForTransactionResponse;
}
