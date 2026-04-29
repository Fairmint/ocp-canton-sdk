/**
 * Unit tests for WarrantIssuance round-trip conversion.
 *
 * Verifies that OCF data survives the OCF -> DAML -> OCF round-trip and
 * is considered equivalent by ocfDeepEqual. This prevents
 * infinite edit loops in the replication script.
 */

import { OcpValidationError } from '../../src/errors';
import { warrantIssuanceDataToDaml } from '../../src/functions/OpenCapTable/warrantIssuance/createWarrantIssuance';
import { damlWarrantIssuanceDataToNative } from '../../src/functions/OpenCapTable/warrantIssuance/getWarrantIssuanceAsOcf';
import { ocfDeepEqual } from '../../src/utils/ocfComparison';

/** Helper: round-trip OCF data through DAML and back to OCF */
function roundTrip(ocfInput: Parameters<typeof warrantIssuanceDataToDaml>[0]): Record<string, unknown> {
  const daml = warrantIssuanceDataToDaml(ocfInput);
  // daml is the DAML representation. Convert it back via the readback function.
  const native = damlWarrantIssuanceDataToNative(daml as unknown as Record<string, unknown>);
  return { object_type: 'TX_WARRANT_ISSUANCE', ...native };
}

describe('WarrantIssuance round-trip equivalence', () => {
  const baseWarrantIssuance = {
    id: '4afe6226-a717-4596-8bcc-fa3c22b154de',
    date: '2022-01-14',
    security_id: '6da41854-e2cd-474d-a809-2b9e86667632',
    custom_id: 'W-2',
    stakeholder_id: '61f3dbac-848b-4149-b2ce-fc5e672787af',
    purchase_price: { amount: '22500', currency: 'USD' },
    security_law_exemptions: [{ description: 'Regulation D', jurisdiction: 'US' }],
    warrant_expiration_date: '2029-09-30',
    exercise_triggers: [
      {
        type: 'AUTOMATIC_ON_CONDITION' as const,
        trigger_id: 'warrant2_trigger',
        nickname: 'Next financing event',
        trigger_description: 'Warrant is exercisable upon the next qualified financing event.',
        trigger_condition: 'TOOD',
        conversion_right: {
          type: 'WARRANT_CONVERSION_RIGHT' as const,
          conversion_mechanism: {
            type: 'FIXED_AMOUNT_CONVERSION' as const,
            converts_to_quantity: '22500',
          },
          converts_to_stock_class_id: '16faa6e5-b13a-4dda-bad2-885fccd2975a',
        },
      },
    ],
  };

  test('basic warrant issuance survives round-trip', () => {
    const dbData = { object_type: 'TX_WARRANT_ISSUANCE', ...baseWarrantIssuance } as Record<string, unknown>;
    const cantonData = roundTrip(baseWarrantIssuance);

    expect(ocfDeepEqual(dbData, cantonData)).toBe(true);
  });

  test('warrant issuance with numeric amount as JS number survives round-trip', () => {
    // DB JSONB can store amount as a number instead of a string
    const dbData = {
      object_type: 'TX_WARRANT_ISSUANCE',
      ...baseWarrantIssuance,
      purchase_price: { amount: 22500, currency: 'USD' },
    };
    const cantonData = roundTrip(baseWarrantIssuance);

    expect(ocfDeepEqual(dbData as Record<string, unknown>, cantonData)).toBe(true);
  });

  test('warrant issuance with undefined quantity and no quantity_source survives round-trip', () => {
    const input = { ...baseWarrantIssuance };
    const dbData = { object_type: 'TX_WARRANT_ISSUANCE', ...input };
    const cantonData = roundTrip(input);

    expect(ocfDeepEqual(dbData, cantonData)).toBe(true);
  });

  test('warrant issuance with explicit null quantity and no quantity_source survives round-trip', () => {
    // Regression test: DB JSONB may store quantity as explicit null (not undefined).
    // The OCF-to-DAML converter must treat null the same as undefined to avoid
    // injecting quantity_source: UNSPECIFIED that the DB doesn't have.
    const input = { ...baseWarrantIssuance, quantity: null as unknown as string };
    const dbData = { object_type: 'TX_WARRANT_ISSUANCE', ...input } as Record<string, unknown>;
    const cantonData = roundTrip(input);

    expect(ocfDeepEqual(dbData, cantonData)).toBe(true);
  });

  test('warrant issuance with null quantity and UNSPECIFIED quantity_source survives round-trip', () => {
    // This is the specific bug scenario: DB has quantity_source but no quantity.
    // The OCF-to-DAML converter sets quantity_source: OcfQuantityUnspecified,
    // and the readback must include it for the comparison to pass.
    const input = { ...baseWarrantIssuance, quantity_source: 'UNSPECIFIED' as const };
    const dbData = { object_type: 'TX_WARRANT_ISSUANCE', ...input };
    const cantonData = roundTrip(input);

    expect(ocfDeepEqual(dbData as Record<string, unknown>, cantonData)).toBe(true);
  });

  test('warrant issuance with quantity and quantity_source survives round-trip', () => {
    const input = {
      ...baseWarrantIssuance,
      quantity: '1000',
      quantity_source: 'INSTRUMENT_FIXED' as const,
    };
    const dbData = { object_type: 'TX_WARRANT_ISSUANCE', ...input };
    const cantonData = roundTrip(input);

    expect(ocfDeepEqual(dbData as Record<string, unknown>, cantonData)).toBe(true);
  });

  test('warrant issuance with empty comments array survives round-trip', () => {
    const input = { ...baseWarrantIssuance, comments: [] as string[] };
    const dbData = { object_type: 'TX_WARRANT_ISSUANCE', ...input };
    const cantonData = roundTrip(input);

    expect(ocfDeepEqual(dbData, cantonData)).toBe(true);
  });

  test('warrant issuance with converts_to_future_round: null in DB survives round-trip', () => {
    // DB may have converts_to_future_round: null which the readback omits.
    // The comparison must treat null as undefined-like.
    const input = { ...baseWarrantIssuance };
    const dbData = {
      object_type: 'TX_WARRANT_ISSUANCE',
      ...input,
      exercise_triggers: [
        {
          ...input.exercise_triggers[0],
          conversion_right: {
            ...input.exercise_triggers[0].conversion_right,
            converts_to_future_round: null,
          },
        },
      ],
    };
    const cantonData = roundTrip(input);

    expect(ocfDeepEqual(dbData as Record<string, unknown>, cantonData)).toBe(true);
  });

  test('warrant issuance with approval dates, consideration_text, and vestings survives round-trip', () => {
    const input = {
      ...baseWarrantIssuance,
      board_approval_date: '2024-06-01',
      stockholder_approval_date: '2024-06-05',
      consideration_text: 'Cash and services',
      vestings: [{ date: '2024-01-01', amount: '100' }],
    };
    const dbData = { object_type: 'TX_WARRANT_ISSUANCE', ...input };
    const cantonData = roundTrip(input);

    expect(ocfDeepEqual(dbData as Record<string, unknown>, cantonData)).toBe(true);
  });

  test('SAFE_CONVERSION on warrant maps to PPS-based mechanism (JSON-safe, no undefined)', () => {
    // Regression: JSON from DB may use convertible-style SAFE_CONVERSION; warrant DAML has no SAFE variant.
    // Previously the switch fell through and produced undefined → CapTableBatch.assertJsonSafe failed opaquely.
    const input = {
      ...baseWarrantIssuance,
      exercise_triggers: [
        {
          ...baseWarrantIssuance.exercise_triggers[0],
          conversion_right: {
            ...baseWarrantIssuance.exercise_triggers[0].conversion_right,
            conversion_mechanism: {
              type: 'SAFE_CONVERSION' as const,
              conversion_discount: '0.2',
              conversion_valuation_cap: { amount: '10000000', currency: 'USD' },
              conversion_mfn: true,
              conversion_timing: 'POST_MONEY',
            },
          },
        },
      ],
    };
    const daml = warrantIssuanceDataToDaml(input);
    const json = JSON.stringify(daml);
    expect(json).not.toMatch(/undefined/);
    const mech = daml.exercise_triggers[0].conversion_right as {
      tag: string;
      value: { conversion_mechanism: { tag: string; value: Record<string, unknown> } };
    };
    expect(mech.tag).toBe('OcfRightWarrant');
    expect(mech.value.conversion_mechanism.tag).toBe('OcfWarrantMechanismPpsBased');
    const pps = mech.value.conversion_mechanism.value;
    expect(pps.discount).toBe(true);
    expect(pps.discount_percentage).toBe('0.2');
    expect(pps.discount_amount).toBeNull();
    expect(String(pps.description)).toContain('SAFE-style conversion');
    expect(String(pps.description)).toContain('conversion_valuation_cap');
  });

  test('bare string SAFE_CONVERSION shorthand maps to PPS-based warrant mechanism', () => {
    const input = {
      ...baseWarrantIssuance,
      exercise_triggers: [
        {
          ...baseWarrantIssuance.exercise_triggers[0],
          conversion_right: {
            ...baseWarrantIssuance.exercise_triggers[0].conversion_right,
            conversion_mechanism: 'SAFE_CONVERSION',
          },
        },
      ],
    };
    const daml = warrantIssuanceDataToDaml(input);
    expect(() => JSON.stringify(daml)).not.toThrow();
    const mech = daml.exercise_triggers[0].conversion_right as {
      value: { conversion_mechanism: { tag: string } };
    };
    expect(mech.value.conversion_mechanism.tag).toBe('OcfWarrantMechanismPpsBased');
  });

  test('CONVERTIBLE_NOTE_CONVERSION on warrant maps to custom mechanism (JSON-safe)', () => {
    const input = {
      ...baseWarrantIssuance,
      exercise_triggers: [
        {
          ...baseWarrantIssuance.exercise_triggers[0],
          conversion_right: {
            ...baseWarrantIssuance.exercise_triggers[0].conversion_right,
            conversion_mechanism: {
              type: 'CONVERTIBLE_NOTE_CONVERSION' as const,
              conversion_discount: '0.15',
              interest_rates: [{ rate: '0.08', accrual_start_date: '2020-01-01', accrual_end_date: null }],
              day_count_convention: 'ACTUAL_365',
              interest_payout: 'DEFERRED',
            },
          },
        },
      ],
    };
    const daml = warrantIssuanceDataToDaml(input);
    expect(() => JSON.stringify(daml)).not.toThrow();
    const mech = daml.exercise_triggers[0].conversion_right as {
      value: { conversion_mechanism: { tag: string; value: { custom_conversion_description: string } } };
    };
    expect(mech.value.conversion_mechanism.tag).toBe('OcfWarrantMechanismCustom');
    expect(mech.value.conversion_mechanism.value.custom_conversion_description).toContain('CONVERTIBLE_NOTE');
  });

  test('unknown conversion_mechanism type still throws (never emits undefined)', () => {
    const input = {
      ...baseWarrantIssuance,
      exercise_triggers: [
        {
          ...baseWarrantIssuance.exercise_triggers[0],
          conversion_right: {
            ...baseWarrantIssuance.exercise_triggers[0].conversion_right,
            conversion_mechanism: { type: 'NOT_A_REAL_MECHANISM' },
          },
        },
      ],
    } as Parameters<typeof warrantIssuanceDataToDaml>[0];
    expect(() => warrantIssuanceDataToDaml(input)).toThrow(OcpValidationError);
    expect(() => warrantIssuanceDataToDaml(input)).toThrow(
      /Unsupported warrant conversion_mechanism type: NOT_A_REAL_MECHANISM/
    );
  });

  test('warrant issuance with numeric converts_to_quantity as JS number survives round-trip', () => {
    const input = {
      ...baseWarrantIssuance,
      exercise_triggers: [
        {
          ...baseWarrantIssuance.exercise_triggers[0],
          conversion_right: {
            ...baseWarrantIssuance.exercise_triggers[0].conversion_right,
            conversion_mechanism: {
              type: 'FIXED_AMOUNT_CONVERSION' as const,
              converts_to_quantity: '22500',
            },
          },
        },
      ],
    };
    // DB stores the quantity as a number
    const dbData = {
      object_type: 'TX_WARRANT_ISSUANCE',
      ...input,
      exercise_triggers: [
        {
          ...input.exercise_triggers[0],
          conversion_right: {
            ...input.exercise_triggers[0].conversion_right,
            conversion_mechanism: {
              type: 'FIXED_AMOUNT_CONVERSION',
              converts_to_quantity: 22500,
            },
          },
        },
      ],
    };
    const cantonData = roundTrip(input);

    expect(ocfDeepEqual(dbData as Record<string, unknown>, cantonData)).toBe(true);
  });
});
