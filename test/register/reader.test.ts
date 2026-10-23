import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OCP_INTERFACES, OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpNetworkError, OcpParseError, OcpValidationError } from '../../src/errors';
import { findCapTables, readRegister, registerEventFormat } from '../../src/register/reader';
import type { AdmittedRegisterContract } from '../../src/types/register';
import {
  deliverMessages,
  queueWebSocketScript,
  resetWebSocketMock,
  webSocketConnections,
  type MockWebSocketConnection,
} from '../mocks/canton-deep';
import {
  acsItem,
  anchorEvent,
  anchorItems,
  BOOK_DATA,
  bookEvents,
  COMMON_CLASS_ID,
  CONTEXT,
  createdEvent,
  FOREIGN_CONTEXT,
  FOUNDERS_SECURITY_ID,
  packageIdForm,
  recordEvent,
  STAKEHOLDER_CLAIM,
  STAKEHOLDER_ID,
  STAKEHOLDER_SHARD_PREFIX,
} from './registerLedgerFixtures';

function ledgerClient(
  ledgerEnd = 42
): LedgerJsonApiClient & { getLedgerEnd: jest.Mock; getActiveContracts: jest.Mock } {
  return {
    getLedgerEnd: jest.fn().mockResolvedValue({ offset: ledgerEnd }),
    getActiveContracts: jest.fn(),
  } as unknown as LedgerJsonApiClient & { getLedgerEnd: jest.Mock; getActiveContracts: jest.Mock };
}

/** Serve the anchor read, then the interface-filtered read. */
function serve(
  anchors: unknown[],
  contracts: Iterable<unknown>,
  options: Parameters<typeof deliverMessages>[2] = {}
): void {
  queueWebSocketScript(async (connection) => deliverMessages(connection, anchors));
  queueWebSocketScript(async (connection) => deliverMessages(connection, contracts, options));
}

function serveBook(extra: unknown[] = [], options: Parameters<typeof deliverMessages>[2] = {}): void {
  serve(anchorItems(anchorEvent('cid-anchor')), [...bookEvents().map(acsItem), ...extra], options);
}

function connectionAt(index: number): MockWebSocketConnection {
  const found = webSocketConnections[index];
  if (found === undefined) throw new Error(`No connection ${index}`);
  return found;
}

beforeEach(() => {
  resetWebSocketMock();
});

