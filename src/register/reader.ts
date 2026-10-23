/**
 * The register reader: reads OpenCapTable-v35 books from the active contract set by the two reader interfaces, admits
 * only genuine register contracts and indexes them by key, one {@link RegisterIndex} per `Context`.
 *
 * Every contract passes the per-contract rules of `admitContract` (package, view, payload, signatories, record view)
 * and rule 5: the reader keys on the full `Context`, so a contract whose cap table ID is a book's but whose parties
 * are not that book's anchor's is rejected as `foreign_context`, and when two anchors share a cap table ID no book
 * under it is trusted (`duplicate_anchor`). It first reads the anchors (a template-filtered read of `CapTable` at the
 * same offset), so it decides every contract as it arrives and buffers none.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
// canton-node-sdk 0.0.266's `getActiveContracts` collects every active contract into an array before it returns, so
// the reader builds the active-contracts request itself and handles each item as it arrives. Replace this with
// canton-node-sdk's streaming active-contracts read on the next canton-node-sdk bump.
import { buildEventFormat } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations/v2/utils/event-format-builder';
import {
  WebSocketClient,
  type WebSocketSubscription,
} from '@fairmint/canton-node-sdk/build/src/core/ws/WebSocketClient';
import { OCP_INTERFACES, OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import { OcpError, OcpErrorCodes, OcpNetworkError, OcpParseError, OcpValidationError } from '../errors';
import type {
  AdmittedRegisterContract,
  RegisterAnchor,
  RegisterContext,
  RegisterReadWarning,
  RegisterRejectedContract,
} from '../types/register';
import { admitContract } from './admission';
import { contextKey, rejectedContract, sameContext } from './admissionRules';
import { readLedgerEnd } from './ledger';
import { RegisterIndex } from './registerIndex';

const ACTIVE_CONTRACTS_PATH = '/v2/state/active-contracts';

/** canton-node-sdk's default for the active-contracts snapshot: silence this long means a hung connection. */
const DEFAULT_IDLE_TIMEOUT_MS = 600_000;

/** WebSocket close code of a stream the server ended normally: anything else may have cut the snapshot short. */
const NORMAL_CLOSURE = 1000;

/** The Ledger API event format the reader uses: both reader interfaces, with their views and no created-event blobs. */
export interface RegisterEventFormat {
  verbose: boolean;
  filtersByParty: Record<
    string,
    {
      cumulative: Array<
        | { identifierFilter: { TemplateFilter: { value: { templateId: string; includeCreatedEventBlob: boolean } } } }
        | {
            identifierFilter: {
              InterfaceFilter: {
                value: { interfaceId: string; includeInterfaceView: boolean; includeCreatedEventBlob: boolean };
              };
            };
          }
        | { identifierFilter: { WildcardFilter: { value: { includeCreatedEventBlob: boolean } } } }
      >;
    }
  >;
}

/**
 * The event format a register read uses for `party`: the `OcfObject` and `RegisterContract` interfaces with their
 * views. Read a transaction with it (for example as a ledger-effects `transactionFormat`) before applying it to a key
 * index, so its created events carry the views admission checks.
 */
export function registerEventFormat(party: string): RegisterEventFormat {
  return buildEventFormat({
    parties: [requireParty(party, 'party')],
    interfaceIds: [OCP_INTERFACES.ocfObject, OCP_INTERFACES.registerContract],
    includeInterfaceView: true,
    includeCreatedEventBlob: false,
  });
}

/** Options for {@link readRegister}. */
export interface ReadRegisterOptions {
  /** The party to read as: a book's issuer, `system_operator` or TA (every register contract has all three signatories) */
  readAs: string;
  /** Read only this cap table's book; contracts of other cap tables are skipped without being reported */
  capTableId?: string;
  /** The offset to read the active contract set at; defaults to the ledger end, read first */
  activeAtOffset?: number;
  /** Keep each OCF record's native data in the index (default `true`) */
  retainPayloads?: boolean;
  /**
   * Called with each contract as it is admitted to a book, in the order the snapshot delivers them, one call at a
   * time; the read waits for a returned promise before it completes. Lets a consumer stream a large book with
   * `retainPayloads: false`.
   */
  onContract?: (contract: AdmittedRegisterContract) => void | Promise<void>;
  /** Fail the read when no message arrives for this many milliseconds (default 600,000; `0` waits indefinitely) */
  idleTimeoutMs?: number;
}

/** A read of the active contract set at one offset. */
export interface RegisterSnapshot {
  /** The offset the snapshot was read at */
  offset: number;
  /** One key index per `Context` with contracts in the snapshot, by cap table ID */
  books: RegisterIndex[];
  /** Contracts the reader indexed in no book, and why */
  rejected: RegisterRejectedContract[];
  warnings: RegisterReadWarning[];
}

