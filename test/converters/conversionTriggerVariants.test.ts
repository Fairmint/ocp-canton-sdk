import { OcpErrorCodes, OcpParseError, OcpValidationError, type OcpErrorCode } from '../../src/errors';
import { convertibleIssuanceDataToDaml } from '../../src/functions/OpenCapTable/convertibleIssuance/createConvertibleIssuance';
import { damlConvertibleIssuanceDataToNative } from '../../src/functions/OpenCapTable/convertibleIssuance/getConvertibleIssuanceAsOcf';
import { warrantIssuanceDataToDaml } from '../../src/functions/OpenCapTable/warrantIssuance/createWarrantIssuance';
import { damlWarrantIssuanceDataToNative } from '../../src/functions/OpenCapTable/warrantIssuance/getWarrantIssuanceAsOcf';
import type { ConvertibleConversionTrigger, WarrantExerciseTrigger } from '../../src/types/native';
import { parseConversionTriggerFields } from '../../src/utils/conversionTriggers';
import { requireFirst } from '../../src/utils/requireDefined';

const convertibleRight = {
  type: 'CONVERTIBLE_CONVERSION_RIGHT' as const,
  conversion_mechanism: {
    type: 'FIXED_AMOUNT_CONVERSION' as const,
    converts_to_quantity: '100',
  },
};

const warrantRight = {
  type: 'WARRANT_CONVERSION_RIGHT' as const,
  conversion_mechanism: {
    type: 'FIXED_AMOUNT_CONVERSION' as const,
    converts_to_quantity: '100',
  },
};

const convertibleTriggerVariants: ConvertibleConversionTrigger[] = [
  {
    type: 'AUTOMATIC_ON_CONDITION',
    trigger_id: 'automatic-condition',
    trigger_condition: 'Qualified financing closes',
    conversion_right: convertibleRight,
  },
  {
    type: 'AUTOMATIC_ON_DATE',
    trigger_id: 'automatic-date',
    trigger_date: '2027-01-01',
    conversion_right: convertibleRight,
  },
  {
    type: 'ELECTIVE_IN_RANGE',
    trigger_id: 'elective-range',
    start_date: '2027-01-01',
    end_date: '2027-12-31',
    conversion_right: convertibleRight,
  },
  {
    type: 'ELECTIVE_ON_CONDITION',
    trigger_id: 'elective-condition',
    trigger_condition: 'Holder elects after a liquidity event',
    conversion_right: convertibleRight,
  },
  {
    type: 'ELECTIVE_AT_WILL',
    trigger_id: 'elective-at-will',
    conversion_right: convertibleRight,
  },
  {
    type: 'UNSPECIFIED',
    trigger_id: 'unspecified',
    conversion_right: convertibleRight,
  },
];

const warrantTriggerVariants: WarrantExerciseTrigger[] = convertibleTriggerVariants.map((trigger) => ({
  ...trigger,
  conversion_right: warrantRight,
}));

const convertibleBase = {
  id: 'convertible-1',
  date: '2026-07-09',
  security_id: 'security-1',
  custom_id: 'SAFE-1',
  stakeholder_id: 'stakeholder-1',
  security_law_exemptions: [],
  investment_amount: { amount: '1000', currency: 'USD' },
  convertible_type: 'SAFE' as const,
  seniority: 1,
};

const warrantBase = {
  id: 'warrant-1',
  date: '2026-07-09',
  security_id: 'security-1',
  custom_id: 'W-1',
  stakeholder_id: 'stakeholder-1',
  security_law_exemptions: [],
  purchase_price: { amount: '1000', currency: 'USD' },
};

function convertibleRangeTrigger(startDate: string, endDate: string): ConvertibleConversionTrigger {
  return {
    type: 'ELECTIVE_IN_RANGE',
    trigger_id: 'elective-range',
    start_date: startDate,
    end_date: endDate,
    conversion_right: convertibleRight,
  };
}

