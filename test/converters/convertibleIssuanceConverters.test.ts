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
import { convertibleIssuanceDataToDaml } from '../../src/functions/OpenCapTable/convertibleIssuance/createConvertibleIssuance';
import { damlConvertibleIssuanceDataToNative } from '../../src/functions/OpenCapTable/convertibleIssuance/getConvertibleIssuanceAsOcf';
import { expectInvalidDate } from '../utils/dateValidationAssertions';
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

function noteInterestRatePath(triggerIndex = 0, interestRateIndex = 0): string {
  return (
    `convertibleIssuance.conversion_triggers[${triggerIndex}].conversion_right.` +
    `conversion_mechanism.interest_rates[${interestRateIndex}]`
  );
}

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
    const input = {
      ...BASE_INPUT,
      conversion_triggers: [
        {
          ...SAFE_TRIGGER_BASE,
          conversion_right: {
            ...SAFE_TRIGGER_BASE.conversion_right,
            conversion_mechanism: {
              ...SAFE_TRIGGER_BASE.conversion_right.conversion_mechanism,
              conversion_timing: 'POST_MONEY',
            },
          },
        },
      ],
    };

    const daml = convertibleIssuanceDataToDaml(input);
    const trigger = daml.conversion_triggers[0];
    const mech = (
      trigger.conversion_right as { conversion_mechanism: { tag: string; value: { conversion_timing: string | null } } }
    ).conversion_mechanism;

    expect(mech.tag).toBe('OcfConvMechSAFE');
    expect(mech.value.conversion_timing).toBe('OcfConvTimingPostMoney');
    expect(mech.value.conversion_timing).not.toBe('OcfConversionTimingPostMoney');
  });

  it('emits OcfConvTimingPreMoney for PRE_MONEY (not OcfConversionTimingPreMoney)', () => {
    const input = {
      ...BASE_INPUT,
      conversion_triggers: [
        {
          ...SAFE_TRIGGER_BASE,
          conversion_right: {
            ...SAFE_TRIGGER_BASE.conversion_right,
            conversion_mechanism: {
              ...SAFE_TRIGGER_BASE.conversion_right.conversion_mechanism,
              conversion_timing: 'PRE_MONEY',
            },
          },
        },
      ],
    };

    const daml = convertibleIssuanceDataToDaml(input);
    const trigger = daml.conversion_triggers[0];
    const mech = (
      trigger.conversion_right as { conversion_mechanism: { tag: string; value: { conversion_timing: string | null } } }
    ).conversion_mechanism;

    expect(mech.tag).toBe('OcfConvMechSAFE');
    expect(mech.value.conversion_timing).toBe('OcfConvTimingPreMoney');
    expect(mech.value.conversion_timing).not.toBe('OcfConversionTimingPreMoney');
  });

  it('emits null for absent conversion_timing', () => {
    const input = {
      ...BASE_INPUT,
      conversion_triggers: [SAFE_TRIGGER_BASE],
    };

    const daml = convertibleIssuanceDataToDaml(input);
    const trigger = daml.conversion_triggers[0];
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

    expect(() => convertibleIssuanceDataToDaml(input)).toThrow('Unknown conversion_timing: POSTMONEY');
  });
});

describe('ConvertibleConversionMechanismInput bare string handling', () => {
  it('accepts bare string SAFE_CONVERSION and treats it as an empty SAFE mechanism', () => {
    const input = {
      ...BASE_INPUT,
      conversion_triggers: [
        {
          ...SAFE_TRIGGER_BASE,
          conversion_right: {
            ...SAFE_TRIGGER_BASE.conversion_right,
            conversion_mechanism: 'SAFE_CONVERSION' as const,
          },
        },
      ],
    };

    const daml = convertibleIssuanceDataToDaml(input);
    const trigger = daml.conversion_triggers[0];
    const mech = (trigger.conversion_right as { conversion_mechanism: { tag: string } }).conversion_mechanism;

    expect(mech.tag).toBe('OcfConvMechSAFE');
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

  it('requires a caller-provided trigger_id instead of synthesizing one', () => {
    const error = captureError(() =>
      convertibleIssuanceDataToDaml({
        ...BASE_INPUT,
        conversion_triggers: [{ ...SAFE_TRIGGER_BASE, trigger_id: '' }],
      })
    );

    expect(error).toMatchObject({
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      fieldPath: 'convertibleIssuance.conversion_triggers[0].trigger_id',
      receivedValue: '',
    });
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
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      fieldPath: 'convertibleIssuance.conversion_triggers[0].trigger_id',
      expectedType: 'non-empty string',
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
      })
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
      })
    );

    expect(error).toBeInstanceOf(OcpParseError);
    expect(error).toMatchObject({ source: `${conversionMechanismPath(1)}.conversion_timing` });
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
      OcfRightConvertible: {
        conversion_mechanism: {
          tag: 'OcfConvMechSAFE',
          value: {
            conversion_mfn: false,
            ...(conversionTiming !== undefined ? { conversion_timing: conversionTiming } : {}),
          },
        },
        converts_to_future_round: true,
      },
    },
  };
}