/** Options for {@link findCapTables}. */
export interface FindCapTablesOptions {
  /** The party to read as */
  party: string;
  /** The offset to read at; defaults to the ledger end, read first */
  activeAtOffset?: number;
  /** Fail the read when no message arrives for this many milliseconds (default 600,000; `0` waits indefinitely) */
  idleTimeoutMs?: number;
}

/** A cap table a party can read: its anchor and `Context`. */
export interface RegisterCapTable {
  context: RegisterContext;
  anchor: RegisterAnchor;
}

/** The cap tables a party can read at one offset. */
export interface FoundCapTables {
  offset: number;
  /** One per cap table ID that exactly one genuine anchor carries, by cap table ID */
  capTables: RegisterCapTable[];
  /** Anchors that are not genuine, and every anchor of a cap table ID that two anchors share (`duplicate_anchor`) */
  rejected: RegisterRejectedContract[];
  warnings: RegisterReadWarning[];
}

function requireParty(party: unknown, fieldPath: string): string {
  if (typeof party !== 'string' || party.length === 0) {
    throw new OcpValidationError(fieldPath, 'Must be a non-empty party ID', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'non-empty string',
      receivedValue: party,
    });
  }
  return party;
}

function requireOptionalOffset(offset: unknown, fieldPath: string): number | undefined {
  if (offset === undefined) return undefined;
  if (typeof offset !== 'number' || !Number.isSafeInteger(offset) || offset < 0) {
    throw new OcpValidationError(fieldPath, 'Must be a non-negative ledger offset', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'non-negative safe integer',
      receivedValue: offset,
    });
  }
  return offset;
}