function warrantRangeTrigger(startDate: string, endDate: string): WarrantExerciseTrigger {
  return {
    type: 'ELECTIVE_IN_RANGE',
    trigger_id: 'elective-range',
    start_date: startDate,
    end_date: endDate,
    conversion_right: warrantRight,
  };
}

function expectValidationError(run: () => unknown, fieldPath: string, code: OcpErrorCode): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error).toMatchObject({ fieldPath, code });
    return;
  }
  throw new Error(`Expected OcpValidationError at ${fieldPath}`);
}

function expectGeneratedParseError(run: () => unknown, entityType: string, decoderPath: string): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(OcpParseError);
    expect(error).toMatchObject({
      source: `damlEntityData.${entityType}`,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: { decoderPath },
    });
    return;
  }
  throw new Error(`Expected generated decoder failure at ${decoderPath}`);
}

function expectDuplicateTriggerIdError(
  run: () => unknown,
  fieldPath: string,
  code: OcpErrorCode,
  triggerId: string,
  firstIndex: number,
  duplicateIndex: number
): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error).toMatchObject({
      fieldPath,
      code,
      receivedValue: triggerId,
      context: expect.objectContaining({ triggerId, firstIndex, duplicateIndex }),
    });
    expect((error as Error).message).toContain(`Duplicate trigger_id ${JSON.stringify(triggerId)}`);
    return;
  }
  throw new Error(`Expected duplicate trigger_id validation at ${fieldPath}`);
}

function requireFirstTwo<T>(values: readonly T[], description: string): [T, T] {
  return [requireFirst(values, `first ${description}`), requireFirst(values.slice(1), `second ${description}`)];
}

