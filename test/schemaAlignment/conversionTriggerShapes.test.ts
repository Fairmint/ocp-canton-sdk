import { OcpValidationError } from '../../src/errors';
import { parseOcfObject } from '../../src/utils/ocfZodSchemas';
import { requireFirst } from '../../src/utils/requireDefined';
import { loadProductionFixture } from '../utils/productionFixtures';

const convertibleFixture = loadProductionFixture('convertibleIssuance', 'safe-post-money');
const fixtureTrigger = requireFirst(
  convertibleFixture.conversion_triggers as Array<Record<string, unknown>>,
  'fixture conversion trigger'
);
const commonTrigger = {
  trigger_id: fixtureTrigger.trigger_id,
  nickname: fixtureTrigger.nickname,
  trigger_description: fixtureTrigger.trigger_description,
  conversion_right: fixtureTrigger.conversion_right,
};

const validTriggers: Array<{ name: string; trigger: Record<string, unknown> }> = [
  {
    name: 'automatic condition',
    trigger: { ...commonTrigger, type: 'AUTOMATIC_ON_CONDITION', trigger_condition: 'Qualified financing closes' },
  },
  {
    name: 'automatic date',
    trigger: { ...commonTrigger, type: 'AUTOMATIC_ON_DATE', trigger_date: '2027-01-01' },
  },
  {
    name: 'elective range',
    trigger: {
      ...commonTrigger,
      type: 'ELECTIVE_IN_RANGE',
      start_date: '2027-01-01',
      end_date: '2027-12-31',
    },
  },
  {
    name: 'elective condition',
    trigger: { ...commonTrigger, type: 'ELECTIVE_ON_CONDITION', trigger_condition: 'Holder elects' },
  },
  { name: 'elective at will', trigger: { ...commonTrigger, type: 'ELECTIVE_AT_WILL' } },
  { name: 'unspecified', trigger: { ...commonTrigger, type: 'UNSPECIFIED' } },
];

const invalidTriggers: Array<{ name: string; trigger: Record<string, unknown> }> = [
  {
    name: 'condition without trigger_condition',
    trigger: { ...commonTrigger, type: 'AUTOMATIC_ON_CONDITION' },
  },
  {
    name: 'condition with a trigger_date',
    trigger: {
      ...commonTrigger,
      type: 'ELECTIVE_ON_CONDITION',
      trigger_condition: 'Holder elects',
      trigger_date: '2027-01-01',
    },
  },
  {
    name: 'date without trigger_date',
    trigger: { ...commonTrigger, type: 'AUTOMATIC_ON_DATE' },
  },
  {
    name: 'date with a trigger_condition',
    trigger: {
      ...commonTrigger,
      type: 'AUTOMATIC_ON_DATE',
      trigger_date: '2027-01-01',
      trigger_condition: 'Not valid for this variant',
    },
  },
  {
    name: 'range without end_date',
    trigger: { ...commonTrigger, type: 'ELECTIVE_IN_RANGE', start_date: '2027-01-01' },
  },
  {
    name: 'at will with range fields',
    trigger: {
      ...commonTrigger,
      type: 'ELECTIVE_AT_WILL',
      start_date: '2027-01-01',
      end_date: '2027-12-31',
    },
  },
  {
    name: 'unspecified with a trigger condition',
    trigger: { ...commonTrigger, type: 'UNSPECIFIED', trigger_condition: 'Not valid for this variant' },
  },
];

function withTrigger(trigger: Record<string, unknown>): Record<string, unknown> {
  return { ...convertibleFixture, conversion_triggers: [trigger] };
}

describe('pinned OCF conversion-trigger shapes', () => {
  it.each(validTriggers)('accepts $name', ({ trigger }) => {
    expect(parseOcfObject(withTrigger(trigger))).toBeDefined();
  });

  it.each(invalidTriggers)('rejects $name', ({ trigger }) => {
    expect(() => parseOcfObject(withTrigger(trigger))).toThrow(OcpValidationError);
  });
});
