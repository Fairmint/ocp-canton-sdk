/**
 * Unit tests for WarrantIssuance round-trip conversion.
 *
 * Verifies that OCF data survives the OCF -> DAML -> OCF round-trip and
 * is considered equivalent by ocfDeepEqual. This prevents
 * infinite edit loops in the replication script.
 */

import { OcpErrorCodes, OcpParseError, OcpValidationError, type OcpErrorCode } from '../../src/errors';
import { warrantIssuanceDataToDaml } from '../../src/functions/OpenCapTable/warrantIssuance/createWarrantIssuance';
import { damlWarrantIssuanceDataToNative } from '../../src/functions/OpenCapTable/warrantIssuance/getWarrantIssuanceAsOcf';
import type { RatioConversionMechanism, WarrantExerciseTrigger } from '../../src/types/native';
import { ocfDeepEqual } from '../../src/utils/ocfComparison';
import { requireFirst } from '../../src/utils/requireDefined';

/** Helper: round-trip OCF data through DAML and back to OCF */
function roundTrip(ocfInput: Parameters<typeof warrantIssuanceDataToDaml>[0]): Record<string, unknown> {
  const daml = warrantIssuanceDataToDaml(ocfInput);
  // daml is the DAML representation. Convert it back via the readback function.
  const native = damlWarrantIssuanceDataToNative(daml);
  return { ...native, object_type: 'TX_WARRANT_ISSUANCE' };
}

