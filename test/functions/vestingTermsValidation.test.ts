import { OcpValidationError } from '../../src/errors';
import { vestingTermsDataToDaml } from '../../src/functions/OpenCapTable/vestingTerms/createVestingTerms';
import { damlVestingTermsDataToNative } from '../../src/functions/OpenCapTable/vestingTerms/getVestingTermsAsOcf';
import type { OcfVestingTerms } from '../../src/types/native';

function makeVestingTerms(): OcfVestingTerms {
  return {
    object_type: 'VESTING_TERMS',
    id: 'terms-1',
    name: 'Standard vesting',
    description: 'A representative two-condition schedule',
    allocation_type: 'CUMULATIVE_ROUNDING',
    vesting_conditions: [
      {
        id: 'start',
        portion: { numerator: '1', denominator: '4' },
        trigger: { type: 'VESTING_START_DATE' },
        next_condition_ids: ['monthly'],
      },
      {
        id: 'monthly',
        quantity: '10.5',
        trigger: {
          type: 'VESTING_SCHEDULE_RELATIVE',
          relative_to_condition_id: 'start',
          period: {
            type: 'MONTHS',
            length: 1,
            occurrences: 36,
            day_of_month: 'VESTING_START_DAY_OR_LAST_DAY_OF_MONTH',
            cliff_installment: 1,
          },
        },
        next_condition_ids: [],
      },
    ],
  };
}

function asMutableConditions(value: unknown): Array<Record<string, unknown>> {
  return (value as { vesting_conditions: Array<Record<string, unknown>> }).vesting_conditions;
}

function makeDamlVestingTerms(): Record<string, unknown> {
  return vestingTermsDataToDaml(makeVestingTerms());
}

function convertDaml(value: Record<string, unknown>): OcfVestingTerms {
  return damlVestingTermsDataToNative(value as unknown as Parameters<typeof damlVestingTermsDataToNative>[0]);
}

function expectValidationError(run: () => unknown, fieldPath: string): void {
  try {
    run();
    throw new Error(`Expected validation to fail at ${fieldPath}`);
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error).toMatchObject({ fieldPath });
  }
}

function setNativeRelativeTrigger(
  conditions: Array<Record<string, unknown>>,
  index: number,
  relativeToConditionId: string
): void {
  const condition = conditions[index];
  if (!condition) throw new Error(`Missing native condition ${index}`);
  condition.trigger = {
    type: 'VESTING_SCHEDULE_RELATIVE',
    relative_to_condition_id: relativeToConditionId,
    period: { type: 'DAYS', length: 1, occurrences: 1 },
  };
}

function setDamlRelativeTrigger(
  conditions: Array<Record<string, unknown>>,
  index: number,
  relativeToConditionId: string
): void {
  const condition = conditions[index];
  if (!condition) throw new Error(`Missing DAML condition ${index}`);
  condition.trigger = {
    tag: 'OcfVestingScheduleRelativeTrigger',
    value: {
      relative_to_condition_id: relativeToConditionId,
      period: {
        tag: 'OcfVestingPeriodDays',
        value: { length_: '1', occurrences: '1', cliff_installment: null },
      },
    },
  };
}

type ConditionMutation = (conditions: Array<Record<string, unknown>>) => void;

const graphCases: ReadonlyArray<{
  readonly name: string;
  readonly mutate: ConditionMutation;
  readonly fieldPath: string;
}> = [
  {
    name: 'duplicate condition IDs',
    mutate: (conditions) => {
      const second = conditions[1];
      if (second) second.id = 'start';
    },
    fieldPath: 'vestingTerms.vesting_conditions[1].id',
  },
  {
    name: 'duplicate next-condition references',
    mutate: (conditions) => {
      const first = conditions[0];
      if (first) first.next_condition_ids = ['monthly', 'monthly'];
    },
    fieldPath: 'vestingTerms.vesting_conditions[0].next_condition_ids[1]',
  },
  {
    name: 'a dangling next-condition reference',
    mutate: (conditions) => {
      const first = conditions[0];
      if (first) first.next_condition_ids = ['missing'];
    },
    fieldPath: 'vestingTerms.vesting_conditions[0].next_condition_ids[0]',
  },
  {
    name: 'a next-condition cycle',
    mutate: (conditions) => {
      const second = conditions[1];
      if (second) second.next_condition_ids = ['start'];
    },
    fieldPath: 'vestingTerms.vesting_conditions[1].next_condition_ids[0]',
  },
];

