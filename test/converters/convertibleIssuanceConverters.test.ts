/**
 * Regression tests for convertible issuance DAML conversion.
 *
 * Guards against wrong DAML enum constructor names for SAFE conversion_timing.
 * The correct DAML type is OcfConversionTimingType with values:
 *   'OcfConvTimingPreMoney' | 'OcfConvTimingPostMoney'
 * (not 'OcfConversionTimingPreMoney' / 'OcfConversionTimingPostMoney')
 *
 * Also guards read-side (DAML → OCF) exact-match hardening for:
 *   - OcfDayCountActual365 / OcfDayCount30_360
 *   - OcfInterestPayoutDeferred / OcfInterestPayoutCash
 */

import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import {
  convertibleIssuanceDataToDaml,
  type ConvertibleIssuanceInput,
} from '../../src/functions/OpenCapTable/convertibleIssuance/createConvertibleIssuance';
import {
  damlConvertibleIssuanceDataToNative as convertTypedConvertibleIssuance,
  type DamlConvertibleIssuanceData,
} from '../../src/functions/OpenCapTable/convertibleIssuance/getConvertibleIssuanceAsOcf';
import type { ConvertibleConversionTrigger } from '../../src/types/native';
import { parseOcfEntityInput } from '../../src/utils/ocfZodSchemas';
import { requireFirst } from '../../src/utils/requireDefined';
import { expectInvalidDate } from '../utils/dateValidationAssertions';
import { loadProductionFixture, stripSourceMetadata } from '../utils/productionFixtures';

const BASE_INPUT = {
  object_type: 'TX_CONVERTIBLE_ISSUANCE' as const,
  id: 'conv-001',
  date: '2024-01-15',
  security_id: 'sec-001',
  custom_id: 'SAFE-1',
  stakeholder_id: 'sh-001',
  investment_amount: { amount: '500000', currency: 'USD' },
  convertible_type: 'SAFE' as const,
  security_law_exemptions: [{ description: 'Regulation D', jurisdiction: 'US' }],
  seniority: 1,
};

const damlConvertibleIssuanceDataToNative = (value: unknown) =>
  convertTypedConvertibleIssuance(value as DamlConvertibleIssuanceData);

const SAFE_TRIGGER_BASE = {
  type: 'ELECTIVE_AT_WILL' as const,
  trigger_id: 'trigger-001',
  conversion_right: {
    type: 'CONVERTIBLE_CONVERSION_RIGHT' as const,
    conversion_mechanism: {
      type: 'SAFE_CONVERSION' as const,
      conversion_discount: '0.20',
      conversion_valuation_cap: { amount: '10000000', currency: 'USD' },
      conversion_mfn: false,
    },
  },
};

type TriggerDateField = 'trigger_date' | 'start_date' | 'end_date';

function triggerTimingWithField(field: TriggerDateField, value: unknown): Record<string, unknown> {
  if (field === 'trigger_date') {
    return { type: 'AUTOMATIC_ON_DATE', trigger_date: value };
  }
  return {
    type: 'ELECTIVE_IN_RANGE',
    start_date: field === 'start_date' ? value : '2024-01-01',
    end_date: field === 'end_date' ? value : '2024-12-31',
  };
}

function convertibleTriggerWithDateField(field: TriggerDateField, value: unknown): ConvertibleConversionTrigger {
  const trigger: unknown = {
    ...SAFE_TRIGGER_BASE,
    ...triggerTimingWithField(field, value),
  };
  return trigger as ConvertibleConversionTrigger;
}

function noteInterestRatePath(triggerIndex = 0, interestRateIndex = 0): string {
  return (
    `convertibleIssuance.conversion_triggers[${triggerIndex}].conversion_right.` +
    `conversion_mechanism.interest_rates[${interestRateIndex}]`
  );
}

function expectParseErrorSource(action: () => unknown, source: string): void {
  const decoderSource = `input.${source
    .replace(/^convertibleIssuance\./, '')
    .replace('.conversion_mechanism.', '.conversion_mechanism.value.')}`;
  const mechanismValue = '.conversion_mechanism.value.';
  const valueIndex = decoderSource.indexOf(mechanismValue);
  if (valueIndex === -1) {
    expectGeneratedDecodeError(action, decoderSource);
    return;
  }
  expectGeneratedDecodeError(
    action,
    decoderSource.slice(0, valueIndex + '.conversion_mechanism'.length),
    decoderSource.slice(valueIndex + mechanismValue.length)
  );
}

function expectGeneratedDecodeError(action: () => unknown, decoderPath: string, _decoderMessage?: string): void {
  try {
    action();
    throw new Error('Expected generated DAML decoding to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(OcpParseError);
    expect(error).toMatchObject({
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: 'damlEntityData.convertibleIssuance',
      context: { decoderPath: expect.stringContaining(decoderPath) },
    });
    expect(JSON.stringify(error).length).toBeLessThan(2_000);
  }
}

function captureValidationError(action: () => unknown): OcpValidationError {
  try {
    action();
  } catch (error) {
    if (error instanceof OcpValidationError) return error;
    throw error;
  }
  throw new Error('Expected OcpValidationError');
}

function encodeRuntimeConvertibleInput(input: unknown): ReturnType<typeof convertibleIssuanceDataToDaml> {
  return convertibleIssuanceDataToDaml(input as Parameters<typeof convertibleIssuanceDataToDaml>[0]);
}

const NOTE_INTEREST_RATE_WRITE_PATH =
  'convertibleIssuance.conversion_triggers[0].conversion_right.conversion_mechanism.interest_rates[0]';

function conversionMechanismPath(triggerIndex = 0): string {
  return `convertibleIssuance.conversion_triggers[${triggerIndex}].conversion_right.conversion_mechanism`;
}

function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected conversion mechanism validation to fail');
}

function buildConvertibleNoteTrigger(triggerId: string, interestRates: unknown[]) {
  return {
    ...SAFE_TRIGGER_BASE,
    trigger_id: triggerId,
    conversion_right: {
      type: 'CONVERTIBLE_CONVERSION_RIGHT',
      conversion_mechanism: {
        type: 'CONVERTIBLE_NOTE_CONVERSION',
        interest_rates: interestRates,
        day_count_convention: 'ACTUAL_365',
        interest_payout: 'CASH',
        interest_accrual_period: 'ANNUAL',
        compounding_type: 'SIMPLE',
      },
    },
  };
}

function buildConvertibleNoteInput(interestRate: unknown) {
  return {
    ...BASE_INPUT,
    convertible_type: 'NOTE',
    conversion_triggers: [buildConvertibleNoteTrigger('trigger-001', [interestRate])],
  } as unknown as Parameters<typeof convertibleIssuanceDataToDaml>[0];
}

describe('SAFE conversion_timing DAML constructor names', () => {
  it('emits OcfConvTimingPostMoney for POST_MONEY (not OcfConversionTimingPostMoney)', () => {
    const input: Parameters<typeof convertibleIssuanceDataToDaml>[0] = {
      ...BASE_INPUT,
      conversion_triggers: [
        {
          ...SAFE_TRIGGER_BASE,
          conversion_right: {
            ...SAFE_TRIGGER_BASE.conversion_right,
            conversion_mechanism: {
              ...SAFE_TRIGGER_BASE.conversion_right.conversion_mechanism,
              conversion_timing: 'POST_MONEY' as const,
            },
          },
        },
      ],
    };

    const daml = encodeRuntimeConvertibleInput(input);
    const trigger = requireFirst(daml.conversion_triggers, 'converted SAFE trigger');
    const mech = (
      trigger.conversion_right as { conversion_mechanism: { tag: string; value: { conversion_timing: string | null } } }
    ).conversion_mechanism;

    expect(mech.tag).toBe('OcfConvMechSAFE');
    expect(mech.value.conversion_timing).toBe('OcfConvTimingPostMoney');
    expect(mech.value.conversion_timing).not.toBe('OcfConversionTimingPostMoney');
  });

  it('emits OcfConvTimingPreMoney for PRE_MONEY (not OcfConversionTimingPreMoney)', () => {
    const input: Parameters<typeof convertibleIssuanceDataToDaml>[0] = {
      ...BASE_INPUT,
      conversion_triggers: [
        {
          ...SAFE_TRIGGER_BASE,
          conversion_right: {
            ...SAFE_TRIGGER_BASE.conversion_right,
            conversion_mechanism: {
              ...SAFE_TRIGGER_BASE.conversion_right.conversion_mechanism,
              conversion_timing: 'PRE_MONEY' as const,
            },
          },
        },
      ],
    };

    const daml = encodeRuntimeConvertibleInput(input);
    const trigger = requireFirst(daml.conversion_triggers, 'converted SAFE trigger');
    const mech = (
      trigger.conversion_right as { conversion_mechanism: { tag: string; value: { conversion_timing: string | null } } }
    ).conversion_mechanism;

    expect(mech.tag).toBe('OcfConvMechSAFE');
    expect(mech.value.conversion_timing).toBe('OcfConvTimingPreMoney');
    expect(mech.value.conversion_timing).not.toBe('OcfConversionTimingPreMoney');
  });

  it('emits null for absent conversion_timing', () => {
    const input: Parameters<typeof convertibleIssuanceDataToDaml>[0] = {
      ...BASE_INPUT,
      conversion_triggers: [SAFE_TRIGGER_BASE],
    };

    const daml = encodeRuntimeConvertibleInput(input);
    const trigger = requireFirst(daml.conversion_triggers, 'converted SAFE trigger');
    const mech = (
      trigger.conversion_right as { conversion_mechanism: { tag: string; value: { conversion_timing: unknown } } }
    ).conversion_mechanism;

    expect(mech.tag).toBe('OcfConvMechSAFE');
    expect(mech.value.conversion_timing).toBeNull();
  });

  it('throws OcpParseError for an unrecognized non-null conversion_timing', () => {
    const input = {
      ...BASE_INPUT,
      conversion_triggers: [
        {
          ...SAFE_TRIGGER_BASE,
          conversion_right: {
            ...SAFE_TRIGGER_BASE.conversion_right,
            conversion_mechanism: {
              ...SAFE_TRIGGER_BASE.conversion_right.conversion_mechanism,
              conversion_timing: 'POSTMONEY',
            },
          },
        },
      ],
    };

    expect(() =>
      convertibleIssuanceDataToDaml(input as unknown as Parameters<typeof convertibleIssuanceDataToDaml>[0])
    ).toThrow('Unknown conversion_timing: POSTMONEY');
  });
});