function requireIdleTimeout(idleTimeoutMs: unknown): number {
  if (idleTimeoutMs === undefined) return DEFAULT_IDLE_TIMEOUT_MS;
  if (typeof idleTimeoutMs !== 'number' || !Number.isFinite(idleTimeoutMs) || idleTimeoutMs < 0) {
    throw new OcpValidationError('idleTimeoutMs', 'Must be a non-negative number of milliseconds', {
      code: OcpErrorCodes.INVALID_TYPE,
      receivedValue: idleTimeoutMs,
    });
  }
  return idleTimeoutMs;
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function networkError(error: unknown): OcpError {
  if (error instanceof OcpError) return error;
  const cause = error instanceof Error ? error : undefined;
  const message = cause?.message ?? String(error);
  const timeout = message.startsWith('WebSocket idle timeout');
  return new OcpNetworkError(`Active contracts read failed: ${message}`, {
    endpoint: ACTIVE_CONTRACTS_PATH,
    code: timeout ? OcpErrorCodes.TIMEOUT : OcpErrorCodes.CONNECTION_FAILED,
    classification: timeout ? 'active_contracts_idle_timeout' : 'active_contracts_stream_failed',
    ...(cause ? { cause } : {}),
  });
}

/** A Canton error frame (`WsCantonError` or `JsCantonError`) as an `OcpNetworkError`. */
function cantonErrorFrame(message: Record<string, unknown>): OcpNetworkError | null {
  if (typeof message.code === 'string' && typeof message.cause === 'string') {
    return new OcpNetworkError(`Active contracts read failed [${message.code}]: ${message.cause}`, {
      endpoint: ACTIVE_CONTRACTS_PATH,
      classification: 'canton_ws_error',
      context: {
        cantonCode: message.code,
        errorCategory: message.errorCategory,
        grpcCodeValue: message.grpcCodeValue,
        correlationId: message.correlationId,
        traceId: message.traceId,
      },
    });
  }
  if ('code' in message && typeof message.message === 'string') {
    const code = typeof message.code === 'string' ? message.code : JSON.stringify(message.code);
    return new OcpNetworkError(`Active contracts read failed [${code}]: ${message.message}`, {
      endpoint: ACTIVE_CONTRACTS_PATH,
      classification: 'canton_js_error',
      context: { cantonCode: code },
    });
  }
  return null;
}

type SnapshotFrame =
  | { readonly kind: 'contract'; readonly createdEvent: unknown }
  | { readonly kind: 'skip' }
  | { readonly kind: 'incomplete'; readonly warning: RegisterReadWarning }
  | { readonly kind: 'error'; readonly error: OcpError };

function incompleteWarning(createdEvent: unknown): RegisterReadWarning {
  const event = isRecordObject(createdEvent) ? createdEvent : {};
  return {
    kind: 'incomplete_reassignment',
    contractId: typeof event.contractId === 'string' ? event.contractId : '',
    templateId: typeof event.templateId === 'string' ? event.templateId : null,
    message: 'Contract is mid-reassignment between synchronizers in the snapshot and was left out',
  };
}

function decodeFrame(message: unknown): SnapshotFrame {
  if (isRecordObject(message) && 'contractEntry' in message) {
    const entry = message.contractEntry;
    if (entry === undefined || entry === null) return { kind: 'skip' };
    if (!isRecordObject(entry)) {
      return {
        kind: 'error',
        error: new OcpParseError('Active contracts item has a malformed contractEntry', {
          source: ACTIVE_CONTRACTS_PATH,
          code: OcpErrorCodes.INVALID_RESPONSE,
        }),
      };
    }
    if (isRecordObject(entry.JsActiveContract)) {
      return { kind: 'contract', createdEvent: entry.JsActiveContract.createdEvent };
    }
    if ('JsEmpty' in entry) return { kind: 'skip' };
    if (isRecordObject(entry.JsIncompleteAssigned)) {
      const assigned = entry.JsIncompleteAssigned.assignedEvent;
      return {
        kind: 'incomplete',
        warning: incompleteWarning(isRecordObject(assigned) ? assigned.createdEvent : null),
      };
    }
    if (isRecordObject(entry.JsIncompleteUnassigned)) {
      return { kind: 'incomplete', warning: incompleteWarning(entry.JsIncompleteUnassigned.createdEvent) };
    }
  }
  if (isRecordObject(message)) {
    const error = cantonErrorFrame(message);
    if (error !== null) return { kind: 'error', error };
    // An item that carries no contract (only a workflow ID or a continuation token).
    if ('workflowId' in message || 'streamContinuationToken' in message) return { kind: 'skip' };
  }
  return {
    kind: 'error',
    error: new OcpParseError('Unexpected active contracts WebSocket message', {
      source: ACTIVE_CONTRACTS_PATH,
      code: OcpErrorCodes.INVALID_RESPONSE,
    }),
  };
}

/** A consumer callback the stream runs after the previous one has settled. */
type Delivery = () => void | Promise<void>;

interface StreamParams {
  activeAtOffset: number;
  eventFormat: RegisterEventFormat;
  idleTimeoutMs: number;
  /**
   * Called with each created event, synchronously as its frame arrives. It may return a consumer callback, which the
   * stream runs one at a time in arrival order: at once when none is pending, else after the pending ones.
   */
  onCreatedEvent: (createdEvent: unknown) => Delivery | undefined;
  onWarning: (warning: RegisterReadWarning) => void;
}

function isPromiseLike(value: unknown): value is PromiseLike<void> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

/**
 * Read the active contract set at an offset over the Ledger API's WebSocket, handing each created event to
 * `onCreatedEvent` as its frame arrives. Resolves once the server closes the stream normally and every consumer
 * callback has settled; a Canton error frame, an unexpected frame, a socket error, the idle timeout or any other close
 * rejects with an `OcpError`, so a cut-short snapshot never reads as complete.
 */
async function streamActiveContracts(client: LedgerJsonApiClient, params: StreamParams): Promise<void> {
  const request = { verbose: false, activeAtOffset: params.activeAtOffset, eventFormat: params.eventFormat };
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let subscription: WebSocketSubscription | undefined;
    const fail = (error: unknown): void => {
      if (settled) return;
      settled = true;
      subscription?.close();
      reject(networkError(error));
    };
    // Consumer callbacks run one at a time, in arrival order: `tail` settles after the last one, and `pending` counts
    // those not yet settled.
    let tail: Promise<void> = Promise.resolve();
    let pending = 0;
    const deliver = (callback: Delivery): Promise<void> | undefined => {
      if (pending === 0) {
        const result = callback();
        if (!isPromiseLike(result)) return undefined;
        tail = Promise.resolve(result);
      } else {
        tail = tail.then(callback);
      }
      pending += 1;
      tail = tail.finally(() => {
        pending -= 1;
      });
      tail.catch(fail);
      return tail;
    };

    new WebSocketClient(client)
      .connect<typeof request, unknown>(
        ACTIVE_CONTRACTS_PATH,
        request,
        {
          // Synchronous up to the consumer's callback: WebSocketClient dispatches the next frame without waiting for
          // this handler, so each frame is decided before the next one arrives.
          onMessage: (message): Promise<void> | undefined => {
            if (settled) return undefined;
            const frame = decodeFrame(message);
            switch (frame.kind) {
              case 'skip':
                return undefined;
              case 'incomplete':
                params.onWarning(frame.warning);
                return undefined;
              case 'error':
                fail(frame.error);
                return undefined;
              case 'contract': {
                const callback = params.onCreatedEvent(frame.createdEvent);
                return callback === undefined ? undefined : deliver(callback);
              }
            }
          },
          onError: fail,
          onClose: (code, reason) => {
            if (settled) return;
            if (code !== NORMAL_CLOSURE) {
              fail(
                new OcpNetworkError(
                  `Active contracts stream closed with code ${code}${reason ? ` (${reason})` : ''}; the snapshot may be incomplete`,
                  {
                    endpoint: ACTIVE_CONTRACTS_PATH,
                    classification: 'active_contracts_stream_closed',
                    context: { closeCode: code, closeReason: reason },
                  }
                )
              );
              return;
            }
            tail.then(() => {
              if (settled) return;
              settled = true;
              resolve();
            }, fail);
          },
        },
        { idleTimeoutMs: params.idleTimeoutMs }
      )
      .then((connected) => {
        subscription = connected;
        if (settled) connected.close();
      }, fail);
  });
}

