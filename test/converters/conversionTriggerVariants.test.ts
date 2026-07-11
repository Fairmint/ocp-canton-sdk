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

function expectParseError(run: () => unknown, source: string, code: OcpErrorCode): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(OcpParseError);
    expect(error).toMatchObject({ source, code });
    return;
  }
  throw new Error(`Expected OcpParseError at ${source}`);
}

describe('exact conversion-trigger converter behavior', () => {
  it('rejects a non-object trigger payload', () => {
    expect(() => parseConversionTriggerFields(null, 'conversionTrigger')).toThrow(
      /Conversion trigger must be an object/
    );
  });

  it('rejects an unknown trigger discriminator', () => {
    expect(() =>
      parseConversionTriggerFields(
        {
          type: 'NOT_A_TRIGGER',
          trigger_id: 'invalid-type',
          conversion_right: convertibleRight,
        },
        'conversionTrigger'
      )
    ).toThrow(/Unknown conversion trigger type: NOT_A_TRIGGER/);
  });

  it.each([
    { field: 'unexpected_field', value: 'not allowed' },
    { field: 'trigger_date', value: undefined },
  ])('rejects an own $field outside the canonical variant shape', ({ field, value }) => {
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
      OcpErrorCodes.INVALID_FORMAT
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
  ] as const)('rejects blank $field values at both write boundaries', ({ field, value }) => {
    const convertibleTrigger = {
      ...requireFirst(convertibleTriggerVariants.slice(4, 5), 'at-will trigger'),
      [field]: value,
    };
    const warrantTrigger = {
      ...requireFirst(warrantTriggerVariants.slice(4, 5), 'at-will warrant trigger'),
      [field]: value,
    };

    expectValidationError(
      () => convertibleIssuanceDataToDaml({ ...convertibleBase, conversion_triggers: [convertibleTrigger] }),
      `convertibleIssuance.conversion_triggers[0].${field}`,
      OcpErrorCodes.INVALID_FORMAT
    );
    expectValidationError(
      () => warrantIssuanceDataToDaml({ ...warrantBase, exercise_triggers: [warrantTrigger] }),
      `warrantIssuance.exercise_triggers[0].${field}`,
      OcpErrorCodes.INVALID_FORMAT
    );
  });

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
      conversion_triggers: [convertibleTriggerVariants[0]!, convertibleTriggerVariants[1]!],
    });
    const trigger = requireFirst(daml.conversion_triggers.slice(1), 'second DAML convertible trigger');
    (trigger as unknown as Record<string, unknown>).unexpected_field = 'not generated by DAML';

    expectValidationError(
      () => damlConvertibleIssuanceDataToNative(daml),
      'convertibleIssuance.conversion_triggers[1].unexpected_field',
      OcpErrorCodes.SCHEMA_MISMATCH
    );
  });

  it('keeps indexed context for malformed DAML convertible rights and mechanisms', () => {
    const malformedRight = convertibleIssuanceDataToDaml({
      ...convertibleBase,
      conversion_triggers: [convertibleTriggerVariants[0]!, convertibleTriggerVariants[1]!],
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
      conversion_triggers: [convertibleTriggerVariants[0]!, convertibleTriggerVariants[1]!],
    });
    const secondMechanismTrigger = requireFirst(
      malformedMechanism.conversion_triggers.slice(1),
      'second DAML convertible trigger'
    );
    secondMechanismTrigger.conversion_right.conversion_mechanism = {
      tag: 'INVALID_MECHANISM',
      value: {},
    } as never;

    expectParseError(
      () => damlConvertibleIssuanceDataToNative(malformedMechanism),
      'convertibleIssuance.conversion_triggers[1].conversion_right.conversion_mechanism.tag',
      OcpErrorCodes.UNKNOWN_ENUM_VALUE
    );
  });

  it('rejects a missing trigger_id from a DAML warrant payload instead of synthesizing one', () => {
    const daml = warrantIssuanceDataToDaml({
      ...warrantBase,
      exercise_triggers: [requireFirst(warrantTriggerVariants, 'warrant trigger')],
    });
    requireFirst(daml.exercise_triggers, 'DAML warrant trigger').trigger_id = null as unknown as string;

    expect(() => damlWarrantIssuanceDataToNative(daml)).toThrow(/trigger_id.*must be a non-empty string/);
  });

  it('rejects an unknown field from an indexed DAML warrant payload as a schema mismatch', () => {
    const daml = warrantIssuanceDataToDaml({
      ...warrantBase,
      exercise_triggers: warrantTriggerVariants.slice(0, 2),
    });
    const trigger = requireFirst(daml.exercise_triggers.slice(1), 'second DAML warrant trigger');
    (trigger as unknown as Record<string, unknown>).unexpected_field = 'not generated by DAML';

    expectValidationError(
      () => damlWarrantIssuanceDataToNative(daml),
      'warrantIssuance.exercise_triggers[1].unexpected_field',
      OcpErrorCodes.SCHEMA_MISMATCH
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

    expectParseError(
      () => damlWarrantIssuanceDataToNative(malformedMechanism),
      'warrantIssuance.exercise_triggers[1].conversion_right.value.conversion_mechanism.tag',
      OcpErrorCodes.UNKNOWN_ENUM_VALUE
    );
  });

  it.each([
    { field: 'nickname', value: '' },
    { field: 'nickname', value: '   ' },
    { field: 'trigger_description', value: '' },
    { field: 'trigger_description', value: '   ' },
  ] as const)('rejects blank $field values at both read boundaries', ({ field, value }) => {
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

    expectValidationError(
      () => damlConvertibleIssuanceDataToNative(convertibleDaml),
      `convertibleIssuance.conversion_triggers[0].${field}`,
      OcpErrorCodes.INVALID_FORMAT
    );
    expectValidationError(
      () => damlWarrantIssuanceDataToNative(warrantDaml),
      `warrantIssuance.exercise_triggers[0].${field}`,
      OcpErrorCodes.INVALID_FORMAT
    );
  });
});
