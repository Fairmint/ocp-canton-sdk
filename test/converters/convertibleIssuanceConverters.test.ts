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

import { OcpErrorCodes, OcpParseError, OcpValidationError, type OcpErrorCode } from '../../src/errors';
import { convertibleIssuanceDataToDaml } from '../../src/functions/OpenCapTable/convertibleIssuance/createConvertibleIssuance';
import { damlConvertibleIssuanceDataToNative } from '../../src/functions/OpenCapTable/convertibleIssuance/getConvertibleIssuanceAsOcf';
import type { ConvertibleConversionTrigger } from '../../src/types/native';
import { requireFirst } from '../../src/utils/requireDefined';
import { loadProductionFixture } from '../utils/productionFixtures';

const BASE_INPUT = {
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

function expectInvalidDate(
  action: () => unknown,
  fieldPath: string,
  receivedValue: unknown,
  code: OcpErrorCode = OcpErrorCodes.INVALID_FORMAT
): void {
  try {
    action();
    throw new Error('Expected date validation to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error).toMatchObject({ code, fieldPath, receivedValue });
  }
}

const NOTE_INTEREST_RATE_PATH =
  'convertibleIssuance.conversion_triggers[].conversion_right.conversion_mechanism.interest_rates[]';
const NOTE_INTEREST_RATE_READ_PATH =
  'convertibleIssuance.conversion_triggers.0.conversion_right.conversion_mechanism.interest_rates.0';

function buildConvertibleNoteInput(interestRate: Record<string, unknown>) {
  return {
    ...BASE_INPUT,
    convertible_type: 'NOTE',
    conversion_triggers: [
      {
        ...SAFE_TRIGGER_BASE,
        conversion_right: {
          type: 'CONVERTIBLE_CONVERSION_RIGHT',
          conversion_mechanism: {
            type: 'CONVERTIBLE_NOTE_CONVERSION',
            interest_rates: [interestRate],
            day_count_convention: 'ACTUAL_365',
            interest_payout: 'CASH',
            interest_accrual_period: 'ANNUAL',
            compounding_type: 'SIMPLE',
          },
        },
      },
    ],
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

    const daml = convertibleIssuanceDataToDaml(input);
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

    const daml = convertibleIssuanceDataToDaml(input);
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

    const daml = convertibleIssuanceDataToDaml(input);
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
      fieldPath: 'convertibleIssuance.conversion_triggers.0.type',
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

  it('rejects an empty required custom_id on ledger readback', () => {
    const daml = convertibleIssuanceDataToDaml(validInput);

    try {
      damlConvertibleIssuanceDataToNative({ ...daml, custom_id: '' });
      throw new Error('Expected custom_id validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'convertibleIssuance.custom_id',
        receivedValue: '',
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Read-side (DAML → OCF) exactness tests
// ---------------------------------------------------------------------------

const BASE_DAML = {
  id: 'conv-001',
  date: '2024-01-15',
  security_id: 'sec-001',
  custom_id: 'SAFE-1',
  stakeholder_id: 'sh-001',
  investment_amount: { amount: '500000', currency: 'USD' },
  convertible_type: 'OcfConvertibleSafe',
  security_law_exemptions: [],
  seniority: 1,
};

function buildDamlSafeTrigger(conversionTiming?: string) {
  return {
    type_: 'OcfTriggerTypeTypeElectiveAtWill',
    trigger_id: 'trigger-001',
    conversion_right: {
      type_: 'CONVERTIBLE_CONVERSION_RIGHT',
      conversion_mechanism: {
        tag: 'OcfConvMechSAFE',
        value: {
          conversion_mfn: false,
          ...(conversionTiming !== undefined ? { conversion_timing: conversionTiming } : {}),
        },
      },
      converts_to_future_round: true,
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

describe('read-side: required seniority boundary', () => {
  test.each([
    ['null', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['undefined', undefined, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['empty string', '', OcpErrorCodes.INVALID_FORMAT],
    ['whitespace string', ' ', OcpErrorCodes.INVALID_FORMAT],
    ['non-integer string', '1.5', OcpErrorCodes.INVALID_FORMAT],
    ['scientific notation', '1e3', OcpErrorCodes.INVALID_FORMAT],
    ['boolean false', false, OcpErrorCodes.INVALID_TYPE],
    ['non-integer number', 1.5, OcpErrorCodes.INVALID_FORMAT],
    ['non-scalar', { value: 1 }, OcpErrorCodes.INVALID_TYPE],
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
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'convertibleIssuance.seniority',
        receivedValue: seniority,
      });
    }
  });
});

function buildDamlNoteTrigger(dayCount: string, interestPayout: string) {
  return {
    type_: 'OcfTriggerTypeTypeElectiveAtWill',
    trigger_id: 'trigger-001',
    conversion_right: {
      type_: 'CONVERTIBLE_CONVERSION_RIGHT',
      conversion_mechanism: {
        tag: 'OcfConvMechNote',
        value: {
          interest_rates: [{ rate: '0.05', accrual_start_date: '2024-01-15' }],
          day_count_convention: dayCount,
          interest_payout: interestPayout,
          interest_accrual_period: 'OcfAccrualAnnual',
          compounding_type: 'OcfSimple',
          conversion_mfn: null,
        },
      },
      converts_to_future_round: true,
    },
  };
}

type LedgerMonetaryVariant = 'SAFE' | 'VALUATION_BASED' | 'PPS_BASED' | 'NOTE';

function buildDamlTriggerWithMonetaryValue(variant: LedgerMonetaryVariant, monetaryValue: unknown) {
  const mechanism = (() => {
    switch (variant) {
      case 'SAFE':
        return {
          tag: 'OcfConvMechSAFE',
          value: { conversion_mfn: false, conversion_valuation_cap: monetaryValue },
        };
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
      case 'NOTE':
        return {
          tag: 'OcfConvMechNote',
          value: { interest_rates: [], conversion_valuation_cap: monetaryValue },
        };
    }
  })();

  return {
    type_: 'OcfTriggerTypeTypeElectiveAtWill',
    trigger_id: `trigger-${variant.toLowerCase()}`,
    conversion_right: {
      OcfRightConvertible: {
        type_: 'CONVERTIBLE_CONVERSION_RIGHT',
        conversion_mechanism: mechanism,
        converts_to_future_round: true,
      },
    },
  };
}

describe('read-side: convertible monetary boundaries', () => {
  const malformedValues: readonly unknown[] = [0, false, '', []];
  const variants = [
    {
      variant: 'SAFE' as const,
      fieldPath:
        'convertibleIssuance.conversion_triggers.0.conversion_right.conversion_mechanism.conversion_valuation_cap',
    },
    {
      variant: 'NOTE' as const,
      fieldPath:
        'convertibleIssuance.conversion_triggers.0.conversion_right.conversion_mechanism.conversion_valuation_cap',
    },
  ];

  test.each(
    variants.flatMap(({ variant, fieldPath }) => malformedValues.map((value) => ({ variant, fieldPath, value })))
  )('rejects $value for $variant instead of treating it as absent', ({ variant, fieldPath, value }) => {
    try {
      damlConvertibleIssuanceDataToNative({
        ...BASE_DAML,
        conversion_triggers: [buildDamlTriggerWithMonetaryValue(variant, value)],
      });
      throw new Error('Expected monetary validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_TYPE,
        fieldPath,
        receivedValue: value,
      });
    }
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
    expect(() =>
      damlConvertibleIssuanceDataToNative({
        ...BASE_DAML,
        conversion_triggers: [buildDamlSafeTrigger('OcfConvTimingInvalidValue')],
      })
    ).toThrow('Unknown conversion_timing: OcfConvTimingInvalidValue');
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
    expect(() =>
      damlConvertibleIssuanceDataToNative({
        ...BASE_DAML,
        convertible_type: 'OcfConvertibleNote',
        conversion_triggers: [buildDamlNoteTrigger('OcfDayCountWrong', 'OcfInterestPayoutCash')],
      })
    ).toThrow('Unknown day_count_convention: OcfDayCountWrong');
  });

  it('unrecognized interest_payout throws OcpParseError', () => {
    expect(() =>
      damlConvertibleIssuanceDataToNative({
        ...BASE_DAML,
        convertible_type: 'OcfConvertibleNote',
        conversion_triggers: [buildDamlNoteTrigger('OcfDayCountActual365', 'OcfInterestPayoutWrong')],
      })
    ).toThrow('Unknown interest_payout: OcfInterestPayoutWrong');
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
    const daml = convertibleIssuanceDataToDaml(input);
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

      try {
        damlConvertibleIssuanceDataToNative({ ...daml, [field]: invalidDate });
        throw new Error('Expected approval date validation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpValidationError);
        expect(error).toMatchObject({
          code: OcpErrorCodes.INVALID_TYPE,
          fieldPath: `convertibleIssuance.${field}`,
          receivedValue: invalidDate,
        });
      }
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
      'convertibleIssuance.conversion_triggers.0.trigger_date',
      null,
      OcpErrorCodes.INVALID_TYPE
    );
  });

  test.each(['trigger_date', 'start_date', 'end_date'] as const)(
    'rejects a present non-string conversion trigger %s',
    (field) => {
      const invalidDate = { seconds: 1 };

      expectInvalidDate(
        () =>
          damlConvertibleIssuanceDataToNative({
            ...BASE_DAML,
            conversion_triggers: [buildDamlSafeTriggerWithDateField(field, invalidDate)],
          }),
        `convertibleIssuance.conversion_triggers.0.${field}`,
        invalidDate,
        OcpErrorCodes.INVALID_TYPE
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
      'convertibleIssuance.conversion_triggers.0.trigger_date',
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
        `convertibleIssuance.conversion_triggers.0.${field}`,
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
    ['', OcpErrorCodes.INVALID_FORMAT],
    [{ seconds: 1 }, OcpErrorCodes.INVALID_TYPE],
  ] as const)('rejects a present invalid note accrual_end_date on readback', (invalidDate, code) => {
    const trigger = buildDamlNoteTrigger('OcfDayCountActual365', 'OcfInterestPayoutCash');
    const mechanism = trigger.conversion_right.conversion_mechanism;
    mechanism.value.interest_rates[0] = {
      ...mechanism.value.interest_rates[0],
      accrual_end_date: invalidDate,
    } as unknown as (typeof mechanism.value.interest_rates)[number];

    expectInvalidDate(
      () =>
        damlConvertibleIssuanceDataToNative({
          ...BASE_DAML,
          convertible_type: 'OcfConvertibleNote',
          conversion_triggers: [trigger],
        }),
      `${NOTE_INTEREST_RATE_READ_PATH}.accrual_end_date`,
      invalidDate,
      code
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

describe('convertible issuance write date boundaries', () => {
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
    'rejects a present non-string %s and accepts null/undefined as absent',
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

      for (const value of [null, undefined]) {
        const result = convertibleIssuanceDataToDaml({
          ...BASE_INPUT,
          conversion_triggers: [SAFE_TRIGGER_BASE],
          [field]: value,
        });
        expect(result[field]).toBeNull();
      }
    }
  );

  it('encodes the required AUTOMATIC_ON_DATE trigger_date and no range dates', () => {
    const result = convertibleIssuanceDataToDaml({
      ...BASE_INPUT,
      conversion_triggers: [
        { ...SAFE_TRIGGER_BASE, type: 'AUTOMATIC_ON_DATE', trigger_date: '2024-01-15T23:30:00-05:00' },
      ],
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
          start_date: '2024-01-15T00:30:00+14:00',
          end_date: '2024-02-15T23:30:00-05:00',
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
      'convertibleIssuance.conversion_triggers.0.trigger_date',
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
        `convertibleIssuance.conversion_triggers.0.${field}`,
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
        `convertibleIssuance.conversion_triggers.0.${field}`,
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
          `convertibleIssuance.conversion_triggers.0.${field}`,
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
      `${NOTE_INTEREST_RATE_PATH}.accrual_start_date`,
      value,
      code
    );
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
      `${NOTE_INTEREST_RATE_PATH}.accrual_end_date`,
      value,
      code
    );
  });

  test.each([null, undefined])('accepts optional note accrual_end_date %p as absent', (value) => {
    const result = convertibleIssuanceDataToDaml(
      buildConvertibleNoteInput({ rate: '0.05', accrual_start_date: '2024-01-15', accrual_end_date: value })
    );
    const trigger = requireFirst(result.conversion_triggers, 'converted note trigger');
    const right = trigger.conversion_right as {
      conversion_mechanism?: { value?: { interest_rates?: Array<{ accrual_end_date: string | null }> } };
    };

    expect(right.conversion_mechanism?.value?.interest_rates?.[0]?.accrual_end_date).toBeNull();
  });
});

/**
 * Uses the production SAFE post-money fixture to exercise the full converter path:
 * AUTOMATIC_ON_CONDITION trigger, capitalization_definition_rules, converts_to_future_round,
 * and valuation cap — all fields that the synthetic BASE_INPUT omits.
 */
describe('POST_MONEY SAFE – production fixture round-trip', () => {
  it('preserves POST_MONEY timing, trigger type, converts_to_future_round, and cap_def_rules from production fixture', () => {
    const fixture = loadProductionFixture<{
      id: string;
      date: string;
      security_id: string;
      custom_id: string;
      stakeholder_id: string;
      investment_amount: { amount: string; currency: string };
      convertible_type: 'SAFE';
      seniority: number;
      security_law_exemptions: Array<{ description: string; jurisdiction: string }>;
      conversion_triggers: Array<{
        type: string;
        trigger_id: string;
        trigger_condition: string;
        conversion_right: {
          type: string;
          converts_to_future_round: boolean;
          conversion_mechanism: {
            type: string;
            conversion_timing: string;
            conversion_mfn: boolean;
            conversion_valuation_cap: { amount: string; currency: string };
            capitalization_definition_rules: Record<string, boolean>;
          };
        };
      }>;
    }>('convertibleIssuance', 'safe-post-money');

    const daml = convertibleIssuanceDataToDaml(
      fixture as unknown as Parameters<typeof convertibleIssuanceDataToDaml>[0]
    );
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