describe('readRegister', () => {
  it('admits a valid book and indexes it by key', async () => {
    const client = ledgerClient();
    serveBook();

    const snapshot = await readRegister(client, { readAs: CONTEXT.issuer });

    expect(snapshot.offset).toBe(42);
    expect(snapshot.rejected).toEqual([]);
    expect(snapshot.warnings).toEqual([]);
    expect(snapshot.books).toHaveLength(1);
    const [book] = snapshot.books;
    if (book === undefined) throw new Error('no book');
    expect(book.context).toEqual(CONTEXT);
    expect(book.offset).toBe(42);
    expect(book.counts()).toEqual({ anchors: 1, records: 6, states: 1, epochs: 1, shards: 256 });
    expect(book.anchor).toMatchObject({ contractId: 'cid-anchor', status: 'ACTIVE', createdOffset: 1 });
    expect(book.record(STAKEHOLDER_ID)).toMatchObject({
      entityType: 'stakeholder',
      contractId: 'cid-stakeholder',
      objectType: 'STAKEHOLDER',
      securityIds: [],
      createdOffset: 2,
      data: { object_type: 'STAKEHOLDER', id: STAKEHOLDER_ID },
    });
    expect(book.issuanceOf(FOUNDERS_SECURITY_ID)).toMatchObject({
      entityType: 'stockIssuance',
      objectId: 'test-stock-issuance-founders-001',
      securityIds: [FOUNDERS_SECURITY_ID],
    });
    expect(book.stateOf(FOUNDERS_SECURITY_ID)?.state).toMatchObject({ seq: 2, quantity: '5000000', derived_ids: true });
    expect(book.epochOf(COMMON_CLASS_ID)?.epoch).toEqual({
      context: CONTEXT,
      stock_class_id: COMMON_CLASS_ID,
      frozen: false,
      splits: [],
    });
    expect(book.shardFor(STAKEHOLDER_CLAIM)?.shard).toEqual({
      context: CONTEXT,
      prefix: STAKEHOLDER_SHARD_PREFIX,
      claimed: [STAKEHOLDER_CLAIM],
    });
    expect(book.flags()).toEqual([]);
  });

  it('reads the anchors and then the book at the ledger end, by the two reader interfaces', async () => {
    const client = ledgerClient(7);
    serveBook();

    await readRegister(client, { readAs: CONTEXT.transfer_agent });

    expect(client.getLedgerEnd).toHaveBeenCalledTimes(1);
    expect(client.getActiveContracts).not.toHaveBeenCalled();
    expect(webSocketConnections).toHaveLength(2);
    expect(connectionAt(0)).toMatchObject({
      client,
      path: '/v2/state/active-contracts',
      options: { idleTimeoutMs: 600_000 },
      request: {
        verbose: false,
        activeAtOffset: 7,
        eventFormat: {
          filtersByParty: {
            [CONTEXT.transfer_agent]: {
              cumulative: [
                {
                  identifierFilter: {
                    TemplateFilter: { value: { templateId: OCP_TEMPLATES.capTable, includeCreatedEventBlob: false } },
                  },
                },
              ],
            },
          },
        },
      },
    });
    expect(connectionAt(1).request).toEqual({
      verbose: false,
      activeAtOffset: 7,
      eventFormat: registerEventFormat(CONTEXT.transfer_agent),
    });
  });

  it('reads at a given offset without reading the ledger end', async () => {
    const client = ledgerClient();
    serveBook();

    const snapshot = await readRegister(client, { readAs: CONTEXT.issuer, activeAtOffset: 5, idleTimeoutMs: 0 });

    expect(snapshot.offset).toBe(5);
    expect(client.getLedgerEnd).not.toHaveBeenCalled();
    expect(connectionAt(1)).toMatchObject({ request: { activeAtOffset: 5 }, options: { idleTimeoutMs: 0 } });
  });

  const forged = { ...BOOK_DATA.stakeholder, id: 'stakeholder-forged' };

  it.each([
    [
      'a wrong package name',
      recordEvent('cid-bad', 'stakeholder', forged, { packageName: 'NotOpenCapTable' }),
      'wrong_package',
    ],
    [
      'a wrong module',
      createdEvent(
        'cid-bad',
        '#OpenCapTable-v35:Fairmint.OpenCapTable.OCF.Forged:Forged',
        { context: CONTEXT, ocf_data: forged },
        [],
        CONTEXT
      ),
      'unknown_template',
    ],
    ['a missing view', recordEvent('cid-bad', 'stakeholder', forged, { interfaceViews: [] }), 'missing_view'],
    [
      'a failed view',
      recordEvent('cid-bad', 'stakeholder', forged, {
        interfaceViews: [
          {
            interfaceId: packageIdForm(OCP_INTERFACES.ocfObject),
            viewStatus: { code: 9, message: 'view failed' },
          },
        ],
      }),
      'invalid_view',
    ],
    [
      'a view naming another cap table than its payload',
      recordEvent('cid-bad', 'stakeholder', forged, { viewOverrides: { cap_table_id: 'test-2' } }),
      'view_mismatch',
    ],
    [
      'a view naming another object',
      recordEvent('cid-bad', 'stakeholder', forged, { viewOverrides: { object_id: 'someone-else' } }),
      'record_mismatch',
    ],
    [
      'a view naming other securities',
      recordEvent('cid-bad', 'stakeholder', forged, { viewOverrides: { security_ids: ['sec-x'] } }),
      'record_mismatch',
    ],
    [
      'a fourth signatory',
      recordEvent('cid-bad', 'stakeholder', forged, {
        signatories: [CONTEXT.issuer, CONTEXT.system_operator, CONTEXT.transfer_agent, 'intruder::1220'],
      }),
      'wrong_signatories',
    ],
    [
      'a missing signatory',
      recordEvent('cid-bad', 'stakeholder', forged, { signatories: [CONTEXT.issuer, CONTEXT.system_operator] }),
      'wrong_signatories',
    ],
  ] as const)('rejects a contract with %s and leaves the book as it was', async (_case, event, reason) => {
    serveBook([acsItem(event)]);

    const snapshot = await readRegister(ledgerClient(), { readAs: CONTEXT.issuer });

    expect(snapshot.rejected).toEqual([expect.objectContaining({ contractId: 'cid-bad', reason })]);
    expect(snapshot.books).toHaveLength(1);
    expect(snapshot.books[0]?.counts().records).toBe(6);
    expect(snapshot.books[0]?.record('stakeholder-forged')).toBeNull();
  });

  it('flags the book incomplete when a contract signed by its parties does not decode', async () => {
    const { id: _id, ...withoutId } = forged;
    serveBook([acsItem(recordEvent('cid-bad', 'stakeholder', { ...withoutId, id: 7 }))]);

    const snapshot = await readRegister(ledgerClient(), { readAs: CONTEXT.issuer });

    expect(snapshot.rejected).toEqual([
      expect.objectContaining({ contractId: 'cid-bad', reason: 'invalid_payload', capTableId: 'test-1' }),
    ]);
    expect(snapshot.books[0]?.flags()).toEqual([
      expect.objectContaining({ kind: 'unreadable_contract', contractId: 'cid-bad', reason: 'invalid_payload' }),
    ]);
  });

  it('rejects a contract of the book’s cap table under other parties as a foreign context', async () => {
    const foreign = recordEvent('cid-foreign', 'stakeholder', forged, { context: FOREIGN_CONTEXT });
    serveBook([acsItem(foreign)]);

    const snapshot = await readRegister(ledgerClient(), { readAs: CONTEXT.issuer });

    expect(snapshot.rejected).toEqual([
      expect.objectContaining({ contractId: 'cid-foreign', reason: 'foreign_context', capTableId: 'test-1' }),
    ]);
    expect(snapshot.books.map((book) => book.context)).toEqual([CONTEXT]);
    expect(snapshot.books[0]?.flags()).toEqual([]);
  });

  it('trusts neither book when two anchors share a cap table ID', async () => {
    const own = bookEvents(CONTEXT);
    const other = bookEvents(FOREIGN_CONTEXT).map((event) => ({
      ...event,
      contractId: `other-${String(event.contractId)}`,
    }));
    const [ownAnchor] = own;
    const [otherAnchor] = other;
    if (ownAnchor === undefined || otherAnchor === undefined) throw new Error('no anchors');
    serve(anchorItems(ownAnchor, otherAnchor), [...own, ...other].map(acsItem));

    const snapshot = await readRegister(ledgerClient(), { readAs: CONTEXT.issuer });

    expect(snapshot.books).toEqual([]);
    expect(snapshot.rejected).toHaveLength(own.length + other.length);
    expect(new Set(snapshot.rejected.map((rejection) => rejection.reason))).toEqual(new Set(['duplicate_anchor']));
  });

  it('reads only the named cap table and skips other books without reporting them', async () => {
    const otherContext = { ...CONTEXT, cap_table_id: 'test-2' };
    const other = bookEvents(otherContext).map((event) => ({
      ...event,
      contractId: `other-${String(event.contractId)}`,
    }));
    const [otherAnchor] = other;
    if (otherAnchor === undefined) throw new Error('no anchor');
    serve(
      anchorItems(anchorEvent('cid-anchor'), otherAnchor),
      [
        ...bookEvents(),
        ...other,
        recordEvent('other-bad', 'stakeholder', forged, { context: otherContext, interfaceViews: [] }),
      ].map(acsItem)
    );

    const snapshot = await readRegister(ledgerClient(), { readAs: CONTEXT.issuer, capTableId: 'test-1' });

    expect(snapshot.books.map((book) => book.context.cap_table_id)).toEqual(['test-1']);
    expect(snapshot.rejected).toEqual([]);
  });

  it('returns one book per cap table, by cap table ID', async () => {
    const otherContext = { ...CONTEXT, cap_table_id: 'test-0' };
    const other = bookEvents(otherContext).map((event) => ({
      ...event,
      contractId: `other-${String(event.contractId)}`,
    }));
    const [otherAnchor] = other;
    if (otherAnchor === undefined) throw new Error('no anchor');
    serve(anchorItems(anchorEvent('cid-anchor'), otherAnchor), [...bookEvents(), ...other].map(acsItem));

    const snapshot = await readRegister(ledgerClient(), { readAs: CONTEXT.issuer });

    expect(snapshot.books.map((book) => book.context.cap_table_id)).toEqual(['test-0', 'test-1']);
    expect(snapshot.books.every((book) => book.flags().length === 0)).toBe(true);
  });

  it('indexes contracts whose anchor the snapshot lacks as a book flagged missing_anchor', async () => {
    serve([], bookEvents().slice(1).map(acsItem));

    const snapshot = await readRegister(ledgerClient(), { readAs: CONTEXT.issuer });

    expect(snapshot.books).toHaveLength(1);
    expect(snapshot.books[0]?.anchor).toBeNull();
    expect(snapshot.books[0]?.flags()).toEqual([{ kind: 'missing_anchor' }]);
  });

  it('warns about another package ID of OpenCapTable-v35 and still admits the contract', async () => {
    const upgraded = recordEvent('cid-upgraded', 'stakeholder', forged, {
      templateId: packageIdForm(OCP_TEMPLATES.capTable, 'ff'.repeat(32)).replace(
        'Fairmint.OpenCapTable.CapTable:CapTable',
        'Fairmint.OpenCapTable.OCF.Stakeholder:Stakeholder'
      ),
    });
    serveBook([acsItem(upgraded)]);

    const snapshot = await readRegister(ledgerClient(), { readAs: CONTEXT.issuer });

    expect(snapshot.warnings).toEqual([expect.objectContaining({ kind: 'package_id', contractId: 'cid-upgraded' })]);
    expect(snapshot.books[0]?.record('stakeholder-forged')?.contractId).toBe('cid-upgraded');
  });

  it('skips empty entries and warns about contracts mid-reassignment', async () => {
    const reassigned = recordEvent('cid-moving', 'stakeholder', forged);
    serveBook([
      { contractEntry: { JsEmpty: {} } },
      { workflowId: '' },
      { contractEntry: { JsIncompleteAssigned: { assignedEvent: { createdEvent: reassigned } } } },
      { contractEntry: { JsIncompleteUnassigned: { createdEvent: reassigned, unassignedEvent: {} } } },
    ]);

    const snapshot = await readRegister(ledgerClient(), { readAs: CONTEXT.issuer });

    expect(snapshot.warnings.map((warning) => [warning.kind, warning.contractId])).toEqual([
      ['incomplete_reassignment', 'cid-moving'],
      ['incomplete_reassignment', 'cid-moving'],
    ]);
    expect(snapshot.books[0]?.record('stakeholder-forged')).toBeNull();
  });

  describe('streaming', () => {
    it('decides every item as it arrives and never asks canton-node-sdk for a collected array', async () => {
      const client = ledgerClient();
      const events = bookEvents();
      const delivered: string[] = [];
      const produced: number[] = [];
      function* lazily(): Generator<unknown> {
        for (const [index, event] of events.entries()) {
          // The previous item was handed to onContract before this one is produced.
          expect(delivered).toHaveLength(index);
          produced.push(index);
          yield acsItem(event);
        }
      }
      serve(anchorItems(anchorEvent('cid-anchor')), lazily());

      const snapshot = await readRegister(client, {
        readAs: CONTEXT.issuer,
        retainPayloads: false,
        onContract: (contract) => {
          delivered.push(contract.contract.contractId);
        },
      });

      expect(client.getActiveContracts).not.toHaveBeenCalled();
      expect(produced).toHaveLength(events.length);
      expect(delivered).toEqual(events.map((event) => event.contractId));
      const [book] = snapshot.books;
      expect(book?.retainsPayloads).toBe(false);
      expect([...(book?.records() ?? [])].every((record) => record.data === null)).toBe(true);
      expect(book?.stateOf(FOUNDERS_SECURITY_ID)?.state.quantity).toBe('5000000');
      // No index entry is the event object the stream delivered.
      expect(book?.record(STAKEHOLDER_ID)).not.toBe(events[2]);
    });

    it('hands onContract the native data even when the index keeps none, one call at a time', async () => {
      serveBook();
      const seen: AdmittedRegisterContract[] = [];
      let running = 0;
      let overlapped = false;

      await readRegister(ledgerClient(), {
        readAs: CONTEXT.issuer,
        retainPayloads: false,
        onContract: async (contract) => {
          running += 1;
          if (running > 1) overlapped = true;
          await new Promise((resolve) => setImmediate(resolve));
          seen.push(contract);
          running -= 1;
        },
      });

      expect(overlapped).toBe(false);
      expect(seen.map((contract) => contract.contract.contractId)).toEqual(
        bookEvents().map((event) => event.contractId)
      );
      const stakeholderRecord = seen.find((contract) => contract.contract.contractId === 'cid-stakeholder');
      expect(stakeholderRecord).toMatchObject({
        kind: 'record',
        context: CONTEXT,
        contract: { data: { id: STAKEHOLDER_ID } },
      });
    });

    it('fails the read when onContract throws', async () => {
      serveBook();

      await expect(
        readRegister(ledgerClient(), {
          readAs: CONTEXT.issuer,
          onContract: () => {
            throw new Error('consumer failed');
          },
        })
      ).rejects.toMatchObject({ name: 'OcpNetworkError', message: expect.stringContaining('consumer failed') });
    });
  });

  describe('stream failures', () => {
    it('maps a WebSocket Canton error frame to OcpNetworkError', async () => {
      serveBook([{ code: 'PARTICIPANT_PRUNED_DATA_ACCESSED', cause: 'offset 42 was pruned', errorCategory: 9 }]);

      const error: unknown = await readRegister(ledgerClient(), { readAs: CONTEXT.issuer }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(OcpNetworkError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.CONNECTION_FAILED,
        classification: 'canton_ws_error',
        message: 'Active contracts read failed [PARTICIPANT_PRUNED_DATA_ACCESSED]: offset 42 was pruned',
      });
    });

    it('maps a JSON Canton error frame to OcpNetworkError', async () => {
      serveBook([{ code: { kind: 'InvalidArgument' }, message: 'bad filter' }]);

      await expect(readRegister(ledgerClient(), { readAs: CONTEXT.issuer })).rejects.toMatchObject({
        name: 'OcpNetworkError',
        classification: 'canton_js_error',
        message: expect.stringContaining('bad filter'),
      });
    });

    it('rejects an unexpected frame', async () => {
      serveBook([{ surprise: true }]);

      await expect(readRegister(ledgerClient(), { readAs: CONTEXT.issuer })).rejects.toBeInstanceOf(OcpParseError);
    });

    it('treats a close other than a normal one as a snapshot that may be incomplete', async () => {
      serveBook([], { closeCode: 1006, closeReason: 'proxy dropped' });

      await expect(readRegister(ledgerClient(), { readAs: CONTEXT.issuer })).rejects.toMatchObject({
        name: 'OcpNetworkError',
        classification: 'active_contracts_stream_closed',
        message: expect.stringContaining('code 1006 (proxy dropped)'),
      });
    });

    it('maps socket errors and the idle timeout to OcpNetworkError', async () => {
      queueWebSocketScript(async (connection) => connection.handlers.onError?.(new Error('ECONNRESET')));
      await expect(findCapTables(ledgerClient(), { party: CONTEXT.issuer })).rejects.toMatchObject({
        name: 'OcpNetworkError',
        code: OcpErrorCodes.CONNECTION_FAILED,
        message: 'Active contracts read failed: ECONNRESET',
      });

      queueWebSocketScript(async (connection) =>
        connection.handlers.onError?.(new Error('WebSocket idle timeout: no message received for 5ms'))
      );
      await expect(findCapTables(ledgerClient(), { party: CONTEXT.issuer })).rejects.toMatchObject({
        code: OcpErrorCodes.TIMEOUT,
        classification: 'active_contracts_idle_timeout',
      });
    });

    it('wraps a failed ledger-end read', async () => {
      const client = ledgerClient();
      client.getLedgerEnd.mockRejectedValue(new Error('HTTP 503'));

      await expect(readRegister(client, { readAs: CONTEXT.issuer })).rejects.toMatchObject({
        name: 'OcpNetworkError',
        classification: 'ledger_end_read_failed',
      });
      client.getLedgerEnd.mockResolvedValue({});
      await expect(readRegister(client, { readAs: CONTEXT.issuer })).rejects.toBeInstanceOf(OcpParseError);
    });

    it('validates its options before reading', async () => {
      const client = ledgerClient();
      await expect(readRegister(client, { readAs: '' })).rejects.toBeInstanceOf(OcpValidationError);
      await expect(readRegister(client, { readAs: CONTEXT.issuer, activeAtOffset: -1 })).rejects.toBeInstanceOf(
        OcpValidationError
      );
      await expect(readRegister(client, { readAs: CONTEXT.issuer, idleTimeoutMs: -5 })).rejects.toBeInstanceOf(
        OcpValidationError
      );
      await expect(readRegister(client, { readAs: CONTEXT.issuer, capTableId: '' })).rejects.toBeInstanceOf(
        OcpValidationError
      );
      expect(webSocketConnections).toHaveLength(0);
    });
  });
});

