/** Unit tests for stock issuance DAML→OCF read conversions. */

import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../../src/errors';
import { damlStockIssuanceDataToNative } from '../../src/functions/OpenCapTable/stockIssuance/getStockIssuanceAsOcf';
import { parseOcfEntityInput } from '../../src/utils/ocfZodSchemas';

type DamlStockIssuance = Fairmint.OpenCapTable.OCF.StockIssuance.StockIssuanceOcfData;

const REQUIRED_STRING_FIELDS = ['id', 'date', 'security_id', 'custom_id', 'stakeholder_id', 'stock_class_id'] as const;

const INVALID_REQUIRED_STRING_VALUES = [
  { description: 'undefined', value: undefined },
  { description: 'null', value: null },
  { description: 'non-string', value: 42 },
] as const;

const requiredStringValidationCases = REQUIRED_STRING_FIELDS.flatMap((field) =>
  INVALID_REQUIRED_STRING_VALUES.map(({ description, value }) => ({ field, description, value }))
);

function makeMinimalDamlStockIssuance(overrides: Partial<DamlStockIssuance> = {}): DamlStockIssuance {
  return {
    id: 'test-id',
    date: '2024-01-15T00:00:00Z',
    security_id: 'sec-1',
    custom_id: 'CS-1',
    stakeholder_id: 'sh-1',
    stock_class_id: 'sc-1',
    share_price: { amount: '1.00', currency: 'USD' },
    quantity: '100',
    security_law_exemptions: [],
    share_numbers_issued: [],
    stock_legend_ids: [],
    vestings: [],
    comments: [],
    board_approval_date: null,
    consideration_text: null,
    cost_basis: null,
    issuance_type: null,
    stock_plan_id: null,
    stockholder_approval_date: null,
    vesting_terms_id: null,
    ...overrides,
  };
}

function makeInvalidDamlStockIssuance(overrides: Record<string, unknown>): DamlStockIssuance {
  return { ...makeMinimalDamlStockIssuance(), ...overrides };
}

function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected stock issuance conversion to fail');
}

function expectGeneratedStockParseError(error: unknown, decoderPath: string | RegExp): void {
  expect(error).toBeInstanceOf(OcpParseError);
  const parseError = error as OcpParseError;
  expect(parseError.code).toBe(OcpErrorCodes.SCHEMA_MISMATCH);
  expect(parseError.source).toBe('damlEntityData.stockIssuance');
  expect(parseError.context).toMatchObject({ entityType: 'stockIssuance' });
  expect(parseError.context).toHaveProperty('decoderMessage');
  const receivedPath = parseError.context?.decoderPath;
  expect(typeof receivedPath).toBe('string');
  if (typeof decoderPath === 'string') expect(receivedPath).toBe(decoderPath);
  else expect(receivedPath).toMatch(decoderPath);
  expect(JSON.stringify(error).length).toBeLessThan(2_000);
}