function expectInvalidWarrantDate(
  action: () => unknown,
  fieldPath: string,
  receivedValue: unknown,
  code: OcpErrorCode = OcpErrorCodes.INVALID_FORMAT
): void {
  try {
    action();
    throw new Error('Expected warrant date validation to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error).toMatchObject({ code, fieldPath, receivedValue });
  }
}

describe('WarrantIssuance round-trip equivalence', () => {
  type TriggerDateField = 'trigger_date' | 'start_date' | 'end_date';

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
    object_type: 'TX_WARRANT_ISSUANCE' as const,
  };
  const baseExerciseTrigger = requireFirst(baseWarrantIssuance.exercise_triggers, 'base warrant exercise trigger');

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

  function warrantTriggerWithDateField(field: TriggerDateField, value: unknown): WarrantExerciseTrigger {
    return {
      trigger_id: baseExerciseTrigger.trigger_id,
      conversion_right: baseExerciseTrigger.conversion_right,
      ...triggerTimingWithField(field, value),
    } as unknown as WarrantExerciseTrigger;
  }

  function stockClassTrigger(overrides: Record<string, unknown> = {}) {
    return {
      type: 'AUTOMATIC_ON_CONDITION' as const,
      trigger_id: 'w_stock_ratio',
      trigger_condition: 'X',
      conversion_right: {
        type: 'STOCK_CLASS_CONVERSION_RIGHT' as const,
        converts_to_stock_class_id: '16faa6e5-b13a-4dda-bad2-885fccd2975a',
        conversion_mechanism: {
          type: 'RATIO_CONVERSION' as const,
          ratio: { numerator: '1', denominator: '1' },
          conversion_price: { amount: '1', currency: 'USD' },
          rounding_type: 'NORMAL' as const,
        },
      },
      ...overrides,
    };
  }

  function stockClassTriggerWithTiming(timing: Record<string, unknown>): WarrantExerciseTrigger {
    const base = stockClassTrigger();
    return {
      trigger_id: base.trigger_id,
      conversion_right: base.conversion_right,
      ...timing,
    } as unknown as WarrantExerciseTrigger;
  }

  function stockClassTriggerWithDateField(field: TriggerDateField, value: unknown): WarrantExerciseTrigger {
    return stockClassTriggerWithTiming(triggerTimingWithField(field, value));
  }

  test('basic warrant issuance survives round-trip', () => {
    const dbData = { ...baseWarrantIssuance, object_type: 'TX_WARRANT_ISSUANCE' } as Record<string, unknown>;
    const cantonData = roundTrip(baseWarrantIssuance);

    expect(ocfDeepEqual(dbData, cantonData)).toBe(true);
  });

  test('warrant issuance with numeric amount as JS number survives round-trip', () => {
    // DB JSONB can store amount as a number instead of a string
    const dbData = {
      ...baseWarrantIssuance,
      purchase_price: { amount: 22500, currency: 'USD' },
      object_type: 'TX_WARRANT_ISSUANCE',
    };
    const cantonData = roundTrip(baseWarrantIssuance);

    expect(ocfDeepEqual(dbData as Record<string, unknown>, cantonData)).toBe(true);
  });

  test('warrant issuance with undefined quantity and no quantity_source survives round-trip', () => {
    const input = { ...baseWarrantIssuance };
    const dbData = { ...input, object_type: 'TX_WARRANT_ISSUANCE' };
    const cantonData = roundTrip(input);

    expect(ocfDeepEqual(dbData, cantonData)).toBe(true);
  });

  test('rejects explicit null quantity at the canonical optional boundary', () => {
    const input = { ...baseWarrantIssuance, quantity: null as unknown as string };
    expect(() => warrantIssuanceDataToDaml(input)).toThrow(OcpValidationError);
    expect(() => warrantIssuanceDataToDaml(input)).toThrow(/explicit null is invalid/);
  });

  test('warrant issuance with null quantity and UNSPECIFIED quantity_source survives round-trip', () => {
    // This is the specific bug scenario: DB has quantity_source but no quantity.
    // The OCF-to-DAML converter sets quantity_source: OcfQuantityUnspecified,
    // and the readback must include it for the comparison to pass.
    const input = { ...baseWarrantIssuance, quantity_source: 'UNSPECIFIED' as const };
    const dbData = { ...input, object_type: 'TX_WARRANT_ISSUANCE' };
    const cantonData = roundTrip(input);

    expect(ocfDeepEqual(dbData as Record<string, unknown>, cantonData)).toBe(true);
  });

  test('warrant issuance with quantity and quantity_source survives round-trip', () => {
    const input: Parameters<typeof warrantIssuanceDataToDaml>[0] = {
      ...baseWarrantIssuance,
      quantity: '1000',
      quantity_source: 'INSTRUMENT_FIXED' as const,
    };
    const dbData = { ...input, object_type: 'TX_WARRANT_ISSUANCE' };
    const cantonData = roundTrip(input);

    expect(ocfDeepEqual(dbData as Record<string, unknown>, cantonData)).toBe(true);
  });

  test('warrant issuance with empty comments array survives round-trip', () => {
    const input = { ...baseWarrantIssuance, comments: [] as string[] };
    const dbData = { ...input, object_type: 'TX_WARRANT_ISSUANCE' };
    const cantonData = roundTrip(input);

    expect(ocfDeepEqual(dbData, cantonData)).toBe(true);
  });

  test('warrant issuance with converts_to_future_round: null in DB survives round-trip', () => {
    // DB may have converts_to_future_round: null which the readback omits.
    // The comparison must treat null as undefined-like.
    const input = { ...baseWarrantIssuance };
    const dbData = {
      ...input,
      exercise_triggers: [
        {
          ...requireFirst(input.exercise_triggers, 'input warrant exercise trigger'),
          conversion_right: {
            ...requireFirst(input.exercise_triggers, 'input warrant exercise trigger').conversion_right,
            converts_to_future_round: null,
          },
        },
      ],
      object_type: 'TX_WARRANT_ISSUANCE',
    };
    const cantonData = roundTrip(input);

    expect(ocfDeepEqual(dbData as Record<string, unknown>, cantonData)).toBe(true);
  });

  test('warrant issuance with approval dates, consideration_text, and vestings survives round-trip', () => {
    const input: Parameters<typeof warrantIssuanceDataToDaml>[0] = {
      ...baseWarrantIssuance,
      board_approval_date: '2024-06-01',
      stockholder_approval_date: '2024-06-05',
      consideration_text: 'Cash and services',
      vestings: [{ date: '2024-01-01', amount: '100' }],
    };
    const dbData = { ...input, object_type: 'TX_WARRANT_ISSUANCE' };
    const cantonData = roundTrip(input);

    expect(ocfDeepEqual(dbData as Record<string, unknown>, cantonData)).toBe(true);
  });

  test.each(['board_approval_date', 'stockholder_approval_date'] as const)(
    'rejects a present non-string %s on readback',
    (field) => {
      const invalidDate = { seconds: 1 };
      const daml = warrantIssuanceDataToDaml(baseWarrantIssuance);

      try {
        damlWarrantIssuanceDataToNative({ ...daml, [field]: invalidDate });
        throw new Error('Expected approval date validation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpValidationError);
        expect(error).toMatchObject({
          code: OcpErrorCodes.INVALID_TYPE,
          fieldPath: `warrantIssuance.${field}`,
          receivedValue: invalidDate,
        });
      }
    }
  );

  test.each([
    ['', OcpErrorCodes.INVALID_FORMAT],
    [{ seconds: 1 }, OcpErrorCodes.INVALID_TYPE],
  ] as const)('rejects a present invalid warrant_expiration_date on readback', (invalidDate, code) => {
    const daml = warrantIssuanceDataToDaml(baseWarrantIssuance);

    try {
      damlWarrantIssuanceDataToNative({ ...daml, warrant_expiration_date: invalidDate });
      throw new Error('Expected warrant expiration date validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code,
        fieldPath: 'warrantIssuance.warrant_expiration_date',
        receivedValue: invalidDate,
      });
    }
  });

  test('omits a null or absent warrant_expiration_date on readback', () => {
    const daml = warrantIssuanceDataToDaml(baseWarrantIssuance);
    const withoutExpiration = { ...daml } as Record<string, unknown>;
    delete withoutExpiration.warrant_expiration_date;

    expect(damlWarrantIssuanceDataToNative({ ...daml, warrant_expiration_date: null }).warrant_expiration_date).toBe(
      undefined
    );
    expect(damlWarrantIssuanceDataToNative(withoutExpiration).warrant_expiration_date).toBeUndefined();
  });

  test.each(['trigger_date', 'start_date', 'end_date'] as const)(
    'rejects a present non-string exercise trigger %s on readback',
    (field) => {
      const invalidDate = { seconds: 1 };
      const daml = warrantIssuanceDataToDaml({
        ...baseWarrantIssuance,
        exercise_triggers: [warrantTriggerWithDateField(field, '2024-01-15')],
      });
      const trigger = daml.exercise_triggers[0];

      try {
        damlWarrantIssuanceDataToNative({
          ...daml,
          exercise_triggers: [{ ...trigger, [field]: invalidDate }],
        });
        throw new Error('Expected trigger date validation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpValidationError);
        expect(error).toMatchObject({
          code: OcpErrorCodes.INVALID_TYPE,
          fieldPath: `warrantIssuance.exercise_triggers.0.${field}`,
          receivedValue: invalidDate,
        });
      }
    }
  );

  test.each(['trigger_date', 'start_date', 'end_date'] as const)(
    'rejects a present empty exercise trigger %s on readback',
    (field) => {
      const daml = warrantIssuanceDataToDaml({
        ...baseWarrantIssuance,
        exercise_triggers: [warrantTriggerWithDateField(field, '2024-01-15')],
      });
      const trigger = daml.exercise_triggers[0];

      try {
        damlWarrantIssuanceDataToNative({
          ...daml,
          exercise_triggers: [{ ...trigger, [field]: '' }],
        });
        throw new Error('Expected trigger date validation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpValidationError);
        expect(error).toMatchObject({
          code: OcpErrorCodes.INVALID_FORMAT,
          fieldPath: `warrantIssuance.exercise_triggers.0.${field}`,
          receivedValue: '',
        });
      }
    }
  );

  test.each(['trigger_date', 'start_date', 'end_date'] as const)(
    'omits a null or absent exercise trigger %s on readback',
    (field) => {
      const daml = warrantIssuanceDataToDaml(baseWarrantIssuance);
      const trigger = { ...daml.exercise_triggers[0] } as unknown as Record<string, unknown>;
      const absentTrigger = { ...trigger };
      delete absentTrigger[field];

      const withNull = damlWarrantIssuanceDataToNative({
        ...daml,
        exercise_triggers: [{ ...trigger, [field]: null }],
      }).exercise_triggers[0] as unknown as Record<string, unknown>;
      const withoutField = damlWarrantIssuanceDataToNative({
        ...daml,
        exercise_triggers: [absentTrigger],
      }).exercise_triggers[0] as unknown as Record<string, unknown>;

      expect(withNull[field]).toBeUndefined();
      expect(withoutField[field]).toBeUndefined();
    }
  );

  test.each(['board_approval_date', 'stockholder_approval_date', 'warrant_expiration_date'] as const)(
    'enforces optional write boundary semantics for %s',
    (field) => {
      const fieldPath = `warrantIssuance.${field}`;
      const invalidDate = { seconds: 1 };

      expectInvalidWarrantDate(
        () =>
          warrantIssuanceDataToDaml({
            ...baseWarrantIssuance,
            [field]: '',
          }),
        fieldPath,
        ''
      );
      expectInvalidWarrantDate(
        () =>
          warrantIssuanceDataToDaml({
            ...baseWarrantIssuance,
            [field]: invalidDate,
          }),
        fieldPath,
        invalidDate,
        OcpErrorCodes.INVALID_TYPE
      );

      for (const value of [null, undefined]) {
        const result = warrantIssuanceDataToDaml({
          ...baseWarrantIssuance,
          [field]: value,
        });
        expect(result[field]).toBeNull();
      }
    }
  );

  test.each(['trigger_date', 'start_date', 'end_date'] as const)(
    'enforces required outer trigger write boundary semantics for %s',
    (field) => {
      const fieldPath = `warrantIssuance.exercise_triggers.0.${field}`;
      const invalidDate = { seconds: 1 };

      expectInvalidWarrantDate(
        () =>
          warrantIssuanceDataToDaml({
            ...baseWarrantIssuance,
            exercise_triggers: [warrantTriggerWithDateField(field, '')],
          }),
        fieldPath,
        ''
      );
      expectInvalidWarrantDate(
        () =>
          warrantIssuanceDataToDaml({
            ...baseWarrantIssuance,
            exercise_triggers: [warrantTriggerWithDateField(field, invalidDate)],
          }),
        fieldPath,
        invalidDate,
        OcpErrorCodes.INVALID_TYPE
      );

      for (const value of [null, undefined]) {
        expectInvalidWarrantDate(
          () =>
            warrantIssuanceDataToDaml({
              ...baseWarrantIssuance,
              exercise_triggers: [warrantTriggerWithDateField(field, value)],
            }),
          fieldPath,
          value,
          OcpErrorCodes.REQUIRED_FIELD_MISSING
        );
      }
    }
  );

  test('uses identical canonical date semantics for outer and nested stock-class triggers', () => {
    const cases = [
      {
        trigger: stockClassTriggerWithTiming({
          type: 'AUTOMATIC_ON_DATE',
          trigger_date: '2024-01-15T23:30:00-05:00',
        }),
        expected: { trigger_date: '2024-01-15T00:00:00.000Z' },
      },
      {
        trigger: stockClassTriggerWithTiming({
          type: 'ELECTIVE_IN_RANGE',
          start_date: '2024-01-15T00:30:00+14:00',
          end_date: '2024-01-15T12:00:00Z',
        }),
        expected: {
          start_date: '2024-01-15T00:00:00.000Z',
          end_date: '2024-01-15T00:00:00.000Z',
        },
      },
    ];

    for (const { trigger, expected } of cases) {
      const result = warrantIssuanceDataToDaml({
        ...baseWarrantIssuance,
        exercise_triggers: [trigger],
      });
      const outer = result.exercise_triggers[0] as unknown as Record<string, unknown>;
      const right = outer.conversion_right as { value: { conversion_trigger: Record<string, unknown> } };
      const nested = right.value.conversion_trigger;

      expect(outer).toMatchObject(expected);
      expect(nested).toMatchObject(expected);
    }
  });

  test.each(['trigger_date', 'start_date', 'end_date'] as const)(
    'validates nested stock-class trigger %s before serialization',
    (field) => {
      const invalidDate = { seconds: 1 };
      expectInvalidWarrantDate(
        () =>
          warrantIssuanceDataToDaml({
            ...baseWarrantIssuance,
            exercise_triggers: [stockClassTriggerWithDateField(field, invalidDate)],
          }),
        `warrantIssuance.exercise_triggers.0.${field}`,
        invalidDate,
        OcpErrorCodes.INVALID_TYPE
      );
    }
  );

  test('STOCK_CLASS_CONVERSION_RIGHT rejects non-NORMAL rounding_type (not persisted in DAML)', () => {
    const input = {
      ...baseWarrantIssuance,
      exercise_triggers: [
        {
          type: 'AUTOMATIC_ON_CONDITION' as const,
          trigger_id: 'w_bad_round',
          trigger_condition: 'X',
          conversion_right: {
            type: 'STOCK_CLASS_CONVERSION_RIGHT' as const,
            converts_to_stock_class_id: '16faa6e5-b13a-4dda-bad2-885fccd2975a',
            conversion_mechanism: {
              type: 'RATIO_CONVERSION' as const,
              ratio: { numerator: '1', denominator: '1' },
              conversion_price: { amount: '1', currency: 'USD' },
              rounding_type: 'CEILING' as const,
            },
          },
        },
      ],
    };
    expect(() => warrantIssuanceDataToDaml(input)).toThrow(OcpValidationError);
    expect(() => warrantIssuanceDataToDaml(input)).toThrow(/rounding_type/);
  });

  test('STOCK_CLASS_CONVERSION_RIGHT + RATIO_CONVERSION maps to OcfRightStockClass and round-trips', () => {
    const stockClassId = '16faa6e5-b13a-4dda-bad2-885fccd2975a';
    const input = {
      ...baseWarrantIssuance,
      exercise_triggers: [
        {
          type: 'AUTOMATIC_ON_CONDITION' as const,
          trigger_id: 'w_stock_ratio',
          nickname: 'Test',
          trigger_description: 'Warrant issuance stock-class conversion right',
          trigger_condition: 'X',
          conversion_right: {
            type: 'STOCK_CLASS_CONVERSION_RIGHT' as const,
            converts_to_stock_class_id: stockClassId,
            conversion_mechanism: {
              type: 'RATIO_CONVERSION' as const,
              ratio: { numerator: '3', denominator: '2' },
              conversion_price: { amount: '10', currency: 'USD' },
              rounding_type: 'NORMAL' as const,
            },
          },
        },
      ],
    };

    const daml = warrantIssuanceDataToDaml(input);
    const trig = requireFirst(daml.exercise_triggers, 'converted warrant exercise trigger');
    expect(trig.conversion_right.tag).toBe('OcfRightStockClass');
    const sr = trig.conversion_right.value as {
      type_: string;
      converts_to_stock_class_id: string;
      conversion_mechanism: string;
      ratio: { numerator: string; denominator: string };
      conversion_price: { amount: string; currency: string };
    };
    expect(sr.type_).toBe('STOCK_CLASS_CONVERSION_RIGHT');
    expect(sr.converts_to_stock_class_id).toBe(stockClassId);
    expect(sr.conversion_mechanism).toBe('OcfConversionMechanismRatioConversion');
    expect(sr.ratio.numerator).toBe('3');
    expect(sr.ratio.denominator).toBe('2');
    expect(sr.conversion_price.amount).toBe('10');
    expect(sr.conversion_price.currency).toBe('USD');

    const dbData = { ...input, object_type: 'TX_WARRANT_ISSUANCE' } as Record<string, unknown>;
    const cantonData = roundTrip(input);
    expect(ocfDeepEqual(dbData, cantonData)).toBe(true);
  });

  test('readback accepts OcfRightStockClass.conversion_mechanism as DAML tagged enum JSON', () => {
    const stockClassId = '16faa6e5-b13a-4dda-bad2-885fccd2975a';
    const input = {
      ...baseWarrantIssuance,
      exercise_triggers: [
        {
          type: 'AUTOMATIC_ON_CONDITION' as const,
          trigger_id: 'w_tagged_mech',
          nickname: 'Test',
          trigger_description: 'Tagged mechanism shape',
          trigger_condition: 'X',
          conversion_right: {
            type: 'STOCK_CLASS_CONVERSION_RIGHT' as const,
            converts_to_stock_class_id: stockClassId,
            conversion_mechanism: {
              type: 'RATIO_CONVERSION' as const,
              ratio: { numerator: '3', denominator: '2' },
              conversion_price: { amount: '10', currency: 'USD' },
              rounding_type: 'NORMAL' as const,
            },
          },
        },
      ],
    };
    const daml = warrantIssuanceDataToDaml(input);
    const payload = JSON.parse(JSON.stringify(daml)) as Record<string, unknown>;
    const trig = payload.exercise_triggers as Array<Record<string, unknown>>;
    const cr = requireFirst(trig, 'serialized warrant exercise trigger').conversion_right as Record<string, unknown>;
    const stockVal = cr.value as Record<string, unknown>;
    stockVal.conversion_mechanism = { tag: 'OcfConversionMechanismRatioConversion' };

    const native = damlWarrantIssuanceDataToNative(payload);
    const nativeTrigger = requireFirst(native.exercise_triggers, 'native warrant exercise trigger');
    expect(nativeTrigger.conversion_right.type).toBe('STOCK_CLASS_CONVERSION_RIGHT');
    if (nativeTrigger.conversion_right.type !== 'STOCK_CLASS_CONVERSION_RIGHT') {
      throw new Error('expected stock class conversion right');
    }
    expect(nativeTrigger.conversion_right.converts_to_stock_class_id).toBe(stockClassId);
    expect(nativeTrigger.conversion_right.conversion_mechanism.type).toBe('RATIO_CONVERSION');
  });

  test('STOCK_CLASS_CONVERSION_RIGHT with unsupported mechanism throws OcpParseError', () => {
    // Intentionally passing runtime-invalid data (CUSTOM_CONVERSION where RATIO_CONVERSION required)
    // to verify the runtime guard in buildWarrantStockClassConversionRight.
    const input = {
      ...baseWarrantIssuance,
      exercise_triggers: [
        {
          type: 'AUTOMATIC_ON_CONDITION' as const,
          trigger_id: 'w_bad_mech',
          trigger_condition: 'X',
          conversion_right: {
            type: 'STOCK_CLASS_CONVERSION_RIGHT' as const,
            converts_to_stock_class_id: '16faa6e5-b13a-4dda-bad2-885fccd2975a',
            conversion_mechanism: {
              type: 'CUSTOM_CONVERSION',
              custom_conversion_description: 'nope',
            } as unknown as RatioConversionMechanism,
          },
        },
      ],
    };
    expect(() => warrantIssuanceDataToDaml(input)).toThrow(OcpParseError);
    expect(() => warrantIssuanceDataToDaml(input)).toThrow(/CUSTOM_CONVERSION/);
  });

  test('SAFE_CONVERSION under WARRANT_CONVERSION_RIGHT throws OcpParseError', () => {
    const input = {
      ...baseWarrantIssuance,
      exercise_triggers: [
        {
          ...baseExerciseTrigger,
          conversion_right: {
            ...baseExerciseTrigger.conversion_right,
            conversion_mechanism: {
              type: 'SAFE_CONVERSION' as unknown as 'CUSTOM_CONVERSION',
              custom_conversion_description: '',
            },
          },
        },
      ],
    } as Parameters<typeof warrantIssuanceDataToDaml>[0];
    expect(() => warrantIssuanceDataToDaml(input)).toThrow(OcpParseError);
    expect(() => warrantIssuanceDataToDaml(input)).toThrow(/SAFE_CONVERSION/);
  });

  test('CONVERTIBLE_NOTE_CONVERSION under WARRANT_CONVERSION_RIGHT throws OcpParseError', () => {
    const input = {
      ...baseWarrantIssuance,
      exercise_triggers: [
        {
          ...baseExerciseTrigger,
          conversion_right: {
            ...baseExerciseTrigger.conversion_right,
            conversion_mechanism: {
              type: 'CONVERTIBLE_NOTE_CONVERSION' as unknown as 'CUSTOM_CONVERSION',
              custom_conversion_description: '',
            },
          },
        },
      ],
    } as Parameters<typeof warrantIssuanceDataToDaml>[0];
    expect(() => warrantIssuanceDataToDaml(input)).toThrow(OcpParseError);
    expect(() => warrantIssuanceDataToDaml(input)).toThrow(/CONVERTIBLE_NOTE_CONVERSION/);
  });

  test('WARRANT_CONVERSION_RIGHT with null conversion_mechanism throws OcpValidationError', () => {
    const input = {
      ...baseWarrantIssuance,
      exercise_triggers: [
        {
          ...baseExerciseTrigger,
          conversion_right: {
            ...baseExerciseTrigger.conversion_right,
            conversion_mechanism:
              null as unknown as (typeof baseWarrantIssuance.exercise_triggers)[0]['conversion_right']['conversion_mechanism'],
          },
        },
      ],
    };
    expect(() => warrantIssuanceDataToDaml(input)).toThrow(OcpValidationError);
  });

  test('unknown conversion_mechanism type throws OcpParseError (never emits undefined)', () => {
    const input = {
      ...baseWarrantIssuance,
      exercise_triggers: [
        {
          ...baseExerciseTrigger,
          conversion_right: {
            ...baseExerciseTrigger.conversion_right,
            conversion_mechanism: {
              type: 'NOT_A_REAL_MECHANISM' as unknown as 'CUSTOM_CONVERSION',
              custom_conversion_description: '',
            },
          },
        },
      ],
    } as Parameters<typeof warrantIssuanceDataToDaml>[0];
    expect(() => warrantIssuanceDataToDaml(input)).toThrow(OcpParseError);
    expect(() => warrantIssuanceDataToDaml(input)).toThrow(/Unknown warrant conversion mechanism/);
    expect(() => warrantIssuanceDataToDaml(input)).toThrow(/NOT_A_REAL_MECHANISM/);
  });

  test('warrant issuance with numeric converts_to_quantity as JS number survives round-trip', () => {
    const input = {
      ...baseWarrantIssuance,
      exercise_triggers: [
        {
          ...baseExerciseTrigger,
          conversion_right: {
            ...baseExerciseTrigger.conversion_right,
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
      ...input,
      exercise_triggers: [
        {
          ...requireFirst(input.exercise_triggers, 'input warrant exercise trigger'),
          conversion_right: {
            ...requireFirst(input.exercise_triggers, 'input warrant exercise trigger').conversion_right,
            conversion_mechanism: {
              type: 'FIXED_AMOUNT_CONVERSION',
              converts_to_quantity: 22500,
            },
          },
        },
      ],
      object_type: 'TX_WARRANT_ISSUANCE',
    };
    const cantonData = roundTrip(input);

    expect(ocfDeepEqual(dbData as Record<string, unknown>, cantonData)).toBe(true);
  });
});
