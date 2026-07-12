/**
 * Unit tests for valuation and vesting type converters.
 *
 * Tests both OCF → DAML and DAML → OCF conversions for:
 * - Valuation
 * - VestingStart
 * - VestingEvent
 * - VestingAcceleration
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import {
  damlValuationToNative,
  damlValuationTypeToNative,
  type DamlValuationData,
} from '../../src/functions/OpenCapTable/valuation/damlToOcf';
import {
  damlVestingAccelerationToNative,
  type DamlVestingAccelerationData,
} from '../../src/functions/OpenCapTable/vestingAcceleration/damlToOcf';
import { getVestingAccelerationAsOcf } from '../../src/functions/OpenCapTable/vestingAcceleration/getVestingAccelerationAsOcf';
import {
  damlVestingEventToNative,
  type DamlVestingEventData,
} from '../../src/functions/OpenCapTable/vestingEvent/damlToOcf';
import { getVestingEventAsOcf } from '../../src/functions/OpenCapTable/vestingEvent/getVestingEventAsOcf';
import {
  damlVestingStartToNative,
  type DamlVestingStartData,
} from '../../src/functions/OpenCapTable/vestingStart/damlToOcf';
import { getVestingStartAsOcf } from '../../src/functions/OpenCapTable/vestingStart/getVestingStartAsOcf';
import { vestingTermsDataToDaml } from '../../src/functions/OpenCapTable/vestingTerms/createVestingTerms';
import { damlVestingTermsDataToNative } from '../../src/functions/OpenCapTable/vestingTerms/getVestingTermsAsOcf';
import type {
  OcfValuation,
  OcfVestingAcceleration,
  OcfVestingEvent,
  OcfVestingStart,
  OcfVestingTerms,
  VestingTrigger,
} from '../../src/types';
import { requireDefined, requireFirst } from '../../src/utils/requireDefined';
import { expectInvalidDate } from '../utils/dateValidationAssertions';

function makeBranchingOcfVestingTerms(): OcfVestingTerms {
  return {
    object_type: 'VESTING_TERMS',
    id: 'vt-branching-graph',
    name: 'Branching vesting graph',
    description: 'Two branches converge on a shared terminal condition',
    allocation_type: 'CUMULATIVE_ROUNDING',
    vesting_conditions: [
      {
        id: 'start',
        quantity: '0',
        trigger: { type: 'VESTING_START_DATE' },
        next_condition_ids: ['milestone', 'service'],
      },
      {
        id: 'milestone',
        quantity: '10',
        trigger: { type: 'VESTING_EVENT' },
        next_condition_ids: ['finish'],
      },
      {
        id: 'service',
        quantity: '20',
        trigger: {
          type: 'VESTING_SCHEDULE_RELATIVE',
          relative_to_condition_id: 'start',
          period: { type: 'MONTHS', length: 12, occurrences: 1, day_of_month: '01' },
        },
        next_condition_ids: ['finish'],
      },
      {
        id: 'finish',
        quantity: '70',
        trigger: { type: 'VESTING_EVENT' },
        next_condition_ids: [],
      },
    ],
  };
}

describe('Valuation Converters', () => {
  describe('OCF → DAML (valuationDataToDaml)', () => {
    test('converts minimal valuation data', () => {
      const ocfData: OcfValuation = {
        object_type: 'VALUATION',
        id: 'val-001',
        stock_class_id: 'sc-001',
        price_per_share: { amount: '1.50', currency: 'USD' },
        effective_date: '2024-01-15',
        valuation_type: '409A',
      };

      const damlData = convertToDaml('valuation', ocfData);

      expect(damlData.id).toBe('val-001');
      expect(damlData.stock_class_id).toBe('sc-001');
      expect(damlData.price_per_share).toEqual({ amount: '1.5', currency: 'USD' });
      expect(damlData.effective_date).toBe('2024-01-15T00:00:00.000Z');
      expect(damlData.valuation_type).toBe('OcfValuationType409A');
    });

    test('converts valuation with all optional fields', () => {
      const ocfData: OcfValuation = {
        object_type: 'VALUATION',
        id: 'val-002',
        stock_class_id: 'sc-002',
        price_per_share: { amount: '2.00', currency: 'USD' },
        effective_date: '2024-02-01',
        valuation_type: '409A',
        provider: 'Valuation Services Inc.',
        board_approval_date: '2024-01-20',
        stockholder_approval_date: '2024-01-25',
        comments: ['Annual 409A valuation', 'Approved by board'],
      };

      const damlData = convertToDaml('valuation', ocfData);

      expect(damlData.provider).toBe('Valuation Services Inc.');
      expect(damlData.board_approval_date).toBe('2024-01-20T00:00:00.000Z');
      expect(damlData.stockholder_approval_date).toBe('2024-01-25T00:00:00.000Z');
      expect(damlData.comments).toEqual(['Annual 409A valuation', 'Approved by board']);
    });

    test('throws error when id is missing', () => {
      const ocfData = {
        object_type: 'VALUATION',
        id: '',
        stock_class_id: 'sc-001',
        price_per_share: { amount: '1.50', currency: 'USD' },
        effective_date: '2024-01-15',
        valuation_type: '409A',
      } as OcfValuation;

      expect(() => convertToDaml('valuation', ocfData)).toThrow(OcpValidationError);
      expect(() => convertToDaml('valuation', ocfData)).toThrow("'valuation.id'");
    });

    test('handles string amount', () => {
      const ocfData: OcfValuation = {
        object_type: 'VALUATION',
        id: 'val-003',
        stock_class_id: 'sc-003',
        price_per_share: { amount: '1.5', currency: 'USD' },
        effective_date: '2024-01-15',
        valuation_type: '409A',
      };

      const damlData = convertToDaml('valuation', ocfData);

      expect(damlData.price_per_share).toEqual({ amount: '1.5', currency: 'USD' });
    });
  });

  describe('DAML → OCF (damlValuationToNative)', () => {
    test('converts minimal valuation data', () => {
      const damlData: DamlValuationData = {
        id: 'val-001',
        stock_class_id: 'sc-001',
        price_per_share: { amount: '1.50', currency: 'USD' },
        effective_date: '2024-01-15T00:00:00.000Z',
        valuation_type: 'OcfValuationType409A',
        provider: null,
        board_approval_date: null,
        stockholder_approval_date: null,
        comments: [],
      };

      const ocfData = damlValuationToNative(damlData);

      expect(ocfData.id).toBe('val-001');
      expect(ocfData.stock_class_id).toBe('sc-001');
      expect(ocfData.price_per_share).toEqual({ amount: '1.5', currency: 'USD' });
      expect(ocfData.effective_date).toBe('2024-01-15');
      expect(ocfData.valuation_type).toBe('409A');
      expect(ocfData.provider).toBeUndefined();
      expect(ocfData.comments).toBeUndefined();
    });

    test('converts valuation with all optional fields', () => {
      const damlData: DamlValuationData = {
        id: 'val-002',
        stock_class_id: 'sc-002',
        price_per_share: { amount: '2.0000000000', currency: 'USD' },
        effective_date: '2024-02-01T00:00:00.000Z',
        valuation_type: 'OcfValuationType409A',
        provider: 'Valuation Services Inc.',
        board_approval_date: '2024-01-20T00:00:00.000Z',
        stockholder_approval_date: '2024-01-25T00:00:00.000Z',
        comments: ['Annual 409A valuation', 'Approved by board'],
      };

      const ocfData = damlValuationToNative(damlData);

      expect(ocfData.provider).toBe('Valuation Services Inc.');
      expect(ocfData.board_approval_date).toBe('2024-01-20');
      expect(ocfData.stockholder_approval_date).toBe('2024-01-25');
      expect(ocfData.comments).toEqual(['Annual 409A valuation', 'Approved by board']);
    });

    test('normalizes DAML numeric values', () => {
      const damlData: DamlValuationData = {
        id: 'val-003',
        stock_class_id: 'sc-003',
        price_per_share: { amount: '1.5000000000', currency: 'USD' },
        effective_date: '2024-01-15T00:00:00.000Z',
        valuation_type: 'OcfValuationType409A',
        provider: null,
        board_approval_date: null,
        stockholder_approval_date: null,
        comments: [],
      };

      const ocfData = damlValuationToNative(damlData);

      expect(ocfData.price_per_share.amount).toBe('1.5');
    });
  });

  describe('damlValuationTypeToNative', () => {
    test('converts known valuation types', () => {
      expect(damlValuationTypeToNative('OcfValuationType409A')).toBe('409A');
    });

    test('throws error for unknown valuation type', () => {
      expect(() => damlValuationTypeToNative('UnknownType')).toThrow(OcpParseError);
      expect(() => damlValuationTypeToNative('UnknownType')).toThrow('Unknown DAML valuation type');
    });

    test.each(['constructor', 'toString'])('rejects inherited prototype key %s', (prototypeKey) => {
      expect(() => damlValuationTypeToNative(prototypeKey)).toThrow(OcpParseError);
      expect(() => damlValuationTypeToNative(prototypeKey)).toThrow(`Unknown DAML valuation type: ${prototypeKey}`);
    });
  });

  describe('round-trip conversion', () => {
    test('OCF → DAML → OCF preserves data', () => {
      // Use a value without trailing zeros to avoid normalization differences
      const originalOcf: OcfValuation = {
        object_type: 'VALUATION',
        id: 'val-roundtrip',
        stock_class_id: 'sc-roundtrip',
        price_per_share: { amount: '3.5', currency: 'USD' },
        effective_date: '2024-03-15',
        valuation_type: '409A',
        provider: 'Test Provider',
        board_approval_date: '2024-03-10',
        comments: ['Test comment'],
      };

      const damlData = convertToDaml('valuation', originalOcf) as unknown as DamlValuationData;
      // Simulate DAML null handling for missing optional fields
      damlData.stockholder_approval_date = damlData.stockholder_approval_date ?? null;
      const roundTrippedOcf = damlValuationToNative(damlData);

      expect(roundTrippedOcf.id).toBe(originalOcf.id);
      expect(roundTrippedOcf.stock_class_id).toBe(originalOcf.stock_class_id);
      expect(roundTrippedOcf.price_per_share).toEqual(originalOcf.price_per_share);
      expect(roundTrippedOcf.effective_date).toBe(originalOcf.effective_date);
      expect(roundTrippedOcf.valuation_type).toBe(originalOcf.valuation_type);
      expect(roundTrippedOcf.provider).toBe(originalOcf.provider);
      expect(roundTrippedOcf.board_approval_date).toBe(originalOcf.board_approval_date);
      expect(roundTrippedOcf.comments).toEqual(originalOcf.comments);
    });
  });
});

describe('VestingStart Converters', () => {
  describe('OCF → DAML (vestingStartDataToDaml)', () => {
    test('converts minimal vesting start data', () => {
      const ocfData: OcfVestingStart = {
        object_type: 'TX_VESTING_START',
        id: 'vs-001',
        date: '2024-01-01',
        security_id: 'sec-001',
        vesting_condition_id: 'vc-001',
      };

      const damlData = convertToDaml('vestingStart', ocfData);

      expect(damlData.id).toBe('vs-001');
      expect(damlData.date).toBe('2024-01-01T00:00:00.000Z');
      expect(damlData.security_id).toBe('sec-001');
      expect(damlData.vesting_condition_id).toBe('vc-001');
    });

    test('converts vesting start with comments', () => {
      const ocfData: OcfVestingStart = {
        object_type: 'TX_VESTING_START',
        id: 'vs-002',
        date: '2024-02-01',
        security_id: 'sec-002',
        vesting_condition_id: 'vc-002',
        comments: ['Employee start date'],
      };

      const damlData = convertToDaml('vestingStart', ocfData);

      expect(damlData.comments).toEqual(['Employee start date']);
    });

    test('throws error when id is missing', () => {
      const ocfData = {
        object_type: 'TX_VESTING_START',
        id: '',
        date: '2024-01-01',
        security_id: 'sec-001',
        vesting_condition_id: 'vc-001',
      } as OcfVestingStart;

      expect(() => convertToDaml('vestingStart', ocfData)).toThrow(OcpValidationError);
      expect(() => convertToDaml('vestingStart', ocfData)).toThrow("'vestingStart.id'");
    });
  });

  describe('DAML → OCF (damlVestingStartToNative)', () => {
    test('converts minimal vesting start data', () => {
      const damlData: DamlVestingStartData = {
        id: 'vs-001',
        date: '2024-01-01T00:00:00.000Z',
        security_id: 'sec-001',
        vesting_condition_id: 'vc-001',
        comments: [],
      };

      const ocfData = damlVestingStartToNative(damlData);

      expect(ocfData.id).toBe('vs-001');
      expect(ocfData.date).toBe('2024-01-01');
      expect(ocfData.security_id).toBe('sec-001');
      expect(ocfData.vesting_condition_id).toBe('vc-001');
      expect(ocfData.comments).toBeUndefined();
    });

    test('converts vesting start with comments', () => {
      const damlData: DamlVestingStartData = {
        id: 'vs-002',
        date: '2024-02-01T00:00:00.000Z',
        security_id: 'sec-002',
        vesting_condition_id: 'vc-002',
        comments: ['Employee start date'],
      };

      const ocfData = damlVestingStartToNative(damlData);

      expect(ocfData.comments).toEqual(['Employee start date']);
    });
  });
});

describe('VestingTerms Converters', () => {
  describe('OCF -> DAML (vestingTermsDataToDaml)', () => {
    const maximumDamlNumeric10 = `${'9'.repeat(28)}.${'9'.repeat(10)}`;

    function makeOcfQuantityVestingTerms(quantity: unknown): OcfVestingTerms {
      return {
        object_type: 'VESTING_TERMS',
        id: 'vt-quantity-boundary',
        name: 'Quantity Boundary',
        description: 'Exercises the OCF Numeric to DAML Numeric 10 boundary',
        allocation_type: 'CUMULATIVE_ROUNDING',
        vesting_conditions: [
          {
            id: 'quantity-condition',
            quantity,
            trigger: { type: 'VESTING_START_DATE' },
            next_condition_ids: [],
          },
        ],
      } as unknown as OcfVestingTerms;
    }

    function makeIndexedOcfVestingTerms(secondAmount: Record<string, unknown>): OcfVestingTerms {
      return {
        object_type: 'VESTING_TERMS',
        id: 'vt-indexed-boundary',
        name: 'Indexed Boundary',
        description: 'Exercises exact vesting condition paths',
        allocation_type: 'CUMULATIVE_ROUNDING',
        vesting_conditions: [
          {
            id: 'first',
            portion: { numerator: '1', denominator: '4' },
            trigger: { type: 'VESTING_START_DATE' },
            next_condition_ids: ['second'],
          },
          {
            id: 'second',
            ...secondAmount,
            trigger: { type: 'VESTING_EVENT' },
            next_condition_ids: [],
          },
        ],
      } as unknown as OcfVestingTerms;
    }

    function requireSecondVestingCondition(input: OcfVestingTerms) {
      return requireDefined(input.vesting_conditions[1], 'second OCF vesting condition');
    }

    test('accepts an acyclic branching graph whose branches share a terminal condition', () => {
      expect(vestingTermsDataToDaml(makeBranchingOcfVestingTerms()).vesting_conditions).toMatchObject([
        { id: 'start', next_condition_ids: ['milestone', 'service'] },
        { id: 'milestone', next_condition_ids: ['finish'] },
        { id: 'service', next_condition_ids: ['finish'] },
        { id: 'finish', next_condition_ids: [] },
      ]);
    });

    test.each([
      [
        'duplicate condition ID',
        (input: OcfVestingTerms) => {
          requireDefined(input.vesting_conditions[1], 'second OCF vesting condition').id = 'start';
        },
        'vestingTerms.vesting_conditions[1].id',
        'start',
        { firstIndex: 0 },
      ],
      [
        'dangling next-condition reference',
        (input: OcfVestingTerms) => {
          requireFirst(input.vesting_conditions, 'first OCF vesting condition').next_condition_ids = ['missing'];
        },
        'vestingTerms.vesting_conditions[0].next_condition_ids[0]',
        'missing',
        { conditionId: 'start' },
      ],
      [
        'dangling relative-trigger reference',
        (input: OcfVestingTerms) => {
          const { trigger } = requireDefined(input.vesting_conditions[2], 'third OCF vesting condition');
          if (trigger.type !== 'VESTING_SCHEDULE_RELATIVE') throw new Error('Expected relative trigger fixture');
          trigger.relative_to_condition_id = 'missing';
        },
        'vestingTerms.vesting_conditions[2].trigger.relative_to_condition_id',
        'missing',
        { conditionId: 'service' },
      ],
      [
        'self-relative trigger reference',
        (input: OcfVestingTerms) => {
          const { trigger } = requireDefined(input.vesting_conditions[2], 'third OCF vesting condition');
          if (trigger.type !== 'VESTING_SCHEDULE_RELATIVE') throw new Error('Expected relative trigger fixture');
          trigger.relative_to_condition_id = 'service';
        },
        'vestingTerms.vesting_conditions[2].trigger.relative_to_condition_id',
        'service',
        { conditionId: 'service' },
      ],
      [
        'cycle',
        (input: OcfVestingTerms) => {
          requireDefined(input.vesting_conditions[3], 'fourth OCF vesting condition').next_condition_ids = ['start'];
        },
        'vestingTerms.vesting_conditions[3].next_condition_ids[0]',
        'start',
        { conditionId: 'finish', targetConditionId: 'start' },
      ],
    ] as const)('rejects a vesting graph with a %s on write', (_case, mutate, fieldPath, receivedValue, context) => {
      const input = JSON.parse(JSON.stringify(makeBranchingOcfVestingTerms())) as OcfVestingTerms;
      mutate(input);

      expect(() => vestingTermsDataToDaml(input)).toThrow(
        expect.objectContaining({
          name: OcpValidationError.name,
          code: OcpErrorCodes.INVALID_FORMAT,
          classification: 'invalid_vesting_graph',
          fieldPath,
          receivedValue,
          context: expect.objectContaining(context),
        })
      );
    });

    test('defaults portion.remainder to false when omitted', () => {
      const ocfData = {
        object_type: 'VESTING_TERMS',
        id: 'vt-001',
        name: 'Standard Vesting',
        description: '4-year vesting with cliff',
        allocation_type: 'CUMULATIVE_ROUNDING',
        vesting_conditions: [
          {
            id: 'start',
            portion: {
              numerator: '1',
              denominator: '4',
            },
            trigger: {
              type: 'VESTING_START_DATE',
            },
            next_condition_ids: [],
          },
        ],
      } as unknown as OcfVestingTerms;

      const damlData = convertToDaml('vestingTerms', ocfData) as {
        vesting_conditions: Array<{ portion: { numerator: string; denominator: string; remainder: boolean } }>;
      };

      expect(requireFirst(damlData.vesting_conditions, 'converted vesting condition').portion).toEqual({
        numerator: '1',
        denominator: '4',
        remainder: false,
      });

      // Ensure command payload remains pure JSON with no undefined fields.
      const serialized = JSON.parse(JSON.stringify(damlData));
      expect(serialized.vesting_conditions[0].portion.remainder).toBe(false);
    });

    test('preserves provided portion.remainder value', () => {
      const ocfData: OcfVestingTerms = {
        object_type: 'VESTING_TERMS',
        id: 'vt-002',
        name: 'Remainder Vesting',
        description: 'Remainder flag explicitly set',
        allocation_type: 'CUMULATIVE_ROUNDING',
        vesting_conditions: [
          {
            id: 'start',
            portion: {
              numerator: '1',
              denominator: '4',
              remainder: true,
            },
            trigger: { type: 'VESTING_START_DATE' },
            next_condition_ids: [],
          },
        ],
      };

      const damlData = convertToDaml('vestingTerms', ocfData) as {
        vesting_conditions: Array<{ portion: { numerator: string; denominator: string; remainder: boolean } }>;
      };

      expect(requireFirst(damlData.vesting_conditions, 'converted vesting condition').portion).toEqual({
        numerator: '1',
        denominator: '4',
        remainder: true,
      });
    });

    test.each([
      ['explicit plus, leading zeros, and trailing fractional zeros', '+000250.5000000000', '250.5'],
      ['leading zeros on an integer', '00000042', '42'],
      ['negative integer zero', '-0', '0'],
      ['negative decimal zero', '-0.0000000000', '0'],
      ['the full DAML Numeric 10 boundary', maximumDamlNumeric10, maximumDamlNumeric10],
    ])('canonicalizes OCF quantity with %s', (_case, quantity, expected) => {
      const damlData = vestingTermsDataToDaml(makeOcfQuantityVestingTerms(quantity));

      expect(damlData).toMatchObject({
        vesting_conditions: [{ quantity: expected, portion: null }],
      });
    });

    test.each([
      ['a 29-digit integer', '1'.repeat(29), OcpErrorCodes.INVALID_FORMAT],
      ['11 fractional digits', '0.00000000001', OcpErrorCodes.INVALID_FORMAT],
      ['scientific notation', '1e-7', OcpErrorCodes.INVALID_FORMAT],
      ['a negative quantity', '-1', OcpErrorCodes.INVALID_FORMAT],
      ['a negative full-boundary quantity', `-${maximumDamlNumeric10}`, OcpErrorCodes.INVALID_FORMAT],
      ['an unreasonably long representation', '1'.repeat(1_000), OcpErrorCodes.INVALID_FORMAT],
      ['a runtime number', 250.5, OcpErrorCodes.INVALID_TYPE],
    ])('rejects OCF quantity with %s using a structured error', (_case, quantity, code) => {
      const receivedValue =
        typeof quantity === 'string' && quantity.length > 256
          ? { valueType: 'string', length: quantity.length, preview: expect.any(String) }
          : quantity;
      try {
        vestingTermsDataToDaml(makeOcfQuantityVestingTerms(quantity));
        throw new Error('Expected OCF vesting quantity conversion to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpValidationError);
        expect(error).toMatchObject({
          fieldPath: 'vestingTerms.vesting_conditions[0].quantity',
          code,
          expectedType: 'OCF Numeric string',
          receivedValue,
        });
      }
    });

    test('round-trips a non-canonical OCF quantity through the create and ledger-read converters', () => {
      const damlData = vestingTermsDataToDaml(makeOcfQuantityVestingTerms('+000250.5000000000'));

      expect(damlData).toMatchObject({ vesting_conditions: [{ quantity: '250.5' }] });

      const roundTripped = damlVestingTermsDataToNative(
        damlData as unknown as Parameters<typeof damlVestingTermsDataToNative>[0]
      );
      expect(roundTripped.vesting_conditions[0]).toMatchObject({ quantity: '250.5' });
    });

    test.each([
      ['neither amount', {}],
      ['both amounts', { portion: { numerator: '1', denominator: '4' }, quantity: '250' }],
    ])('rejects a vesting condition with %s at runtime', (_case, amountFields) => {
      const ocfData = {
        object_type: 'VESTING_TERMS',
        id: 'vt-invalid',
        name: 'Invalid Vesting',
        description: 'Invalid conditional shape',
        allocation_type: 'CUMULATIVE_ROUNDING',
        vesting_conditions: [
          {
            id: 'condition-invalid',
            ...amountFields,
            trigger: { type: 'VESTING_START_DATE' },
            next_condition_ids: [],
          },
        ],
      } as unknown as OcfVestingTerms;

      expect(() => convertToDaml('vestingTerms', ocfData)).toThrow(OcpValidationError);
    });

    test.each(['portion', 'quantity'] as const)('rejects an explicit null %s amount', (field) => {
      const ocfData = {
        object_type: 'VESTING_TERMS',
        id: 'vt-null-amount',
        name: 'Invalid Null Amount',
        description: 'Explicit null is not canonical omission',
        allocation_type: 'CUMULATIVE_ROUNDING',
        vesting_conditions: [
          {
            id: 'condition-null',
            [field]: null,
            trigger: { type: 'VESTING_START_DATE' },
            next_condition_ids: [],
          },
        ],
      } as unknown as OcfVestingTerms;

      try {
        vestingTermsDataToDaml(ocfData);
        throw new Error('Expected conversion to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpValidationError);
        expect(error).toMatchObject({
          fieldPath: `vestingTerms.vesting_conditions[0].${field}`,
          code: OcpErrorCodes.INVALID_TYPE,
          receivedValue: null,
        });
      }
    });

    test.each([
      [
        'invalid quantity',
        { quantity: true },
        'vestingTerms.vesting_conditions[1].quantity',
        OcpErrorCodes.INVALID_TYPE,
      ],
      ['null quantity', { quantity: null }, 'vestingTerms.vesting_conditions[1].quantity', OcpErrorCodes.INVALID_TYPE],
      ['neither amount', {}, 'vestingTerms.vesting_conditions[1]', OcpErrorCodes.REQUIRED_FIELD_MISSING],
      [
        'both amounts',
        { quantity: '1', portion: { numerator: '1', denominator: '4' } },
        'vestingTerms.vesting_conditions[1]',
        OcpErrorCodes.INVALID_FORMAT,
      ],
    ] as const)('direct writer reports the exact second-condition path for %s', (_case, amount, fieldPath, code) => {
      expect(() => vestingTermsDataToDaml(makeIndexedOcfVestingTerms(amount))).toThrow(
        expect.objectContaining({ fieldPath, code })
      );
    });

    test('direct writer reports the exact duplicate next_condition_ids index', () => {
      const input = makeIndexedOcfVestingTerms({ quantity: '1' });
      requireSecondVestingCondition(input).next_condition_ids = ['third', 'fourth', 'third'];

      expect(() => vestingTermsDataToDaml(input)).toThrow(
        expect.objectContaining({
          fieldPath: 'vestingTerms.vesting_conditions[1].next_condition_ids[2]',
          code: OcpErrorCodes.INVALID_FORMAT,
          receivedValue: 'third',
          context: expect.objectContaining({ firstIndex: 0 }),
        })
      );
    });

    test('rejects vesting terms without a condition at the direct converter boundary', () => {
      const ocfData = {
        object_type: 'VESTING_TERMS',
        id: 'vt-empty',
        name: 'Empty Vesting',
        description: 'Invalid empty condition list',
        allocation_type: 'CUMULATIVE_ROUNDING',
        vesting_conditions: [],
      } as unknown as OcfVestingTerms;

      expect(() => vestingTermsDataToDaml(ocfData)).toThrow(
        expect.objectContaining({
          fieldPath: 'vestingTerms.vesting_conditions',
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        })
      );
    });

    test('reports the exact vesting-condition index for an invalid absolute date', () => {
      const ocfData: OcfVestingTerms = {
        object_type: 'VESTING_TERMS',
        id: 'vt-indexed-write',
        name: 'Indexed write path',
        description: 'Tests indexed validation paths',
        allocation_type: 'CUMULATIVE_ROUNDING',
        vesting_conditions: [
          {
            id: 'start',
            quantity: '1',
            trigger: { type: 'VESTING_START_DATE' },
            next_condition_ids: ['bad-date'],
          },
          {
            id: 'bad-date',
            quantity: '1',
            trigger: { type: 'VESTING_SCHEDULE_ABSOLUTE', date: '' },
            next_condition_ids: [],
          },
        ],
      };

      expectInvalidDate(() => vestingTermsDataToDaml(ocfData), 'vestingTerms.vesting_conditions[1].trigger.date', '');
    });

    test('accepts the schema minimum zero relative-period length on write', () => {
      const input = makeIndexedOcfVestingTerms({ quantity: '1' });
      requireSecondVestingCondition(input).trigger = {
        type: 'VESTING_SCHEDULE_RELATIVE',
        relative_to_condition_id: 'first',
        period: { type: 'DAYS', length: 0, occurrences: 1 },
      };

      expect(vestingTermsDataToDaml(input)).toMatchObject({
        vesting_conditions: [{}, { trigger: { value: { period: { value: { length_: '0', occurrences: '1' } } } } }],
      });
    });

    test.each([
      ['fractional length', { length: 1.5, occurrences: 1 }, 'length'],
      ['unsafe length', { length: Number.MAX_SAFE_INTEGER + 1, occurrences: 1 }, 'length'],
      ['fractional occurrences', { length: 1, occurrences: 1.5 }, 'occurrences'],
      ['zero occurrences', { length: 1, occurrences: 0 }, 'occurrences'],
      ['negative cliff', { length: 1, occurrences: 1, cliff_installment: -1 }, 'cliff_installment'],
      ['fractional cliff', { length: 1, occurrences: 1, cliff_installment: 1.5 }, 'cliff_installment'],
    ] as const)('direct writer rejects %s as a generated DAML Int', (_case, period, field) => {
      const input = makeIndexedOcfVestingTerms({ quantity: '1' });
      requireSecondVestingCondition(input).trigger = {
        type: 'VESTING_SCHEDULE_RELATIVE',
        relative_to_condition_id: 'first',
        period: { type: 'DAYS', ...period },
      };

      expect(() => vestingTermsDataToDaml(input)).toThrow(
        expect.objectContaining({
          fieldPath: `vestingTerms.vesting_conditions[1].trigger.period.${field}`,
          code: OcpErrorCodes.INVALID_FORMAT,
        })
      );
    });

    test.each([
      [
        'missing length',
        { length: undefined, occurrences: 1 },
        'length',
        undefined,
        OcpErrorCodes.REQUIRED_FIELD_MISSING,
      ],
      ['null length', { length: null, occurrences: 1 }, 'length', null, OcpErrorCodes.INVALID_TYPE],
      [
        'missing occurrences',
        { length: 1, occurrences: undefined },
        'occurrences',
        undefined,
        OcpErrorCodes.REQUIRED_FIELD_MISSING,
      ],
      ['null occurrences', { length: 1, occurrences: null }, 'occurrences', null, OcpErrorCodes.INVALID_TYPE],
    ] as const)(
      'direct writer distinguishes %s at the exact indexed path',
      (_case, period, field, receivedValue, code) => {
        const input = makeIndexedOcfVestingTerms({ quantity: '1' });
        requireSecondVestingCondition(input).trigger = {
          type: 'VESTING_SCHEDULE_RELATIVE',
          relative_to_condition_id: 'first',
          period: { type: 'DAYS', ...period },
        } as unknown as VestingTrigger;

        expect(() => vestingTermsDataToDaml(input)).toThrow(
          expect.objectContaining({
            fieldPath: `vestingTerms.vesting_conditions[1].trigger.period.${field}`,
            code,
            receivedValue,
          })
        );
      }
    );

    test('direct writer preserves the exact maximum safe vesting period integer', () => {
      const input = makeIndexedOcfVestingTerms({ quantity: '1' });
      requireSecondVestingCondition(input).trigger = {
        type: 'VESTING_SCHEDULE_RELATIVE',
        relative_to_condition_id: 'first',
        period: { type: 'DAYS', length: Number.MAX_SAFE_INTEGER, occurrences: 1, cliff_installment: 0 },
      };

      expect(vestingTermsDataToDaml(input)).toMatchObject({
        vesting_conditions: [
          {},
          {
            trigger: {
              value: {
                period: {
                  value: {
                    length_: Number.MAX_SAFE_INTEGER.toString(),
                    occurrences: '1',
                    cliff_installment: '0',
                  },
                },
              },
            },
          },
        ],
      });
    });
  });
});

describe('VestingEvent Converters', () => {
  describe('OCF → DAML (vestingEventDataToDaml)', () => {
    test('converts minimal vesting event data', () => {
      const ocfData: OcfVestingEvent = {
        object_type: 'TX_VESTING_EVENT',
        id: 've-001',
        date: '2024-06-01',
        security_id: 'sec-001',
        vesting_condition_id: 'vc-milestone-001',
      };

      const damlData = convertToDaml('vestingEvent', ocfData);

      expect(damlData.id).toBe('ve-001');
      expect(damlData.date).toBe('2024-06-01T00:00:00.000Z');
      expect(damlData.security_id).toBe('sec-001');
      expect(damlData.vesting_condition_id).toBe('vc-milestone-001');
    });

    test('converts vesting event with comments', () => {
      const ocfData: OcfVestingEvent = {
        object_type: 'TX_VESTING_EVENT',
        id: 've-002',
        date: '2024-07-01',
        security_id: 'sec-002',
        vesting_condition_id: 'vc-milestone-002',
        comments: ['Milestone achieved: Series A funding'],
      };

      const damlData = convertToDaml('vestingEvent', ocfData);

      expect(damlData.comments).toEqual(['Milestone achieved: Series A funding']);
    });

    test('throws error when id is missing', () => {
      const ocfData = {
        object_type: 'TX_VESTING_EVENT',
        id: '',
        date: '2024-06-01',
        security_id: 'sec-001',
        vesting_condition_id: 'vc-milestone-001',
      } as OcfVestingEvent;

      expect(() => convertToDaml('vestingEvent', ocfData)).toThrow(OcpValidationError);
      expect(() => convertToDaml('vestingEvent', ocfData)).toThrow("'vestingEvent.id'");
    });
  });

  describe('DAML → OCF (damlVestingEventToNative)', () => {
    test('converts minimal vesting event data', () => {
      const damlData: DamlVestingEventData = {
        id: 've-001',
        date: '2024-06-01T00:00:00.000Z',
        security_id: 'sec-001',
        vesting_condition_id: 'vc-milestone-001',
        comments: [],
      };

      const ocfData = damlVestingEventToNative(damlData);

      expect(ocfData.id).toBe('ve-001');
      expect(ocfData.date).toBe('2024-06-01');
      expect(ocfData.security_id).toBe('sec-001');
      expect(ocfData.vesting_condition_id).toBe('vc-milestone-001');
      expect(ocfData.comments).toBeUndefined();
    });

    test('converts vesting event with comments', () => {
      const damlData: DamlVestingEventData = {
        id: 've-002',
        date: '2024-07-01T00:00:00.000Z',
        security_id: 'sec-002',
        vesting_condition_id: 'vc-milestone-002',
        comments: ['Milestone achieved: Series A funding'],
      };

      const ocfData = damlVestingEventToNative(damlData);

      expect(ocfData.comments).toEqual(['Milestone achieved: Series A funding']);
    });
  });
});

describe('VestingAcceleration Converters', () => {
  describe('OCF → DAML (vestingAccelerationDataToDaml)', () => {
    test('converts minimal vesting acceleration data', () => {
      const ocfData: OcfVestingAcceleration = {
        object_type: 'TX_VESTING_ACCELERATION',
        id: 'va-001',
        date: '2024-12-01',
        security_id: 'sec-001',
        quantity: '10000',
        reason_text: 'Company acquisition',
      };

      const damlData = convertToDaml('vestingAcceleration', ocfData);

      expect(damlData.id).toBe('va-001');
      expect(damlData.date).toBe('2024-12-01T00:00:00.000Z');
      expect(damlData.security_id).toBe('sec-001');
      expect(damlData.quantity).toBe('10000');
      expect(damlData.reason_text).toBe('Company acquisition');
    });

    test('converts vesting acceleration with all fields', () => {
      const ocfData: OcfVestingAcceleration = {
        object_type: 'TX_VESTING_ACCELERATION',
        id: 'va-002',
        date: '2024-12-15',
        security_id: 'sec-002',
        quantity: '25000',
        reason_text: 'Single-trigger acceleration due to M&A',
        comments: ['Accelerated upon change of control', 'Per employment agreement section 4.3'],
      };

      const damlData = convertToDaml('vestingAcceleration', ocfData);

      expect(damlData.reason_text).toBe('Single-trigger acceleration due to M&A');
      expect(damlData.comments).toEqual(['Accelerated upon change of control', 'Per employment agreement section 4.3']);
    });

    test('handles numeric quantity', () => {
      const ocfData: OcfVestingAcceleration = {
        object_type: 'TX_VESTING_ACCELERATION',
        id: 'va-003',
        date: '2024-12-01',
        security_id: 'sec-003',
        quantity: '15000',
        reason_text: 'Termination without cause',
      };

      const damlData = convertToDaml('vestingAcceleration', ocfData);

      expect(damlData.quantity).toBe('15000');
    });

    test('throws error when id is missing', () => {
      const ocfData = {
        object_type: 'TX_VESTING_ACCELERATION',
        id: '',
        date: '2024-12-01',
        security_id: 'sec-001',
        quantity: '10000',
        reason_text: 'Company acquisition',
      } as OcfVestingAcceleration;

      expect(() => convertToDaml('vestingAcceleration', ocfData)).toThrow(OcpValidationError);
      expect(() => convertToDaml('vestingAcceleration', ocfData)).toThrow("'vestingAcceleration.id'");
    });
  });

  describe('DAML → OCF (damlVestingAccelerationToNative)', () => {
    test('converts minimal vesting acceleration data', () => {
      const damlData: DamlVestingAccelerationData = {
        id: 'va-001',
        date: '2024-12-01T00:00:00.000Z',
        security_id: 'sec-001',
        quantity: '10000.0000000000',
        reason_text: 'Company acquisition',
        comments: [],
      };

      const ocfData = damlVestingAccelerationToNative(damlData);

      expect(ocfData.id).toBe('va-001');
      expect(ocfData.date).toBe('2024-12-01');
      expect(ocfData.security_id).toBe('sec-001');
      expect(ocfData.quantity).toBe('10000');
      expect(ocfData.reason_text).toBe('Company acquisition');
      expect(ocfData.comments).toBeUndefined();
    });

    test('converts vesting acceleration with all fields', () => {
      const damlData: DamlVestingAccelerationData = {
        id: 'va-002',
        date: '2024-12-15T00:00:00.000Z',
        security_id: 'sec-002',
        quantity: '25000',
        reason_text: 'Single-trigger acceleration due to M&A',
        comments: ['Accelerated upon change of control', 'Per employment agreement section 4.3'],
      };

      const ocfData = damlVestingAccelerationToNative(damlData);

      expect(ocfData.reason_text).toBe('Single-trigger acceleration due to M&A');
      expect(ocfData.comments).toEqual(['Accelerated upon change of control', 'Per employment agreement section 4.3']);
    });

    test('normalizes DAML numeric values', () => {
      const damlData: DamlVestingAccelerationData = {
        id: 'va-003',
        date: '2024-12-01T00:00:00.000Z',
        security_id: 'sec-003',
        quantity: '15000.5000000000',
        reason_text: 'Partial acceleration',
        comments: [],
      };

      const ocfData = damlVestingAccelerationToNative(damlData);

      expect(ocfData.quantity).toBe('15000.5');
    });
  });

  describe('round-trip conversion', () => {
    test('OCF → DAML → OCF preserves data', () => {
      const originalOcf: OcfVestingAcceleration = {
        object_type: 'TX_VESTING_ACCELERATION',
        id: 'va-roundtrip',
        date: '2024-12-31',
        security_id: 'sec-roundtrip',
        quantity: '50000',
        reason_text: 'Double-trigger acceleration',
        comments: ['Per employment agreement'],
      };

      const damlData = convertToDaml('vestingAcceleration', originalOcf) as unknown as DamlVestingAccelerationData;
      const roundTrippedOcf = damlVestingAccelerationToNative(damlData);

      expect(roundTrippedOcf.id).toBe(originalOcf.id);
      expect(roundTrippedOcf.date).toBe(originalOcf.date);
      expect(roundTrippedOcf.security_id).toBe(originalOcf.security_id);
      expect(roundTrippedOcf.quantity).toBe(originalOcf.quantity);
      expect(roundTrippedOcf.reason_text).toBe(originalOcf.reason_text);
      expect(roundTrippedOcf.comments).toEqual(originalOcf.comments);
    });
  });
});

// ---------------------------------------------------------------------------
// Drift regression: remainder / comments defaults (reproduces Slack alerts)
// ---------------------------------------------------------------------------

describe('VestingTerms drift regression', () => {
  const maximumDamlNumeric10 = `${'9'.repeat(28)}.${'9'.repeat(10)}`;

  /**
   * Minimal DAML-shaped vesting terms payload for testing damlVestingTermsDataToNative.
   * Mirrors the structure returned by the Canton Ledger JSON API.
   */
  function makeDamlVestingTerms(overrides: Record<string, unknown> = {}) {
    return {
      id: 'vt-drift-001',
      name: 'Standard Vesting',
      description: '4-year vesting with cliff',
      allocation_type: 'OcfAllocationCumulativeRounding',
      vesting_conditions: [
        {
          id: 'start',
          description: null,
          quantity: null,
          portion: {
            numerator: '1',
            denominator: '4',
            remainder: false,
          },
          trigger: { tag: 'OcfVestingStartTrigger', value: {} },
          next_condition_ids: [],
        },
      ],
      comments: [],
      ...overrides,
    } as unknown as Parameters<typeof damlVestingTermsDataToNative>[0];
  }

  test('reads an acyclic branching graph whose branches share a terminal condition', () => {
    const daml = vestingTermsDataToDaml(makeBranchingOcfVestingTerms());

    expect(
      damlVestingTermsDataToNative(daml as unknown as Parameters<typeof damlVestingTermsDataToNative>[0])
        .vesting_conditions
    ).toMatchObject([
      { id: 'start', next_condition_ids: ['milestone', 'service'] },
      { id: 'milestone', next_condition_ids: ['finish'] },
      { id: 'service', next_condition_ids: ['finish'] },
      { id: 'finish', next_condition_ids: [] },
    ]);
  });

  test.each([
    [
      'duplicate condition ID',
      (conditions: Array<Record<string, unknown>>) => {
        requireDefined(conditions[1], 'second DAML vesting condition').id = 'start';
      },
      'vestingTerms.vesting_conditions[1].id',
      'start',
      { firstIndex: 0 },
    ],
    [
      'dangling next-condition reference',
      (conditions: Array<Record<string, unknown>>) => {
        requireFirst(conditions, 'first DAML vesting condition').next_condition_ids = ['missing'];
      },
      'vestingTerms.vesting_conditions[0].next_condition_ids[0]',
      'missing',
      { conditionId: 'start' },
    ],
    [
      'dangling relative-trigger reference',
      (conditions: Array<Record<string, unknown>>) => {
        const trigger = requireDefined(conditions[2], 'third DAML vesting condition').trigger as {
          value: { relative_to_condition_id: string };
        };
        trigger.value.relative_to_condition_id = 'missing';
      },
      'vestingTerms.vesting_conditions[2].trigger.relative_to_condition_id',
      'missing',
      { conditionId: 'service' },
    ],
    [
      'self-relative trigger reference',
      (conditions: Array<Record<string, unknown>>) => {
        const trigger = requireDefined(conditions[2], 'third DAML vesting condition').trigger as {
          value: { relative_to_condition_id: string };
        };
        trigger.value.relative_to_condition_id = 'service';
      },
      'vestingTerms.vesting_conditions[2].trigger.relative_to_condition_id',
      'service',
      { conditionId: 'service' },
    ],
    [
      'cycle',
      (conditions: Array<Record<string, unknown>>) => {
        requireDefined(conditions[3], 'fourth DAML vesting condition').next_condition_ids = ['start'];
      },
      'vestingTerms.vesting_conditions[3].next_condition_ids[0]',
      'start',
      { conditionId: 'finish', targetConditionId: 'start' },
    ],
  ] as const)('rejects a vesting graph with a %s on read', (_case, mutate, source, receivedValue, context) => {
    const daml = vestingTermsDataToDaml(makeBranchingOcfVestingTerms());
    const conditions = daml.vesting_conditions as Array<Record<string, unknown>>;
    mutate(conditions);

    expect(() =>
      damlVestingTermsDataToNative(daml as unknown as Parameters<typeof damlVestingTermsDataToNative>[0])
    ).toThrow(
      expect.objectContaining({
        name: OcpParseError.name,
        code: OcpErrorCodes.INVALID_FORMAT,
        classification: 'invalid_vesting_graph',
        source,
        context: expect.objectContaining({ receivedValue, ...context }),
      })
    );
  });

  test('preserves remainder: false when explicitly set (truthiness fix)', () => {
    const result = damlVestingTermsDataToNative(makeDamlVestingTerms());
    const { portion } = requireFirst(result.vesting_conditions, 'native vesting condition');
    expect(portion).toBeDefined();
    expect(portion?.numerator).toBe('1');
    expect(portion?.denominator).toBe('4');
    expect(portion?.remainder).toBe(false);
  });

  test.each([
    ['null', null],
    ['array', []],
    ['primitive', 'not-a-condition'],
  ] as const)('rejects a %s vesting condition with an indexed structured error', (_case, invalidCondition) => {
    const daml = makeDamlVestingTerms();
    (daml as unknown as { vesting_conditions: unknown[] }).vesting_conditions.push(invalidCondition);

    try {
      damlVestingTermsDataToNative(daml);
      throw new Error('Expected malformed vesting condition to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpParseError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'vestingTerms.vesting_conditions[1]',
      });
    }
  });

  test('rejects a legacy Some portion wrapper through the generated-DAML boundary', () => {
    const daml = makeDamlVestingTerms();
    (daml as unknown as { vesting_conditions: unknown[] }).vesting_conditions.push({
      id: 'legacy-portion-wrapper',
      description: null,
      quantity: null,
      portion: { tag: 'Some', value: null },
      trigger: { tag: 'OcfVestingStartTrigger', value: {} },
      next_condition_ids: [],
    });

    expect(() => damlVestingTermsDataToNative(daml)).toThrow(
      expect.objectContaining({
        name: OcpParseError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'vestingTerms.vesting_conditions[1].portion.tag',
      })
    );
  });

  test.each([
    ['array', [], 'vestingTerms.vesting_conditions[1].portion', []],
    ['primitive', 'not-a-portion', 'vestingTerms.vesting_conditions[1].portion', 'not-a-portion'],
    ['false', false, 'vestingTerms.vesting_conditions[1].portion', false],
    ['zero', 0, 'vestingTerms.vesting_conditions[1].portion', 0],
    ['empty string', '', 'vestingTerms.vesting_conditions[1].portion', ''],
  ] as const)('rejects a %s with a structured portion error', (_case, invalidPortion, fieldPath, receivedValue) => {
    const daml = makeDamlVestingTerms();
    (daml as unknown as { vesting_conditions: unknown[] }).vesting_conditions.push({
      id: 'invalid-portion',
      description: null,
      quantity: null,
      portion: invalidPortion,
      trigger: { tag: 'OcfVestingStartTrigger', value: {} },
      next_condition_ids: [],
    });

    expect(() => damlVestingTermsDataToNative(daml)).toThrow(
      expect.objectContaining({
        name: OcpValidationError.name,
        code: OcpErrorCodes.INVALID_TYPE,
        fieldPath,
        expectedType: 'portion object or omitted',
        receivedValue,
      })
    );
  });

  test.each([
    ['null', null],
    ['record', {}],
    ['primitive', 'not-conditions'],
  ] as const)('rejects a %s vesting_conditions collection with a structured error', (_case, invalidConditions) => {
    const daml = makeDamlVestingTerms({ vesting_conditions: invalidConditions });

    expect(() => damlVestingTermsDataToNative(daml)).toThrow(
      expect.objectContaining({
        name: OcpValidationError.name,
        code: OcpErrorCodes.INVALID_TYPE,
        fieldPath: 'vestingTerms.vesting_conditions',
        expectedType: 'array',
        receivedValue: invalidConditions,
      })
    );
  });

  test.each([
    ['null', null],
    ['array', []],
    ['primitive', 42],
  ] as const)('rejects a %s vesting trigger with an indexed structured error', (_case, invalidTrigger) => {
    const daml = makeDamlVestingTerms();
    (daml as unknown as { vesting_conditions: unknown[] }).vesting_conditions.push({
      id: 'invalid-trigger',
      description: null,
      quantity: null,
      portion: null,
      trigger: invalidTrigger,
      next_condition_ids: [],
    });

    try {
      damlVestingTermsDataToNative(daml);
      throw new Error('Expected malformed vesting trigger to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpParseError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'vestingTerms.vesting_conditions[1].trigger',
      });
    }
  });

  test('reports the exact vesting-condition index for an invalid absolute date on readback', () => {
    const daml = makeDamlVestingTerms();
    (daml as unknown as { vesting_conditions: unknown[] }).vesting_conditions.push({
      id: 'bad-date',
      description: null,
      quantity: null,
      portion: null,
      trigger: { tag: 'OcfVestingScheduleAbsoluteTrigger', value: { date: '' } },
      next_condition_ids: [],
    });

    expectInvalidDate(() => damlVestingTermsDataToNative(daml), 'vestingTerms.vesting_conditions[1].trigger.date', '');
  });

  test('reports the exact vesting-condition path when an absolute trigger value is missing', () => {
    const daml = makeDamlVestingTerms();
    (daml as unknown as { vesting_conditions: unknown[] }).vesting_conditions.push({
      id: 'missing-trigger-value',
      description: null,
      quantity: null,
      portion: null,
      trigger: { tag: 'OcfVestingScheduleAbsoluteTrigger' },
      next_condition_ids: [],
    });

    expectInvalidDate(
      () => damlVestingTermsDataToNative(daml),
      'vestingTerms.vesting_conditions[1].trigger.value',
      undefined,
      OcpErrorCodes.REQUIRED_FIELD_MISSING
    );
  });

  test('accepts the schema minimum zero relative-period length on read', () => {
    const daml = makeDamlVestingTerms();
    (daml as unknown as { vesting_conditions: unknown[] }).vesting_conditions.push({
      id: 'bad-relative-period',
      description: null,
      quantity: '1',
      portion: null,
      trigger: {
        tag: 'OcfVestingScheduleRelativeTrigger',
        value: {
          relative_to_condition_id: 'start',
          period: {
            tag: 'OcfVestingPeriodDays',
            value: { length_: '0', occurrences: '1', cliff_installment: null },
          },
        },
      },
      next_condition_ids: [],
    });

    expect(damlVestingTermsDataToNative(daml).vesting_conditions[1]).toMatchObject({
      trigger: { type: 'VESTING_SCHEDULE_RELATIVE', period: { type: 'DAYS', length: 0, occurrences: 1 } },
    });
  });

  test.each([
    ['fractional length', { length_: '1.5', occurrences: '1', cliff_installment: null }, 'length'],
    ['number length', { length_: 1, occurrences: '1', cliff_installment: null }, 'length'],
    ['leading-zero length', { length_: '01', occurrences: '1', cliff_installment: null }, 'length'],
    ['unsafe length', { length_: '9007199254740992', occurrences: '1', cliff_installment: null }, 'length'],
    ['fractional occurrences', { length_: '1', occurrences: '1.5', cliff_installment: null }, 'occurrences'],
    ['zero occurrences', { length_: '1', occurrences: '0', cliff_installment: null }, 'occurrences'],
    ['negative cliff', { length_: '1', occurrences: '1', cliff_installment: '-1' }, 'cliff_installment'],
    ['negative-zero cliff', { length_: '1', occurrences: '1', cliff_installment: '-0' }, 'cliff_installment'],
    ['fractional cliff', { length_: '1', occurrences: '1', cliff_installment: '1.5' }, 'cliff_installment'],
  ] as const)('direct reader rejects %s without numeric coercion', (_case, periodValue, field) => {
    const daml = makeDamlVestingTerms();
    (daml as unknown as { vesting_conditions: unknown[] }).vesting_conditions.push({
      id: 'bad-relative-period',
      description: null,
      quantity: '1',
      portion: null,
      trigger: {
        tag: 'OcfVestingScheduleRelativeTrigger',
        value: {
          relative_to_condition_id: 'start',
          period: { tag: 'OcfVestingPeriodDays', value: periodValue },
        },
      },
      next_condition_ids: [],
    });

    expect(() => damlVestingTermsDataToNative(daml)).toThrow(
      expect.objectContaining({
        fieldPath: `vestingTerms.vesting_conditions[1].trigger.period.${field}`,
      })
    );
  });

  test.each([
    {
      name: 'missing value',
      trigger: { tag: 'OcfVestingScheduleRelativeTrigger' },
      fieldPath: 'vestingTerms.vesting_conditions[1].trigger.value',
    },
    {
      name: 'missing period',
      trigger: {
        tag: 'OcfVestingScheduleRelativeTrigger',
        value: { relative_to_condition_id: 'start' },
      },
      fieldPath: 'vestingTerms.vesting_conditions[1].trigger.period',
    },
    {
      name: 'missing relative condition id',
      trigger: {
        tag: 'OcfVestingScheduleRelativeTrigger',
        value: { period: { tag: 'OcfVestingPeriodDays' } },
      },
      fieldPath: 'vestingTerms.vesting_conditions[1].trigger.relative_to_condition_id',
    },
  ])('reports the exact vesting-condition index for a relative trigger with $name', ({ trigger, fieldPath }) => {
    const daml = makeDamlVestingTerms();
    (daml as unknown as { vesting_conditions: unknown[] }).vesting_conditions.push({
      id: 'bad-relative-trigger',
      description: null,
      quantity: null,
      portion: null,
      trigger,
      next_condition_ids: [],
    });

    expect(() => damlVestingTermsDataToNative(daml)).toThrow(
      expect.objectContaining({
        name: 'OcpValidationError',
        fieldPath,
      })
    );
  });

  test.each([
    [
      'missing length',
      { occurrences: '1', cliff_installment: null },
      'length',
      undefined,
      OcpErrorCodes.REQUIRED_FIELD_MISSING,
    ],
    [
      'null length',
      { length_: null, occurrences: '1', cliff_installment: null },
      'length',
      null,
      OcpErrorCodes.INVALID_TYPE,
    ],
    [
      'missing occurrences',
      { length_: '1', cliff_installment: null },
      'occurrences',
      undefined,
      OcpErrorCodes.REQUIRED_FIELD_MISSING,
    ],
    [
      'null occurrences',
      { length_: '1', occurrences: null, cliff_installment: null },
      'occurrences',
      null,
      OcpErrorCodes.INVALID_TYPE,
    ],
  ] as const)(
    'direct reader distinguishes %s at the exact indexed path',
    (_case, periodValue, field, receivedValue, code) => {
      const daml = makeDamlVestingTerms();
      (daml as unknown as { vesting_conditions: unknown[] }).vesting_conditions.push({
        id: 'bad-relative-period',
        description: null,
        quantity: '1',
        portion: null,
        trigger: {
          tag: 'OcfVestingScheduleRelativeTrigger',
          value: {
            relative_to_condition_id: 'start',
            period: { tag: 'OcfVestingPeriodDays', value: periodValue },
          },
        },
        next_condition_ids: [],
      });

      expect(() => damlVestingTermsDataToNative(daml)).toThrow(
        expect.objectContaining({
          fieldPath: `vestingTerms.vesting_conditions[1].trigger.period.${field}`,
          code,
          receivedValue,
        })
      );
    }
  );

  test('direct reader rejects an unexpected relative-period value field at its exact indexed path', () => {
    const daml = makeDamlVestingTerms();
    (daml as unknown as { vesting_conditions: unknown[] }).vesting_conditions.push({
      id: 'extra-relative-period-field',
      description: null,
      quantity: '1',
      portion: null,
      trigger: {
        tag: 'OcfVestingScheduleRelativeTrigger',
        value: {
          relative_to_condition_id: 'start',
          period: {
            tag: 'OcfVestingPeriodDays',
            value: { length_: '1', occurrences: '1', cliff_installment: null, unexpected: true },
          },
        },
      },
      next_condition_ids: [],
    });

    expect(() => damlVestingTermsDataToNative(daml)).toThrow(
      expect.objectContaining({
        fieldPath: 'vestingTerms.vesting_conditions[1].trigger.period.value.unexpected',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        receivedValue: true,
      })
    );
  });

  test('reports the exact vesting-condition index for an unknown trigger tag', () => {
    const daml = makeDamlVestingTerms();
    (daml as unknown as { vesting_conditions: unknown[] }).vesting_conditions.push({
      id: 'unknown-trigger',
      description: null,
      quantity: null,
      portion: null,
      trigger: { tag: 'OcfUnknownVestingTrigger' },
      next_condition_ids: [],
    });

    expect(() => damlVestingTermsDataToNative(daml)).toThrow(
      expect.objectContaining({
        name: 'OcpParseError',
        source: 'vestingTerms.vesting_conditions[1].trigger.tag',
      })
    );
  });

  test('direct reader preserves the exact maximum safe vesting period integer', () => {
    const daml = makeDamlVestingTerms({
      vesting_conditions: [
        {
          id: 'start',
          description: null,
          quantity: '0',
          portion: null,
          trigger: { tag: 'OcfVestingStartTrigger', value: {} },
          next_condition_ids: ['max-safe-period'],
        },
        {
          id: 'max-safe-period',
          description: null,
          quantity: '1',
          portion: null,
          trigger: {
            tag: 'OcfVestingScheduleRelativeTrigger',
            value: {
              relative_to_condition_id: 'start',
              period: {
                tag: 'OcfVestingPeriodDays',
                value: {
                  length_: Number.MAX_SAFE_INTEGER.toString(),
                  occurrences: '1',
                  cliff_installment: '0',
                },
              },
            },
          },
          next_condition_ids: [],
        },
      ],
    });

    expect(
      requireDefined(
        damlVestingTermsDataToNative(daml).vesting_conditions[1],
        'maximum-period native vesting condition'
      ).trigger
    ).toMatchObject({ period: { length: Number.MAX_SAFE_INTEGER, occurrences: 1, cliff_installment: 0 } });
  });

  test('preserves remainder: true', () => {
    const daml = makeDamlVestingTerms();
    const damlCondition = requireFirst(
      (daml as unknown as { vesting_conditions: Array<{ portion: { remainder: boolean } }> }).vesting_conditions,
      'DAML vesting condition'
    );
    damlCondition.portion.remainder = true;
    const result = damlVestingTermsDataToNative(daml);
    expect(requireFirst(result.vesting_conditions, 'native vesting condition').portion?.remainder).toBe(true);
  });

  test('strips empty comments array', () => {
    const result = damlVestingTermsDataToNative(makeDamlVestingTerms({ comments: [] }));
    expect(result.comments).toBeUndefined();
    expect('comments' in result).toBe(false);
  });

  test('preserves non-empty comments', () => {
    const result = damlVestingTermsDataToNative(makeDamlVestingTerms({ comments: ['Board note'] }));
    expect(result.comments).toEqual(['Board note']);
  });

  test.each([
    ['unknown root field', { unexpected: true }, 'vestingTerms.unexpected'],
    ['malformed comments', { comments: 42 }, 'vestingTerms.comments'],
  ])('rejects %s losslessly', (_case, fields, source) => {
    expect(() => damlVestingTermsDataToNative(makeDamlVestingTerms(fields))).toThrow(
      expect.objectContaining({ name: OcpParseError.name, code: OcpErrorCodes.SCHEMA_MISMATCH, source })
    );
  });

  test('rejects an unknown condition field at its exact index', () => {
    const base = makeDamlVestingTerms() as unknown as {
      vesting_conditions: [Record<string, unknown>, ...Array<Record<string, unknown>>];
    };
    const first = base.vesting_conditions[0];
    first.unexpected = true;

    expect(() => damlVestingTermsDataToNative(base as never)).toThrow(
      expect.objectContaining({
        name: OcpParseError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'vestingTerms.vesting_conditions[0].unexpected',
      })
    );
  });

  test('rejects an unknown unit-trigger value field instead of dropping it', () => {
    const base = makeDamlVestingTerms() as unknown as {
      vesting_conditions: [Record<string, unknown>, ...Array<Record<string, unknown>>];
    };
    const first = base.vesting_conditions[0];
    first.trigger = { tag: 'OcfVestingStartTrigger', value: { unexpected: true } };

    expect(() => damlVestingTermsDataToNative(base as never)).toThrow(
      expect.objectContaining({
        name: OcpParseError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'vestingTerms.vesting_conditions[0].trigger.value.unexpected',
      })
    );
  });

  test('rejects a malformed typed root field at its exact path', () => {
    expect(() => damlVestingTermsDataToNative(makeDamlVestingTerms({ name: 42 }))).toThrow(
      expect.objectContaining({
        name: OcpParseError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'vestingTerms.name',
      })
    );
  });

  test('rejects an array unit-trigger value at its exact path', () => {
    const base = makeDamlVestingTerms() as unknown as {
      vesting_conditions: [Record<string, unknown>, ...Array<Record<string, unknown>>];
    };
    base.vesting_conditions[0].trigger = { tag: 'OcfVestingStartTrigger', value: [] };

    expect(() => damlVestingTermsDataToNative(base as never)).toThrow(
      expect.objectContaining({
        name: OcpParseError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'vestingTerms.vesting_conditions[0].trigger.value',
      })
    );
  });

  test('rejects an array vesting portion without a TypeError', () => {
    const base = makeDamlVestingTerms() as unknown as {
      vesting_conditions: [Record<string, unknown>, ...Array<Record<string, unknown>>];
    };
    base.vesting_conditions[0].portion = [];

    expect(() => damlVestingTermsDataToNative(base as never)).toThrow(
      expect.objectContaining({
        name: OcpValidationError.name,
        code: OcpErrorCodes.INVALID_TYPE,
        fieldPath: 'vestingTerms.vesting_conditions[0].portion',
      })
    );
  });

  test.each([
    ['string', '250.5000000000', '250.5'],
    ['lowercase scientific string', '1e-7', '0.0000001'],
    ['uppercase scientific string at the scale limit', '1E-10', '0.0000000001'],
    ['scientific string with a positive exponent', '1.2e+2', '120'],
    ['exact maximum DAML Numeric 10 string', maximumDamlNumeric10, maximumDamlNumeric10],
    ['negative integer zero', '-0', '0'],
    ['negative decimal zero', '-0.0000000000', '0'],
  ])('normalizes a DAML vesting quantity provided as a %s', (_case, quantity, expected) => {
    const condition = {
      id: 'quantity-condition',
      description: null,
      quantity,
      portion: null,
      trigger: { tag: 'OcfVestingStartTrigger', value: {} },
      next_condition_ids: [],
    };

    const result = damlVestingTermsDataToNative(makeDamlVestingTerms({ vesting_conditions: [condition] }));

    expect(result.vesting_conditions[0]).toMatchObject({ quantity: expected });
    expect(result.vesting_conditions[0]).not.toHaveProperty('portion');
  });

  test.each([
    ['zero number', 0, OcpErrorCodes.INVALID_TYPE],
    ['ordinary decimal number', 250.5, OcpErrorCodes.INVALID_TYPE],
    ['number serialized with a negative exponent', 1e-7, OcpErrorCodes.INVALID_TYPE],
    ['number at the DAML Numeric scale limit', 1e-10, OcpErrorCodes.INVALID_TYPE],
    ['an unsafe integer', Number.MAX_SAFE_INTEGER + 1, OcpErrorCodes.INVALID_TYPE],
    ['a number beyond the DAML Numeric scale', 1e-11, OcpErrorCodes.INVALID_TYPE],
    ['a decimal string beyond the DAML Numeric scale', '0.00000000001', OcpErrorCodes.INVALID_FORMAT],
    ['an integer string with a leading zero', '01', OcpErrorCodes.INVALID_FORMAT],
    ['a decimal string with a leading zero', '00.1', OcpErrorCodes.INVALID_FORMAT],
    ['a signed scientific string with a leading zero', '-01e+2', OcpErrorCodes.INVALID_FORMAT],
    ['a 29-digit integer string', '1'.repeat(29), OcpErrorCodes.INVALID_FORMAT],
    ['a 100-digit integer string', '9'.repeat(100), OcpErrorCodes.INVALID_FORMAT],
    ['a scientific string beyond the integer range', '1e28', OcpErrorCodes.INVALID_FORMAT],
    ['a negative string quantity', '-1', OcpErrorCodes.INVALID_FORMAT],
    ['a negative numeric quantity', -1, OcpErrorCodes.INVALID_TYPE],
    ['an enormous positive exponent', `1e${'9'.repeat(1_000)}`, OcpErrorCodes.INVALID_FORMAT],
    ['an enormous negative exponent', `1e-${'9'.repeat(1_000)}`, OcpErrorCodes.INVALID_FORMAT],
    ['a number with unsafe decimal precision', 123456789.12345679, OcpErrorCodes.INVALID_TYPE],
    ['a floating-point artifact beyond the DAML Numeric scale', 0.30000000000000004, OcpErrorCodes.INVALID_TYPE],
    ['invalid decimal string', 'not-a-number', OcpErrorCodes.INVALID_FORMAT],
    ['boolean', true, OcpErrorCodes.INVALID_TYPE],
    ['object', {}, OcpErrorCodes.INVALID_TYPE],
  ])('rejects a DAML vesting quantity provided as %s', (_case, quantity, code) => {
    const receivedValue =
      typeof quantity === 'string' && quantity.length > 256
        ? { valueType: 'string', length: quantity.length, preview: expect.any(String) }
        : quantity;
    const condition = {
      id: 'invalid-quantity-condition',
      description: null,
      quantity,
      portion: null,
      trigger: { tag: 'OcfVestingStartTrigger', value: {} },
      next_condition_ids: [],
    };

    try {
      damlVestingTermsDataToNative(makeDamlVestingTerms({ vesting_conditions: [condition] }));
      throw new Error('Expected vesting quantity conversion to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        fieldPath: 'vestingTerms.vesting_conditions[0].quantity',
        code,
        expectedType: 'DAML Numeric 10 string',
        receivedValue,
      });
    }
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects a non-finite generated vesting quantity %p as unsafe JSON',
    (quantity) => {
      const condition = {
        id: 'non-finite-quantity-condition',
        description: null,
        quantity,
        portion: null,
        trigger: { tag: 'OcfVestingStartTrigger', value: {} },
        next_condition_ids: [],
      };

      expect(() => damlVestingTermsDataToNative(makeDamlVestingTerms({ vesting_conditions: [condition] }))).toThrow(
        expect.objectContaining({
          name: OcpParseError.name,
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          source: 'vestingTerms.vesting_conditions[0].quantity',
        })
      );
    }
  );

  test.each([
    [
      'neither amount',
      {
        id: 'invalid-neither',
        description: null,
        quantity: null,
        portion: null,
        trigger: { tag: 'OcfVestingStartTrigger', value: {} },
        next_condition_ids: [],
      },
    ],
    [
      'both amounts',
      {
        id: 'invalid-both',
        description: null,
        quantity: '250',
        portion: { numerator: '1', denominator: '4', remainder: false },
        trigger: { tag: 'OcfVestingStartTrigger', value: {} },
        next_condition_ids: [],
      },
    ],
  ])('rejects DAML vesting conditions with %s', (_case, condition) => {
    expect(() => damlVestingTermsDataToNative(makeDamlVestingTerms({ vesting_conditions: [condition] }))).toThrow(
      OcpValidationError
    );
  });

  test.each([
    ['neither amount', { quantity: null, portion: null }, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    [
      'both amounts',
      { quantity: '1', portion: { numerator: '1', denominator: '4', remainder: false } },
      OcpErrorCodes.INVALID_FORMAT,
    ],
  ] as const)('direct reader indexes second-condition XOR failure for %s', (_case, amounts, code) => {
    const daml = makeDamlVestingTerms();
    (daml as unknown as { vesting_conditions: unknown[] }).vesting_conditions.push({
      id: 'second',
      description: null,
      ...amounts,
      trigger: { tag: 'OcfVestingEventTrigger', value: {} },
      next_condition_ids: [],
    });

    expect(() => damlVestingTermsDataToNative(daml)).toThrow(
      expect.objectContaining({
        fieldPath: 'vestingTerms.vesting_conditions[1]',
        code,
      })
    );
  });

  test('direct reader reports the exact duplicate next_condition_ids index', () => {
    const daml = makeDamlVestingTerms();
    (daml as unknown as { vesting_conditions: unknown[] }).vesting_conditions.push({
      id: 'second',
      description: null,
      quantity: '1',
      portion: null,
      trigger: { tag: 'OcfVestingEventTrigger', value: {} },
      next_condition_ids: ['third', 'fourth', 'third'],
    });

    expect(() => damlVestingTermsDataToNative(daml)).toThrow(
      expect.objectContaining({
        fieldPath: 'vestingTerms.vesting_conditions[1].next_condition_ids[2]',
        code: OcpErrorCodes.INVALID_FORMAT,
        receivedValue: 'third',
        context: expect.objectContaining({ firstIndex: 0 }),
      })
    );
  });

  test('round-trip OCF → DAML → OCF preserves remainder when DAML has it', () => {
    const ocfInput: OcfVestingTerms = {
      object_type: 'VESTING_TERMS',
      id: 'vt-rt-001',
      name: 'Standard Vesting',
      description: '4-year vesting with cliff',
      allocation_type: 'CUMULATIVE_ROUNDING',
      vesting_conditions: [
        {
          id: 'start',
          portion: { numerator: '1', denominator: '4' },
          trigger: { type: 'VESTING_START_DATE' },
          next_condition_ids: [],
        },
      ],
    };

    const damlData = convertToDaml('vestingTerms', ocfInput);
    const roundTripped = damlVestingTermsDataToNative(
      damlData as unknown as Parameters<typeof damlVestingTermsDataToNative>[0]
    );

    const roundTrippedPortion = requireFirst(
      roundTripped.vesting_conditions,
      'round-tripped vesting condition'
    ).portion;
    expect(roundTrippedPortion).toBeDefined();
    // When OCF omits remainder, convertToDaml may add false as DAML default; we preserve it (truthiness fix)
    expect(roundTrippedPortion?.remainder).toBe(false);
  });

  test('round-trips the canonical zero vesting-period length exactly', () => {
    const ocfInput: OcfVestingTerms = {
      object_type: 'VESTING_TERMS',
      id: 'vt-zero-length',
      name: 'Immediate schedule',
      description: 'Exercises the schema minimum period length',
      allocation_type: 'CUMULATIVE_ROUNDING',
      vesting_conditions: [
        {
          id: 'start',
          quantity: '0',
          trigger: { type: 'VESTING_START_DATE' },
          next_condition_ids: ['relative'],
        },
        {
          id: 'relative',
          quantity: '1',
          trigger: {
            type: 'VESTING_SCHEDULE_RELATIVE',
            relative_to_condition_id: 'start',
            period: { type: 'DAYS', length: 0, occurrences: 1 },
          },
          next_condition_ids: [],
        },
      ],
    };

    const damlData = vestingTermsDataToDaml(ocfInput);
    expect(damlData).toMatchObject({
      vesting_conditions: [{ id: 'start' }, { trigger: { value: { period: { value: { length_: '0' } } } } }],
    });
    expect(
      damlVestingTermsDataToNative(damlData as unknown as Parameters<typeof damlVestingTermsDataToNative>[0])
        .vesting_conditions[1]
    ).toMatchObject({ trigger: { period: { length: 0 } } });
  });

  test('round-trip OCF → DAML → OCF preserves omitted comments', () => {
    const ocfInput: OcfVestingTerms = {
      object_type: 'VESTING_TERMS',
      id: 'vt-rt-002',
      name: 'Standard Vesting',
      description: '4-year vesting with cliff',
      allocation_type: 'CUMULATIVE_ROUNDING',
      vesting_conditions: [
        {
          id: 'start',
          portion: { numerator: '1', denominator: '4' },
          trigger: { type: 'VESTING_START_DATE' },
          next_condition_ids: [],
        },
      ],
    };

    const damlData = convertToDaml('vestingTerms', ocfInput);
    const roundTripped = damlVestingTermsDataToNative(
      damlData as unknown as Parameters<typeof damlVestingTermsDataToNative>[0]
    );

    expect(roundTripped.comments).toBeUndefined();
    expect('comments' in roundTripped).toBe(false);
  });
});