describe('convertible issuance discriminator and required-ID boundaries', () => {
  const validInput: Parameters<typeof convertibleIssuanceDataToDaml>[0] = {
    ...BASE_INPUT,
    conversion_triggers: [SAFE_TRIGGER_BASE],
  };

  test.each([
    {
      name: 'convertible type',
      fieldPath: 'convertibleIssuance.convertible_type',
      receivedValue: 'BOND',
      input: { ...validInput, convertible_type: 'BOND' },
    },
    {
      name: 'trigger type',
      fieldPath: 'convertibleIssuance.conversion_triggers[0].type',
      receivedValue: 'ON_MAGIC_EVENT',
      input: {
        ...validInput,
        conversion_triggers: [{ ...SAFE_TRIGGER_BASE, type: 'ON_MAGIC_EVENT' }],
      },
    },
  ])('rejects an unknown runtime $name with a typed error', ({ input, fieldPath, receivedValue }) => {
    try {
      convertibleIssuanceDataToDaml(input as unknown as Parameters<typeof convertibleIssuanceDataToDaml>[0]);
      throw new Error('Expected runtime discriminator validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        fieldPath,
        receivedValue,
      });
    }
  });

  it('rejects a mismatched conversion right on the exact second trigger', () => {
    const input = {
      ...validInput,
      conversion_triggers: [
        SAFE_TRIGGER_BASE,
        {
          ...SAFE_TRIGGER_BASE,
          trigger_id: 'trigger-002',
          conversion_right: {
            ...SAFE_TRIGGER_BASE.conversion_right,
            type: 'WARRANT_CONVERSION_RIGHT',
          },
        },
      ],
    } as unknown as Parameters<typeof convertibleIssuanceDataToDaml>[0];

    try {
      convertibleIssuanceDataToDaml(input);
      throw new Error('Expected conversion-right validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpParseError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'convertibleIssuance.conversion_triggers[1].conversion_right.type',
      });
    }
  });

  test.each([
    ['explicit null', null],
    ['number', 0],
    ['string', 'false'],
    ['object', {}],
  ] as const)('rejects a %s future-round flag on the exact second trigger', (_case, value) => {
    const input = {
      ...validInput,
      conversion_triggers: [
        SAFE_TRIGGER_BASE,
        {
          ...SAFE_TRIGGER_BASE,
          trigger_id: 'trigger-002',
          conversion_right: {
            ...SAFE_TRIGGER_BASE.conversion_right,
            converts_to_future_round: value,
          },
        },
      ],
    } as unknown as Parameters<typeof convertibleIssuanceDataToDaml>[0];

    try {
      convertibleIssuanceDataToDaml(input);
      throw new Error('Expected future-round validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_TYPE,
        fieldPath: 'convertibleIssuance.conversion_triggers[1].conversion_right.converts_to_future_round',
        receivedValue: value,
      });
    }
  });

  it('preserves false on the exact second future-round flag', () => {
    const daml = convertibleIssuanceDataToDaml({
      ...validInput,
      conversion_triggers: [
        SAFE_TRIGGER_BASE,
        {
          ...SAFE_TRIGGER_BASE,
          trigger_id: 'trigger-002',
          conversion_right: {
            ...SAFE_TRIGGER_BASE.conversion_right,
            converts_to_future_round: false,
          },
        },
      ],
    });

    expect(daml.conversion_triggers[1]?.conversion_right.converts_to_future_round).toBe(false);
  });

  test.each([
    ['explicit null', null, OcpErrorCodes.INVALID_TYPE],
    ['wrong type', 42, OcpErrorCodes.INVALID_TYPE],
  ] as const)('rejects a %s optional stock-class target on the exact second trigger', (_case, value, code) => {
    const input = {
      ...validInput,
      conversion_triggers: [
        SAFE_TRIGGER_BASE,
        {
          ...SAFE_TRIGGER_BASE,
          trigger_id: 'trigger-002',
          conversion_right: {
            ...SAFE_TRIGGER_BASE.conversion_right,
            converts_to_stock_class_id: value,
          },
        },
      ],
    } as unknown as Parameters<typeof convertibleIssuanceDataToDaml>[0];

    try {
      convertibleIssuanceDataToDaml(input);
      throw new Error('Expected stock-class target validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code,
        fieldPath: 'convertibleIssuance.conversion_triggers[1].conversion_right.converts_to_stock_class_id',
        receivedValue: value,
      });
    }
  });

  it('preserves an empty optional stock-class target on the exact second trigger', () => {
    const daml = convertibleIssuanceDataToDaml({
      ...validInput,
      conversion_triggers: [
        SAFE_TRIGGER_BASE,
        {
          ...SAFE_TRIGGER_BASE,
          trigger_id: 'trigger-002',
          conversion_right: { ...SAFE_TRIGGER_BASE.conversion_right, converts_to_stock_class_id: '' },
        },
      ],
    });
    expect(daml.conversion_triggers[1]?.conversion_right.converts_to_stock_class_id).toBe('');
  });

  test.each([
    ['null', null],
    ['wrong type', 42],
  ] as const)('rejects a %s second trigger record in the generated decoder', (_case, value) => {
    const daml = encodeRuntimeConvertibleInput(validInput);
    const firstTrigger = requireFirst(daml.conversion_triggers, 'serialized convertible trigger');
    expectGeneratedDecodeError(
      () => damlConvertibleIssuanceDataToNative({ ...daml, conversion_triggers: [firstTrigger, value] }),
      'input.conversion_triggers[1]'
    );
  });

  test.each([
    ['null', null],
    ['wrong type', 42],
  ] as const)('rejects a %s second trigger_id in the generated decoder', (_case, value) => {
    const daml = encodeRuntimeConvertibleInput(validInput);
    const firstTrigger = requireFirst(daml.conversion_triggers, 'serialized convertible trigger');
    const secondTrigger = { ...firstTrigger, trigger_id: value };
    expectGeneratedDecodeError(
      () =>
        damlConvertibleIssuanceDataToNative({
          ...daml,
          conversion_triggers: [firstTrigger, secondTrigger],
        }),
      'input.conversion_triggers[1].trigger_id'
    );
  });

  it('preserves an empty second trigger_id on ledger readback', () => {
    const daml = encodeRuntimeConvertibleInput(validInput);
    const firstTrigger = requireFirst(daml.conversion_triggers, 'serialized convertible trigger');
    expect(
      damlConvertibleIssuanceDataToNative({
        ...daml,
        conversion_triggers: [firstTrigger, { ...firstTrigger, trigger_id: '' }],
      }).conversion_triggers[1]?.trigger_id
    ).toBe('');
  });

  test.each([
    ['null', null],
    ['wrong type', {}],
  ] as const)('rejects a %s conversion_triggers collection in the generated decoder', (_case, value) => {
    const daml = encodeRuntimeConvertibleInput(validInput);
    expectGeneratedDecodeError(
      () => damlConvertibleIssuanceDataToNative({ ...daml, conversion_triggers: value }),
      'input.conversion_triggers'
    );
  });

  it('preserves an empty required custom_id on ledger readback', () => {
    const daml = encodeRuntimeConvertibleInput(validInput);
    expect(damlConvertibleIssuanceDataToNative({ ...daml, custom_id: '' }).custom_id).toBe('');
  });
});

