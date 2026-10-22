/**
 * Tests for buildOcfManifest (a manifest from a book's key index) and extractCantonOcfManifest (read the book with
 * the register reader, then build).
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpValidationError } from '../../src/errors';
import { admitContract } from '../../src/register/admission';
import { RegisterIndex } from '../../src/register/registerIndex';
import { buildOcfManifest, countManifestObjects, extractCantonOcfManifest } from '../../src/utils/cantonOcfExtractor';
import { deliverMessages, queueWebSocketScript, resetWebSocketMock } from '../mocks/canton-deep';
import {
  acsItem,
  anchorEvent,
  anchorItems,
  BOOK_DATA,
  bookEvents,
  CONTEXT,
  FOUNDERS_SECURITY_ID,
  recordEvent,
  STAKEHOLDER_ID,
} from '../register/registerLedgerFixtures';

function bookIndex(events: unknown[] = bookEvents(), retainPayloads = true): RegisterIndex {
  const index = new RegisterIndex({ context: CONTEXT, offset: 50, retainPayloads });
  for (const event of events) {
    const result = admitContract(event, { requireView: true });
    if (!result.ok) throw new Error(result.rejection.message);
    index.add(result.contract);
  }
  return index;
}

const vestingStart = {
  id: 'vesting-start-1',
  date: '2024-01-15',
  security_id: FOUNDERS_SECURITY_ID,
  vesting_condition_id: 'condition-1',
  comments: [],
};

describe('buildOcfManifest', () => {
  it('groups every record of the book, transactions in date order', () => {
    const manifest = buildOcfManifest(
      bookIndex([...bookEvents(), recordEvent('cid-vesting', 'vestingStart', vestingStart, { offset: 4 })])
    );

    expect(manifest.issuer).toMatchObject({ object_type: 'ISSUER' });
    expect(manifest.stakeholders).toEqual([
      expect.objectContaining({ id: STAKEHOLDER_ID, object_type: 'STAKEHOLDER' }),
    ]);
    expect(manifest.stockClasses).toEqual([expect.objectContaining({ object_type: 'STOCK_CLASS' })]);
    expect(manifest.transactions.map((transaction) => [transaction.object_type, transaction.date])).toEqual([
      ['TX_STOCK_ISSUANCE', '2024-01-15'],
      ['TX_VESTING_START', '2024-01-15'],
      ['TX_STOCK_ACCEPTANCE', '2024-01-20'],
    ]);
    expect(countManifestObjects(manifest)).toBe(6);
  });

  it('leaves the hold pair out of a strict OCF export and includes it in an extended one', () => {
    const index = bookIndex();

    expect(buildOcfManifest(index).transactions.some((tx) => tx.object_type === 'TX_STOCK_HOLD')).toBe(false);
    expect(buildOcfManifest(index, { includeHoldRecords: true }).transactions).toContainEqual(
      expect.objectContaining({ object_type: 'TX_STOCK_HOLD', id: 'hold-1', quantity: '1500' })
    );
  });

  it('returns copies, so editing a manifest leaves the index as it was', () => {
    const index = bookIndex();
    const manifest = buildOcfManifest(index);
    const [stakeholder] = manifest.stakeholders;
    if (stakeholder === undefined) throw new Error('no stakeholder');
    stakeholder.id = 'edited';

    expect(index.record(STAKEHOLDER_ID)?.data).toMatchObject({ id: STAKEHOLDER_ID });
  });

  it('needs the record data', () => {
    expect(() => buildOcfManifest(bookIndex(bookEvents(), false))).toThrow(OcpValidationError);
  });

  it('refuses a book with two issuer records', () => {
    const second = recordEvent('cid-issuer-2', 'issuer', { ...BOOK_DATA.issuer, id: 'issuer-2' });

    expect(() => buildOcfManifest(bookIndex([...bookEvents(), second]))).toThrow(
      expect.objectContaining({ classification: 'multiple_issuer_records' })
    );
  });

  it('returns an empty manifest for an empty index', () => {
    expect(countManifestObjects(buildOcfManifest(new RegisterIndex({ context: CONTEXT, offset: 1 })))).toBe(0);
  });
});

describe('extractCantonOcfManifest', () => {
  const client = { getLedgerEnd: jest.fn().mockResolvedValue({ offset: 9 }) } as unknown as LedgerJsonApiClient;

  function serve(anchors: unknown[], contracts: unknown[]): void {
    queueWebSocketScript(async (connection) => deliverMessages(connection, anchors));
    queueWebSocketScript(async (connection) => deliverMessages(connection, contracts));
  }

  beforeEach(() => {
    resetWebSocketMock();
  });

  it('reads the book, then builds its manifest', async () => {
    serve(anchorItems(anchorEvent('cid-anchor')), bookEvents().map(acsItem));
    const logs: string[] = [];

    const manifest = await extractCantonOcfManifest(client, {
      readAs: CONTEXT.issuer,
      capTableId: CONTEXT.cap_table_id,
      includeHoldRecords: true,
      logger: (message) => logs.push(message),
    });

    expect(manifest.stakeholders).toHaveLength(1);
    expect(manifest.transactions.map((transaction) => transaction.object_type)).toEqual([
      'TX_STOCK_ISSUANCE',
      'TX_STOCK_ACCEPTANCE',
      'TX_STOCK_HOLD',
    ]);
    expect(logs).toEqual(['  Read cap table test-1 at offset 9: 6 records']);
  });

  it('throws when no book or several books match', async () => {
    serve([], []);
    await expect(extractCantonOcfManifest(client, { readAs: CONTEXT.issuer })).rejects.toMatchObject({
      classification: 'register_book_not_found',
    });

    const other = bookEvents({ ...CONTEXT, cap_table_id: 'test-2' }).map((event) => ({
      ...event,
      contractId: `other-${String(event.contractId)}`,
    }));
    const [otherAnchor] = other;
    if (otherAnchor === undefined) throw new Error('no anchor');
    serve(anchorItems(anchorEvent('cid-anchor'), otherAnchor), [...bookEvents(), ...other].map(acsItem));
    await expect(extractCantonOcfManifest(client, { readAs: CONTEXT.issuer })).rejects.toMatchObject({
      classification: 'register_book_ambiguous',
    });
  });

  it('refuses a book that reads incomplete unless asked to export it anyway', async () => {
    const { id: _id, ...withoutId } = BOOK_DATA.stakeholder;
    const broken = recordEvent('cid-broken', 'stakeholder', { ...withoutId, id: 4 });
    const contracts = [...bookEvents(), broken].map(acsItem);

    serve(anchorItems(anchorEvent('cid-anchor')), contracts);
    const error: unknown = await extractCantonOcfManifest(client, { readAs: CONTEXT.issuer }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OcpContractError);
    expect(error).toMatchObject({ classification: 'register_book_incomplete' });

    serve(anchorItems(anchorEvent('cid-anchor')), contracts);
    const manifest = await extractCantonOcfManifest(client, { readAs: CONTEXT.issuer, allowIncomplete: true });
    expect(manifest.stakeholders).toHaveLength(1);
  });
});