describe('exact conversion-trigger converter behavior', () => {
  it('rejects a non-object trigger payload', () => {
    expect(() => parseConversionTriggerFields(null, 'conversionTrigger')).toThrow(
      /Conversion trigger must be an object/
    );
  });

  it.each([
    { name: 'missing', value: undefined, code: OcpErrorCodes.REQUIRED_FIELD_MISSING },
    { name: 'null', value: null, code: OcpErrorCodes.REQUIRED_FIELD_MISSING },
    { name: 'non-string', value: 42, code: OcpErrorCodes.INVALID_TYPE },
    { name: 'empty', value: '', code: OcpErrorCodes.INVALID_FORMAT },
    { name: 'unknown', value: 'NOT_A_TRIGGER', code: OcpErrorCodes.UNKNOWN_ENUM_VALUE },
  ])('rejects a $name trigger discriminator with exact taxonomy', ({ value, code }) => {
    expectValidationError(
      () =>
        parseConversionTriggerFields(
          {
            type: value,
            trigger_id: 'invalid-type',
            conversion_right: convertibleRight,
          },
          'conversionTrigger'
        ),
      'conversionTrigger.type',
      code
    );
  });

  it.each([
    { field: 'unexpected_field', value: 'not allowed', code: OcpErrorCodes.SCHEMA_MISMATCH },
    { field: 'trigger_date', value: undefined, code: OcpErrorCodes.INVALID_FORMAT },
  ])('rejects an own $field outside the canonical variant shape', ({ field, value, code }) => {
    expectValidationError(
      () =>
        parseConversionTriggerFields(
          {
            type: 'UNSPECIFIED',
            trigger_id: 'strict-own-fields',
            conversion_right: convertibleRight,
            [field]: value,
          },
          'conversionTrigger.3'
        ),
      `conversionTrigger.3.${field}`,
      code
    );
  });

  it.each([
    {
      field: 'trigger_id',
      trigger: { type: 'UNSPECIFIED', trigger_id: '', conversion_right: convertibleRight },
    },
    {
      field: 'trigger_condition',
      trigger: {
        type: 'AUTOMATIC_ON_CONDITION',
        trigger_id: 'empty-condition',
        trigger_condition: '',
        conversion_right: convertibleRight,
      },
    },
    {
      field: 'trigger_date',
      trigger: {
        type: 'AUTOMATIC_ON_DATE',
        trigger_id: 'empty-date',
        trigger_date: '',
        conversion_right: convertibleRight,
      },
    },
    {
      field: 'start_date',
      trigger: {
        type: 'ELECTIVE_IN_RANGE',
        trigger_id: 'empty-start',
        start_date: '',
        end_date: '2027-12-31',
        conversion_right: convertibleRight,
      },
    },
    {
      field: 'end_date',
      trigger: {
        type: 'ELECTIVE_IN_RANGE',
        trigger_id: 'empty-end',
        start_date: '2027-01-01',
        end_date: '',
        conversion_right: convertibleRight,
      },
    },
  ])('rejects an empty required $field', ({ field, trigger }) => {
    expect(() => parseConversionTriggerFields(trigger, 'conversionTrigger')).toThrow(
      new RegExp(`${field} is required and must be a non-empty string`)
    );
  });

  it.each(convertibleTriggerVariants)('round-trips convertible $type without synthesizing fields', (trigger) => {
    const daml = convertibleIssuanceDataToDaml({
      ...convertibleBase,
      conversion_triggers: [trigger],
    });
    const native = damlConvertibleIssuanceDataToNative(daml);

    expect(requireFirst(native.conversion_triggers, 'native convertible trigger')).toEqual(trigger);
  });

  it.each(warrantTriggerVariants)('round-trips warrant $type without synthesizing fields', (trigger) => {
    const daml = warrantIssuanceDataToDaml({
      ...warrantBase,
      exercise_triggers: [trigger],
    });
    const native = damlWarrantIssuanceDataToNative(daml);

    expect(requireFirst(native.exercise_triggers, 'native warrant trigger')).toEqual(trigger);
  });

  it.each([
    {
      family: 'convertible',
      fieldPath: 'convertibleIssuance.conversion_triggers.1.trigger_id',
      run: () =>
        convertibleIssuanceDataToDaml({
          ...convertibleBase,
          conversion_triggers: [
            { ...convertibleTriggerVariants[0]!, trigger_id: 'shared-trigger-id' },
            { ...convertibleTriggerVariants[1]!, trigger_id: 'shared-trigger-id' },
          ],
        }),
    },
    {
      family: 'warrant',
      fieldPath: 'warrantIssuance.exercise_triggers.1.trigger_id',
      run: () =>
        warrantIssuanceDataToDaml({
          ...warrantBase,
          exercise_triggers: [
            { ...warrantTriggerVariants[0]!, trigger_id: 'shared-trigger-id' },
            { ...warrantTriggerVariants[1]!, trigger_id: 'shared-trigger-id' },
          ],
        }),
    },
  ] as const)('rejects duplicate $family writer trigger IDs across differing variants', ({ run, fieldPath }) => {
    expectDuplicateTriggerIdError(run, fieldPath, OcpErrorCodes.INVALID_FORMAT, 'shared-trigger-id', 0, 1);
  });

  it.each([
    {
      family: 'convertible',
      fieldPath: 'convertibleIssuance.conversion_triggers.1.trigger_id',
      run: () => {
        const daml = convertibleIssuanceDataToDaml({
          ...convertibleBase,
          conversion_triggers: requireFirstTwo(convertibleTriggerVariants, 'convertible trigger'),
        });
        const [first, second] = requireFirstTwo(daml.conversion_triggers, 'DAML convertible trigger');
        second.trigger_id = first.trigger_id;
        return damlConvertibleIssuanceDataToNative(daml);
      },
    },
    {
      family: 'warrant',
      fieldPath: 'warrantIssuance.exercise_triggers.1.trigger_id',
      run: () => {
        const daml = warrantIssuanceDataToDaml({
          ...warrantBase,
          exercise_triggers: warrantTriggerVariants.slice(0, 2),
        });
        const [first, second] = requireFirstTwo(daml.exercise_triggers, 'DAML warrant trigger');
        second.trigger_id = first.trigger_id;
        return damlWarrantIssuanceDataToNative(daml);
      },
    },
  ] as const)('rejects duplicate $family reader trigger IDs across differing variants', ({ run, fieldPath }) => {
    expectDuplicateTriggerIdError(run, fieldPath, OcpErrorCodes.SCHEMA_MISMATCH, 'automatic-condition', 0, 1);
  });

  it.each([
    {
      family: 'convertible writer',
      fieldPath: 'convertibleIssuance.conversion_triggers.0.end_date',
      code: OcpErrorCodes.INVALID_FORMAT,
      run: () =>
        convertibleIssuanceDataToDaml({
          ...convertibleBase,
          conversion_triggers: [convertibleRangeTrigger('2028-12-31', '2028-01-01')],
        }),
    },
    {
      family: 'warrant writer',
      fieldPath: 'warrantIssuance.exercise_triggers.0.end_date',
      code: OcpErrorCodes.INVALID_FORMAT,
      run: () =>
        warrantIssuanceDataToDaml({
          ...warrantBase,
          exercise_triggers: [warrantRangeTrigger('2028-12-31', '2028-01-01')],
        }),
    },
    {
      family: 'convertible reader',
      fieldPath: 'convertibleIssuance.conversion_triggers.0.end_date',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      run: () => {
        const daml = convertibleIssuanceDataToDaml({
          ...convertibleBase,
          conversion_triggers: [convertibleRangeTrigger('2027-01-01', '2027-12-31')],
        });
        const trigger = requireFirst(daml.conversion_triggers, 'DAML convertible trigger');
        trigger.start_date = '2028-12-31T00:00:00.000Z';
        trigger.end_date = '2028-01-01T00:00:00.000Z';
        return damlConvertibleIssuanceDataToNative(daml);
      },
    },
    {
      family: 'warrant reader',
      fieldPath: 'warrantIssuance.exercise_triggers.0.end_date',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      run: () => {
        const daml = warrantIssuanceDataToDaml({
          ...warrantBase,
          exercise_triggers: [warrantRangeTrigger('2027-01-01', '2027-12-31')],
        });
        const trigger = requireFirst(daml.exercise_triggers, 'DAML warrant trigger');
        trigger.start_date = '2028-12-31T00:00:00.000Z';
        trigger.end_date = '2028-01-01T00:00:00.000Z';
        return damlWarrantIssuanceDataToNative(daml);
      },
    },
  ] as const)('rejects a reversed ELECTIVE_IN_RANGE window at the $family boundary', ({ run, fieldPath, code }) => {
    expectValidationError(run, fieldPath, code);
  });

  it.each([
    { name: 'ordered', startDate: '2027-01-01', endDate: '2027-12-31' },
    { name: 'single-day inclusive', startDate: '2027-06-15', endDate: '2027-06-15' },
  ] as const)('round-trips $name ranges for both trigger families', ({ startDate, endDate }) => {
    const convertibleTrigger = convertibleRangeTrigger(startDate, endDate);
    const warrantTrigger = warrantRangeTrigger(startDate, endDate);

    const convertible = damlConvertibleIssuanceDataToNative(
      convertibleIssuanceDataToDaml({ ...convertibleBase, conversion_triggers: [convertibleTrigger] })
    );
    const warrant = damlWarrantIssuanceDataToNative(
      warrantIssuanceDataToDaml({ ...warrantBase, exercise_triggers: [warrantTrigger] })
    );

    expect(requireFirst(convertible.conversion_triggers, 'native convertible range trigger')).toEqual(
      convertibleTrigger
    );
    expect(requireFirst(warrant.exercise_triggers, 'native warrant range trigger')).toEqual(warrantTrigger);
  });

  it('rejects a cross-variant field at the convertible write boundary', () => {
    const invalidTrigger = {
      type: 'ELECTIVE_AT_WILL',
      trigger_id: 'invalid-at-will',
      trigger_date: '2027-01-01',
      conversion_right: convertibleRight,
    } as unknown as ConvertibleConversionTrigger;

    expect(() => convertibleIssuanceDataToDaml({ ...convertibleBase, conversion_triggers: [invalidTrigger] })).toThrow(
      OcpValidationError
    );
    expect(() => convertibleIssuanceDataToDaml({ ...convertibleBase, conversion_triggers: [invalidTrigger] })).toThrow(
      /trigger_date is not valid for conversion trigger type ELECTIVE_AT_WILL/
    );
  });

  it('rejects an unknown field at the indexed convertible write boundary', () => {
    const invalidTrigger = {
      ...requireFirst(convertibleTriggerVariants.slice(4, 5), 'at-will trigger'),
      unexpected_field: 'not allowed',
    } as unknown as ConvertibleConversionTrigger;

    expectValidationError(
      () =>
        convertibleIssuanceDataToDaml({
          ...convertibleBase,
          conversion_triggers: [convertibleTriggerVariants[0]!, invalidTrigger],
        }),
      'convertibleIssuance.conversion_triggers[1].unexpected_field',
      OcpErrorCodes.INVALID_FORMAT
    );
  });

  it('rejects a missing variant field at the warrant write boundary', () => {
    const invalidTrigger = {
      type: 'ELECTIVE_IN_RANGE',
      trigger_id: 'invalid-range',
      start_date: '2027-01-01',
      conversion_right: warrantRight,
    } as unknown as WarrantExerciseTrigger;

    expect(() => warrantIssuanceDataToDaml({ ...warrantBase, exercise_triggers: [invalidTrigger] })).toThrow(
      /end_date is required and must be a string/
    );
  });

  it('rejects an unknown field at the indexed warrant write boundary', () => {
    const invalidTrigger = {
      ...requireFirst(warrantTriggerVariants.slice(4, 5), 'at-will warrant trigger'),
      unexpected_field: 'not allowed',
    } as unknown as WarrantExerciseTrigger;

    expectValidationError(
      () =>
        warrantIssuanceDataToDaml({
          ...warrantBase,
          exercise_triggers: [warrantTriggerVariants[0]!, invalidTrigger],
        }),
      'warrantIssuance.exercise_triggers[1].unexpected_field',
      OcpErrorCodes.INVALID_FORMAT
    );
  });

  it('rejects OCF nulls instead of treating them as omitted write fields', () => {
    const invalidTrigger = {
      type: 'UNSPECIFIED',
      trigger_id: 'null-nickname',
      nickname: null,
      conversion_right: convertibleRight,
    } as unknown as ConvertibleConversionTrigger;

    expect(() => convertibleIssuanceDataToDaml({ ...convertibleBase, conversion_triggers: [invalidTrigger] })).toThrow(
      /nickname must be a string when present/
    );
  });

  it.each([
    { field: 'nickname', value: '' },
    { field: 'nickname', value: '   ' },
    { field: 'trigger_description', value: '' },
    { field: 'trigger_description', value: '   ' },
  ] as const)(
    'preserves schema-valid empty or whitespace-only $field values at both write boundaries',
    ({ field, value }) => {
      const convertibleTrigger = {
        ...requireFirst(convertibleTriggerVariants.slice(4, 5), 'at-will trigger'),
        [field]: value,
      };
      const warrantTrigger = {
        ...requireFirst(warrantTriggerVariants.slice(4, 5), 'at-will warrant trigger'),
        [field]: value,
      };

      const convertible = convertibleIssuanceDataToDaml({
        ...convertibleBase,
        conversion_triggers: [convertibleTrigger],
      });
      const warrant = warrantIssuanceDataToDaml({ ...warrantBase, exercise_triggers: [warrantTrigger] });

      expect(convertible.conversion_triggers[0]?.[field]).toBe(value);
      expect(warrant.exercise_triggers[0]?.[field]).toBe(value);
    }
  );

  it('rejects a missing conversion right at the write boundary', () => {
    const invalidTrigger = {
      type: 'UNSPECIFIED',
      trigger_id: 'missing-right',
    } as unknown as ConvertibleConversionTrigger;

    expect(() => convertibleIssuanceDataToDaml({ ...convertibleBase, conversion_triggers: [invalidTrigger] })).toThrow(
      /conversion_right is required/
    );
  });

  it('rejects a non-null cross-variant field from a DAML convertible payload', () => {
    const daml = convertibleIssuanceDataToDaml({
      ...convertibleBase,
      conversion_triggers: [requireFirst(convertibleTriggerVariants.slice(4, 5), 'at-will trigger')],
    });
    requireFirst(daml.conversion_triggers, 'DAML convertible trigger').trigger_condition = 'not allowed';

    expect(() => damlConvertibleIssuanceDataToNative(daml)).toThrow(
      /trigger_condition is not allowed for ELECTIVE_AT_WILL triggers/
    );
  });

  it('rejects an unknown field from an indexed DAML convertible payload as a schema mismatch', () => {
    const daml = convertibleIssuanceDataToDaml({
      ...convertibleBase,
      conversion_triggers: requireFirstTwo(convertibleTriggerVariants, 'convertible trigger'),
    });
    const trigger = requireFirst(daml.conversion_triggers.slice(1), 'second DAML convertible trigger');
    (trigger as unknown as Record<string, unknown>).unexpected_field = 'not generated by DAML';

    expectGeneratedParseError(
      () => damlConvertibleIssuanceDataToNative(daml),
      'convertibleIssuance',
      'input.conversion_triggers[1].unexpected_field'
    );
  });

  it('keeps indexed context for malformed DAML convertible rights and mechanisms', () => {
    const malformedRight = convertibleIssuanceDataToDaml({
      ...convertibleBase,
      conversion_triggers: requireFirstTwo(convertibleTriggerVariants, 'convertible trigger'),
    });
    const secondRightTrigger = requireFirst(
      malformedRight.conversion_triggers.slice(1),
      'second DAML convertible trigger'
    );
    secondRightTrigger.conversion_right.type_ = 'INVALID_RIGHT';

    expectValidationError(
      () => damlConvertibleIssuanceDataToNative(malformedRight),
      'convertibleIssuance.conversion_triggers[1].conversion_right.type_',
      OcpErrorCodes.INVALID_FORMAT
    );

    const malformedMechanism = convertibleIssuanceDataToDaml({
      ...convertibleBase,
      conversion_triggers: requireFirstTwo(convertibleTriggerVariants, 'convertible trigger'),
    });
    const secondMechanismTrigger = requireFirst(
      malformedMechanism.conversion_triggers.slice(1),
      'second DAML convertible trigger'
    );
    secondMechanismTrigger.conversion_right.conversion_mechanism = {
      tag: 'INVALID_MECHANISM',
      value: {},
    } as never;

    expectGeneratedParseError(
      () => damlConvertibleIssuanceDataToNative(malformedMechanism),
      'convertibleIssuance',
      'input.conversion_triggers[1].conversion_right.conversion_mechanism'
    );
  });

  it('rejects a missing trigger_id from a DAML warrant payload instead of synthesizing one', () => {
    const daml = warrantIssuanceDataToDaml({
      ...warrantBase,
      exercise_triggers: [requireFirst(warrantTriggerVariants, 'warrant trigger')],
    });
    requireFirst(daml.exercise_triggers, 'DAML warrant trigger').trigger_id = null as unknown as string;

    expect(() => damlWarrantIssuanceDataToNative(daml)).toThrow(
      /input\.exercise_triggers\[0\]\.trigger_id.*expected a string/
    );
  });

  it('rejects an unknown field from an indexed DAML warrant payload as a schema mismatch', () => {
    const daml = warrantIssuanceDataToDaml({
      ...warrantBase,
      exercise_triggers: warrantTriggerVariants.slice(0, 2),
    });
    const trigger = requireFirst(daml.exercise_triggers.slice(1), 'second DAML warrant trigger');
    (trigger as unknown as Record<string, unknown>).unexpected_field = 'not generated by DAML';

    expectGeneratedParseError(
      () => damlWarrantIssuanceDataToNative(daml),
      'warrantIssuance',
      'input.exercise_triggers[1].unexpected_field'
    );
  });

  it('keeps indexed context for malformed DAML warrant rights and mechanisms', () => {
    const malformedRight = warrantIssuanceDataToDaml({
      ...warrantBase,
      exercise_triggers: warrantTriggerVariants.slice(0, 2),
    });
    const secondRightTrigger = requireFirst(malformedRight.exercise_triggers.slice(1), 'second DAML warrant trigger');
    const secondRight = secondRightTrigger.conversion_right as { value: Record<string, unknown> };
    secondRight.value.type_ = 'INVALID_RIGHT';

    expectValidationError(
      () => damlWarrantIssuanceDataToNative(malformedRight),
      'warrantIssuance.exercise_triggers[1].conversion_right.value.type_',
      OcpErrorCodes.INVALID_FORMAT
    );

    const malformedMechanism = warrantIssuanceDataToDaml({
      ...warrantBase,
      exercise_triggers: warrantTriggerVariants.slice(0, 2),
    });
    const secondMechanismTrigger = requireFirst(
      malformedMechanism.exercise_triggers.slice(1),
      'second DAML warrant trigger'
    );
    const secondMechanismRight = secondMechanismTrigger.conversion_right as { value: Record<string, unknown> };
    secondMechanismRight.value.conversion_mechanism = { tag: 'INVALID_MECHANISM', value: {} };

    expectGeneratedParseError(
      () => damlWarrantIssuanceDataToNative(malformedMechanism),
      'warrantIssuance',
      'input.exercise_triggers[1].conversion_right'
    );
  });

  it.each([
    { field: 'nickname', value: '' },
    { field: 'nickname', value: '   ' },
    { field: 'trigger_description', value: '' },
    { field: 'trigger_description', value: '   ' },
  ] as const)(
    'preserves schema-valid empty or whitespace-only $field values at both read boundaries',
    ({ field, value }) => {
      const convertibleDaml = convertibleIssuanceDataToDaml({
        ...convertibleBase,
        conversion_triggers: [requireFirst(convertibleTriggerVariants.slice(4, 5), 'at-will trigger')],
      });
      const convertibleTrigger = requireFirst(convertibleDaml.conversion_triggers, 'DAML convertible trigger');
      (convertibleTrigger as unknown as Record<string, unknown>)[field] = value;

      const warrantDaml = warrantIssuanceDataToDaml({
        ...warrantBase,
        exercise_triggers: [requireFirst(warrantTriggerVariants.slice(4, 5), 'at-will warrant trigger')],
      });
      const warrantTrigger = requireFirst(warrantDaml.exercise_triggers, 'DAML warrant trigger');
      (warrantTrigger as unknown as Record<string, unknown>)[field] = value;

      const nativeConvertibleTrigger = requireFirst(
        damlConvertibleIssuanceDataToNative(convertibleDaml).conversion_triggers,
        'native convertible trigger'
      );
      const nativeWarrantTrigger = requireFirst(
        damlWarrantIssuanceDataToNative(warrantDaml).exercise_triggers,
        'native warrant trigger'
      );
      expect(nativeConvertibleTrigger[field]).toBe(value);
      expect(nativeWarrantTrigger[field]).toBe(value);
    }
  );
});