describe('convertible issuance runtime-total writer boundary', () => {
  const validInput = { ...BASE_INPUT, conversion_triggers: [SAFE_TRIGGER_BASE] };

  test.each([
    ['null root', null, OcpErrorCodes.INVALID_TYPE],
    ['scalar root', 42, OcpErrorCodes.INVALID_TYPE],
  ] as const)('classifies a %s', (_case, value, code) => {
    expect(captureValidationError(() => convertibleIssuanceDataToDaml(value as never))).toMatchObject({
      code,
      fieldPath: 'convertibleIssuance',
      receivedValue: value,
    });
  });

  test.each([
    ['null', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['record', {}, OcpErrorCodes.INVALID_TYPE],
  ] as const)('classifies a %s conversion_triggers collection', (_case, value, code) => {
    const error = captureValidationError(() =>
      convertibleIssuanceDataToDaml({ ...validInput, conversion_triggers: value } as never)
    );
    expect(error).toMatchObject({
      code,
      fieldPath: 'convertibleIssuance.conversion_triggers',
      receivedValue: value,
    });
  });

  test.each([
    ['null', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['number', 42, OcpErrorCodes.INVALID_TYPE],
  ] as const)('classifies a %s second trigger record', (_case, value, code) => {
    const error = captureValidationError(() =>
      convertibleIssuanceDataToDaml({
        ...validInput,
        conversion_triggers: [SAFE_TRIGGER_BASE, value],
      } as never)
    );
    expect(error).toMatchObject({
      code,
      fieldPath: 'convertibleIssuance.conversion_triggers[1]',
      receivedValue: value,
    });
  });

  test.each([
    ['null', null, OcpErrorCodes.INVALID_TYPE],
    ['number', 0, OcpErrorCodes.INVALID_TYPE],
  ] as const)('classifies a %s second trigger_id', (_case, value, code) => {
    const error = captureValidationError(() =>
      convertibleIssuanceDataToDaml({
        ...validInput,
        conversion_triggers: [SAFE_TRIGGER_BASE, { ...SAFE_TRIGGER_BASE, trigger_id: value }],
      } as never)
    );
    expect(error).toMatchObject({
      code,
      fieldPath: 'convertibleIssuance.conversion_triggers[1].trigger_id',
      receivedValue: value,
    });
  });

  it('preserves an empty second trigger_id on write', () => {
    expect(
      convertibleIssuanceDataToDaml({
        ...validInput,
        conversion_triggers: [SAFE_TRIGGER_BASE, { ...SAFE_TRIGGER_BASE, trigger_id: '' }],
      }).conversion_triggers[1]?.trigger_id
    ).toBe('');
  });

  test.each([
    ['null', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['number', 0, OcpErrorCodes.INVALID_TYPE],
    ['malformed', '2024-02-30', OcpErrorCodes.INVALID_FORMAT],
  ] as const)('classifies a %s required issuance date', (_case, value, code) => {
    expect(
      captureValidationError(() => convertibleIssuanceDataToDaml({ ...validInput, date: value } as never))
    ).toMatchObject({ code, fieldPath: 'convertibleIssuance.date', receivedValue: value });
  });

  test.each([
    ['null monetary', null, 'convertibleIssuance.investment_amount', OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['scalar monetary', false, 'convertibleIssuance.investment_amount', OcpErrorCodes.INVALID_TYPE],
    [
      'missing amount',
      { currency: 'USD' },
      'convertibleIssuance.investment_amount.amount',
      OcpErrorCodes.REQUIRED_FIELD_MISSING,
    ],
    [
      'wrong amount',
      { amount: false, currency: 'USD' },
      'convertibleIssuance.investment_amount.amount',
      OcpErrorCodes.INVALID_TYPE,
    ],
    [
      'missing currency',
      { amount: '1', currency: null },
      'convertibleIssuance.investment_amount.currency',
      OcpErrorCodes.INVALID_TYPE,
    ],
  ] as const)('classifies a %s', (_case, value, fieldPath, code) => {
    expect(
      captureValidationError(() => convertibleIssuanceDataToDaml({ ...validInput, investment_amount: value } as never))
    ).toMatchObject({ code, fieldPath });
  });

  test.each([
    ['null exemptions', 'security_law_exemptions', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['record exemptions', 'security_law_exemptions', {}, OcpErrorCodes.INVALID_TYPE],
    ['null comments', 'comments', null, OcpErrorCodes.INVALID_TYPE],
  ] as const)('classifies %s', (_case, field, value, code) => {
    expect(
      captureValidationError(() => encodeRuntimeConvertibleInput({ ...validInput, [field]: value }))
    ).toMatchObject({ code, fieldPath: `convertibleIssuance.${field}`, receivedValue: value });
  });

  test.each([
    ['explicit null', null, OcpErrorCodes.INVALID_TYPE],
    ['number', 42, OcpErrorCodes.INVALID_TYPE],
  ] as const)('rejects an optional stock-class target that is %s', (_case, value, code) => {
    const error = captureValidationError(() =>
      convertibleIssuanceDataToDaml({
        ...validInput,
        conversion_triggers: [
          {
            ...SAFE_TRIGGER_BASE,
            conversion_right: { ...SAFE_TRIGGER_BASE.conversion_right, converts_to_stock_class_id: value },
          },
        ],
      } as never)
    );
    expect(error).toMatchObject({
      code,
      fieldPath: 'convertibleIssuance.conversion_triggers[0].conversion_right.converts_to_stock_class_id',
      receivedValue: value,
    });
  });

  it('preserves an empty optional stock-class target', () => {
    const daml = convertibleIssuanceDataToDaml({
      ...validInput,
      conversion_triggers: [
        {
          ...SAFE_TRIGGER_BASE,
          conversion_right: { ...SAFE_TRIGGER_BASE.conversion_right, converts_to_stock_class_id: '' },
        },
      ],
    });
    expect(daml.conversion_triggers[0]?.conversion_right.converts_to_stock_class_id).toBe('');
  });
});

describe('convertible issuance seniority write boundary', () => {
  const validInput: ConvertibleIssuanceInput = {
    ...BASE_INPUT,
    conversion_triggers: [SAFE_TRIGGER_BASE],
  };

  test.each([
    ['null', null, OcpErrorCodes.INVALID_TYPE],
    ['undefined', undefined, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['numeric string', '1', OcpErrorCodes.INVALID_TYPE],
    ['boolean', false, OcpErrorCodes.INVALID_TYPE],
    ['fractional number', 1.5, OcpErrorCodes.INVALID_FORMAT],
    ['unsafe integer', Number.MAX_SAFE_INTEGER + 1, OcpErrorCodes.OUT_OF_RANGE],
    ['NaN', Number.NaN, OcpErrorCodes.INVALID_FORMAT],
    ['positive infinity', Number.POSITIVE_INFINITY, OcpErrorCodes.INVALID_FORMAT],
  ] as const)('rejects %s before writing DAML', (_case, seniority, code) => {
    try {
      convertibleIssuanceDataToDaml({
        ...validInput,
        seniority,
      } as unknown as Parameters<typeof convertibleIssuanceDataToDaml>[0]);
      throw new Error('Expected seniority validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code,
        fieldPath: 'convertibleIssuance.seniority',
        ...(typeof seniority === 'number' && !Number.isFinite(seniority) ? {} : { receivedValue: seniority }),
      });
    }
  });

  test.each([0, 1, Number.MAX_SAFE_INTEGER])('encodes safe integer %p as a DAML integer string', (seniority) => {
    expect(encodeRuntimeConvertibleInput({ ...validInput, seniority }).seniority).toBe(seniority.toString());
  });
});

describe('write-side conversion mechanism paths', () => {
  it('rejects a bare trigger discriminator at the writer boundary', () => {
    const error = captureError(() =>
      convertibleIssuanceDataToDaml({
        ...BASE_INPUT,
        conversion_triggers: ['AUTOMATIC_ON_DATE'] as unknown as Parameters<
          typeof convertibleIssuanceDataToDaml
        >[0]['conversion_triggers'],
      })
    );

    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: 'convertibleIssuance.conversion_triggers[0]',
      receivedValue: 'AUTOMATIC_ON_DATE',
    });
  });

  it('preserves a caller-provided empty trigger_id', () => {
    expect(
      convertibleIssuanceDataToDaml({
        ...BASE_INPUT,
        conversion_triggers: [{ ...SAFE_TRIGGER_BASE, trigger_id: '' }],
      }).conversion_triggers[0]?.trigger_id
    ).toBe('');
  });

  it('rejects a truthy non-string writer trigger_id', () => {
    const error = captureError(() =>
      convertibleIssuanceDataToDaml({
        ...BASE_INPUT,
        conversion_triggers: [{ ...SAFE_TRIGGER_BASE, trigger_id: 42 }] as unknown as Parameters<
          typeof convertibleIssuanceDataToDaml
        >[0]['conversion_triggers'],
      })
    );

    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: 'convertibleIssuance.conversion_triggers[0].trigger_id',
      receivedValue: 42,
    });
  });

  it('reports the exact trigger index for a malformed nested numeric field', () => {
    const invalidTrigger = {
      ...SAFE_TRIGGER_BASE,
      trigger_id: 'trigger-002',
      conversion_right: {
        type: 'CONVERTIBLE_CONVERSION_RIGHT' as const,
        conversion_mechanism: {
          type: 'FIXED_AMOUNT_CONVERSION' as const,
          converts_to_quantity: '1e2',
        },
      },
    };
    const error = captureError(() =>
      convertibleIssuanceDataToDaml({
        ...BASE_INPUT,
        conversion_triggers: [SAFE_TRIGGER_BASE, invalidTrigger],
      } as unknown as Parameters<typeof convertibleIssuanceDataToDaml>[0])
    );

    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: `${conversionMechanismPath(1)}.converts_to_quantity`,
      receivedValue: '1e2',
    });
  });

  it('reports the exact trigger index for a malformed mechanism enum', () => {
    const invalidTrigger = {
      ...SAFE_TRIGGER_BASE,
      trigger_id: 'trigger-002',
      conversion_right: {
        ...SAFE_TRIGGER_BASE.conversion_right,
        conversion_mechanism: {
          ...SAFE_TRIGGER_BASE.conversion_right.conversion_mechanism,
          conversion_timing: 'POSTMONEY',
        },
      },
    };
    const error = captureError(() =>
      convertibleIssuanceDataToDaml({
        ...BASE_INPUT,
        conversion_triggers: [SAFE_TRIGGER_BASE, invalidTrigger],
      } as unknown as Parameters<typeof convertibleIssuanceDataToDaml>[0])
    );

    expect(error).toBeInstanceOf(OcpParseError);
    expect(error).toMatchObject({ source: `${conversionMechanismPath(1)}.conversion_timing` });
  });
});

// ---------------------------------------------------------------------------
// Read-side (DAML → OCF) exactness tests
// ---------------------------------------------------------------------------

