/**
 * Same-day dependency order in sortTransactions.
 *
 * Within a day, a transaction that acts on security X comes after the issuance of X, and a re-papered issuance
 * comes after its parent. Inputs whose date/weight order already meets those dependencies sort exactly by key, as
 * the libs/api DB loader sorts them; transactionSorting.test.ts pins the days where the two differ.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  buildConversionResultSecurityIds,
  buildTransactionSortKey,
  sortTransactions,
} from '../../src/utils/cantonOcfExtractor';

type Tx = Record<string, unknown>;

/** The order before dependencies: date, then intra-day weight, then security, created time and ID. */
function keyOrder(transactions: Tx[]): Tx[] {
  const resultIds = buildConversionResultSecurityIds(transactions);
  return transactions
    .map((tx) => ({ tx, key: buildTransactionSortKey(tx, resultIds) }))
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((item) => item.tx);
}

const ids = (transactions: Tx[]): unknown[] => transactions.map((tx) => tx.id);

const DAY = '2025-03-15';

function stockIssuance(id: string, securityId: string, date = DAY): Tx {
  return { id, date, object_type: 'TX_STOCK_ISSUANCE', security_id: securityId, quantity: '100' };
}

/**
 * A registry trade as a position registry writes it (OpenCapTable Positions.daml): transfer `<trade>-TR-0` draws on
 * `lot`; issuance `<trade>-ISS-B-0` re-papers the buyer's new lot `<trade>-B-0`; for a partial draw, issuance
 * `<trade>-ISS-R-0` re-papers the seller's remainder `<trade>-R-0`.
 */
function registryTrade(trade: string, lot: string, { remainder = false, date = DAY } = {}): Tx[] {
  const records: Tx[] = [
    {
      id: `${trade}-TR-0`,
      date,
      object_type: 'TX_STOCK_TRANSFER',
      security_id: lot,
      quantity: '10',
      resulting_security_ids: [`${trade}-B-0`],
      ...(remainder ? { balance_security_id: `${trade}-R-0` } : {}),
    },
    stockIssuance(`${trade}-ISS-B-0`, `${trade}-B-0`, date),
  ];
  if (remainder) records.push(stockIssuance(`${trade}-ISS-R-0`, `${trade}-R-0`, date));
  return records;
}