function buildDamlNoteTrigger(dayCount: string, interestPayout: string, triggerId = 'trigger-001') {
  return {
    type_: 'OcfTriggerTypeTypeElectiveAtWill',
    trigger_id: triggerId,
    conversion_right: {
      OcfRightConvertible: {
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
    },
  };
}

describe('read-side conversion mechanism paths', () => {
  it('requires a ledger trigger_id instead of synthesizing one', () => {
    const { trigger_id: _triggerId, ...triggerWithoutId } = buildDamlSafeTrigger();
    const error = captureError(() =>
      damlConvertibleIssuanceDataToNative({ ...BASE_DAML, conversion_triggers: [triggerWithoutId] })
    );

    expect(error).toMatchObject({
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      fieldPath: 'convertibleIssuance.conversion_triggers[0].trigger_id',
      receivedValue: undefined,
    });
  });

  it('rejects a bare trigger discriminator read from the ledger', () => {
    const error = captureError(() =>
      damlConvertibleIssuanceDataToNative({ ...BASE_DAML, conversion_triggers: ['AUTOMATIC_ON_DATE'] })
    );

    expect(error).toMatchObject({
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      fieldPath: 'convertibleIssuance.conversion_triggers[0]',
      receivedValue: 'AUTOMATIC_ON_DATE',
    });
  });

  it('reports the indexed canonical field for an unknown trigger discriminator', () => {
    const error = captureError(() =>
      damlConvertibleIssuanceDataToNative({
        ...BASE_DAML,
        conversion_triggers: [{ ...buildDamlSafeTrigger(), type_: 'OcfTriggerTypeTypeUnknown' }],
      })
    );

    expect(error).toBeInstanceOf(OcpParseError);
    expect(error).toMatchObject({
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      source: 'convertibleIssuance.conversion_triggers[0].type_',
    });
  });

  it('reports the exact path for a missing conversion_right', () => {
    const { conversion_right: _conversionRight, ...triggerWithoutRight } = buildDamlSafeTrigger();
    const error = captureError(() =>
      damlConvertibleIssuanceDataToNative({ ...BASE_DAML, conversion_triggers: [triggerWithoutRight] })
    );

    expect(error).toMatchObject({
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      fieldPath: 'convertibleIssuance.conversion_triggers[0].conversion_right',
      receivedValue: undefined,
    });
  });

  test.each([null, 'not-an-object', 42, []])(
    'rejects malformed wrapped convertible conversion-right value %p',
    (value) => {
      const trigger = {
        ...buildDamlSafeTrigger(),
        conversion_right: { OcfRightConvertible: value },
      };
      const error = captureError(() =>
        damlConvertibleIssuanceDataToNative({ ...BASE_DAML, conversion_triggers: [trigger] })
      );

      expect(error).toMatchObject({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        fieldPath: 'convertibleIssuance.conversion_triggers[0].conversion_right.OcfRightConvertible',
        receivedValue: value,
      });
    }
  );

  it('reports the exact trigger index for a malformed nested field', () => {
    const invalidTrigger = {
      ...buildDamlSafeTrigger(),
      trigger_id: 'trigger-002',
      conversion_right: {
        OcfRightConvertible: {
          conversion_mechanism: {
            tag: 'OcfConvMechFixedAmount',
            value: { converts_to_quantity: { unexpected: true } },
          },
          converts_to_future_round: true,
        },
      },
    };
    const error = captureError(() =>
      damlConvertibleIssuanceDataToNative({
        ...BASE_DAML,
        conversion_triggers: [buildDamlSafeTrigger(), invalidTrigger],
      })
    );

    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: `${conversionMechanismPath(1)}.converts_to_quantity`,
      receivedValue: { unexpected: true },
    });
  });

  it('reports the exact trigger index for a malformed mechanism enum', () => {
    const invalidTrigger = {
      ...buildDamlSafeTrigger('OcfConvTimingInvalidValue'),
      trigger_id: 'trigger-002',
    };
    const error = captureError(() =>
      damlConvertibleIssuanceDataToNative({
        ...BASE_DAML,
        conversion_triggers: [buildDamlSafeTrigger(), invalidTrigger],
      })
    );

    expect(error).toBeInstanceOf(OcpParseError);
    expect(error).toMatchObject({ source: `${conversionMechanismPath(1)}.conversion_timing` });
  });
});

