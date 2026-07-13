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

import { convertibleIssuanceDataToDaml } from '../../src/functions/OpenCapTable/convertibleIssuance/createConvertibleIssuance';
import { damlConvertibleIssuanceDataToNative } from '../../src/functions/OpenCapTable/convertibleIssuance/getConvertibleIssuanceAsOcf';
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

function buildDamlNoteTrigger(dayCount: string, interestPayout: string) {
  return {
    type_: 'OcfTriggerTypeTypeElectiveAtWill',
    trigger_id: 'trigger-001',
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