describe('Vesting read-path wrapper compatibility', () => {
  const baseEventPayload = {
    created: {
      createdEvent: {
        createArgument: {},
      },
    },
  };

  function mockClientWithCreateArgument(createArgument: Record<string, unknown>): LedgerJsonApiClient {
    return {
      getEventsByContractId: jest.fn().mockImplementation(async ({ contractId }: { contractId: string }) => {
        await Promise.resolve();
        return {
          ...baseEventPayload,
          created: {
            createdEvent: {
              contractId,
              createArgument,
            },
          },
        };
      }),
    } as unknown as LedgerJsonApiClient;
  }

  test('getVestingStartAsOcf reads canonical vesting_data wrapper', async () => {
    const client = mockClientWithCreateArgument({
      vesting_data: {
        id: 'vs-read-001',
        date: '2024-01-01T00:00:00.000Z',
        security_id: 'sec-001',
        vesting_condition_id: 'vc-001',
        comments: [],
      },
    });

    const result = await getVestingStartAsOcf(client, { contractId: 'cid-vs' });
    expect(result.vestingStart.object_type).toBe('TX_VESTING_START');
    expect(result.vestingStart.id).toBe('vs-read-001');
  });

  test('getVestingStartAsOcf also accepts legacy vesting_start_data wrapper', async () => {
    const client = mockClientWithCreateArgument({
      vesting_start_data: {
        id: 'vs-read-legacy-001',
        date: '2024-01-01T00:00:00.000Z',
        security_id: 'sec-001',
        vesting_condition_id: 'vc-001',
        comments: [],
      },
    });

    const result = await getVestingStartAsOcf(client, { contractId: 'cid-vs-legacy' });
    expect(result.vestingStart.id).toBe('vs-read-legacy-001');
  });

  test('getVestingEventAsOcf reads canonical vesting_data wrapper', async () => {
    const client = mockClientWithCreateArgument({
      vesting_data: {
        id: 've-read-001',
        date: '2024-06-01T00:00:00.000Z',
        security_id: 'sec-001',
        vesting_condition_id: 'vc-evt-001',
        comments: [],
      },
    });

    const result = await getVestingEventAsOcf(client, { contractId: 'cid-ve' });
    expect(result.vestingEvent.object_type).toBe('TX_VESTING_EVENT');
    expect(result.vestingEvent.id).toBe('ve-read-001');
  });

  test('getVestingEventAsOcf also accepts legacy vesting_event_data wrapper', async () => {
    const client = mockClientWithCreateArgument({
      vesting_event_data: {
        id: 've-read-legacy-001',
        date: '2024-06-01T00:00:00.000Z',
        security_id: 'sec-001',
        vesting_condition_id: 'vc-evt-001',
        comments: [],
      },
    });

    const result = await getVestingEventAsOcf(client, { contractId: 'cid-ve-legacy' });
    expect(result.vestingEvent.id).toBe('ve-read-legacy-001');
  });

  test('getVestingAccelerationAsOcf reads canonical acceleration_data wrapper', async () => {
    const client = mockClientWithCreateArgument({
      acceleration_data: {
        id: 'va-read-001',
        date: '2024-12-01T00:00:00.000Z',
        security_id: 'sec-001',
        quantity: '10000',
        reason_text: 'Company acquisition',
        comments: [],
      },
    });

    const result = await getVestingAccelerationAsOcf(client, { contractId: 'cid-va' });
    expect(result.vestingAcceleration.object_type).toBe('TX_VESTING_ACCELERATION');
    expect(result.vestingAcceleration.id).toBe('va-read-001');
  });

  test('getVestingAccelerationAsOcf also accepts legacy vesting_acceleration_data wrapper', async () => {
    const client = mockClientWithCreateArgument({
      vesting_acceleration_data: {
        id: 'va-read-legacy-001',
        date: '2024-12-01T00:00:00.000Z',
        security_id: 'sec-001',
        quantity: '10000',
        reason_text: 'Company acquisition',
        comments: [],
      },
    });

    const result = await getVestingAccelerationAsOcf(client, { contractId: 'cid-va-legacy' });
    expect(result.vestingAcceleration.id).toBe('va-read-legacy-001');
  });
});