interface AnchorRead {
  /** The one genuine anchor of each cap table ID that has exactly one */
  trusted: Map<string, RegisterCapTable>;
  /** Cap table IDs two or more genuine anchors share */
  duplicated: Map<string, RegisterCapTable[]>;
  rejected: RegisterRejectedContract[];
  warnings: RegisterReadWarning[];
}

/** Read every `CapTable` anchor `party` sees at `offset` (a template filter, so the events carry no view). */
async function readAnchors(
  client: LedgerJsonApiClient,
  party: string,
  offset: number,
  idleTimeoutMs: number
): Promise<AnchorRead> {
  const byCapTable = new Map<string, RegisterCapTable[]>();
  const rejected: RegisterRejectedContract[] = [];
  const warnings: RegisterReadWarning[] = [];
  await streamActiveContracts(client, {
    activeAtOffset: offset,
    eventFormat: buildEventFormat({
      parties: [party],
      templateIds: [OCP_TEMPLATES.capTable],
      includeCreatedEventBlob: false,
    }),
    idleTimeoutMs,
    onWarning: (warning) => warnings.push(warning),
    onCreatedEvent: (createdEvent) => {
      const result = admitContract(createdEvent, { requireView: false });
      warnings.push(...result.warnings);
      if (!result.ok) {
        rejected.push(result.rejection);
        return undefined;
      }
      if (result.contract.kind !== 'anchor') return undefined;
      const { context, contract } = result.contract;
      const anchors = byCapTable.get(context.cap_table_id) ?? [];
      anchors.push({ context, anchor: contract });
      byCapTable.set(context.cap_table_id, anchors);
      return undefined;
    },
  });
  const trusted = new Map<string, RegisterCapTable>();
  const duplicated = new Map<string, RegisterCapTable[]>();
  for (const [capTableId, anchors] of byCapTable) {
    const [only] = anchors;
    if (anchors.length === 1 && only !== undefined) trusted.set(capTableId, only);
    else duplicated.set(capTableId, anchors);
  }
  return { trusted, duplicated, rejected, warnings };
}

function duplicateAnchorRejection(
  contract: { contractId: string; templateId: string },
  capTableId: string
): RegisterRejectedContract {
  return rejectedContract(
    { ...contract, packageName: null },
    'duplicate_anchor',
    `Two or more anchors carry cap table ${capTableId}, so no book under it is trusted`,
    capTableId
  );
}

function byCapTableId(a: RegisterContext, b: RegisterContext): number {
  return a.cap_table_id === b.cap_table_id
    ? contextKey(a).localeCompare(contextKey(b))
    : a.cap_table_id.localeCompare(b.cap_table_id);
}

/**
 * List the cap tables a party can read: every genuine `CapTable` anchor it sees (package, payload and signatories),
 * except those of a cap table ID that two anchors share, which are reported as `duplicate_anchor`.
 */
export async function findCapTables(
  client: LedgerJsonApiClient,
  options: FindCapTablesOptions
): Promise<FoundCapTables> {
  const party = requireParty(options.party, 'party');
  const idleTimeoutMs = requireIdleTimeout(options.idleTimeoutMs);
  const offset = requireOptionalOffset(options.activeAtOffset, 'activeAtOffset') ?? (await readLedgerEnd(client));
  const anchors = await readAnchors(client, party, offset, idleTimeoutMs);
  const rejected = [...anchors.rejected];
  for (const [capTableId, duplicates] of anchors.duplicated) {
    for (const { anchor } of duplicates) rejected.push(duplicateAnchorRejection(anchor, capTableId));
  }
  return {
    offset,
    capTables: [...anchors.trusted.values()].sort((a, b) => byCapTableId(a.context, b.context)),
    rejected,
    warnings: anchors.warnings,
  };
}