const BASE_DAML = convertibleIssuanceDataToDaml({
  ...BASE_INPUT,
  conversion_triggers: [SAFE_TRIGGER_BASE],
});
const BASE_DAML_SAFE_TRIGGER = requireFirst(BASE_DAML.conversion_triggers, 'base generated SAFE trigger');
if (BASE_DAML_SAFE_TRIGGER.conversion_right.conversion_mechanism.tag !== 'OcfConvMechSAFE') {
  throw new Error('Expected the base generated trigger to contain a SAFE mechanism');
}
const BASE_DAML_NOTE_TRIGGER = requireFirst(
  convertibleIssuanceDataToDaml({
    ...BASE_INPUT,
    convertible_type: 'NOTE',
    conversion_triggers: [
      buildConvertibleNoteTrigger('trigger-001', [{ rate: '0.05', accrual_start_date: '2024-01-15' }]),
    ],
  } as unknown as ConvertibleIssuanceInput).conversion_triggers,
  'base generated note trigger'
);
if (BASE_DAML_NOTE_TRIGGER.conversion_right.conversion_mechanism.tag !== 'OcfConvMechNote') {
  throw new Error('Expected the base generated trigger to contain a note mechanism');
}

function buildDamlSafeTrigger(conversionTiming?: string) {
  const baseRight = BASE_DAML_SAFE_TRIGGER.conversion_right;
  const baseMechanism = baseRight.conversion_mechanism;
  if (baseMechanism.tag !== 'OcfConvMechSAFE') throw new Error('Expected a generated SAFE mechanism');
  return {
    ...BASE_DAML_SAFE_TRIGGER,
    conversion_right: {
      ...baseRight,
      conversion_mechanism: {
        ...baseMechanism,
        value: {
          ...baseMechanism.value,
          conversion_timing: conversionTiming ?? null,
        },
      },
    },
  };
}

function buildDamlSafeTriggerWithDateField(field: TriggerDateField, value: unknown) {
  if (field === 'trigger_date') {
    return {
      ...buildDamlSafeTrigger(),
      type_: 'OcfTriggerTypeTypeAutomaticOnDate',
      trigger_date: value,
    };
  }
  return {
    ...buildDamlSafeTrigger(),
    type_: 'OcfTriggerTypeTypeElectiveInRange',
    start_date: field === 'start_date' ? value : '2024-01-01',
    end_date: field === 'end_date' ? value : '2024-12-31',
  };
}

describe('convertible issuance required read taxonomy', () => {
  test.each([
    ['null', null],
    ['number', 42],
  ] as const)('rejects a structurally invalid %s required date in the generated decoder', (_case, value) => {
    expectGeneratedDecodeError(
      () =>
        damlConvertibleIssuanceDataToNative({
          ...BASE_DAML,
          date: value,
          conversion_triggers: [buildDamlSafeTrigger()],
        }),
      'input.date'
    );
  });

  it('classifies a semantically malformed required date', () => {
    const value = '2024-02-30';
    const error = captureValidationError(() =>
      damlConvertibleIssuanceDataToNative({
        ...BASE_DAML,
        date: value,
        conversion_triggers: [buildDamlSafeTrigger()],
      })
    );
    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'convertibleIssuance.date',
      receivedValue: value,
    });
  });

  test.each([
    ['null', null],
    ['number', 42],
  ] as const)('rejects a structurally invalid %s convertible_type in the generated decoder', (_case, value) => {
    expectGeneratedDecodeError(
      () =>
        damlConvertibleIssuanceDataToNative({
          ...BASE_DAML,
          convertible_type: value,
          conversion_triggers: [buildDamlSafeTrigger()],
        }),
      'input.convertible_type'
    );
  });
});

describe('read-side: required seniority boundary', () => {
  test.each([
    ['null', null],
    ['undefined', undefined],
    ['boolean false', false],
    ['integer number', 1],
    ['non-integer number', 1.5],
    ['non-scalar', { value: 1 }],
  ] as const)('rejects structurally invalid %s in the generated decoder', (_case, seniority) => {
    expectGeneratedDecodeError(
      () =>
        damlConvertibleIssuanceDataToNative({
          ...BASE_DAML,
          seniority,
          conversion_triggers: [buildDamlSafeTrigger()],
        }),
      'input.seniority'
    );
  });

  test.each([
    ['empty string', '', OcpErrorCodes.INVALID_FORMAT],
    ['whitespace string', ' ', OcpErrorCodes.INVALID_FORMAT],
    ['non-integer string', '1.5', OcpErrorCodes.INVALID_FORMAT],
    ['scientific notation', '1e3', OcpErrorCodes.INVALID_FORMAT],
    ['leading plus', '+1', OcpErrorCodes.INVALID_FORMAT],
    ['leading zero', '01', OcpErrorCodes.INVALID_FORMAT],
    ['negative zero', '-0', OcpErrorCodes.INVALID_FORMAT],
  ] as const)('rejects %s instead of coercing it to an integer', (_case, seniority, code) => {
    try {
      damlConvertibleIssuanceDataToNative({
        ...BASE_DAML,
        seniority,
        conversion_triggers: [buildDamlSafeTrigger()],
      });
      throw new Error('Expected seniority validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code,
        fieldPath: 'convertibleIssuance.seniority',
        receivedValue: seniority,
      });
    }
  });

  it('rejects an integer outside JavaScript safe range', () => {
    const seniority = '9007199254740992';
    try {
      damlConvertibleIssuanceDataToNative({
        ...BASE_DAML,
        seniority,
        conversion_triggers: [buildDamlSafeTrigger()],
      });
      throw new Error('Expected seniority validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.OUT_OF_RANGE,
        fieldPath: 'convertibleIssuance.seniority',
        receivedValue: seniority,
      });
    }
  });

  test.each([
    ['zero', '0', 0],
    ['positive', '1', 1],
    ['negative', '-1', -1],
    ['maximum safe integer', String(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER],
    ['minimum safe integer', String(Number.MIN_SAFE_INTEGER), Number.MIN_SAFE_INTEGER],
  ] as const)('accepts a canonical %s DAML Int string', (_case, seniority, expected) => {
    expect(
      damlConvertibleIssuanceDataToNative({
        ...BASE_DAML,
        seniority,
        conversion_triggers: [buildDamlSafeTrigger()],
      }).seniority
    ).toBe(expected);
  });
});

describe('read-side: numeric field diagnostics', () => {
  it('preserves a zero pro_rata value', () => {
    const result = damlConvertibleIssuanceDataToNative({
      ...BASE_DAML,
      pro_rata: '0',
      conversion_triggers: [buildDamlSafeTrigger()],
    });

    expect(result.pro_rata).toBe('0');
  });

  test.each(['1e3', 'not-a-number', ''])('reports malformed pro_rata %p at its OCF field path', (proRata) => {
    try {
      damlConvertibleIssuanceDataToNative({
        ...BASE_DAML,
        pro_rata: proRata,
        conversion_triggers: [buildDamlSafeTrigger()],
      });
      throw new Error('Expected pro_rata validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'convertibleIssuance.pro_rata',
        receivedValue: proRata,
      });
    }
  });

  test.each(['1e3', 'not-a-number', ''])('reports malformed investment amount %p at its OCF field path', (amount) => {
    try {
      damlConvertibleIssuanceDataToNative({
        ...BASE_DAML,
        investment_amount: { amount, currency: 'USD' },
        conversion_triggers: [buildDamlSafeTrigger()],
      });
      throw new Error('Expected investment amount validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'convertibleIssuance.investment_amount.amount',
        receivedValue: amount,
      });
    }
  });
});

function buildDamlNoteTrigger(dayCount: string, interestPayout: string, triggerId = 'trigger-001') {
  const baseRight = BASE_DAML_NOTE_TRIGGER.conversion_right;
  const baseMechanism = baseRight.conversion_mechanism;
  if (baseMechanism.tag !== 'OcfConvMechNote') throw new Error('Expected a generated note mechanism');
  return {
    ...BASE_DAML_NOTE_TRIGGER,
    trigger_id: triggerId,
    conversion_right: {
      ...baseRight,
      conversion_mechanism: {
        ...baseMechanism,
        value: {
          ...baseMechanism.value,
          interest_rates: baseMechanism.value.interest_rates.map((rate) => ({ ...rate })),
          day_count_convention: dayCount,
          interest_payout: interestPayout,
        },
      },
    },
  };
}

type LedgerMonetaryVariant = 'SAFE' | 'VALUATION_BASED' | 'PPS_BASED' | 'NOTE';

function buildDamlTriggerWithMonetaryValue(variant: LedgerMonetaryVariant, monetaryValue: unknown) {
  if (variant === 'SAFE') {
    const trigger = buildDamlSafeTrigger();
    const mechanism = trigger.conversion_right.conversion_mechanism;
    return {
      ...trigger,
      trigger_id: 'trigger-safe',
      conversion_right: {
        ...trigger.conversion_right,
        conversion_mechanism: {
          ...mechanism,
          value: { ...mechanism.value, conversion_valuation_cap: monetaryValue },
        },
      },
    };
  }
  if (variant === 'NOTE') {
    const trigger = buildDamlNoteTrigger('OcfDayCountActual365', 'OcfInterestPayoutDeferred', 'trigger-note');
    const mechanism = trigger.conversion_right.conversion_mechanism;
    return {
      ...trigger,
      conversion_right: {
        ...trigger.conversion_right,
        conversion_mechanism: {
          ...mechanism,
          value: { ...mechanism.value, conversion_valuation_cap: monetaryValue },
        },
      },
    };
  }
  const mechanism = (() => {
    switch (variant) {
      case 'VALUATION_BASED':
        return {
          tag: 'OcfConvMechValuationBased',
          value: { valuation_type: 'PRE_MONEY', valuation_amount: monetaryValue },
        };
      case 'PPS_BASED':
        return {
          tag: 'OcfConvMechPpsBased',
          value: { description: 'Next financing', discount: false, discount_amount: monetaryValue },
        };
    }
  })();

  return {
    type_: 'OcfTriggerTypeTypeElectiveAtWill',
    trigger_id: `trigger-${variant.toLowerCase()}`,
    conversion_right: {
      type_: 'CONVERTIBLE_CONVERSION_RIGHT',
      conversion_mechanism: mechanism,
      converts_to_future_round: true,
    },
  };
}