describe('sortTransactions: same-day chained trades', () => {
  it('orders a resale of the first buyer’s new lot after that lot’s issuance (two hops)', () => {
    const transactions = [
      ...registryTrade('trade-2', 'trade-1-B-0'),
      ...registryTrade('trade-1', 'sec-origin'),
      stockIssuance('origin', 'sec-origin', '2025-01-02'),
    ];

    // By weight alone: both transfers (20), then both re-papered issuances (36).
    expect(ids(keyOrder(transactions))).toEqual([
      'origin',
      'trade-1-TR-0',
      'trade-2-TR-0',
      'trade-1-ISS-B-0',
      'trade-2-ISS-B-0',
    ]);
    expect(ids(sortTransactions(transactions))).toEqual([
      'origin',
      'trade-1-TR-0',
      'trade-1-ISS-B-0',
      'trade-2-TR-0',
      'trade-2-ISS-B-0',
    ]);
  });

  it('orders a three-hop chain and leaves unrelated same-day transactions in key order', () => {
    const transactions = [
      ...registryTrade('trade-3', 'trade-2-B-0'),
      ...registryTrade('trade-2', 'trade-1-B-0'),
      ...registryTrade('trade-1', 'sec-origin'),
      stockIssuance('origin', 'sec-origin', '2025-01-02'),
      stockIssuance('unrelated-issuance', 'sec-unrelated'),
      { id: 'unrelated-cancellation', date: DAY, object_type: 'TX_STOCK_CANCELLATION', security_id: 'sec-unrelated' },
      { id: 'adjustment', date: DAY, object_type: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT' },
    ];

    expect(ids(sortTransactions(transactions))).toEqual([
      'origin',
      'adjustment',
      'unrelated-issuance',
      'trade-1-TR-0',
      'trade-1-ISS-B-0',
      'trade-2-TR-0',
      'trade-2-ISS-B-0',
      'trade-3-TR-0',
      'trade-3-ISS-B-0',
      'unrelated-cancellation',
    ]);
  });

  it('orders a same-day resale of the seller’s remainder after the remainder’s issuance', () => {
    const transactions = [
      ...registryTrade('trade-2', 'trade-1-R-0', { remainder: true }),
      ...registryTrade('trade-1', 'sec-origin', { remainder: true }),
    ];

    expect(ids(sortTransactions(transactions))).toEqual([
      'trade-1-TR-0',
      'trade-1-ISS-B-0',
      'trade-1-ISS-R-0',
      'trade-2-TR-0',
      'trade-2-ISS-B-0',
      'trade-2-ISS-R-0',
    ]);
  });

  it('keeps each re-papered issuance after its own transfer when the chain runs against key order', () => {
    // The resale's new lot ("a-…") sorts before the first buyer's lot ("z-…") by security ID, so without the
    // parent dependency its issuance would be ready, and taken, before the resale itself.
    const transactions = [...registryTrade('a-trade', 'z-trade-B-0'), ...registryTrade('z-trade', 'sec-origin')];

    expect(ids(keyOrder(transactions))).toEqual(['z-trade-TR-0', 'a-trade-TR-0', 'a-trade-ISS-B-0', 'z-trade-ISS-B-0']);
    expect(ids(sortTransactions(transactions))).toEqual([
      'z-trade-TR-0',
      'z-trade-ISS-B-0',
      'a-trade-TR-0',
      'a-trade-ISS-B-0',
    ]);
  });

  it('orders a consolidation after the same-day issuances of the securities it consolidates', () => {
    const transactions = [
      stockIssuance('held-lot', 'sec-held', '2025-01-02'),
      ...registryTrade('trade-1', 'sec-origin'),
      {
        id: 'consolidation',
        date: DAY,
        object_type: 'TX_STOCK_CONSOLIDATION',
        security_ids: ['sec-held', 'trade-1-B-0'],
        resulting_security_id: 'sec-consolidated',
      },
      stockIssuance('consolidated', 'sec-consolidated'),
    ];

    expect(ids(sortTransactions(transactions))).toEqual([
      'held-lot',
      'consolidated',
      'trade-1-TR-0',
      'trade-1-ISS-B-0',
      'consolidation',
    ]);
  });

  it('orders transactions that act on a same-day issuance after it, whatever their weight', () => {
    // Return to pool (5) and reissuance (9) weigh less than an issuance (10).
    const transactions = [
      stockIssuance('issuance', 'sec-a'),
      { id: 'return-to-pool', date: DAY, object_type: 'TX_STOCK_PLAN_RETURN_TO_POOL', security_id: 'sec-a' },
      { id: 'reissuance', date: DAY, object_type: 'TX_STOCK_REISSUANCE', security_id: 'sec-a' },
      stockIssuance('other-issuance', 'sec-b'),
    ];

    expect(ids(sortTransactions(transactions))).toEqual(['issuance', 'return-to-pool', 'reissuance', 'other-issuance']);
  });
});

describe('sortTransactions: the DB loader’s key order wherever it already meets the dependencies', () => {
  function fixtureTransactions(): Tx[] {
    const transactions: Tx[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(entryPath);
          continue;
        }
        if (!entry.name.endsWith('.json')) continue;
        const parsed: unknown = JSON.parse(fs.readFileSync(entryPath, 'utf8'));
        // createOcf fixtures wrap the DB record with the ledger request and response.
        const record = (parsed as { db?: unknown }).db ?? parsed;
        const objectType = (record as { object_type?: unknown }).object_type;
        if (typeof objectType === 'string' && /^(TX|CE)_/.test(objectType)) transactions.push(record as Tx);
      }
    };
    walk(path.join(__dirname, '../fixtures'));
    return transactions;
  }

  it('sorts every repository fixture transaction exactly by key, on their own dates and on one day', () => {
    const transactions = fixtureTransactions();
    expect(transactions.length).toBeGreaterThanOrEqual(70);

    expect(sortTransactions(transactions)).toEqual(keyOrder(transactions));
    const oneDay = transactions.map((tx) => ({ ...tx, date: DAY }));
    expect(sortTransactions(oneDay)).toEqual(keyOrder(oneDay));
  });

  /** A deterministic pseudo-random generator (mulberry32), so the ledger is the same on every run. */
  function random(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * A cap table's history over `days` days: issuances with same-day acceptances and vesting starts, transfers with
   * their re-papered issuances, cancellations, and stakeholder events. With `sameDayResales`, a transfer may also
   * draw on a lot issued earlier the same day. Also returns the lots still open at the end.
   */
  function generateLedger(days: number, sameDayResales: boolean): { transactions: Tx[]; openLots: string[] } {
    const next = random(sameDayResales ? 2 : 1);
    const pick = <T>(items: T[]): T => items[Math.floor(next() * items.length)] as T;
    const transactions: Tx[] = [];
    let open: string[] = [];
    let counter = 0;
    for (let d = 0; d < days; d += 1) {
      const date = new Date(Date.UTC(2024, 0, 1 + d)).toISOString().slice(0, 10);
      const earlierLots = [...open];
      const issuedToday: string[] = [];
      const issue = (securityId: string, objectType = 'TX_STOCK_ISSUANCE'): void => {
        transactions.push({ id: `iss-${(counter += 1)}`, date, object_type: objectType, security_id: securityId });
        issuedToday.push(securityId);
      };
      const consume = (lot: string): void => {
        for (const lots of [earlierLots, issuedToday]) {
          const index = lots.indexOf(lot);
          if (index >= 0) lots.splice(index, 1);
        }
      };
      for (let i = Math.floor(next() * 4); i > 0; i -= 1) {
        const securityId = `sec-${(counter += 1)}`;
        issue(securityId, pick(['TX_STOCK_ISSUANCE', 'TX_EQUITY_COMPENSATION_ISSUANCE', 'TX_WARRANT_ISSUANCE']));
        if (next() < 0.3) {
          transactions.push({
            id: `acc-${(counter += 1)}`,
            date,
            object_type: 'TX_STOCK_ACCEPTANCE',
            security_id: securityId,
          });
        }
        if (next() < 0.3) {
          transactions.push({
            id: `vst-${(counter += 1)}`,
            date,
            object_type: 'TX_VESTING_START',
            security_id: securityId,
          });
        }
      }
      for (let i = Math.floor(next() * 4); i > 0; i -= 1) {
        const drawable = sameDayResales ? [...earlierLots, ...issuedToday] : earlierLots;
        if (drawable.length === 0) break;
        const lot = pick(drawable);
        const result = `sec-${(counter += 1)}`;
        const balance = next() < 0.5 ? `sec-${(counter += 1)}` : undefined;
        transactions.push({
          id: `tr-${(counter += 1)}`,
          date,
          object_type: 'TX_STOCK_TRANSFER',
          security_id: lot,
          resulting_security_ids: [result],
          ...(balance !== undefined ? { balance_security_id: balance } : {}),
        });
        issue(result);
        if (balance !== undefined) issue(balance);
        consume(lot);
      }
      if (earlierLots.length > 0 && next() < 0.3) {
        const lot = pick(earlierLots);
        transactions.push({
          id: `can-${(counter += 1)}`,
          date,
          object_type: 'TX_STOCK_CANCELLATION',
          security_id: lot,
        });
        consume(lot);
      }
      if (next() < 0.2) {
        transactions.push({ id: `rel-${(counter += 1)}`, date, object_type: 'CE_STAKEHOLDER_RELATIONSHIP' });
      }
      open = [...earlierLots, ...issuedToday];
    }
    return { transactions, openLots: open };
  }

  it('generates histories that keep open exactly the lots no transaction drew on', () => {
    for (const sameDayResales of [false, true]) {
      const { transactions, openLots } = generateLedger(300, sameDayResales);
      const drawn = transactions
        .filter((tx) => tx.object_type === 'TX_STOCK_TRANSFER' || tx.object_type === 'TX_STOCK_CANCELLATION')
        .map((tx) => tx.security_id);
      const issued = transactions
        .filter((tx) => String(tx.object_type).endsWith('_ISSUANCE'))
        .map((tx) => tx.security_id);

      expect(new Set(drawn).size).toBe(drawn.length);
      expect([...openLots].sort()).toEqual(issued.filter((lot) => !drawn.includes(lot)).sort());
    }
  });

  it('sorts a large generated history without same-day resales exactly by key', () => {
    const { transactions } = generateLedger(1500, false);
    expect(transactions.length).toBeGreaterThan(5000);

    expect(sortTransactions(transactions)).toEqual(keyOrder(transactions));
  });

  it('orders every same-day resale of a large generated history after the issuance it draws on', () => {
    const { transactions } = generateLedger(1500, true);
    const warnings: string[] = [];
    const sorted = sortTransactions(transactions, { logger: (message) => warnings.push(message) });

    expect(warnings).toEqual([]);

    expect([...sorted].sort((a, b) => String(a.id).localeCompare(String(b.id)))).toEqual(
      [...transactions].sort((a, b) => String(a.id).localeCompare(String(b.id)))
    );
    const position = new Map(sorted.map((tx, index) => [tx, index]));
    const issuanceOf = new Map(
      sorted.filter((tx) => String(tx.object_type).endsWith('_ISSUANCE')).map((tx) => [tx.security_id, tx])
    );
    let sameDayDraws = 0;
    for (const tx of sorted) {
      if (String(tx.object_type).endsWith('_ISSUANCE')) continue;
      const issuance = issuanceOf.get(tx.security_id);
      if (issuance === undefined || issuance.date !== tx.date) continue;
      sameDayDraws += 1;
      expect(position.get(issuance)).toBeLessThan(position.get(tx) as number);
    }
    for (const parent of sorted.filter((tx) => tx.object_type === 'TX_STOCK_TRANSFER')) {
      for (const produced of [...(parent.resulting_security_ids as string[]), parent.balance_security_id]) {
        if (produced === undefined) continue;
        expect(position.get(parent)).toBeLessThan(position.get(issuanceOf.get(produced) as Tx) as number);
      }
    }
    expect(sameDayDraws).toBeGreaterThan(100);
  });
});