describe('damlStockIssuanceDataToNative', () => {
  test('rejects a non-object payload with a controlled schema mismatch', () => {
    expectGeneratedStockParseError(
      captureError(() =>
        damlStockIssuanceDataToNative(null as unknown as Parameters<typeof damlStockIssuanceDataToNative>[0])
      ),
      'input'
    );
  });

  describe('issuance_type handling (DAML Optional enum)', () => {
    test('returns RSA when issuance_type is OcfStockIssuanceRSA', () => {
      const daml = makeMinimalDamlStockIssuance({ issuance_type: 'OcfStockIssuanceRSA' });
      const result = damlStockIssuanceDataToNative(daml);
      expect(result.issuance_type).toBe('RSA');
    });

    test('returns FOUNDERS_STOCK when issuance_type is OcfStockIssuanceFounders', () => {
      const daml = makeMinimalDamlStockIssuance({ issuance_type: 'OcfStockIssuanceFounders' });
      const result = damlStockIssuanceDataToNative(daml);
      expect(result.issuance_type).toBe('FOUNDERS_STOCK');
    });

    test('omits issuance_type when DAML value is null (Optional None)', () => {
      const daml = makeMinimalDamlStockIssuance({ issuance_type: null });
      const result = damlStockIssuanceDataToNative(daml);
      expect(result.issuance_type).toBeUndefined();
    });

    test('omits issuance_type when DAML field is undefined (absent)', () => {
      const daml = makeMinimalDamlStockIssuance();
      delete (daml as Partial<DamlStockIssuance>).issuance_type;
      const result = damlStockIssuanceDataToNative(daml);
      expect(result.issuance_type).toBeUndefined();
    });

    test('throws for unknown DAML issuance type string', () => {
      const daml = {
        ...makeMinimalDamlStockIssuance(),
        issuance_type: 'OcfStockIssuanceUnknown',
      } as unknown as DamlStockIssuance;
      expectGeneratedStockParseError(
        captureError(() => damlStockIssuanceDataToNative(daml)),
        'input.issuance_type'
      );
    });
  });

  describe('required field extraction', () => {
    test.each(requiredStringValidationCases)(
      'rejects $description $field values with structured validation details',
      ({ field, value }) => {
        const daml = makeInvalidDamlStockIssuance({ [field]: value });

        expectGeneratedStockParseError(
          captureError(() => damlStockIssuanceDataToNative(daml)),
          `input.${field}`
        );
      }
    );

    test.each(REQUIRED_STRING_FIELDS)('requires generated %s as an own field', (field) => {
      const daml = makeMinimalDamlStockIssuance() as unknown as Record<string, unknown>;
      delete daml[field];

      expectGeneratedStockParseError(
        captureError(() => damlStockIssuanceDataToNative(daml as DamlStockIssuance)),
        `input.${field}`
      );
    });

    test.each(REQUIRED_STRING_FIELDS.filter((field) => field !== 'date'))(
      'rejects an empty generated Text value for %s',
      (field) => {
        expect(
          captureError(() => damlStockIssuanceDataToNative(makeMinimalDamlStockIssuance({ [field]: '' })))
        ).toMatchObject({
          name: 'OcpValidationError',
          code: OcpErrorCodes.INVALID_FORMAT,
          fieldPath: `stockIssuance.${field}`,
          receivedValue: '',
        });
      }
    );

    test('extracts all required fields correctly', () => {
      const daml = makeMinimalDamlStockIssuance();
      const result = damlStockIssuanceDataToNative(daml);
      expect(result.id).toBe('test-id');
      expect(result.date).toBe('2024-01-15');
      expect(result.security_id).toBe('sec-1');
      expect(result.custom_id).toBe('CS-1');
      expect(result.stakeholder_id).toBe('sh-1');
      expect(result.stock_class_id).toBe('sc-1');
      expect(result.quantity).toBe('100');
      expect(result.share_price).toEqual({ amount: '1', currency: 'USD' });
    });
  });

  describe('date field diagnostics', () => {
    test('reports the stock issuance date path for a malformed required date', () => {
      const date = '2024-02-30T00:00:00Z';
      const daml = makeMinimalDamlStockIssuance({ date });

      expect(() => damlStockIssuanceDataToNative(daml)).toThrow(
        expect.objectContaining({
          code: OcpErrorCodes.INVALID_FORMAT,
          fieldPath: 'stockIssuance.date',
          receivedValue: date,
        })
      );
    });

    test.each(['board_approval_date', 'stockholder_approval_date'] as const)(
      'reports the exact %s path for a malformed optional date',
      (field) => {
        const date = '2023-02-29T00:00:00Z';
        const daml = makeMinimalDamlStockIssuance({ [field]: date });

        expect(() => damlStockIssuanceDataToNative(daml)).toThrow(
          expect.objectContaining({
            code: OcpErrorCodes.INVALID_FORMAT,
            fieldPath: `stockIssuance.${field}`,
            receivedValue: date,
          })
        );
      }
    );
  });

  describe('optional field handling', () => {
    test('includes vesting_terms_id when present', () => {
      const daml = makeMinimalDamlStockIssuance({ vesting_terms_id: 'vt-1' });
      const result = damlStockIssuanceDataToNative(daml);
      expect(result.vesting_terms_id).toBe('vt-1');
    });

    test('omits vesting_terms_id when null', () => {
      const daml = makeMinimalDamlStockIssuance({ vesting_terms_id: null });
      const result = damlStockIssuanceDataToNative(daml);
      expect(result.vesting_terms_id).toBeUndefined();
    });

    test('includes stock_plan_id when present', () => {
      const daml = makeMinimalDamlStockIssuance({ stock_plan_id: 'sp-1' });
      const result = damlStockIssuanceDataToNative(daml);
      expect(result.stock_plan_id).toBe('sp-1');
    });

    test('omits stock_plan_id when null', () => {
      const daml = makeMinimalDamlStockIssuance({ stock_plan_id: null });
      const result = damlStockIssuanceDataToNative(daml);
      expect(result.stock_plan_id).toBeUndefined();
    });

    test('includes cost_basis when present', () => {
      const daml = makeMinimalDamlStockIssuance({ cost_basis: { amount: '0', currency: 'USD' } });
      const result = damlStockIssuanceDataToNative(daml);
      expect(result.cost_basis).toEqual({ amount: '0', currency: 'USD' });
    });

    test('omits cost_basis when null', () => {
      const daml = makeMinimalDamlStockIssuance({ cost_basis: null });
      const result = damlStockIssuanceDataToNative(daml);
      expect(result.cost_basis).toBeUndefined();
    });
  });

  describe('array field handling', () => {
    test('omits empty vestings so the output remains OCF-schema valid', () => {
      const daml = makeMinimalDamlStockIssuance({ vestings: [] });
      const result = damlStockIssuanceDataToNative(daml);

      expect(result).not.toHaveProperty('vestings');
      expect(() => parseOcfEntityInput('stockIssuance', result)).not.toThrow();
    });

    test('includes non-empty vestings', () => {
      const daml = makeMinimalDamlStockIssuance({
        vestings: [{ date: '2025-06-01T00:00:00Z', amount: '10.00' }],
      });
      const result = damlStockIssuanceDataToNative(daml);

      expect(result.vestings).toEqual([{ date: '2025-06-01', amount: '10' }]);
      expect(() => parseOcfEntityInput('stockIssuance', result)).not.toThrow();
    });

    test('rejects a present non-array vestings value', () => {
      const daml = makeInvalidDamlStockIssuance({ vestings: 'not-an-array' });

      expectGeneratedStockParseError(
        captureError(() => damlStockIssuanceDataToNative(daml)),
        'input.vestings'
      );
    });

    test.each([
      { description: 'a null entry', vestings: [null], decoderPath: 'input.vestings[0]' },
      {
        description: 'a non-string date',
        vestings: [{ date: 1, amount: '10' }],
        decoderPath: 'input.vestings[0].date',
      },
      {
        description: 'a non-numeric amount',
        vestings: [{ date: '2025-06-01T00:00:00Z', amount: {} }],
        decoderPath: 'input.vestings[0].amount',
      },
    ])('rejects $description with an indexed schema mismatch', ({ vestings, decoderPath }) => {
      const daml = makeInvalidDamlStockIssuance({ vestings });

      expectGeneratedStockParseError(
        captureError(() => damlStockIssuanceDataToNative(daml)),
        decoderPath
      );
    });

    test('handles security_law_exemptions array', () => {
      const daml = makeMinimalDamlStockIssuance({
        security_law_exemptions: [{ description: 'SEC Rule 701', jurisdiction: 'US' }],
      });
      const result = damlStockIssuanceDataToNative(daml);
      expect(result.security_law_exemptions).toEqual([{ description: 'SEC Rule 701', jurisdiction: 'US' }]);
    });

    test('handles empty security_law_exemptions', () => {
      const daml = makeMinimalDamlStockIssuance({ security_law_exemptions: [] });
      const result = damlStockIssuanceDataToNative(daml);
      expect(result.security_law_exemptions).toEqual([]);
    });

    test.each([
      ['security_law_exemptions', { description: 'Rule 701', jurisdiction: 'US' }],
      ['share_numbers_issued', { starting_share_number: '1', ending_share_number: '100' }],
    ] as const)('rejects malformed %s elements with indexed structured errors', (field, validElement) => {
      for (const invalidElement of [null, [], 'not-an-object']) {
        const error = captureError(() =>
          damlStockIssuanceDataToNative(
            makeMinimalDamlStockIssuance({
              [field]: [validElement, invalidElement],
            })
          )
        );

        expectGeneratedStockParseError(error, `input.${field}[1]`);
      }
    });

    test.each([
      ['security_law_exemptions', 'description', 42],
      ['share_numbers_issued', 'starting_share_number', 42],
      ['share_numbers_issued', 'ending_share_number', null],
    ] as const)('reports the indexed %s.%s field', (collection, field, invalidValue) => {
      const validElement =
        collection === 'security_law_exemptions'
          ? { description: 'Rule 701', jurisdiction: 'US' }
          : { starting_share_number: '1', ending_share_number: '100' };
      const error = captureError(() =>
        damlStockIssuanceDataToNative(
          makeMinimalDamlStockIssuance({
            [collection]: [validElement, { ...validElement, [field]: invalidValue }],
          })
        )
      );

      expectGeneratedStockParseError(error, `input.${collection}[1].${field}`);
    });

    test('rejects an empty security-law jurisdiction Text value', () => {
      expect(
        captureError(() =>
          damlStockIssuanceDataToNative(
            makeMinimalDamlStockIssuance({
              security_law_exemptions: [{ description: 'Rule 701', jurisdiction: '' }],
            })
          )
        )
      ).toMatchObject({
        name: 'OcpValidationError',
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'stockIssuance.security_law_exemptions[0].jurisdiction',
        receivedValue: '',
      });
    });

    test.each(['security_law_exemptions', 'share_numbers_issued'] as const)(
      'rejects a present non-array %s collection',
      (field) => {
        const invalidValue = { not: 'an array' };
        const error = captureError(() =>
          damlStockIssuanceDataToNative(makeMinimalDamlStockIssuance({ [field]: invalidValue }))
        );

        expectGeneratedStockParseError(error, `input.${field}`);
      }
    );

    test('handles stock_legend_ids array', () => {
      const daml = makeMinimalDamlStockIssuance({ stock_legend_ids: ['leg-1', 'leg-2'] });
      const result = damlStockIssuanceDataToNative(daml);
      expect(result.stock_legend_ids).toEqual(['leg-1', 'leg-2']);
    });

    test('handles comments array', () => {
      const daml = makeMinimalDamlStockIssuance({ comments: ['note 1', 'note 2'] });
      const result = damlStockIssuanceDataToNative(daml);
      expect(result.comments).toEqual(['note 1', 'note 2']);
    });
  });
});