describe('vesting terms semantic validation', () => {
  it.each(graphCases)('rejects $name at the OCF create boundary', ({ mutate, fieldPath }) => {
    const terms = makeVestingTerms();
    mutate(asMutableConditions(terms));

    expectValidationError(() => vestingTermsDataToDaml(terms), fieldPath);
  });

  it.each(graphCases)('rejects $name at the DAML read boundary', ({ mutate, fieldPath }) => {
    const daml = makeDamlVestingTerms();
    mutate(asMutableConditions(daml));

    expectValidationError(() => convertDaml(daml), fieldPath);
  });

  it.each([
    ['a dangling relative condition reference', 'missing'],
    ['a self-relative condition reference', 'monthly'],
  ])('rejects %s at both conversion boundaries', (_name, relativeId) => {
    const fieldPath = 'vestingTerms.vesting_conditions[1].trigger.relative_to_condition_id';
    const terms = makeVestingTerms();
    const nativeTrigger = asMutableConditions(terms)[1]?.trigger as Record<string, unknown> | undefined;
    if (!nativeTrigger) throw new Error('Missing native relative trigger fixture');
    nativeTrigger.relative_to_condition_id = relativeId;
    expectValidationError(() => vestingTermsDataToDaml(terms), fieldPath);

    const daml = makeDamlVestingTerms();
    const damlTrigger = asMutableConditions(daml)[1]?.trigger as Record<string, unknown> | undefined;
    const damlTriggerValue = damlTrigger?.value as Record<string, unknown> | undefined;
    if (!damlTriggerValue) throw new Error('Missing DAML relative trigger fixture');
    damlTriggerValue.relative_to_condition_id = relativeId;
    expectValidationError(() => convertDaml(daml), fieldPath);
  });

  it.each([
    ['a relative-only cycle', false],
    ['a mixed next-condition and relative cycle', true],
  ])('rejects %s at both conversion boundaries', (_name, keepNextEdge) => {
    const fieldPath = 'vestingTerms.vesting_conditions[0].trigger.relative_to_condition_id';
    const terms = makeVestingTerms();
    const nativeConditions = asMutableConditions(terms);
    if (!keepNextEdge) {
      const first = nativeConditions[0];
      if (first) first.next_condition_ids = [];
    }
    setNativeRelativeTrigger(nativeConditions, 0, 'monthly');
    expectValidationError(() => vestingTermsDataToDaml(terms), fieldPath);

    const daml = makeDamlVestingTerms();
    const damlConditions = asMutableConditions(daml);
    if (!keepNextEdge) {
      const first = damlConditions[0];
      if (first) first.next_condition_ids = [];
    }
    setDamlRelativeTrigger(damlConditions, 0, 'monthly');
    expectValidationError(() => convertDaml(daml), fieldPath);
  });

  it('allows multiple independent roots at both conversion boundaries', () => {
    const terms = makeVestingTerms();
    const nativeConditions = asMutableConditions(terms);
    const first = nativeConditions[0];
    const second = nativeConditions[1];
    if (!first || !second) throw new Error('Missing independent-root fixtures');
    first.next_condition_ids = [];
    second.trigger = { type: 'VESTING_START_DATE' };

    const daml = vestingTermsDataToDaml(terms);
    const result = convertDaml(daml);
    expect(result.vesting_conditions).toHaveLength(2);
    expect(result.vesting_conditions.map(({ id }) => id)).toEqual(['start', 'monthly']);
  });

  it.each([
    ['zero length', 'length', 0],
    ['fractional length', 'length', 1.5],
    ['fractional occurrences', 'occurrences', 2.5],
    ['zero occurrences', 'occurrences', 0],
    ['negative cliff installment', 'cliff_installment', -1],
    ['unsafe cliff installment', 'cliff_installment', Number.MAX_SAFE_INTEGER + 1],
  ])('rejects %s at the OCF create boundary', (_name, field, value) => {
    const terms = makeVestingTerms();
    const trigger = asMutableConditions(terms)[1]?.trigger as Record<string, unknown> | undefined;
    const period = trigger?.period as Record<string, unknown> | undefined;
    if (!period) throw new Error('Missing native period fixture');
    period[field] = value;

    expectValidationError(
      () => vestingTermsDataToDaml(terms),
      `vestingTerms.vesting_conditions[1].trigger.period.${field}`
    );
  });

  it.each([
    ['zero length', 'length_', '0', 'length'],
    ['fractional length', 'length_', '1.5', 'length'],
    ['fractional occurrences', 'occurrences', '2.5', 'occurrences'],
    ['zero occurrences', 'occurrences', '0', 'occurrences'],
    ['negative cliff installment', 'cliff_installment', '-1', 'cliff_installment'],
    ['unsafe cliff installment', 'cliff_installment', '9007199254740992', 'cliff_installment'],
  ])('rejects %s at the DAML read boundary', (_name, damlField, value, nativeField) => {
    const daml = makeDamlVestingTerms();
    const trigger = asMutableConditions(daml)[1]?.trigger as Record<string, unknown> | undefined;
    const triggerValue = trigger?.value as Record<string, unknown> | undefined;
    const period = triggerValue?.period as Record<string, unknown> | undefined;
    const periodValue = period?.value as Record<string, unknown> | undefined;
    if (!periodValue) throw new Error('Missing DAML period fixture');
    periodValue[damlField] = value;

    expectValidationError(() => convertDaml(daml), `vestingTerms.vesting_conditions[1].trigger.period.${nativeField}`);
  });

  it.each([
    ['an over-scale numerator', 'numerator', '0.00000000001'],
    ['a zero denominator', 'denominator', '0'],
  ])('rejects %s at both conversion boundaries', (_name, field, value) => {
    const fieldPath = `vestingTerms.vesting_conditions[0].portion.${field}`;
    const terms = makeVestingTerms();
    const nativePortion = asMutableConditions(terms)[0]?.portion as Record<string, unknown> | undefined;
    if (!nativePortion) throw new Error('Missing native portion fixture');
    nativePortion[field] = value;
    expectValidationError(() => vestingTermsDataToDaml(terms), fieldPath);

    const daml = makeDamlVestingTerms();
    const damlPortion = asMutableConditions(daml)[0]?.portion as Record<string, unknown> | undefined;
    if (!damlPortion) throw new Error('Missing DAML portion fixture');
    damlPortion[field] = value;
    expectValidationError(() => convertDaml(daml), fieldPath);
  });
});