describe('read-side: conversion_timing exact DAML constructor matching', () => {
  it('OcfConvTimingPreMoney → PRE_MONEY', () => {
    const result = damlConvertibleIssuanceDataToNative({
      ...BASE_DAML,
      conversion_triggers: [buildDamlSafeTrigger('OcfConvTimingPreMoney')],
    });
    const mech = result.conversion_triggers[0].conversion_right.conversion_mechanism as {
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
    const mech = result.conversion_triggers[0].conversion_right.conversion_mechanism as {
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
    const mech = result.conversion_triggers[0].conversion_right.conversion_mechanism as {
      type: string;
      conversion_timing?: string;
    };
    expect(mech.conversion_timing).toBeUndefined();
  });

  // Legacy long-form aliases — persisted contracts written before constructor names were shortened
  it('OcfConversionTimingPreMoney (legacy) → PRE_MONEY', () => {
    const result = damlConvertibleIssuanceDataToNative({
      ...BASE_DAML,
      conversion_triggers: [buildDamlSafeTrigger('OcfConversionTimingPreMoney')],
    });
    const mech = result.conversion_triggers[0].conversion_right.conversion_mechanism as {
      type: string;
      conversion_timing?: string;
    };
    expect(mech.conversion_timing).toBe('PRE_MONEY');
  });

  it('OcfConversionTimingPostMoney (legacy) → POST_MONEY', () => {
    const result = damlConvertibleIssuanceDataToNative({
      ...BASE_DAML,
      conversion_triggers: [buildDamlSafeTrigger('OcfConversionTimingPostMoney')],
    });
    const mech = result.conversion_triggers[0].conversion_right.conversion_mechanism as {
      type: string;
      conversion_timing?: string;
    };
    expect(mech.conversion_timing).toBe('POST_MONEY');
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
    const mech = result.conversion_triggers[0].conversion_right.conversion_mechanism as {
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
    const mech = result.conversion_triggers[0].conversion_right.conversion_mechanism as {
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
    const mech = result.conversion_triggers[0].conversion_right.conversion_mechanism as {
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
    const mech = result.conversion_triggers[0].conversion_right.conversion_mechanism as {
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
  function roundTrip(conversionTiming: string | undefined) {
    const input = {
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
    const mech = result.conversion_triggers[0].conversion_right.conversion_mechanism as {
      type: string;
      conversion_timing?: string;
    };
    expect(mech.type).toBe('SAFE_CONVERSION');
    expect(mech.conversion_timing).toBe('POST_MONEY');
  });

  it('PRE_MONEY survives OCF → DAML → OCF round-trip', () => {
    const result = roundTrip('PRE_MONEY');
    const mech = result.conversion_triggers[0].conversion_right.conversion_mechanism as {
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

      expectInvalidDate(
        () => damlConvertibleIssuanceDataToNative({ ...daml, [field]: invalidDate }),
        `convertibleIssuance.${field}`,
        invalidDate,
        OcpErrorCodes.INVALID_TYPE
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

  test.each([
    ['empty', '', OcpErrorCodes.INVALID_FORMAT],
    ['non-string', { seconds: 1 }, OcpErrorCodes.INVALID_TYPE],
  ] as const)('rejects a present invalid note accrual_end_date on readback when %s', (_case, invalidDate, code) => {
    const trigger = buildDamlNoteTrigger('OcfDayCountActual365', 'OcfInterestPayoutCash');
    const mechanism = trigger.conversion_right.OcfRightConvertible.conversion_mechanism;
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
      `${noteInterestRatePath()}.accrual_end_date`,
      invalidDate,
      code
    );
  });

  test('reports the exact trigger and interest-rate indexes on readback', () => {
    const firstTrigger = buildDamlNoteTrigger('OcfDayCountActual365', 'OcfInterestPayoutCash');
    const secondTrigger = buildDamlNoteTrigger('OcfDayCountActual365', 'OcfInterestPayoutCash', 'trigger-002');
    const mechanism = secondTrigger.conversion_right.OcfRightConvertible.conversion_mechanism;
    mechanism.value.interest_rates.push({ rate: '0.06', accrual_start_date: '' });

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
    const mechanism = trigger.conversion_right.OcfRightConvertible.conversion_mechanism;
    (mechanism.value.interest_rates as unknown[]).push(invalidRate);

    const error = captureError(() =>
      damlConvertibleIssuanceDataToNative({
        ...BASE_DAML,
        convertible_type: 'OcfConvertibleNote',
        conversion_triggers: [trigger],
      })
    );

    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: noteInterestRatePath(0, 1),
      expectedType: 'object',
      receivedValue: invalidRate,
    });
  });

  test.each([
    ['record', { bad: true }],
    ['primitive', 'not-interest-rates'],
    ['number', 42],
  ] as const)('rejects a present %s interest_rates collection', (_case, invalidRates) => {
    const trigger = buildDamlNoteTrigger('OcfDayCountActual365', 'OcfInterestPayoutCash');
    const mechanism = trigger.conversion_right.OcfRightConvertible.conversion_mechanism;
    mechanism.value.interest_rates = invalidRates as never;

    const error = captureError(() =>
      damlConvertibleIssuanceDataToNative({
        ...BASE_DAML,
        convertible_type: 'OcfConvertibleNote',
        conversion_triggers: [trigger],
      })
    );

    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: `${conversionMechanismPath()}.interest_rates`,
      expectedType: 'array | null',
      receivedValue: invalidRates,
    });
  });

  test('omits a null note accrual_end_date on readback', () => {
    const trigger = buildDamlNoteTrigger('OcfDayCountActual365', 'OcfInterestPayoutCash');
    const mechanism = trigger.conversion_right.OcfRightConvertible.conversion_mechanism;
    mechanism.value.interest_rates[0] = {
      ...mechanism.value.interest_rates[0],
      accrual_end_date: null,
    } as unknown as (typeof mechanism.value.interest_rates)[number];

    const result = damlConvertibleIssuanceDataToNative({
      ...BASE_DAML,
      convertible_type: 'OcfConvertibleNote',
      conversion_triggers: [trigger],
    });
    const nativeMechanism = result.conversion_triggers[0].conversion_right.conversion_mechanism as {
      interest_rates: Array<{ accrual_end_date?: string }>;
    };

    expect(nativeMechanism.interest_rates[0].accrual_end_date).toBeUndefined();
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
            { ...SAFE_TRIGGER_BASE, trigger_date: '2024-01-15' } as unknown as typeof SAFE_TRIGGER_BASE,
          ],
        }),
      'convertibleIssuance.conversion_triggers[0].trigger_date',
      '2024-01-15',
      OcpErrorCodes.INVALID_FORMAT
    );
  });

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
      expectedType: 'string | number',
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

  test.each([null, undefined])('accepts optional note accrual_end_date %p as absent', (value) => {
    const result = convertibleIssuanceDataToDaml(
      buildConvertibleNoteInput({ rate: '0.05', accrual_start_date: '2024-01-15', accrual_end_date: value })
    );
    const trigger = result.conversion_triggers[0];
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

    const trigger = result.conversion_triggers[0];
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