/**
 * Read the books a party can see from the active contract set at one offset, indexed by key.
 *
 * Reads the anchors first, then streams the active contract set filtered by the `OcfObject` and `RegisterContract`
 * interfaces at the same offset, deciding each contract as it arrives: admitted to the book of its `Context` (and
 * passed to `onContract`), or reported in `rejected`. A contract signed by a book's three parties that the reader cannot
 * admit is also flagged on that book (`unreadable_contract`), so a book never reads complete when it is not. A cap
 * table whose contracts the snapshot holds but whose anchor it does not becomes a book flagged `missing_anchor`.
 *
 * @throws OcpNetworkError when the read fails or the stream does not end normally
 */
export async function readRegister(
  client: LedgerJsonApiClient,
  options: ReadRegisterOptions
): Promise<RegisterSnapshot> {
  const party = requireParty(options.readAs, 'readAs');
  const idleTimeoutMs = requireIdleTimeout(options.idleTimeoutMs);
  const { capTableId, onContract } = options;
  if (capTableId !== undefined && (typeof capTableId !== 'string' || capTableId.length === 0)) {
    throw new OcpValidationError('capTableId', 'Must be a non-empty cap table ID', {
      code: OcpErrorCodes.INVALID_TYPE,
      receivedValue: capTableId,
    });
  }
  const retainPayloads = options.retainPayloads ?? true;
  const offset = requireOptionalOffset(options.activeAtOffset, 'activeAtOffset') ?? (await readLedgerEnd(client));

  const anchors = await readAnchors(client, party, offset, idleTimeoutMs);
  const inScope = (id: string | null): boolean => capTableId === undefined || id === null || id === capTableId;
  const books = new Map<string, RegisterIndex>();
  for (const { context } of anchors.trusted.values()) {
    if (inScope(context.cap_table_id)) {
      books.set(contextKey(context), new RegisterIndex({ context, offset, retainPayloads }));
    }
  }
  const rejected: RegisterRejectedContract[] = [];
  // Every anchor also implements RegisterContract, so the second read reports the anchors' rejections and warnings.
  const warnings: RegisterReadWarning[] = [];

  const admit = (createdEvent: unknown): Delivery | undefined => {
    const result = admitContract(createdEvent, { requireView: true });
    warnings.push(...result.warnings);
    if (!result.ok) {
      if (
        capTableId !== undefined &&
        result.rejection.capTableId !== null &&
        result.rejection.capTableId !== capTableId
      ) {
        return undefined;
      }
      rejected.push(result.rejection);
      if (result.signedBy !== null) books.get(contextKey(result.signedBy))?.addUnreadable(result.rejection);
      return undefined;
    }
    const admitted = result.contract;
    const { context, contract } = admitted;
    if (capTableId !== undefined && context.cap_table_id !== capTableId) return undefined;
    if (anchors.duplicated.has(context.cap_table_id)) {
      rejected.push(duplicateAnchorRejection(contract, context.cap_table_id));
      return undefined;
    }
    const trusted = anchors.trusted.get(context.cap_table_id);
    if (trusted !== undefined && !sameContext(trusted.context, context)) {
      rejected.push(
        rejectedContract(
          { contractId: contract.contractId, templateId: contract.templateId, packageName: null },
          'foreign_context',
          `Contract of cap table ${context.cap_table_id} under parties other than its anchor's`,
          context.cap_table_id
        )
      );
      return undefined;
    }
    if (trusted !== undefined && admitted.kind === 'anchor' && contract.contractId !== trusted.anchor.contractId) {
      rejected.push(duplicateAnchorRejection(contract, context.cap_table_id));
      return undefined;
    }
    const key = contextKey(context);
    let book = books.get(key);
    if (book === undefined) {
      book = new RegisterIndex({ context, offset, retainPayloads });
      books.set(key, book);
    }
    book.add(admitted);
    return onContract === undefined ? undefined : (): void | Promise<void> => onContract(admitted);
  };

  await streamActiveContracts(client, {
    activeAtOffset: offset,
    eventFormat: registerEventFormat(party),
    idleTimeoutMs,
    onWarning: (warning) => warnings.push(warning),
    onCreatedEvent: admit,
  });

  return {
    offset,
    books: [...books.values()].sort((a, b) => byCapTableId(a.context, b.context)),
    rejected,
    warnings,
  };
}
