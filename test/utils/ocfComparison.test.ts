/** Tests for OCF comparison utilities */

import {
  SCHEMA_DEFAULT_EQUIVALENCE_RULES,
  diffOcfObjects,
  isSchemaDefaultEquivalent,
  ocfCompare,
  ocfDeepEqual,
} from '../../src/utils/ocfComparison';

/** Realistic 1:1 RATIO_CONVERSION right, modeled on production data. */
const ONE_TO_ONE_RIGHT = {
  type: 'STOCK_CLASS_CONVERSION_RIGHT',
  conversion_mechanism: {
    type: 'RATIO_CONVERSION',
    ratio: { numerator: '1', denominator: '1' },
    rounding_type: 'NORMAL',
    conversion_price: { amount: '1.00', currency: 'USD' },
  },
} as const;

/** Production-like preferred stock class fixture (portals 683d572d / 71fefa84 drift). */
const REALISTIC_PREFERRED_STOCK_CLASS_WITH_RIGHT = {
  object_type: 'STOCK_CLASS',
  id: 'stock-class_7a420f2c8697',
  name: 'Series Seed Preferred Stock',
  class_type: 'PREFERRED',
  default_id_prefix: 'SS-',
  current_shares_authorized: '10000000',
  board_approval_date: '2024-08-14',
  conversion_rights: [
    {
      type: 'STOCK_CLASS_CONVERSION_RIGHT',
      conversion_mechanism: {
        type: 'RATIO_CONVERSION',
        ratio: { numerator: '1', denominator: '1' },
        rounding_type: 'NORMAL',
        conversion_price: { amount: '1.00', currency: 'USD' },
      },
      converts_to_stock_class_id: 'stock-class_8b1719257017',
    },
  ],
};

describe('ocfDeepEqual', () => {
  test('returns true for identical objects', () => {
    const obj = { id: 'test-1', name: 'Test', quantity: '100' };
    expect(ocfDeepEqual(obj, { ...obj })).toBe(true);
  });

  test('returns true for numeric strings with different precision', () => {
    expect(ocfDeepEqual({ quantity: '100' }, { quantity: '100.0000000000' })).toBe(true);
    expect(ocfDeepEqual({ quantity: '100.5' }, { quantity: '100.5' })).toBe(true);
  });

  test('returns true when comparing undefined to empty array', () => {
    expect(ocfDeepEqual({ items: undefined }, { items: [] })).toBe(true);
    expect(ocfDeepEqual({ items: [] }, { items: undefined })).toBe(true);
  });

  test('returns true when comparing undefined to empty object', () => {
    expect(ocfDeepEqual({ data: undefined }, { data: {} })).toBe(true);
  });

  test('returns true for whitespace-trimmed strings', () => {
    expect(ocfDeepEqual({ name: 'Test' }, { name: '  Test  ' })).toBe(true);
  });

  test('returns false for different values', () => {
    expect(ocfDeepEqual({ quantity: '100' }, { quantity: '200' })).toBe(false);
  });

  test('returns true for number vs equivalent numeric string (DB JSONB vs DAML readback)', () => {
    // DB JSONB stores numbers as JS numbers, DAML readback returns strings
    expect(ocfDeepEqual({ value: 100 }, { value: '100' })).toBe(true);
    expect(ocfDeepEqual({ value: '100' }, { value: 100 })).toBe(true);
    expect(ocfDeepEqual({ value: 22500 }, { value: '22500' })).toBe(true);
    expect(ocfDeepEqual({ value: 35000 }, { value: '35000' })).toBe(true);
    expect(ocfDeepEqual({ value: 100.5 }, { value: '100.5' })).toBe(true);
  });

  test('returns false for number vs non-equivalent string', () => {
    expect(ocfDeepEqual({ value: 100 }, { value: 'abc' })).toBe(false);
    expect(ocfDeepEqual({ value: 100 }, { value: '200' })).toBe(false);
  });

  test('handles nested number vs string comparison', () => {
    // Simulates purchase_price.amount stored as number in DB vs string from Canton
    const dbData = {
      purchase_price: { amount: 22500, currency: 'USD' },
      exercise_triggers: [
        {
          conversion_right: {
            conversion_mechanism: { converts_to_quantity: 22500 },
          },
        },
      ],
    };
    const cantonData = {
      purchase_price: { amount: '22500', currency: 'USD' },
      exercise_triggers: [
        {
          conversion_right: {
            conversion_mechanism: { converts_to_quantity: '22500' },
          },
        },
      ],
    };
    expect(ocfDeepEqual(dbData, cantonData)).toBe(true);
  });

  test('handles nested objects correctly', () => {
    const a = { issuer: { id: 'test', name: { legal_name: 'Test Corp' } } };
    const b = { issuer: { id: 'test', name: { legal_name: 'Test Corp' } } };
    expect(ocfDeepEqual(a, b)).toBe(true);
  });

  test('handles zero share ranges as undefined-like', () => {
    expect(
      ocfDeepEqual(
        { share_numbers: [{ starting_share_number: 0, ending_share_number: 0 }] },
        { share_numbers: undefined }
      )
    ).toBe(true);
  });

  test('treats omitted remainder and false as equivalent', () => {
    expect(
      ocfDeepEqual(
        { portion: { numerator: '1', denominator: '4' } },
        { portion: { numerator: '1', denominator: '4', remainder: false } }
      )
    ).toBe(true);
    expect(
      ocfDeepEqual(
        { portion: { numerator: '1', denominator: '4', remainder: false } },
        { portion: { numerator: '1', denominator: '4' } }
      )
    ).toBe(true);
  });

  test('remainder: true is NOT equivalent to omitted or false', () => {
    // remainder: true should NOT match omitted remainder
    expect(ocfDeepEqual({ portion: { remainder: true } }, { portion: {} })).toBe(false);
    // remainder: true should NOT match remainder: false
    expect(ocfDeepEqual({ portion: { remainder: true } }, { portion: { remainder: false } })).toBe(false);
  });
});