describe('findCapTables', () => {
  it('lists the genuine anchors a party sees and reports anchors sharing a cap table ID', async () => {
    const shared = { ...CONTEXT, cap_table_id: 'test-9' };
    queueWebSocketScript(async (connection) =>
      deliverMessages(
        connection,
        anchorItems(
          anchorEvent('cid-b', { ...CONTEXT, cap_table_id: 'test-b' }, { status: 'CapTableStatusTearingDown' }),
          anchorEvent('cid-a', { ...CONTEXT, cap_table_id: 'test-a' }),
          anchorEvent('cid-9a', shared),
          anchorEvent('cid-9b', { ...shared, transfer_agent: 'other-transfer-agent::1220' }),
          anchorEvent('cid-forged', CONTEXT, { signatories: [CONTEXT.issuer] })
        )
      )
    );

    const found = await findCapTables(ledgerClient(3), { party: CONTEXT.issuer });

    expect(found.offset).toBe(3);
    expect(
      found.capTables.map(({ context, anchor }) => [context.cap_table_id, anchor.contractId, anchor.status])
    ).toEqual([
      ['test-a', 'cid-a', 'ACTIVE'],
      ['test-b', 'cid-b', 'TEARING_DOWN'],
    ]);
    expect(found.rejected.map((rejection) => [rejection.contractId, rejection.reason])).toEqual([
      ['cid-forged', 'wrong_signatories'],
      ['cid-9a', 'duplicate_anchor'],
      ['cid-9b', 'duplicate_anchor'],
    ]);
  });
});

describe('registerEventFormat', () => {
  it('filters by both reader interfaces with their views and no blobs', () => {
    expect(registerEventFormat('party::1')).toEqual({
      verbose: false,
      filtersByParty: {
        'party::1': {
          cumulative: [OCP_INTERFACES.ocfObject, OCP_INTERFACES.registerContract].map((interfaceId) => ({
            identifierFilter: {
              InterfaceFilter: { value: { interfaceId, includeInterfaceView: true, includeCreatedEventBlob: false } },
            },
          })),
        },
      },
    });
    expect(() => registerEventFormat('')).toThrow(OcpValidationError);
  });
});