describe('sortTransactions: dependency cycles', () => {
  const cycleDay = (): Tx[] => [
    // Malformed lineage: each transfer produces the security the other one draws on.
    {
      id: 'transfer-a',
      date: DAY,
      object_type: 'TX_STOCK_TRANSFER',
      security_id: 'sec-a',
      resulting_security_ids: ['sec-b'],
    },
    {
      id: 'transfer-b',
      date: DAY,
      object_type: 'TX_STOCK_TRANSFER',
      security_id: 'sec-b',
      resulting_security_ids: ['sec-a'],
    },
    stockIssuance('issuance-a', 'sec-a'),
    stockIssuance('issuance-b', 'sec-b'),
  ];

  it('keeps a cyclic day in key order, reports it, and still orders the other days', () => {
    const chain = [...registryTrade('trade-2', 'trade-1-B-0', { date: '2025-03-16' })];
    chain.push(...registryTrade('trade-1', 'sec-origin', { date: '2025-03-16' }));
    const transactions = [...cycleDay(), ...chain];
    const warnings: string[] = [];

    const sorted = sortTransactions(transactions, { logger: (message) => warnings.push(message) });

    expect(ids(sorted)).toEqual([
      ...ids(keyOrder(cycleDay())),
      'trade-1-TR-0',
      'trade-1-ISS-B-0',
      'trade-2-TR-0',
      'trade-2-ISS-B-0',
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(`4 transaction(s) dated ${DAY} name each other's securities in a cycle`);
    for (const id of ['transfer-a', 'transfer-b', 'issuance-a', 'issuance-b']) expect(warnings[0]).toContain(id);
  });

  it('reports a transfer that produces the security it draws on', () => {
    const transactions = [
      { id: 'self', date: DAY, object_type: 'TX_STOCK_TRANSFER', security_id: 'sec-a', balance_security_id: 'sec-a' },
      stockIssuance('issuance-a', 'sec-a'),
      stockIssuance('unrelated', 'sec-z'),
    ];
    const warnings: string[] = [];

    const sorted = sortTransactions(transactions, { logger: (message) => warnings.push(message) });

    expect(sorted).toEqual(keyOrder(transactions));
    expect(warnings).toEqual([expect.stringContaining(': self, issuance-a')]);
  });

  it('warns on the console without a logger', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(ids(sortTransactions(cycleDay()))).toEqual(ids(keyOrder(cycleDay())));
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('in a cycle'));
    } finally {
      warn.mockRestore();
    }
  });
});