describe('date normalization', () => {
  test('returns true for date-only vs ISO timestamp with same date', () => {
    expect(ocfDeepEqual({ date: '2024-01-15' }, { date: '2024-01-15T00:00:00.000Z' })).toBe(true);
  });

  test('returns true for ISO timestamp vs date-only with same date', () => {
    expect(ocfDeepEqual({ date: '2024-01-15T12:30:00Z' }, { date: '2024-01-15' })).toBe(true);
  });

  test('returns true for two identical date-only strings', () => {
    expect(ocfDeepEqual({ date: '2024-01-15' }, { date: '2024-01-15' })).toBe(true);
  });

  test('returns true for two ISO timestamps with same date', () => {
    expect(ocfDeepEqual({ date: '2024-01-15T00:00:00.000Z' }, { date: '2024-01-15T12:30:00Z' })).toBe(true);
  });

  test('returns false for different dates', () => {
    expect(ocfDeepEqual({ date: '2024-01-15' }, { date: '2024-01-16' })).toBe(false);
  });

  test('handles nested date fields in transaction-like objects', () => {
    const dbData = {
      id: 'tx-1',
      date: '2024-08-14T00:00:00.000Z',
      security_id: 'sec-1',
    };
    const cantonData = {
      id: 'tx-1',
      date: '2024-08-14',
      security_id: 'sec-1',
    };
    expect(ocfDeepEqual(dbData, cantonData)).toBe(true);
  });

  test('handles date in array elements', () => {
    const a = { items: [{ date: '2024-01-15T00:00:00.000Z' }] };
    const b = { items: [{ date: '2024-01-15' }] };
    expect(ocfDeepEqual(a, b)).toBe(true);
  });

  test('does not treat non-date strings as dates', () => {
    expect(ocfDeepEqual({ val: 'hello' }, { val: 'hello' })).toBe(true);
    expect(ocfDeepEqual({ val: 'hello' }, { val: 'world' })).toBe(false);
  });

  test('does not match date-prefixed IDs as dates', () => {
    // Strings starting with YYYY-MM-DD but without valid time suffix
    // must NOT be normalized as dates (could be IDs, codes, etc.)
    expect(ocfDeepEqual({ id: '2024-01-15TICKET' }, { id: '2024-01-15TICKET' })).toBe(true);
    expect(ocfDeepEqual({ id: '2024-01-15TICKET' }, { id: '2024-01-15' })).toBe(false);
    expect(ocfDeepEqual({ id: '2024-01-15Tabc' }, { id: '2024-01-15' })).toBe(false);
  });

  test('handles date with timezone offset', () => {
    expect(ocfDeepEqual({ date: '2024-01-15' }, { date: '2024-01-15T12:00:00+05:00' })).toBe(true);
  });

  test('keeps lexical date-prefix semantics when an offset crosses a UTC day', () => {
    expect(ocfDeepEqual({ date: '2024-01-15' }, { date: '2024-01-15T23:30:00-05:00' })).toBe(true);
    expect(ocfDeepEqual({ date: '2024-01-15' }, { date: '2024-01-15T00:30:00+14:00' })).toBe(true);
  });

  test.each([
    '2024-02-30T00:00:00Z',
    '2024-01-15T12:30:00',
    '2024-01-15T24:00:00Z',
    '2024-01-15T12:30:00+24:00',
    '2024-01-15T12:30:00Zjunk',
  ])('does not normalize invalid date-time %s', (invalidDateTime) => {
    expect(ocfDeepEqual({ date: '2024-01-15' }, { date: invalidDateTime })).toBe(false);
  });

  test('does not normalize impossible date-only values', () => {
    expect(ocfDeepEqual({ date: '2024-02-30' }, { date: '2024-02-30T00:00:00Z' })).toBe(false);
    expect(ocfDeepEqual({ date: '2023-02-29' }, { date: '2023-02-29T00:00:00Z' })).toBe(false);
  });
});