describe('read-side: convertible monetary boundaries', () => {
  const malformedValues: readonly unknown[] = [0, false, '', []];
  const variants = [
    {
      variant: 'SAFE' as const,
      fieldPath:
        'convertibleIssuance.conversion_triggers[0].conversion_right.conversion_mechanism.conversion_valuation_cap',
    },
    {
      variant: 'NOTE' as const,
      fieldPath:
        'convertibleIssuance.conversion_triggers[0].conversion_right.conversion_mechanism.conversion_valuation_cap',
    },
  ];

  test.each(
    variants.flatMap(({ variant, fieldPath }) => malformedValues.map((value) => ({ variant, fieldPath, value })))
  )('rejects $value for $variant instead of treating it as absent', ({ variant, fieldPath, value }) => {
    expectGeneratedDecodeError(
      () =>
        damlConvertibleIssuanceDataToNative({
          ...BASE_DAML,
          conversion_triggers: [buildDamlTriggerWithMonetaryValue(variant, value)],
        }),
      `input.${fieldPath.replace('convertibleIssuance.', '').replace('.conversion_mechanism.', '.conversion_mechanism.value.')}`
    );
  });

  test.each(['VALUATION_BASED', 'PPS_BASED'] as const)(
    'rejects the non-canonical %s mechanism before interpreting its fields',
    (variant) => {
      try {
        damlConvertibleIssuanceDataToNative({
          ...BASE_DAML,
          conversion_triggers: [buildDamlTriggerWithMonetaryValue(variant, null)],
        });
        throw new Error('Expected non-canonical convertible mechanism to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpParseError);
        expect(error).toMatchObject({ code: OcpErrorCodes.SCHEMA_MISMATCH });
      }
    }
  );

  test.each([
    {
      name: 'keyed wrapper',
      wrap: (right: unknown) => ({ OcfRightConvertible: right }),
    },
    {
      name: 'tagged wrapper',
      wrap: (right: unknown) => ({ tag: 'OcfRightConvertible', value: right }),
    },
  ])('rejects the non-generated $name convertible-right shape', ({ wrap }) => {
    const trigger = buildDamlTriggerWithMonetaryValue('SAFE', null);
    const wrapped = { ...trigger, conversion_right: wrap(trigger.conversion_right) };
    expectGeneratedDecodeError(
      () => damlConvertibleIssuanceDataToNative({ ...BASE_DAML, conversion_triggers: [wrapped] }),
      'input.conversion_triggers[0].conversion_right'
    );
  });
});

describe('read-side conversion mechanism paths', () => {
  it('requires a ledger trigger_id instead of synthesizing one', () => {
    const { trigger_id: _triggerId, ...triggerWithoutId } = buildDamlSafeTrigger();
    expectGeneratedDecodeError(
      () => damlConvertibleIssuanceDataToNative({ ...BASE_DAML, conversion_triggers: [triggerWithoutId] }),
      'input.conversion_triggers[0]',
      'trigger_id'
    );
  });

  it('rejects a bare trigger discriminator read from the ledger', () => {
    expectGeneratedDecodeError(
      () => damlConvertibleIssuanceDataToNative({ ...BASE_DAML, conversion_triggers: ['AUTOMATIC_ON_DATE'] }),
      'input.conversion_triggers[0]'
    );
  });

  it('reports the indexed canonical field for an unknown trigger discriminator', () => {
    expectGeneratedDecodeError(
      () =>
        damlConvertibleIssuanceDataToNative({
          ...BASE_DAML,
          conversion_triggers: [{ ...buildDamlSafeTrigger(), type_: 'OcfTriggerTypeTypeUnknown' }],
        }),
      'input.conversion_triggers[0].type_'
    );
  });

  it('reports the exact path for a missing conversion_right', () => {
    const { conversion_right: _conversionRight, ...triggerWithoutRight } = buildDamlSafeTrigger();
    expectGeneratedDecodeError(
      () => damlConvertibleIssuanceDataToNative({ ...BASE_DAML, conversion_triggers: [triggerWithoutRight] }),
      'input.conversion_triggers[0]',
      'conversion_right'
    );
  });

  test.each([null, 'not-an-object', 42, []])(
    'rejects malformed wrapped convertible conversion-right value %p',
    (value) => {
      const trigger = {
        ...buildDamlSafeTrigger(),
        conversion_right: { OcfRightConvertible: value },
      };
      expectGeneratedDecodeError(
        () => damlConvertibleIssuanceDataToNative({ ...BASE_DAML, conversion_triggers: [trigger] }),
        'input.conversion_triggers[0].conversion_right'
      );
    }
  );

  it('reports the exact trigger index for a malformed nested field', () => {
    const invalidTrigger = {
      ...buildDamlSafeTrigger(),
      trigger_id: 'trigger-002',
      conversion_right: {
        type_: 'CONVERTIBLE_CONVERSION_RIGHT',
        conversion_mechanism: {
          tag: 'OcfConvMechFixedAmount',
          value: { converts_to_quantity: { unexpected: true } },
        },
        converts_to_future_round: true,
      },
    };
    expectGeneratedDecodeError(
      () =>
        damlConvertibleIssuanceDataToNative({
          ...BASE_DAML,
          conversion_triggers: [buildDamlSafeTrigger(), invalidTrigger],
        }),
      'input.conversion_triggers[1].conversion_right.conversion_mechanism',
      'converts_to_quantity'
    );
  });

  it('reports the exact trigger index for a malformed mechanism enum', () => {
    const invalidTrigger = {
      ...buildDamlSafeTrigger('OcfConvTimingInvalidValue'),
      trigger_id: 'trigger-002',
    };
    expectGeneratedDecodeError(
      () =>
        damlConvertibleIssuanceDataToNative({
          ...BASE_DAML,
          conversion_triggers: [buildDamlSafeTrigger(), invalidTrigger],
        }),
      'input.conversion_triggers[1].conversion_right.conversion_mechanism.value.conversion_timing'
    );
  });
});

describe('read-side: conversion_timing exact DAML constructor matching', () => {
  it('OcfConvTimingPreMoney → PRE_MONEY', () => {
    const result = damlConvertibleIssuanceDataToNative({
      ...BASE_DAML,
      conversion_triggers: [buildDamlSafeTrigger('OcfConvTimingPreMoney')],
    });
    const mech = requireFirst(result.conversion_triggers, 'native conversion trigger').conversion_right
      .conversion_mechanism as {
      type: string;
      conversion_timing?: string;
    };
    expect(mech.conversion_timing).toBe('PRE_MONEY');
  });

  it('OcfConvTimingPostMoney → POST_MONEY', () => {
    const result = damlConvertibleIssuanceDataToNative({
      ...BASE_DAML,
      conversion_triggers: [buildDamlSafeTrigger('OcfConvTimingPostMoney')],
    });
    const mech = requireFirst(result.conversion_triggers, 'native conversion trigger').conversion_right
      .conversion_mechanism as {
      type: string;
      conversion_timing?: string;
    };
    expect(mech.conversion_timing).toBe('POST_MONEY');
  });

  it('absent conversion_timing → field is absent', () => {
    const result = damlConvertibleIssuanceDataToNative({
      ...BASE_DAML,
      conversion_triggers: [buildDamlSafeTrigger()],
    });
    const mech = requireFirst(result.conversion_triggers, 'native conversion trigger').conversion_right
      .conversion_mechanism as {
      type: string;
      conversion_timing?: string;
    };
    expect(mech.conversion_timing).toBeUndefined();
  });

  it('unrecognized constructor throws OcpParseError', () => {
    expectParseErrorSource(
      () =>
        damlConvertibleIssuanceDataToNative({
          ...BASE_DAML,
          conversion_triggers: [buildDamlSafeTrigger('OcfConvTimingInvalidValue')],
        }),
      'convertibleIssuance.conversion_triggers[0].conversion_right.conversion_mechanism.conversion_timing'
    );
  });
});

describe('read-side: day_count_convention and interest_payout exact DAML constructor matching', () => {
  it('OcfDayCountActual365 → ACTUAL_365', () => {
    const result = damlConvertibleIssuanceDataToNative({
      ...BASE_DAML,
      convertible_type: 'OcfConvertibleNote',
      conversion_triggers: [buildDamlNoteTrigger('OcfDayCountActual365', 'OcfInterestPayoutDeferred')],
    });
    const mech = requireFirst(result.conversion_triggers, 'native conversion trigger').conversion_right
      .conversion_mechanism as {
      type: string;
      day_count_convention?: string;
      interest_payout?: string;
    };
    expect(mech.day_count_convention).toBe('ACTUAL_365');
  });

  it('OcfDayCount30_360 → 30_360', () => {
    const result = damlConvertibleIssuanceDataToNative({
      ...BASE_DAML,
      convertible_type: 'OcfConvertibleNote',
      conversion_triggers: [buildDamlNoteTrigger('OcfDayCount30_360', 'OcfInterestPayoutCash')],
    });
    const mech = requireFirst(result.conversion_triggers, 'native conversion trigger').conversion_right
      .conversion_mechanism as {
      type: string;
      day_count_convention?: string;
    };
    expect(mech.day_count_convention).toBe('30_360');
  });

  it('OcfInterestPayoutDeferred → DEFERRED', () => {
    const result = damlConvertibleIssuanceDataToNative({
      ...BASE_DAML,
      convertible_type: 'OcfConvertibleNote',
      conversion_triggers: [buildDamlNoteTrigger('OcfDayCountActual365', 'OcfInterestPayoutDeferred')],
    });
    const mech = requireFirst(result.conversion_triggers, 'native conversion trigger').conversion_right
      .conversion_mechanism as {
      type: string;
      interest_payout?: string;
    };
    expect(mech.interest_payout).toBe('DEFERRED');
  });

  it('OcfInterestPayoutCash → CASH', () => {
    const result = damlConvertibleIssuanceDataToNative({
      ...BASE_DAML,
      convertible_type: 'OcfConvertibleNote',
      conversion_triggers: [buildDamlNoteTrigger('OcfDayCountActual365', 'OcfInterestPayoutCash')],
    });
    const mech = requireFirst(result.conversion_triggers, 'native conversion trigger').conversion_right
      .conversion_mechanism as {
      type: string;
      interest_payout?: string;
    };
    expect(mech.interest_payout).toBe('CASH');
  });

  it('unrecognized day_count_convention throws OcpParseError', () => {
    expectParseErrorSource(
      () =>
        damlConvertibleIssuanceDataToNative({
          ...BASE_DAML,
          convertible_type: 'OcfConvertibleNote',
          conversion_triggers: [buildDamlNoteTrigger('OcfDayCountWrong', 'OcfInterestPayoutCash')],
        }),
      'convertibleIssuance.conversion_triggers[0].conversion_right.conversion_mechanism.day_count_convention'
    );
  });

  it('unrecognized interest_payout throws OcpParseError', () => {
    expectParseErrorSource(
      () =>
        damlConvertibleIssuanceDataToNative({
          ...BASE_DAML,
          convertible_type: 'OcfConvertibleNote',
          conversion_triggers: [buildDamlNoteTrigger('OcfDayCountActual365', 'OcfInterestPayoutWrong')],
        }),
      'convertibleIssuance.conversion_triggers[0].conversion_right.conversion_mechanism.interest_payout'
    );
  });

  test.each([
    ['interest_accrual_period', 'OcfAccrualWrong'],
    ['compounding_type', 'OcfCompoundingWrong'],
  ] as const)('attributes an unknown %s to its exact mechanism path', (field, value) => {
    const trigger = buildDamlNoteTrigger('OcfDayCountActual365', 'OcfInterestPayoutCash');
    (trigger.conversion_right.conversion_mechanism.value as unknown as Record<string, unknown>)[field] = value;

    expectParseErrorSource(
      () =>
        damlConvertibleIssuanceDataToNative({
          ...BASE_DAML,
          convertible_type: 'OcfConvertibleNote',
          conversion_triggers: [trigger],
        }),
      `convertibleIssuance.conversion_triggers[0].conversion_right.conversion_mechanism.${field}`
    );
  });

  it('attributes an unknown DAML trigger tag to the exact second trigger', () => {
    expectParseErrorSource(
      () =>
        damlConvertibleIssuanceDataToNative({
          ...BASE_DAML,
          conversion_triggers: [
            buildDamlSafeTrigger(),
            { ...buildDamlSafeTrigger(), trigger_id: 'trigger-002', type_: 'OcfTriggerTypeTypeWrong' },
          ],
        }),
      'convertibleIssuance.conversion_triggers[1].type_'
    );
  });
});

describe('SAFE conversion_timing round-trip', () => {
  function roundTrip(conversionTiming: 'PRE_MONEY' | 'POST_MONEY' | undefined) {
    const input: Parameters<typeof convertibleIssuanceDataToDaml>[0] = {
      ...BASE_INPUT,
      conversion_triggers: [
        {
          ...SAFE_TRIGGER_BASE,
          conversion_right: {
            ...SAFE_TRIGGER_BASE.conversion_right,
            conversion_mechanism: {
              ...SAFE_TRIGGER_BASE.conversion_right.conversion_mechanism,
              ...(conversionTiming ? { conversion_timing: conversionTiming } : {}),
            },
          },
        },
      ],
    };
    const daml = encodeRuntimeConvertibleInput(input);
    return damlConvertibleIssuanceDataToNative(daml);
  }

  it('POST_MONEY survives OCF → DAML → OCF round-trip', () => {
    const result = roundTrip('POST_MONEY');
    const mech = requireFirst(result.conversion_triggers, 'native conversion trigger').conversion_right
      .conversion_mechanism as {
      type: string;
      conversion_timing?: string;
    };
    expect(mech.type).toBe('SAFE_CONVERSION');
    expect(mech.conversion_timing).toBe('POST_MONEY');
  });

  it('PRE_MONEY survives OCF → DAML → OCF round-trip', () => {
    const result = roundTrip('PRE_MONEY');
    const mech = requireFirst(result.conversion_triggers, 'native conversion trigger').conversion_right
      .conversion_mechanism as {
      type: string;
      conversion_timing?: string;
    };
    expect(mech.type).toBe('SAFE_CONVERSION');
    expect(mech.conversion_timing).toBe('PRE_MONEY');
  });
});

describe('convertible issuance approval-date read boundaries', () => {
  test.each(['board_approval_date', 'stockholder_approval_date'] as const)(
    'rejects a present non-string %s',
    (field) => {
      const invalidDate = { seconds: 1 };
      const daml = convertibleIssuanceDataToDaml({
        ...BASE_INPUT,
        conversion_triggers: [SAFE_TRIGGER_BASE],
      });
      expectGeneratedDecodeError(
        () => damlConvertibleIssuanceDataToNative({ ...daml, [field]: invalidDate }),
        `input.${field}`
      );
    }
  );

  it('decodes only the required AUTOMATIC_ON_DATE trigger_date', () => {
    const trigger = {
      ...buildDamlSafeTrigger(),
      type_: 'OcfTriggerTypeTypeAutomaticOnDate',
      trigger_date: '2024-01-15T23:30:00-05:00',
      start_date: null,
      end_date: null,
    };
    const result = damlConvertibleIssuanceDataToNative({ ...BASE_DAML, conversion_triggers: [trigger] });

    expect(result.conversion_triggers[0]).toMatchObject({ type: 'AUTOMATIC_ON_DATE', trigger_date: '2024-01-15' });
    expect(result.conversion_triggers[0]).not.toHaveProperty('start_date');
    expect(result.conversion_triggers[0]).not.toHaveProperty('end_date');
  });

  it('rejects a missing required AUTOMATIC_ON_DATE trigger_date on readback', () => {
    expectInvalidDate(
      () =>
        damlConvertibleIssuanceDataToNative({
          ...BASE_DAML,
          conversion_triggers: [
            { ...buildDamlSafeTrigger(), type_: 'OcfTriggerTypeTypeAutomaticOnDate', trigger_date: null },
          ],
        }),
      'convertibleIssuance.conversion_triggers[0].trigger_date',
      null,
      OcpErrorCodes.REQUIRED_FIELD_MISSING
    );
  });

  test.each(['trigger_date', 'start_date', 'end_date'] as const)(
    'rejects a present non-string conversion trigger %s',
    (field) => {
      const invalidDate = { seconds: 1 };
      expectGeneratedDecodeError(
        () =>
          damlConvertibleIssuanceDataToNative({
            ...BASE_DAML,
            conversion_triggers: [buildDamlSafeTriggerWithDateField(field, invalidDate)],
          }),
        `input.conversion_triggers[0].${field}`
      );
    }
  );

  it('decodes only the required ELECTIVE_IN_RANGE start and end dates', () => {
    const trigger = {
      ...buildDamlSafeTrigger(),
      type_: 'OcfTriggerTypeTypeElectiveInRange',
      trigger_date: null,
      start_date: '2024-01-15T00:00:00Z',
      end_date: '2024-02-15T00:00:00Z',
    };
    const result = damlConvertibleIssuanceDataToNative({ ...BASE_DAML, conversion_triggers: [trigger] });

    expect(result.conversion_triggers[0]).toMatchObject({
      type: 'ELECTIVE_IN_RANGE',
      start_date: '2024-01-15',
      end_date: '2024-02-15',
    });
    expect(result.conversion_triggers[0]).not.toHaveProperty('trigger_date');
  });

  it('rejects date fields forbidden by the trigger discriminator on readback', () => {
    expectInvalidDate(
      () =>
        damlConvertibleIssuanceDataToNative({
          ...BASE_DAML,
          conversion_triggers: [{ ...buildDamlSafeTrigger(), trigger_date: '2024-01-15T00:00:00Z' }],
        }),
      'convertibleIssuance.conversion_triggers[0].trigger_date',
      '2024-01-15T00:00:00Z',
      OcpErrorCodes.SCHEMA_MISMATCH
    );
  });

  test.each(['trigger_date', 'start_date', 'end_date'] as const)(
    'rejects a present empty conversion trigger %s',
    (field) => {
      expectInvalidDate(
        () =>
          damlConvertibleIssuanceDataToNative({
            ...BASE_DAML,
            conversion_triggers: [buildDamlSafeTriggerWithDateField(field, '')],
          }),
        `convertibleIssuance.conversion_triggers[0].${field}`,
        '',
        OcpErrorCodes.INVALID_FORMAT
      );
    }
  );

  test.each(['trigger_date', 'start_date', 'end_date'] as const)(
    'omits a null or absent conversion trigger %s',
    (field) => {
      const withNull = damlConvertibleIssuanceDataToNative({
        ...BASE_DAML,
        conversion_triggers: [{ ...buildDamlSafeTrigger(), [field]: null }],
      }).conversion_triggers[0] as unknown as Record<string, unknown>;
      const withoutField = damlConvertibleIssuanceDataToNative({
        ...BASE_DAML,
        conversion_triggers: [buildDamlSafeTrigger()],
      }).conversion_triggers[0] as unknown as Record<string, unknown>;

      expect(withNull[field]).toBeUndefined();
      expect(withoutField[field]).toBeUndefined();
    }
  );

  test.each([
    ['empty', '', OcpErrorCodes.INVALID_FORMAT],
    ['non-string', { seconds: 1 }, OcpErrorCodes.INVALID_TYPE],
  ] as const)('rejects a present invalid note accrual_end_date on readback when %s', (_case, invalidDate, code) => {
    const trigger = buildDamlNoteTrigger('OcfDayCountActual365', 'OcfInterestPayoutCash');
    const mechanism = trigger.conversion_right.conversion_mechanism;
    mechanism.value.interest_rates[0] = {
      ...mechanism.value.interest_rates[0],
      accrual_end_date: invalidDate,
    } as unknown as (typeof mechanism.value.interest_rates)[number];

    const action = () =>
      damlConvertibleIssuanceDataToNative({
        ...BASE_DAML,
        convertible_type: 'OcfConvertibleNote',
        conversion_triggers: [trigger],
      });
    if (typeof invalidDate === 'string') {
      expectInvalidDate(action, `${noteInterestRatePath()}.accrual_end_date`, invalidDate, code);
    } else {
      expectGeneratedDecodeError(
        action,
        'input.conversion_triggers[0].conversion_right.conversion_mechanism.value.interest_rates[0].accrual_end_date'
      );
    }
  });

  test('reports the exact trigger and interest-rate indexes on readback', () => {
    const firstTrigger = buildDamlNoteTrigger('OcfDayCountActual365', 'OcfInterestPayoutCash');
    const secondTrigger = buildDamlNoteTrigger('OcfDayCountActual365', 'OcfInterestPayoutCash', 'trigger-002');
    const mechanism = secondTrigger.conversion_right.conversion_mechanism;
    mechanism.value.interest_rates.push({ rate: '0.06', accrual_start_date: '', accrual_end_date: null });

    expectInvalidDate(
      () =>
        damlConvertibleIssuanceDataToNative({
          ...BASE_DAML,
          convertible_type: 'OcfConvertibleNote',
          conversion_triggers: [firstTrigger, secondTrigger],
        }),
      `${noteInterestRatePath(1, 1)}.accrual_start_date`,
      ''
    );
  });

  test.each([
    ['null', null],
    ['array', []],
    ['primitive', 'not-an-interest-rate'],
  ] as const)('rejects a %s interest-rate element with an indexed structured error', (_case, invalidRate) => {
    const trigger = buildDamlNoteTrigger('OcfDayCountActual365', 'OcfInterestPayoutCash');
    const mechanism = trigger.conversion_right.conversion_mechanism;
    (mechanism.value.interest_rates as unknown[]).push(invalidRate);

    expectGeneratedDecodeError(
      () =>
        damlConvertibleIssuanceDataToNative({
          ...BASE_DAML,
          convertible_type: 'OcfConvertibleNote',
          conversion_triggers: [trigger],
        }),
      'input.conversion_triggers[0].conversion_right.conversion_mechanism',
      'interest_rates[1]'
    );
  });

  test.each([
    ['record', { bad: true }],
    ['primitive', 'not-interest-rates'],
    ['number', 42],
  ] as const)('rejects a present %s interest_rates collection', (_case, invalidRates) => {
    const trigger = buildDamlNoteTrigger('OcfDayCountActual365', 'OcfInterestPayoutCash');
    const mechanism = trigger.conversion_right.conversion_mechanism;
    mechanism.value.interest_rates = invalidRates as never;

    expectGeneratedDecodeError(
      () =>
        damlConvertibleIssuanceDataToNative({
          ...BASE_DAML,
          convertible_type: 'OcfConvertibleNote',
          conversion_triggers: [trigger],
        }),
      'input.conversion_triggers[0].conversion_right.conversion_mechanism',
      'interest_rates'
    );
  });

  test('omits a null note accrual_end_date on readback', () => {
    const trigger = buildDamlNoteTrigger('OcfDayCountActual365', 'OcfInterestPayoutCash');
    const mechanism = trigger.conversion_right.conversion_mechanism;
    mechanism.value.interest_rates[0] = {
      ...mechanism.value.interest_rates[0],
      accrual_end_date: null,
    } as unknown as (typeof mechanism.value.interest_rates)[number];

    const result = damlConvertibleIssuanceDataToNative({
      ...BASE_DAML,
      convertible_type: 'OcfConvertibleNote',
      conversion_triggers: [trigger],
    });
    const nativeTrigger = requireFirst(result.conversion_triggers, 'converted note trigger');
    const nativeMechanism = nativeTrigger.conversion_right.conversion_mechanism as {
      interest_rates: Array<{ accrual_end_date?: string }>;
    };

    expect(
      requireFirst(nativeMechanism.interest_rates, 'converted note interest rate').accrual_end_date
    ).toBeUndefined();
  });
});

describe('convertible issuance write field boundaries', () => {
  it('reports a malformed investment amount at its OCF field path', () => {
    const amount = '1e3';
    try {
      convertibleIssuanceDataToDaml({
        ...BASE_INPUT,
        investment_amount: { amount, currency: 'USD' },
        conversion_triggers: [SAFE_TRIGGER_BASE],
      });
      throw new Error('Expected investment amount validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'convertibleIssuance.investment_amount.amount',
        receivedValue: amount,
      });
    }
  });

  it('reports a malformed mechanism field on the exact second trigger', () => {
    const conversionDiscount = '1e3';
    try {
      convertibleIssuanceDataToDaml({
        ...BASE_INPUT,
        conversion_triggers: [
          SAFE_TRIGGER_BASE,
          {
            ...SAFE_TRIGGER_BASE,
            trigger_id: 'trigger-002',
            conversion_right: {
              ...SAFE_TRIGGER_BASE.conversion_right,
              conversion_mechanism: {
                ...SAFE_TRIGGER_BASE.conversion_right.conversion_mechanism,
                conversion_discount: conversionDiscount,
              },
            },
          },
        ],
      });
      throw new Error('Expected conversion discount validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath:
          'convertibleIssuance.conversion_triggers[1].conversion_right.conversion_mechanism.conversion_discount',
        receivedValue: conversionDiscount,
      });
    }
  });

  test.each(['1e3', 'not-a-number', ''])('reports malformed note interest rate %p at its OCF field path', (rate) => {
    try {
      convertibleIssuanceDataToDaml(buildConvertibleNoteInput({ rate, accrual_start_date: '2024-01-15' }));
      throw new Error('Expected interest rate validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: `${NOTE_INTEREST_RATE_WRITE_PATH}.rate`,
        receivedValue: rate,
      });
    }
  });

  it('indexes a malformed second interest rate on the second note trigger', () => {
    const rate = '1e3';
    const input = buildConvertibleNoteInput({ rate: '0.05', accrual_start_date: '2024-01-15' });
    const firstTrigger = requireFirst(input.conversion_triggers, 'first note trigger');
    const mechanism = firstTrigger.conversion_right.conversion_mechanism;
    if (mechanism.type !== 'CONVERTIBLE_NOTE_CONVERSION') throw new Error('Expected a note conversion mechanism');

    try {
      convertibleIssuanceDataToDaml({
        ...input,
        conversion_triggers: [
          firstTrigger,
          {
            ...firstTrigger,
            trigger_id: 'trigger-002',
            conversion_right: {
              ...firstTrigger.conversion_right,
              conversion_mechanism: {
                ...mechanism,
                interest_rates: [...mechanism.interest_rates, { rate, accrual_start_date: '2024-02-15' }],
              },
            },
          },
        ],
      });
      throw new Error('Expected second interest rate validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath:
          'convertibleIssuance.conversion_triggers[1].conversion_right.conversion_mechanism.interest_rates[1].rate',
        receivedValue: rate,
      });
    }
  });

  test('reports the contextual field path for an invalid required date', () => {
    expectInvalidDate(
      () =>
        convertibleIssuanceDataToDaml({
          ...BASE_INPUT,
          date: '',
          conversion_triggers: [SAFE_TRIGGER_BASE],
        }),
      'convertibleIssuance.date',
      ''
    );
  });

  test.each(['board_approval_date', 'stockholder_approval_date'] as const)(
    'validates a present %s instead of treating a falsy value as absent',
    (field) => {
      expectInvalidDate(
        () =>
          convertibleIssuanceDataToDaml({
            ...BASE_INPUT,
            conversion_triggers: [SAFE_TRIGGER_BASE],
            [field]: '',
          }),
        `convertibleIssuance.${field}`,
        ''
      );
    }
  );

  test.each(['board_approval_date', 'stockholder_approval_date'] as const)(
    'rejects non-canonical present values for optional %s',
    (field) => {
      const invalidDate = { seconds: 1 };
      expectInvalidDate(
        () =>
          convertibleIssuanceDataToDaml({
            ...BASE_INPUT,
            conversion_triggers: [SAFE_TRIGGER_BASE],
            [field]: invalidDate,
          }),
        `convertibleIssuance.${field}`,
        invalidDate,
        OcpErrorCodes.INVALID_TYPE
      );

      for (const { value, code } of [
        { value: null, code: OcpErrorCodes.INVALID_TYPE },
        { value: undefined, code: OcpErrorCodes.REQUIRED_FIELD_MISSING },
      ]) {
        expect(
          captureValidationError(() =>
            convertibleIssuanceDataToDaml({
              ...BASE_INPUT,
              conversion_triggers: [SAFE_TRIGGER_BASE],
              [field]: value,
            })
          )
        ).toMatchObject({ code, fieldPath: `convertibleIssuance.${field}` });
      }
    }
  );

  it('encodes the required AUTOMATIC_ON_DATE trigger_date and no range dates', () => {
    const result = convertibleIssuanceDataToDaml({
      ...BASE_INPUT,
      conversion_triggers: [{ ...SAFE_TRIGGER_BASE, type: 'AUTOMATIC_ON_DATE', trigger_date: '2024-01-15' }],
    });

    expect(result.conversion_triggers[0]).toMatchObject({
      trigger_date: '2024-01-15T00:00:00.000Z',
      start_date: null,
      end_date: null,
    });
  });

  it('encodes the required ELECTIVE_IN_RANGE dates and no trigger_date', () => {
    const result = convertibleIssuanceDataToDaml({
      ...BASE_INPUT,
      conversion_triggers: [
        {
          ...SAFE_TRIGGER_BASE,
          type: 'ELECTIVE_IN_RANGE',
          start_date: '2024-01-15',
          end_date: '2024-02-15',
        },
      ],
    });

    expect(result.conversion_triggers[0]).toMatchObject({
      trigger_date: null,
      start_date: '2024-01-15T00:00:00.000Z',
      end_date: '2024-02-15T00:00:00.000Z',
    });
  });

  it('rejects date fields forbidden by the trigger discriminator on write', () => {
    expectInvalidDate(
      () =>
        convertibleIssuanceDataToDaml({
          ...BASE_INPUT,
          conversion_triggers: [
            { ...SAFE_TRIGGER_BASE, trigger_date: '2024-01-15' } as unknown as ConvertibleConversionTrigger,
          ],
        }),
      'convertibleIssuance.conversion_triggers[0].trigger_date',
      '2024-01-15',
      OcpErrorCodes.INVALID_FORMAT
    );
  });

  test.each(['trigger_date', 'start_date', 'end_date'] as const)(
    'validates a present conversion trigger %s instead of treating a falsy value as absent',
    (field) => {
      expectInvalidDate(
        () =>
          convertibleIssuanceDataToDaml({
            ...BASE_INPUT,
            conversion_triggers: [convertibleTriggerWithDateField(field, '')],
          }),
        `convertibleIssuance.conversion_triggers[0].${field}`,
        ''
      );
    }
  );

  test.each(['trigger_date', 'start_date', 'end_date'] as const)(
    'rejects invalid required conversion trigger %s values',
    (field) => {
      const invalidDate = { seconds: 1 };
      expectInvalidDate(
        () =>
          convertibleIssuanceDataToDaml({
            ...BASE_INPUT,
            conversion_triggers: [convertibleTriggerWithDateField(field, invalidDate)],
          }),
        `convertibleIssuance.conversion_triggers[0].${field}`,
        invalidDate,
        OcpErrorCodes.INVALID_TYPE
      );

      for (const value of [null, undefined]) {
        expectInvalidDate(
          () =>
            convertibleIssuanceDataToDaml({
              ...BASE_INPUT,
              conversion_triggers: [convertibleTriggerWithDateField(field, value)],
            }),
          `convertibleIssuance.conversion_triggers[0].${field}`,
          value,
          OcpErrorCodes.REQUIRED_FIELD_MISSING
        );
      }
    }
  );

  test.each([
    ['null', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['undefined', undefined, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['empty', '', OcpErrorCodes.INVALID_FORMAT],
    ['non-string', { seconds: 1 }, OcpErrorCodes.INVALID_TYPE],
  ] as const)('rejects a required note accrual_start_date when %s', (_case, value, code) => {
    expectInvalidDate(
      () => convertibleIssuanceDataToDaml(buildConvertibleNoteInput({ rate: '0.05', accrual_start_date: value })),
      `${noteInterestRatePath()}.accrual_start_date`,
      value,
      code
    );
  });

  test('reports the exact trigger and interest-rate indexes on write', () => {
    const input = {
      ...BASE_INPUT,
      convertible_type: 'NOTE',
      conversion_triggers: [
        buildConvertibleNoteTrigger('trigger-001', [{ rate: '0.05', accrual_start_date: '2024-01-15' }]),
        buildConvertibleNoteTrigger('trigger-002', [
          { rate: '0.05', accrual_start_date: '2024-01-15' },
          { rate: '0.06', accrual_start_date: '' },
        ]),
      ],
    } as unknown as Parameters<typeof convertibleIssuanceDataToDaml>[0];

    expectInvalidDate(
      () => convertibleIssuanceDataToDaml(input),
      `${noteInterestRatePath(1, 1)}.accrual_start_date`,
      ''
    );
  });

  test.each([
    ['null', null],
    ['array', []],
    ['primitive', 'not-an-interest-rate'],
  ] as const)('rejects a %s interest-rate element on write with an indexed structured error', (_case, invalidRate) => {
    const error = captureError(() => convertibleIssuanceDataToDaml(buildConvertibleNoteInput(invalidRate)));

    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: noteInterestRatePath(),
      expectedType: 'object',
      receivedValue: invalidRate,
    });
  });

  test('rejects a non-numeric-shaped interest rate with its indexed field path', () => {
    const invalidRate = { value: '0.05' };
    const error = captureError(() =>
      convertibleIssuanceDataToDaml(buildConvertibleNoteInput({ rate: invalidRate, accrual_start_date: '2024-01-15' }))
    );

    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: `${noteInterestRatePath()}.rate`,
      expectedType: 'OCF percentage decimal string',
      receivedValue: invalidRate,
    });
  });

  test.each([
    ['empty', '', OcpErrorCodes.INVALID_FORMAT],
    ['non-string', { seconds: 1 }, OcpErrorCodes.INVALID_TYPE],
  ] as const)('rejects a present optional note accrual_end_date when %s', (_case, value, code) => {
    expectInvalidDate(
      () =>
        convertibleIssuanceDataToDaml(
          buildConvertibleNoteInput({ rate: '0.05', accrual_start_date: '2024-01-15', accrual_end_date: value })
        ),
      `${noteInterestRatePath()}.accrual_end_date`,
      value,
      code
    );
  });

  test.each([
    [null, OcpErrorCodes.INVALID_TYPE],
    [undefined, OcpErrorCodes.REQUIRED_FIELD_MISSING],
  ] as const)('rejects non-canonical optional note accrual_end_date %p', (value, code) => {
    expect(
      captureValidationError(() =>
        convertibleIssuanceDataToDaml(
          buildConvertibleNoteInput({ rate: '0.05', accrual_start_date: '2024-01-15', accrual_end_date: value })
        )
      )
    ).toMatchObject({ code, fieldPath: `${noteInterestRatePath()}.accrual_end_date` });
  });
});

