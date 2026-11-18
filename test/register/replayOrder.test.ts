/**
 * The replay order: definitions first, documents last, dated records in date order with the units rule (a split
 * first on its day), same-day dependencies, bundled outputs, and the records that may replay after their own date.
 */

import { orderReplay, replayWeight } from '../../src/register/replay/order';
import { SPLIT_WEIGHT, txWeight } from '../../src/utils/cantonOcfExtractor';
import {
  acceptance,
  D2024,
  EVENT_DAY,
  issuance,
  issuer,
  manifestOf,
  out,
  split,
  SPLIT_DAY,
  stakeholder,
  stockClass,
  transfer,
  vestingStart,
  vestingTerms,
  type OcfJson,
} from './replayFixtures';

function order(...records: OcfJson[]): string[] {
  return orderReplay(manifestOf(records)).units.map((unit) => unit.record.id);
}

describe('orderReplay', () => {
  it('puts definitions first by kind, a class after the classes it converts to, and documents last', () => {
    const preferred = stockClass('CLS-P', {
      conversion_rights: [
        {
          type: 'STOCK_CLASS_CONVERSION_RIGHT',
          conversion_mechanism: { type: 'RATIO_CONVERSION', ratio: { numerator: '1', denominator: '1' } },
          converts_to_stock_class_id: 'CLS-C',
        },
      ],
    });
    const document: OcfJson = { object_type: 'DOCUMENT', id: 'DOC-1', md5: 'x', related_objects: [] };
    expect(
      order(
        issuance('S-1', 'SH-A', 'CLS-C', '1', D2024),
        document,
        preferred,
        stockClass('CLS-C'),
        vestingTerms('VT-1'),
        stakeholder('SH-A'),
        issuer()
      )
    ).toEqual(['ISSUER-1', 'SH-A', 'VT-1', 'CLS-C', 'CLS-P', 'ISS-S-1', 'DOC-1']);
  });

  it('sorts a split first on its day: records dated on it are in post-split units', () => {
    expect(
      order(
        acceptance('ACC-1', 'S-1', SPLIT_DAY),
        issuance('S-2', 'SH-A', 'CLS-A', '1', SPLIT_DAY),
        split('SPLIT-1', 'CLS-A', '2', '1', SPLIT_DAY),
        issuance('S-1', 'SH-A', 'CLS-A', '1', D2024)
      )
    ).toEqual(['ISS-S-1', 'SPLIT-1', 'ISS-S-2', 'ACC-1']);
    expect(replayWeight('TX_STOCK_CLASS_SPLIT')).toBe(SPLIT_WEIGHT);
    expect(replayWeight('TX_STOCK_HOLD')).toBe(15);
    expect(replayWeight('TX_STOCK_TRANSFER')).toBe(txWeight({ object_type: 'TX_STOCK_TRANSFER' }));
  });

  it('bundles a stock event with its outputs and orders an issuance before the events on its security', () => {
    const { units } = orderReplay(
      manifestOf([
        acceptance('ACC-B', 'S-B1', EVENT_DAY),
        out('S-A1-R', 'SH-A', '500'),
        transfer('TR-1', 'S-A1', '100', ['S-B1'], 'S-A1-R'),
        out('S-B1', 'SH-B', '100'),
        issuance('S-A1', 'SH-A', 'CLS-A', '600', D2024),
      ])
    );
    expect(units.map((unit) => unit.record.id)).toEqual(['ISS-S-A1', 'TR-1', 'ACC-B']);
    const [, bundle] = units;
    expect(bundle?.resulting.map((record) => record?.id)).toEqual(['ISS-S-B1']);
    expect(bundle?.balance?.id).toBe('ISS-S-A1-R');
    expect(units.map((unit) => unit.index)).toEqual([0, 1, 2]);
  });

  it('replays a backdated vesting start and a financing on the day of what they name', () => {
    const financing: OcfJson = {
      object_type: 'FINANCING',
      id: 'FIN-1',
      date: '2023-01-01',
      name: 'Seed',
      issuance_ids: ['ISS-S-1'],
    };
    const { units } = orderReplay(
      manifestOf([
        financing,
        vestingStart('VS-1', 'S-1', '2023-06-01'),
        acceptance('ACC-0', 'S-1', '2023-12-31'),
        issuance('S-1', 'SH-A', 'CLS-A', '1', D2024),
      ])
    );
    expect(units.map((unit) => [unit.record.id, unit.date])).toEqual([
      ['ACC-0', '2023-12-31'],
      ['ISS-S-1', D2024],
      ['VS-1', D2024],
      ['FIN-1', D2024],
    ]);
  });

  it('reports the objects it cannot place, in manifest order', () => {
    const { problems, units } = orderReplay(
      manifestOf([
        { object_type: 'TX_STOCK_ACCEPTANCE', id: 'ACC-1', date: 'soon', security_id: 'S-1' },
        { object_type: 'TX_NOT_OCF', id: 'X-1', date: D2024 },
        { object_type: 'TX_STOCK_ACCEPTANCE', id: 7, date: D2024 },
      ])
    );
    expect(units).toEqual([]);
    expect(problems.map((problem) => [problem.recordId, problem.message])).toEqual([
      ['ACC-1', 'TX_STOCK_ACCEPTANCE ACC-1: date must be a date (YYYY-MM-DD)'],
      ['X-1', 'unknown object type TX_NOT_OCF'],
      [null, 'TX_STOCK_ACCEPTANCE: id must be a string'],
    ]);
  });
});