describe('ocfCompare', () => {
  test('reports no differences for number vs equivalent string', () => {
    const result = ocfCompare({ amount: 22500 }, { amount: '22500' });
    expect(result.equal).toBe(true);
    expect(result.differences).toHaveLength(0);
  });

  test('reports differences for actually different values', () => {
    const result = ocfCompare({ amount: '100' }, { amount: '200' });
    expect(result.equal).toBe(false);
    expect(result.differences.length).toBeGreaterThan(0);
  });

  test('reports no differences for date format variations', () => {
    const result = ocfCompare({ date: '2024-08-14T00:00:00.000Z' }, { date: '2024-08-14' });
    expect(result.equal).toBe(true);
    expect(result.differences).toHaveLength(0);
  });

  test('reports differences for different dates', () => {
    const result = ocfCompare({ date: '2024-08-14' }, { date: '2024-08-15' });
    expect(result.equal).toBe(false);
    expect(result.differences.length).toBeGreaterThan(0);
  });
});

describe('diffOcfObjects', () => {
  test('returns no diffs for number vs equivalent string', () => {
    const diffs = diffOcfObjects({ amount: 22500 }, { amount: '22500' });
    expect(diffs).toHaveLength(0);
  });

  test('returns diffs for number vs non-equivalent string', () => {
    const diffs = diffOcfObjects({ value: 100 }, { value: 'abc' });
    expect(diffs.length).toBeGreaterThan(0);
  });

  test('handles nested number/string equivalence', () => {
    const a = { purchase_price: { amount: 22500, currency: 'USD' } };
    const b = { purchase_price: { amount: '22500', currency: 'USD' } };
    const diffs = diffOcfObjects(a, b);
    expect(diffs).toHaveLength(0);
  });

  test('treats omitted remainder and false as no diff', () => {
    const a = { vesting_conditions: [{ portion: { numerator: '1', denominator: '4' } }] };
    const b = { vesting_conditions: [{ portion: { numerator: '1', denominator: '4', remainder: false } }] };
    const diffs = diffOcfObjects(a, b);
    expect(diffs).toHaveLength(0);
  });

  test('treats single 1:1 RATIO_CONVERSION right vs absent conversion_rights as no diff', () => {
    const dbSide = { stockClasses: [REALISTIC_PREFERRED_STOCK_CLASS_WITH_RIGHT] };
    const cantonSide = {
      stockClasses: [{ ...REALISTIC_PREFERRED_STOCK_CLASS_WITH_RIGHT, conversion_rights: undefined }],
    };
    const diffs = diffOcfObjects(dbSide, cantonSide);
    expect(diffs).toHaveLength(0);
  });

  test('returns no diffs for date format variations', () => {
    const diffs = diffOcfObjects({ date: '2024-08-14T00:00:00.000Z' }, { date: '2024-08-14' });
    expect(diffs).toHaveLength(0);
  });
});

