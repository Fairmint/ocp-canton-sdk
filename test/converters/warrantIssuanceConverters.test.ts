/**
 * Unit tests for WarrantIssuance round-trip conversion.
 *
 * Verifies that OCF data survives the OCF -> DAML -> OCF round-trip and
 * is considered equivalent by ocfDeepEqual. This prevents
 * infinite edit loops in the replication script.
 */

import { OcpErrorCodes, OcpParseError, OcpValidationError, type OcpErrorCode } from '../../src/errors';
import {
  warrantIssuanceDataToDaml,
  type WarrantTriggerTypeInput,
} from '../../src/functions/OpenCapTable/warrantIssuance/createWarrantIssuance';
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

function captureValidationError(action: () => unknown): OcpValidationError {
  try {
    action();
  } catch (error) {
    if (error instanceof OcpValidationError) return error;
    throw error;
  }
  throw new Error('Expected OcpValidationError');
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
    object_type: 'TX_WARRANT_ISSUANCE' as const,
  };
  const baseExerciseTrigger = requireFirst(baseWarrantIssuance.exercise_triggers, 'base warrant exercise trigger');

  function stockClassTrigger(overrides: Record<string, unknown> = {}): WarrantExerciseTrigger {
    const triggerType = (overrides.type ?? 'AUTOMATIC_ON_CONDITION') as WarrantTriggerTypeInput;
    const trigger = {
      trigger_id: 'w_stock_ratio',
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
      type: triggerType,
    };
    return (triggerType === 'AUTOMATIC_ON_CONDITION' || triggerType === 'ELECTIVE_ON_CONDITION'
      ? { trigger_condition: 'X', ...trigger }
      : trigger) as unknown as WarrantExerciseTrigger;
  }

  function expectInvalidLedgerMonetary(convert: () => unknown, fieldPath: string, receivedValue: unknown): void {
    try {
      convert();
      throw new Error('Expected monetary validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_TYPE,
        fieldPath,
        receivedValue,
      });
    }
  }

  it('rejects an unknown runtime trigger type with a typed error', () => {
    const input = {
      ...baseWarrantIssuance,
      exercise_triggers: [{ ...baseExerciseTrigger, type: 'ON_MAGIC_EVENT' }],
    } as unknown as Parameters<typeof warrantIssuanceDataToDaml>[0];

    try {
      warrantIssuanceDataToDaml(input);
      throw new Error('Expected runtime trigger validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        fieldPath: 'warrantIssuance.exercise_triggers.0.type',
        receivedValue: 'ON_MAGIC_EVENT',
      });
    }
  });

  it('attributes an unknown runtime conversion right to the exact second exercise trigger', () => {
    const input = {
      ...baseWarrantIssuance,
      exercise_triggers: [
        baseExerciseTrigger,
        {
          ...baseExerciseTrigger,
          trigger_id: 'warrant2_trigger_2',
          conversion_right: { type: 'NOT_A_REAL_RIGHT' },
        },
      ],
    } as unknown as Parameters<typeof warrantIssuanceDataToDaml>[0];

    try {
      warrantIssuanceDataToDaml(input);
      throw new Error('Expected runtime conversion-right validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpParseError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'warrantIssuance.exercise_triggers.1.conversion_right.type',
      });
    }
  });

  it('rejects a null conversion right on the exact second exercise trigger with a typed error', () => {
    const input = {
      ...baseWarrantIssuance,
      exercise_triggers: [
        baseExerciseTrigger,
        {
          ...baseExerciseTrigger,
          trigger_id: 'warrant2_trigger_2',
          conversion_right: null,
        },
      ],
    } as unknown as Parameters<typeof warrantIssuanceDataToDaml>[0];

    try {
      warrantIssuanceDataToDaml(input);
      throw new Error('Expected conversion-right validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        fieldPath: 'warrantIssuance.exercise_triggers.1.conversion_right',
        receivedValue: null,
      });
    }
  });

  test.each([
    ['null root', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['scalar root', 42, OcpErrorCodes.INVALID_TYPE],
  ] as const)('classifies a %s on write', (_case, value, code) => {
    expect(captureValidationError(() => warrantIssuanceDataToDaml(value as never))).toMatchObject({
      code,
      fieldPath: 'warrantIssuance',
      receivedValue: value,
    });
  });

  test.each([
    ['null', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['record', {}, OcpErrorCodes.INVALID_TYPE],
  ] as const)('classifies a %s exercise_triggers collection on write', (_case, value, code) => {
    const error = captureValidationError(() =>
      warrantIssuanceDataToDaml({ ...baseWarrantIssuance, exercise_triggers: value } as never)
    );
    expect(error).toMatchObject({
      code,
      fieldPath: 'warrantIssuance.exercise_triggers',
      receivedValue: value,
    });
  });

  test.each([
    ['null', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['number', 42, OcpErrorCodes.INVALID_TYPE],
  ] as const)('classifies a %s second exercise trigger on write', (_case, value, code) => {
    const error = captureValidationError(() =>
      warrantIssuanceDataToDaml({
        ...baseWarrantIssuance,
        exercise_triggers: [baseExerciseTrigger, value],
      } as never)
    );
    expect(error).toMatchObject({
      code,
      fieldPath: 'warrantIssuance.exercise_triggers.1',
      receivedValue: value,
    });
  });

  test.each([
    ['null', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['number', 0, OcpErrorCodes.INVALID_TYPE],
    ['empty', '', OcpErrorCodes.INVALID_FORMAT],
  ] as const)('classifies a %s second trigger_id on write', (_case, value, code) => {
    const error = captureValidationError(() =>
      warrantIssuanceDataToDaml({
        ...baseWarrantIssuance,
        exercise_triggers: [baseExerciseTrigger, { ...baseExerciseTrigger, trigger_id: value }],
      } as never)
    );
    expect(error).toMatchObject({
      code,
      fieldPath: 'warrantIssuance.exercise_triggers.1.trigger_id',
      receivedValue: value,
    });
  });

  test.each([
    ['null', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['number', 0, OcpErrorCodes.INVALID_TYPE],
    ['malformed', '2024-02-30', OcpErrorCodes.INVALID_FORMAT],
  ] as const)('classifies a %s required issuance date on write', (_case, value, code) => {
    expect(
      captureValidationError(() => warrantIssuanceDataToDaml({ ...baseWarrantIssuance, date: value } as never))
    ).toMatchObject({ code, fieldPath: 'warrantIssuance.date', receivedValue: value });
  });

  test.each([null, false, 0, ''] as const)('rejects exercise_price %p instead of erasing it', (value) => {
    expect(
      captureValidationError(() =>
        warrantIssuanceDataToDaml({ ...baseWarrantIssuance, exercise_price: value } as never)
      )
    ).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: 'warrantIssuance.exercise_price',
      receivedValue: value,
    });
  });

  it('rejects explicit-null vestings instead of defaulting to an empty array', () => {
    expect(
      captureValidationError(() => warrantIssuanceDataToDaml({ ...baseWarrantIssuance, vestings: null } as never))
    ).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: 'warrantIssuance.vestings',
      receivedValue: null,
    });
  });

  test.each([
    ['null purchase price', 'purchase_price', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['scalar purchase price', 'purchase_price', false, OcpErrorCodes.INVALID_TYPE],
    ['null exemptions', 'security_law_exemptions', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['record exemptions', 'security_law_exemptions', {}, OcpErrorCodes.INVALID_TYPE],
    ['null comments', 'comments', null, OcpErrorCodes.INVALID_TYPE],
  ] as const)('classifies %s on write', (_case, field, value, code) => {
    expect(
      captureValidationError(() => warrantIssuanceDataToDaml({ ...baseWarrantIssuance, [field]: value }))
    ).toMatchObject({ code, fieldPath: `warrantIssuance.${field}`, receivedValue: value });
  });

  test.each([
    ['explicit null', null, OcpErrorCodes.INVALID_TYPE],
    ['number', 42, OcpErrorCodes.INVALID_TYPE],
    ['empty', '', OcpErrorCodes.INVALID_FORMAT],
  ] as const)('strictly validates an optional warrant stock-class target that is %s', (_case, value, code) => {
    const error = captureValidationError(() =>
      warrantIssuanceDataToDaml({
        ...baseWarrantIssuance,
        exercise_triggers: [
          {
            ...baseExerciseTrigger,
            conversion_right: { ...baseExerciseTrigger.conversion_right, converts_to_stock_class_id: value },
          },
        ],
      } as never)
    );
    expect(error).toMatchObject({
      code,
      fieldPath: 'warrantIssuance.exercise_triggers.0.conversion_right.converts_to_stock_class_id',
      receivedValue: value,
    });
  });

  test.each([
    ['missing', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['wrong type', 42, OcpErrorCodes.INVALID_TYPE],
    ['empty', '', OcpErrorCodes.INVALID_FORMAT],
  ] as const)('strictly validates a required stock-class target that is %s', (_case, value, code) => {
    const trigger = stockClassTrigger();
    const error = captureValidationError(() =>
      warrantIssuanceDataToDaml({
        ...baseWarrantIssuance,
        exercise_triggers: [
          {
            ...trigger,
            conversion_right: { ...trigger.conversion_right, converts_to_stock_class_id: value },
          },
        ],
      } as never)
    );
    expect(error).toMatchObject({
      code,
      fieldPath: 'warrantIssuance.exercise_triggers.0.conversion_right.converts_to_stock_class_id',
      receivedValue: value,
    });
  });

  test.each([
    ['warrant', baseExerciseTrigger],
    ['stock-class', stockClassTrigger()],
  ] as const)('strictly validates the %s future-round flag on the exact second trigger', (_kind, trigger) => {
    for (const value of [null, 0, 'false', {}]) {
      const secondTrigger = {
        ...trigger,
        trigger_id: `${trigger.trigger_id}-2`,
        conversion_right: {
          ...trigger.conversion_right,
          converts_to_future_round: value,
        },
      };
      const input = {
        ...baseWarrantIssuance,
        exercise_triggers: [baseExerciseTrigger, secondTrigger],
      } as unknown as Parameters<typeof warrantIssuanceDataToDaml>[0];

      try {
        warrantIssuanceDataToDaml(input);
        throw new Error('Expected future-round validation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpValidationError);
        expect(error).toMatchObject({
          code: OcpErrorCodes.INVALID_TYPE,
          fieldPath: 'warrantIssuance.exercise_triggers.1.conversion_right.converts_to_future_round',
          receivedValue: value,
        });
      }
    }
  });

  test.each([
    ['warrant', baseExerciseTrigger],
    ['stock-class', stockClassTrigger()],
  ] as const)('preserves false for the %s future-round flag', (_kind, trigger) => {
    const secondTrigger = {
      ...trigger,
      trigger_id: `${trigger.trigger_id}-2`,
      conversion_right: {
        ...trigger.conversion_right,
        converts_to_future_round: false,
      },
    };
    const daml = warrantIssuanceDataToDaml({
      ...baseWarrantIssuance,
      exercise_triggers: [baseExerciseTrigger, secondTrigger],
    });

    expect(daml.exercise_triggers[1]?.conversion_right.value.converts_to_future_round).toBe(false);
  });

  test.each([
    ['explicit null', null, OcpErrorCodes.INVALID_TYPE],
    ['wrong type', 42, OcpErrorCodes.INVALID_TYPE],
    ['empty string', '', OcpErrorCodes.INVALID_FORMAT],
  ] as const)('rejects a %s optional warrant stock-class target on the exact second trigger', (_case, value, code) => {
    const input = {
      ...baseWarrantIssuance,
      exercise_triggers: [
        baseExerciseTrigger,
        {
          ...baseExerciseTrigger,
          trigger_id: 'warrant2_trigger_2',
          conversion_right: {
            ...baseExerciseTrigger.conversion_right,
            converts_to_stock_class_id: value,
          },
        },
      ],
    } as unknown as Parameters<typeof warrantIssuanceDataToDaml>[0];

    try {
      warrantIssuanceDataToDaml(input);
      throw new Error('Expected optional stock-class target validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code,
        expectedType: 'non-empty string or omitted property',
        fieldPath: 'warrantIssuance.exercise_triggers.1.conversion_right.converts_to_stock_class_id',
        receivedValue: value,
      });
    }
  });

  test.each([
    ['missing', undefined, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['explicit null', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['wrong type', 42, OcpErrorCodes.INVALID_TYPE],
    ['empty string', '', OcpErrorCodes.INVALID_FORMAT],
  ] as const)('classifies a %s required stock-class target on the exact second trigger', (_case, value, code) => {
    const secondTrigger = stockClassTrigger();
    const input = {
      ...baseWarrantIssuance,
      exercise_triggers: [
        baseExerciseTrigger,
        {
          ...secondTrigger,
          trigger_id: 'w_stock_ratio_2',
          conversion_right: {
            ...secondTrigger.conversion_right,
            converts_to_stock_class_id: value,
          },
        },
      ],
    } as unknown as Parameters<typeof warrantIssuanceDataToDaml>[0];

    try {
      warrantIssuanceDataToDaml(input);
      throw new Error('Expected required stock-class target validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code,
        expectedType: 'non-empty string',
        fieldPath: 'warrantIssuance.exercise_triggers.1.conversion_right.converts_to_stock_class_id',
        receivedValue: value,
      });
    }
  });

  test.each([
    ['missing', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['wrong type', 42, OcpErrorCodes.INVALID_TYPE],
  ] as const)('classifies a %s second exercise-trigger record precisely', (_case, value, code) => {
    const daml = warrantIssuanceDataToDaml(baseWarrantIssuance);
    const firstTrigger = requireFirst(daml.exercise_triggers, 'serialized warrant exercise trigger');

    try {
      damlWarrantIssuanceDataToNative({ ...daml, exercise_triggers: [firstTrigger, value] });
      throw new Error('Expected second trigger validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code,
        fieldPath: 'warrantIssuance.exercise_triggers.1',
        receivedValue: value,
      });
    }
  });

  test.each([
    ['missing', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['wrong type', 42, OcpErrorCodes.INVALID_TYPE],
    ['empty', '', OcpErrorCodes.INVALID_FORMAT],
  ] as const)('classifies a %s second trigger_id precisely', (_case, value, code) => {
    const daml = warrantIssuanceDataToDaml(baseWarrantIssuance);
    const firstTrigger = requireFirst(daml.exercise_triggers, 'serialized warrant exercise trigger');
    const secondTrigger = { ...firstTrigger, trigger_id: value };

    try {
      damlWarrantIssuanceDataToNative({
        ...daml,
        exercise_triggers: [firstTrigger, secondTrigger],
      });
      throw new Error('Expected trigger_id validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code,
        fieldPath: 'warrantIssuance.exercise_triggers.1.trigger_id',
        receivedValue: value,
      });
    }
  });

  test.each([
    ['missing', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['wrong type', {}, OcpErrorCodes.INVALID_TYPE],
  ] as const)('classifies a %s exercise_triggers collection precisely', (_case, value, code) => {
    const daml = warrantIssuanceDataToDaml(baseWarrantIssuance);

    try {
      damlWarrantIssuanceDataToNative({ ...daml, exercise_triggers: value });
      throw new Error('Expected exercise_triggers validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code,
        expectedType: 'array',
        fieldPath: 'warrantIssuance.exercise_triggers',
        receivedValue: value,
      });
    }
  });

  it('attributes an unknown DAML trigger tag to the exact second exercise trigger', () => {
    const daml = warrantIssuanceDataToDaml(baseWarrantIssuance);
    const firstTrigger = requireFirst(daml.exercise_triggers, 'serialized warrant exercise trigger');
    try {
      damlWarrantIssuanceDataToNative({
        ...daml,
        exercise_triggers: [
          firstTrigger,
          { ...firstTrigger, trigger_id: 'warrant2_trigger_2', type_: 'OcfTriggerTypeTypeWrong' },
        ],
      });
      throw new Error('Expected trigger tag validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpParseError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        source: 'warrantIssuance.exercise_triggers.1.type_',
      });
    }
  });

  it('rejects an empty required custom_id on ledger readback', () => {
    const daml = warrantIssuanceDataToDaml(baseWarrantIssuance);

    try {
      damlWarrantIssuanceDataToNative({ ...daml, custom_id: '' });
      throw new Error('Expected custom_id validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'warrantIssuance.custom_id',
        receivedValue: '',
      });
    }
  });

  test.each([
    ['null', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['number', 42, OcpErrorCodes.INVALID_TYPE],
    ['malformed', '2024-02-30', OcpErrorCodes.INVALID_FORMAT],
  ] as const)('classifies a %s required issuance date on readback', (_case, value, code) => {
    const daml = warrantIssuanceDataToDaml(baseWarrantIssuance);
    const error = captureValidationError(() => damlWarrantIssuanceDataToNative({ ...daml, date: value }));
    expect(error).toMatchObject({ code, fieldPath: 'warrantIssuance.date', receivedValue: value });
  });

  it('classifies a missing required purchase_price on readback', () => {
    const daml = warrantIssuanceDataToDaml(baseWarrantIssuance);
    expect(
      captureValidationError(() => damlWarrantIssuanceDataToNative({ ...daml, purchase_price: null }))
    ).toMatchObject({
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      fieldPath: 'warrantIssuance.purchase_price',
      receivedValue: null,
    });
  });

  test('rejects a ledger-invalid empty optional trigger nickname at its exact path', () => {
    const daml = warrantIssuanceDataToDaml(baseWarrantIssuance);
    const firstTrigger = requireFirst(daml.exercise_triggers, 'serialized warrant trigger');
    const error = captureValidationError(() =>
      damlWarrantIssuanceDataToNative({
        ...daml,
        exercise_triggers: [{ ...firstTrigger, nickname: '' }],
      })
    );
    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'warrantIssuance.exercise_triggers.0.nickname',
      receivedValue: '',
    });
  });

  test.each(['0', '-1'] as const)('rejects non-positive second vesting amount %s on readback', (amount) => {
    const daml = warrantIssuanceDataToDaml({
      ...baseWarrantIssuance,
      vestings: [{ date: '2024-01-01', amount: '1' }],
    });
    const firstVesting = requireFirst(daml.vestings, 'serialized warrant vesting');
    const error = captureValidationError(() =>
      damlWarrantIssuanceDataToNative({
        ...daml,
        vestings: [firstVesting, { ...firstVesting, amount }],
      })
    );
    expect(error).toMatchObject({
      code: OcpErrorCodes.OUT_OF_RANGE,
      fieldPath: 'warrantIssuance.vestings.1.amount',
      receivedValue: amount,
    });
  });

  it('validates a malformed readback vesting date before its non-positive amount', () => {
    const daml = warrantIssuanceDataToDaml({
      ...baseWarrantIssuance,
      vestings: [{ date: '2024-01-01', amount: '1' }],
    });
    const firstVesting = requireFirst(daml.vestings, 'serialized warrant vesting');

    expectInvalidWarrantDate(
      () =>
        damlWarrantIssuanceDataToNative({
          ...daml,
          vestings: [firstVesting, { date: '', amount: '0' }],
        }),
      'warrantIssuance.vestings.1.date',
      '',
      OcpErrorCodes.INVALID_FORMAT
    );
  });

  test.each([
    ['null', null],
    ['array', []],
    ['primitive', 'not-a-vesting'],
  ] as const)('rejects a %s second vesting with an indexed structured error', (_case, invalidVesting) => {
    const daml = warrantIssuanceDataToDaml({
      ...baseWarrantIssuance,
      vestings: [{ date: '2024-01-01', amount: '1' }],
    });
    const firstVesting = requireFirst(daml.vestings, 'serialized warrant vesting');
    const error = captureValidationError(() =>
      damlWarrantIssuanceDataToNative({
        ...daml,
        vestings: [firstVesting, invalidVesting],
      })
    );

    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: 'warrantIssuance.vestings.1',
      expectedType: 'object',
      receivedValue: invalidVesting,
    });
  });

  test.each([0, false, '', []] as const)(
    'rejects malformed optional exercise_price %p instead of treating it as absent',
    (value) => {
      const daml = warrantIssuanceDataToDaml(baseWarrantIssuance);
      expectInvalidLedgerMonetary(
        () => damlWarrantIssuanceDataToNative({ ...daml, exercise_price: value }),
        'warrantIssuance.exercise_price',
        value
      );
    }
  );

  test.each([0, false, '', []] as const)('rejects malformed required purchase_price %p contextually', (value) => {
    const daml = warrantIssuanceDataToDaml(baseWarrantIssuance);
    expectInvalidLedgerMonetary(
      () => damlWarrantIssuanceDataToNative({ ...daml, purchase_price: value }),
      'warrantIssuance.purchase_price',
      value
    );
  });

  test.each([
    ['purchase_price', 'warrantIssuance.purchase_price.amount'],
    ['exercise_price', 'warrantIssuance.exercise_price.amount'],
  ] as const)('reports malformed %s amount at its OCF field path', (field, fieldPath) => {
    const daml = warrantIssuanceDataToDaml(baseWarrantIssuance);
    const amount = '1e3';

    try {
      damlWarrantIssuanceDataToNative({
        ...daml,
        [field]: { amount, currency: 'USD' },
      });
      throw new Error('Expected monetary amount validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath,
        receivedValue: amount,
      });
    }
  });

  test.each([
    ['purchase_price', 'warrantIssuance.purchase_price.amount'],
    ['exercise_price', 'warrantIssuance.exercise_price.amount'],
  ] as const)('reports malformed write-side %s amount at its OCF field path', (field, fieldPath) => {
    const amount = '1e3';
    try {
      warrantIssuanceDataToDaml({
        ...baseWarrantIssuance,
        [field]: { amount, currency: 'USD' },
      });
      throw new Error('Expected monetary amount validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath,
        receivedValue: amount,
      });
    }
  });

  it('reports a malformed write-side vesting amount at its OCF field path', () => {
    const amount = '1e3';
    try {
      warrantIssuanceDataToDaml({
        ...baseWarrantIssuance,
        vestings: [
          { date: '2024-01-01', amount: '1' },
          { date: '2024-02-01', amount },
        ],
      });
      throw new Error('Expected vesting amount validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'warrantIssuance.vestings.1.amount',
        receivedValue: amount,
      });
    }
  });

  it('validates zero-amount vesting dates before filtering and preserves original indexes', () => {
    expectInvalidWarrantDate(
      () =>
        warrantIssuanceDataToDaml({
          ...baseWarrantIssuance,
          vestings: [
            { date: '2024-01-01', amount: '0' },
            { date: '', amount: '0' },
          ],
        }),
      'warrantIssuance.vestings.1.date',
      '',
      OcpErrorCodes.INVALID_FORMAT
    );

    const encoded = warrantIssuanceDataToDaml({
      ...baseWarrantIssuance,
      vestings: [
        { date: '2024-01-01', amount: '0' },
        { date: '2024-02-01', amount: '1' },
      ],
    });
    expect(encoded.vestings).toEqual([{ date: '2024-02-01T00:00:00.000Z', amount: '1' }]);
  });

  it('rejects a negative vesting amount instead of silently dropping it', () => {
    const amount = '-1';
    const error = captureValidationError(() =>
      warrantIssuanceDataToDaml({
        ...baseWarrantIssuance,
        vestings: [
          { date: '2024-01-01', amount: '1' },
          { date: '2024-02-01', amount },
        ],
      })
    );
    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error).toMatchObject({
      code: OcpErrorCodes.OUT_OF_RANGE,
      fieldPath: 'warrantIssuance.vestings.1.amount',
      receivedValue: amount,
    });
  });

  it('reports a malformed mechanism field on the exact second exercise trigger', () => {
    const convertsToQuantity = '1e3';
    try {
      warrantIssuanceDataToDaml({
        ...baseWarrantIssuance,
        exercise_triggers: [
          baseExerciseTrigger,
          {
            ...baseExerciseTrigger,
            trigger_id: 'warrant2_trigger_2',
            conversion_right: {
              ...baseExerciseTrigger.conversion_right,
              conversion_mechanism: {
                ...baseExerciseTrigger.conversion_right.conversion_mechanism,
                converts_to_quantity: convertsToQuantity,
              },
            },
          },
        ],
      });
      throw new Error('Expected conversion quantity validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'warrantIssuance.exercise_triggers.1.conversion_right.conversion_mechanism.converts_to_quantity',
        receivedValue: convertsToQuantity,
      });
    }
  });

  test.each(['1e3', 'not-a-number', ''])('reports malformed quantity %p at its OCF field path', (quantity) => {
    const daml = warrantIssuanceDataToDaml(baseWarrantIssuance);

    try {
      damlWarrantIssuanceDataToNative({ ...daml, quantity });
      throw new Error('Expected quantity validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'warrantIssuance.quantity',
        receivedValue: quantity,
      });
    }
  });

  it('preserves a zero quantity value on readback', () => {
    const daml = warrantIssuanceDataToDaml(baseWarrantIssuance);
    const result = damlWarrantIssuanceDataToNative({ ...daml, quantity: '0' });

    expect(result.quantity).toBe('0');
  });

  it('reports a malformed vesting amount at its indexed OCF field path', () => {
    const daml = warrantIssuanceDataToDaml(baseWarrantIssuance);
    const amount = '1e3';

    try {
      damlWarrantIssuanceDataToNative({
        ...daml,
        vestings: [
          { date: '2024-01-01T00:00:00Z', amount: '1' },
          { date: '2024-02-01T00:00:00Z', amount },
        ],
      });
      throw new Error('Expected vesting amount validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'warrantIssuance.vestings.1.amount',
        receivedValue: amount,
      });
    }
  });

  test.each([
    {
      tag: 'OcfWarrantMechanismValuationBased',
      field: 'valuation_amount',
      fieldPath: 'warrantIssuance.exercise_triggers.0.conversion_right.value.conversion_mechanism.valuation_amount',
      value: { valuation_type: 'CAP' },
    },
    {
      tag: 'OcfWarrantMechanismPpsBased',
      field: 'discount_amount',
      fieldPath: 'warrantIssuance.exercise_triggers.0.conversion_right.value.conversion_mechanism.discount_amount',
      value: { description: 'Next financing', discount: false },
    },
  ])('reports malformed $field with its contextual path', ({ tag, field, fieldPath, value }) => {
    const daml = warrantIssuanceDataToDaml(baseWarrantIssuance);
    const malformed = { amount: 'not-a-number', currency: 'USD' };
    const trigger = {
      type_: 'OcfTriggerTypeTypeElectiveAtWill',
      trigger_id: `trigger-${field}`,
      conversion_right: {
        tag: 'OcfRightWarrant',
        value: {
          type_: 'WARRANT_CONVERSION_RIGHT',
          conversion_mechanism: {
            tag,
            value: { ...value, [field]: malformed },
          },
        },
      },
    };

    try {
      damlWarrantIssuanceDataToNative({ ...daml, exercise_triggers: [trigger] });
      throw new Error('Expected monetary validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: `${fieldPath}.amount`,
        receivedValue: malformed.amount,
      });
    }
  });

  test.each([0, false, '', []] as const)(
    'rejects malformed stock-class conversion_price %p instead of treating it as absent',
    (value) => {
      const daml = warrantIssuanceDataToDaml({
        ...baseWarrantIssuance,
        exercise_triggers: [stockClassTrigger()],
      });
      const payload = JSON.parse(JSON.stringify(daml)) as Record<string, unknown>;
      const triggers = payload.exercise_triggers as Array<Record<string, unknown>>;
      const conversionRight = requireFirst(triggers, 'serialized warrant exercise trigger').conversion_right as {
        value: Record<string, unknown>;
      };
      conversionRight.value.conversion_price = value;

      expectInvalidLedgerMonetary(
        () => damlWarrantIssuanceDataToNative(payload),
        'warrantIssuance.exercise_triggers.0.conversion_right.value.conversion_mechanism.conversion_price',
        value
      );
    }
  );

  test('rejects a malformed tagged Some stock-class conversion_price value', () => {
    const daml = warrantIssuanceDataToDaml({
      ...baseWarrantIssuance,
      exercise_triggers: [stockClassTrigger()],
    });
    const payload = JSON.parse(JSON.stringify(daml)) as Record<string, unknown>;
    const triggers = payload.exercise_triggers as Array<Record<string, unknown>>;
    const conversionRight = requireFirst(triggers, 'serialized warrant exercise trigger').conversion_right as {
      value: Record<string, unknown>;
    };
    conversionRight.value.conversion_price = { tag: 'Some', value: false };

    try {
      damlWarrantIssuanceDataToNative(payload);
      throw new Error('Expected tagged Some conversion_price validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'warrantIssuance.exercise_triggers.0.conversion_right.value.conversion_mechanism.conversion_price',
        expectedType: 'direct Monetary record or null',
        receivedValue: { tag: 'Some', value: false },
      });
    }
  });

  test('basic warrant issuance survives round-trip', () => {
    const dbData = { ...baseWarrantIssuance, object_type: 'TX_WARRANT_ISSUANCE' } as Record<string, unknown>;
    const cantonData = roundTrip(baseWarrantIssuance);

    expect(ocfDeepEqual(dbData, cantonData)).toBe(true);
  });

  it('rejects a bare trigger discriminator at both writer and generated-read boundaries', () => {
    const writerError = captureValidationError(() =>
      warrantIssuanceDataToDaml({
        ...baseWarrantIssuance,
        exercise_triggers: ['AUTOMATIC_ON_DATE'],
      } as never)
    );
    expect(writerError).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: 'warrantIssuance.exercise_triggers.0',
      receivedValue: 'AUTOMATIC_ON_DATE',
    });

    const daml = warrantIssuanceDataToDaml(baseWarrantIssuance);
    const readerError = captureValidationError(() =>
      damlWarrantIssuanceDataToNative({ ...daml, exercise_triggers: ['AUTOMATIC_ON_DATE'] })
    );
    expect(readerError).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: 'warrantIssuance.exercise_triggers.0',
      receivedValue: 'AUTOMATIC_ON_DATE',
    });
  });

  it.each([
    ['trigger_id', 'warrantIssuance.exercise_triggers.0.trigger_id'],
    ['conversion_right', 'warrantIssuance.exercise_triggers.0.conversion_right'],
  ] as const)('requires generated exercise-trigger %s instead of synthesizing it', (field, fieldPath) => {
    const daml = warrantIssuanceDataToDaml(baseWarrantIssuance);
    const trigger = { ...requireFirst(daml.exercise_triggers, 'converted warrant exercise trigger') } as Record<
      string,
      unknown
    >;
    delete trigger[field];

    const error = captureValidationError(() =>
      damlWarrantIssuanceDataToNative({ ...daml, exercise_triggers: [trigger] })
    );
    expect(error).toMatchObject({
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      fieldPath,
      receivedValue: undefined,
    });
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
    const input = {
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
    const input = {
      ...baseWarrantIssuance,
      board_approval_date: '2024-06-01',
      stockholder_approval_date: '2024-06-05',
      consideration_text: 'Cash and services',
      vestings: [{ date: '2024-01-01', amount: '100' }] as [{ date: string; amount: string }],
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

  it('decodes only the required AUTOMATIC_ON_DATE trigger_date', () => {
    const daml = warrantIssuanceDataToDaml(baseWarrantIssuance);
    const trigger = {
      ...daml.exercise_triggers[0],
      type_: 'OcfTriggerTypeTypeAutomaticOnDate',
      trigger_date: '2024-01-15T23:30:00-05:00',
      trigger_condition: null,
      start_date: null,
      end_date: null,
    };
    const result = damlWarrantIssuanceDataToNative({ ...daml, exercise_triggers: [trigger] });

    expect(result.exercise_triggers[0]).toMatchObject({ type: 'AUTOMATIC_ON_DATE', trigger_date: '2024-01-15' });
    expect(result.exercise_triggers[0]).not.toHaveProperty('start_date');
    expect(result.exercise_triggers[0]).not.toHaveProperty('end_date');
  });

  it('decodes only the required ELECTIVE_IN_RANGE dates', () => {
    const daml = warrantIssuanceDataToDaml(baseWarrantIssuance);
    const trigger = {
      ...daml.exercise_triggers[0],
      type_: 'OcfTriggerTypeTypeElectiveInRange',
      trigger_date: null,
      trigger_condition: null,
      start_date: '2024-01-15T00:00:00Z',
      end_date: '2024-02-15T00:00:00Z',
    };
    const result = damlWarrantIssuanceDataToNative({ ...daml, exercise_triggers: [trigger] });

    expect(result.exercise_triggers[0]).toMatchObject({
      type: 'ELECTIVE_IN_RANGE',
      start_date: '2024-01-15',
      end_date: '2024-02-15',
    });
    expect(result.exercise_triggers[0]).not.toHaveProperty('trigger_date');
  });

  it('rejects date fields forbidden by the trigger discriminator on readback', () => {
    const daml = warrantIssuanceDataToDaml(baseWarrantIssuance);
    expectInvalidWarrantDate(
      () =>
        damlWarrantIssuanceDataToNative({
          ...daml,
          exercise_triggers: [{ ...daml.exercise_triggers[0], trigger_date: '2024-01-15T00:00:00Z' }],
        }),
      'warrantIssuance.exercise_triggers.0.trigger_date',
      '2024-01-15T00:00:00Z',
      OcpErrorCodes.SCHEMA_MISMATCH
    );
  });

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

  it('rejects date fields forbidden by the trigger discriminator on write', () => {
    expectInvalidWarrantDate(
      () =>
        warrantIssuanceDataToDaml({
          ...baseWarrantIssuance,
          exercise_triggers: [{ ...baseExerciseTrigger, trigger_date: '2024-01-15' }],
        } as never),
      'warrantIssuance.exercise_triggers.0.trigger_date',
      '2024-01-15',
      OcpErrorCodes.INVALID_FORMAT
    );
  });

  test('uses identical canonical AUTOMATIC_ON_DATE semantics for outer and nested stock-class triggers', () => {
    const result = warrantIssuanceDataToDaml({
      ...baseWarrantIssuance,
      exercise_triggers: [
        stockClassTrigger({
          type: 'AUTOMATIC_ON_DATE',
          trigger_date: '2024-01-15T23:30:00-05:00',
        }),
      ],
    });
    const outer = result.exercise_triggers[0] as unknown as Record<string, unknown>;
    const right = outer.conversion_right as { value: { conversion_trigger: Record<string, unknown> } };
    const nested = right.value.conversion_trigger;

    expect(outer).toMatchObject({ trigger_date: '2024-01-15T00:00:00.000Z', start_date: null, end_date: null });
    expect(nested).toMatchObject({ trigger_date: '2024-01-15T00:00:00.000Z', start_date: null, end_date: null });
  });

  test('uses identical canonical ELECTIVE_IN_RANGE semantics for outer and nested stock-class triggers', () => {
    const result = warrantIssuanceDataToDaml({
      ...baseWarrantIssuance,
      exercise_triggers: [
        stockClassTrigger({
          type: 'ELECTIVE_IN_RANGE',
          start_date: '2024-01-15T00:30:00+14:00',
          end_date: '2024-02-15T23:30:00-05:00',
        }),
      ],
    });
    const outer = result.exercise_triggers[0] as unknown as Record<string, unknown>;
    const right = outer.conversion_right as { value: { conversion_trigger: Record<string, unknown> } };
    const nested = right.value.conversion_trigger;

    expect(outer).toMatchObject({
      trigger_date: null,
      start_date: '2024-01-15T00:00:00.000Z',
      end_date: '2024-02-15T00:00:00.000Z',
    });
    expect(nested).toMatchObject({
      trigger_date: null,
      start_date: '2024-01-15T00:00:00.000Z',
      end_date: '2024-02-15T00:00:00.000Z',
    });
  });

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

  test('readback rejects OcfRightStockClass.conversion_mechanism as a non-generated tagged object', () => {
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

    const error = captureValidationError(() => damlWarrantIssuanceDataToNative(payload));
    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: 'warrantIssuance.exercise_triggers.0.conversion_right.value.conversion_mechanism.type',
      receivedValue: { tag: 'OcfConversionMechanismRatioConversion' },
    });
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
