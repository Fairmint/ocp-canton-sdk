import { OcpValidationError } from '../../src/errors';
import {
  convertibleIssuanceDataToDaml,
  type ConversionTriggerInput,
} from '../../src/functions/OpenCapTable/convertibleIssuance/createConvertibleIssuance';
import { damlConvertibleIssuanceDataToNative } from '../../src/functions/OpenCapTable/convertibleIssuance/getConvertibleIssuanceAsOcf';
import {
  warrantIssuanceDataToDaml,
  type WarrantExerciseTriggerInput,
} from '../../src/functions/OpenCapTable/warrantIssuance/createWarrantIssuance';
import { damlWarrantIssuanceDataToNative } from '../../src/functions/OpenCapTable/warrantIssuance/getWarrantIssuanceAsOcf';
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

const convertibleTriggerVariants: ConversionTriggerInput[] = [
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

const warrantTriggerVariants: WarrantExerciseTriggerInput[] = convertibleTriggerVariants.map((trigger) => ({
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
    } as unknown as ConversionTriggerInput;

    expect(() => convertibleIssuanceDataToDaml({ ...convertibleBase, conversion_triggers: [invalidTrigger] })).toThrow(
      OcpValidationError
    );
    expect(() => convertibleIssuanceDataToDaml({ ...convertibleBase, conversion_triggers: [invalidTrigger] })).toThrow(
      /trigger_date is not valid for conversion trigger type ELECTIVE_AT_WILL/
    );
  });

  it('rejects a missing variant field at the warrant write boundary', () => {
    const invalidTrigger = {
      type: 'ELECTIVE_IN_RANGE',
      trigger_id: 'invalid-range',
      start_date: '2027-01-01',
      conversion_right: warrantRight,
    } as unknown as WarrantExerciseTriggerInput;

    expect(() => warrantIssuanceDataToDaml({ ...warrantBase, exercise_triggers: [invalidTrigger] })).toThrow(
      /end_date is required and must be a string/
    );
  });

  it('rejects OCF nulls instead of treating them as omitted write fields', () => {
    const invalidTrigger = {
      type: 'UNSPECIFIED',
      trigger_id: 'null-nickname',
      nickname: null,
      conversion_right: convertibleRight,
    } as unknown as ConversionTriggerInput;

    expect(() => convertibleIssuanceDataToDaml({ ...convertibleBase, conversion_triggers: [invalidTrigger] })).toThrow(
      /nickname must be a string when present/
    );
  });

  it('rejects a missing conversion right at the write boundary', () => {
    const invalidTrigger = {
      type: 'UNSPECIFIED',
      trigger_id: 'missing-right',
    } as unknown as ConversionTriggerInput;

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
      /trigger_condition is not valid for conversion trigger type ELECTIVE_AT_WILL/
    );
  });

  it('rejects a missing trigger_id from a DAML warrant payload instead of synthesizing one', () => {
    const daml = warrantIssuanceDataToDaml({
      ...warrantBase,
      exercise_triggers: [requireFirst(warrantTriggerVariants, 'warrant trigger')],
    });
    requireFirst(daml.exercise_triggers, 'DAML warrant trigger').trigger_id = null as unknown as string;

    expect(() => damlWarrantIssuanceDataToNative(daml)).toThrow(/trigger_id is required and must be a string/);
  });
});