describe('schema-default equivalence rules', () => {
  describe('rule table shape', () => {
    test('keeps the portion.remainder rule and adds the conversion-rights rule', () => {
      const ids = SCHEMA_DEFAULT_EQUIVALENCE_RULES.map((rule) => rule.id);
      expect(ids).toContain('portion-remainder-false-default');
      expect(ids).toContain('conversion-rights-single-1to1-ratio');
      expect(new Set(ids).size).toBe(ids.length); // ids unique
      for (const rule of SCHEMA_DEFAULT_EQUIVALENCE_RULES) {
        expect(typeof rule.id).toBe('string');
        expect(rule.id.length).toBeGreaterThan(0);
        expect(typeof rule.description).toBe('string');
        expect(rule.description.length).toBeGreaterThan(0);
        expect(['exact', 'suffix']).toContain(rule.match.kind);
        expect(typeof rule.match.path).toBe('string');
        expect(typeof rule.isEquivalent).toBe('function');
      }
    });
  });

  describe('isSchemaDefaultEquivalent predicate', () => {
    test('portion.remainder: false vs undefined-like equivalent, side-agnostic', () => {
      expect(isSchemaDefaultEquivalent('portion.remainder', false, undefined)).toBe(true);
      expect(isSchemaDefaultEquivalent('portion.remainder', undefined, false)).toBe(true);
      expect(isSchemaDefaultEquivalent('nested.portion.remainder', false, null)).toBe(true);
    });

    test('portion.remainder: true vs false NOT equivalent', () => {
      expect(isSchemaDefaultEquivalent('portion.remainder', true, false)).toBe(false);
    });

    test('non-matching path never fires a rule', () => {
      expect(isSchemaDefaultEquivalent('notportion.remainder', false, undefined)).toBe(false);
      expect(isSchemaDefaultEquivalent('portion.remainderx', false, undefined)).toBe(false);
      expect(isSchemaDefaultEquivalent('conversion_rights_x', ONE_TO_ONE_RIGHT, undefined)).toBe(false);
    });
  });

  describe('conversion_rights rule (1:1 RATIO_CONVERSION vs absent)', () => {
    test('direct predicate: single 1:1 right vs empty/absent array is equivalent (both directions)', () => {
      expect(isSchemaDefaultEquivalent('conversion_rights', [ONE_TO_ONE_RIGHT], undefined)).toBe(true);
      expect(isSchemaDefaultEquivalent('conversion_rights', undefined, [ONE_TO_ONE_RIGHT])).toBe(true);
      expect(isSchemaDefaultEquivalent('conversion_rights', [ONE_TO_ONE_RIGHT], [])).toBe(true);
      expect(isSchemaDefaultEquivalent('conversion_rights', [], [ONE_TO_ONE_RIGHT])).toBe(true);
      expect(isSchemaDefaultEquivalent('a.conversion_rights', [ONE_TO_ONE_RIGHT], null)).toBe(true);
      expect(isSchemaDefaultEquivalent('x.y.conversion_rights', null, [ONE_TO_ONE_RIGHT])).toBe(true);
    });

    test('rejects 2:1 ratio vs empty (non-1:1)', () => {
      const twoToOne = {
        type: 'STOCK_CLASS_CONVERSION_RIGHT',
        conversion_mechanism: {
          type: 'RATIO_CONVERSION',
          ratio: { numerator: '2', denominator: '1' },
          rounding_type: 'NORMAL',
          conversion_price: { amount: '1.00', currency: 'USD' },
        },
      };
      expect(isSchemaDefaultEquivalent('conversion_rights', [twoToOne], [])).toBe(false);
      expect(isSchemaDefaultEquivalent('conversion_rights', [], [twoToOne])).toBe(false);
    });

    test('rejects converts_to_future_round: true (changes semantics)', () => {
      const futureRoundRight = {
        type: 'STOCK_CLASS_CONVERSION_RIGHT',
        conversion_mechanism: {
          type: 'RATIO_CONVERSION',
          ratio: { numerator: '1', denominator: '1' },
          rounding_type: 'NORMAL',
          conversion_price: { amount: '1.00', currency: 'USD' },
        },
        converts_to_future_round: true,
      };
      expect(isSchemaDefaultEquivalent('conversion_rights', [futureRoundRight], [])).toBe(false);
      expect(isSchemaDefaultEquivalent('conversion_rights', [], [futureRoundRight])).toBe(false);
    });

    test('rejects two rights on one side', () => {
      expect(isSchemaDefaultEquivalent('conversion_rights', [ONE_TO_ONE_RIGHT, ONE_TO_ONE_RIGHT], [])).toBe(false);
      expect(isSchemaDefaultEquivalent('conversion_rights', [], [ONE_TO_ONE_RIGHT, ONE_TO_ONE_RIGHT])).toBe(false);
    });

    test('tolerates absent type discriminator and numeric ratio components', () => {
      const untypedNumeric = {
        conversion_mechanism: {
          type: 'RATIO_CONVERSION',
          ratio: { numerator: 1, denominator: 1.0 },
          rounding_type: 'NORMAL',
          conversion_price: { amount: '1.00', currency: 'USD' },
        },
      };
      expect(isSchemaDefaultEquivalent('conversion_rights', [untypedNumeric], undefined)).toBe(true);
      expect(isSchemaDefaultEquivalent('conversion_rights', undefined, [untypedNumeric])).toBe(true);
    });

    test('non-RATIO_CONVERSION mechanisms are not schema-default', () => {
      const fixedConversion = {
        type: 'STOCK_CLASS_CONVERSION_RIGHT',
        conversion_mechanism: {
          type: 'FIXED_RATE_CONVERSION',
          conversion_price: { amount: '1.00', currency: 'USD' },
        },
      };
      expect(isSchemaDefaultEquivalent('conversion_rights', [fixedConversion], [])).toBe(false);
    });
  });

  describe('ocfCompare / ocfDeepEqual end-to-end', () => {
    test('(a) stockClass with single 1:1 right vs empty/absent conversion_rights → equal', () => {
      const withRight = { ...REALISTIC_PREFERRED_STOCK_CLASS_WITH_RIGHT };
      const withoutRight = { ...REALISTIC_PREFERRED_STOCK_CLASS_WITH_RIGHT, conversion_rights: [] };
      expect(ocfCompare(withRight, withoutRight)).toEqual({ equal: true, differences: [] });
      expect(ocfCompare(withoutRight, withRight)).toEqual({ equal: true, differences: [] });

      const absent = { ...REALISTIC_PREFERRED_STOCK_CLASS_WITH_RIGHT, conversion_rights: undefined };
      expect(ocfCompare(withRight, absent)).toEqual({ equal: true, differences: [] });
      expect(ocfCompare(absent, withRight)).toEqual({ equal: true, differences: [] });
    });

    test('(b) nested path with .conversion_rights suffix → equal', () => {
      const dbRow = {
        id: 'stock-class_7a420f2c8697',
        stockClass: REALISTIC_PREFERRED_STOCK_CLASS_WITH_RIGHT,
      };
      const cantonRow = {
        id: 'stock-class_7a420f2c8697',
        stockClass: { ...REALISTIC_PREFERRED_STOCK_CLASS_WITH_RIGHT, conversion_rights: undefined },
      };
      expect(ocfCompare(dbRow, cantonRow)).toEqual({ equal: true, differences: [] });
      expect(ocfCompare(cantonRow, dbRow)).toEqual({ equal: true, differences: [] });
    });

    test('(c) 2:1 right vs empty → NOT equal', () => {
      const twoToOneRight = {
        ...ONE_TO_ONE_RIGHT,
        conversion_mechanism: {
          ...ONE_TO_ONE_RIGHT.conversion_mechanism,
          ratio: { numerator: '2', denominator: '1' },
        },
      };
      const dbRow = { ...REALISTIC_PREFERRED_STOCK_CLASS_WITH_RIGHT, conversion_rights: [twoToOneRight] };
      const cantonRow = { ...REALISTIC_PREFERRED_STOCK_CLASS_WITH_RIGHT, conversion_rights: undefined };
      const result = ocfCompare(dbRow, cantonRow);
      expect(result.equal).toBe(false);
      expect(result.differences.length).toBeGreaterThan(0);
      expect(ocfCompare(cantonRow, dbRow).equal).toBe(false);
    });

    test('(d) 1:1 with converts_to_future_round: true vs empty → NOT equal', () => {
      const futureRoundRight = { ...ONE_TO_ONE_RIGHT, converts_to_future_round: true };
      const dbRow = { ...REALISTIC_PREFERRED_STOCK_CLASS_WITH_RIGHT, conversion_rights: [futureRoundRight] };
      const cantonRow = { ...REALISTIC_PREFERRED_STOCK_CLASS_WITH_RIGHT, conversion_rights: undefined };
      const result = ocfCompare(dbRow, cantonRow);
      expect(result.equal).toBe(false);
      expect(result.differences.length).toBeGreaterThan(0);
      expect(ocfCompare(cantonRow, dbRow).equal).toBe(false);
    });

    test('(e) two rights on one side vs empty → NOT equal', () => {
      const dbRow = {
        ...REALISTIC_PREFERRED_STOCK_CLASS_WITH_RIGHT,
        conversion_rights: [ONE_TO_ONE_RIGHT, ONE_TO_ONE_RIGHT],
      };
      const cantonRow = { ...REALISTIC_PREFERRED_STOCK_CLASS_WITH_RIGHT, conversion_rights: undefined };
      const result = ocfCompare(dbRow, cantonRow);
      expect(result.equal).toBe(false);
      expect(result.differences.length).toBeGreaterThan(0);
      expect(ocfCompare(cantonRow, dbRow).equal).toBe(false);
    });

    test('(f) existing portion.remainder behavior still passes', () => {
      expect(
        ocfDeepEqual(
          { portion: { numerator: '1', denominator: '4' } },
          { portion: { numerator: '1', denominator: '4', remainder: false } }
        )
      ).toBe(true);
      expect(ocfDeepEqual({ portion: { remainder: true } }, { portion: { remainder: false } })).toBe(false);
    });

    test('(g) realistic production-style fixture: DB 1:1 right vs Canton absent → equal with no differences', () => {
      const dbRow = REALISTIC_PREFERRED_STOCK_CLASS_WITH_RIGHT;
      const cantonRow = { ...REALISTIC_PREFERRED_STOCK_CLASS_WITH_RIGHT, conversion_rights: undefined };
      expect(ocfCompare(dbRow, cantonRow)).toEqual({ equal: true, differences: [] });
      expect(ocfCompare(cantonRow, dbRow)).toEqual({ equal: true, differences: [] });
    });
  });
});