/**
 * Uses the production SAFE post-money fixture to exercise the full converter path:
 * AUTOMATIC_ON_CONDITION trigger, capitalization_definition_rules, converts_to_future_round,
 * and valuation cap — all fields that the synthetic BASE_INPUT omits.
 */
describe('POST_MONEY SAFE – production fixture round-trip', () => {
  it('preserves POST_MONEY timing, trigger type, converts_to_future_round, and cap_def_rules from production fixture', () => {
    const fixture = parseOcfEntityInput(
      'convertibleIssuance',
      stripSourceMetadata(loadProductionFixture('convertibleIssuance', 'safe-post-money'))
    );
    const daml = convertibleIssuanceDataToDaml(fixture);
    const result = damlConvertibleIssuanceDataToNative(daml);

    const trigger = requireFirst(result.conversion_triggers, 'production fixture conversion trigger');
    const right = trigger.conversion_right;
    const mech = right.conversion_mechanism as {
      type: string;
      conversion_timing?: string;
      conversion_mfn?: boolean;
      conversion_valuation_cap?: { amount: string; currency: string };
      capitalization_definition_rules?: Record<string, boolean>;
    };

    // Timing must survive the full path using a real AUTOMATIC_ON_CONDITION trigger
    expect(trigger.type).toBe('AUTOMATIC_ON_CONDITION');
    expect(mech.type).toBe('SAFE_CONVERSION');
    expect(mech.conversion_timing).toBe('POST_MONEY');

    // Conversion right metadata
    expect(right.converts_to_future_round).toBe(true);

    // Cap definition rules are a richer object absent from synthetic tests
    expect(mech.capitalization_definition_rules).toBeDefined();
    expect(mech.capitalization_definition_rules?.include_outstanding_shares).toBe(true);
    expect(mech.capitalization_definition_rules?.include_new_money).toBe(false);

    // Valuation cap round-trips correctly
    expect(mech.conversion_valuation_cap?.amount).toBe('10000000');
    expect(mech.conversion_valuation_cap?.currency).toBe('USD');
  });
});
