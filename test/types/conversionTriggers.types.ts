/** Compile-time contracts for the six exact canonical conversion-trigger variants. */

import type {
  ConvertibleConversionRight,
  ConvertibleConversionTrigger,
  WarrantConversionRight,
  WarrantExerciseTrigger,
} from '../../src';

const convertibleRight: ConvertibleConversionRight = {
  type: 'CONVERTIBLE_CONVERSION_RIGHT',
  conversion_mechanism: {
    type: 'FIXED_AMOUNT_CONVERSION',
    converts_to_quantity: '100',
  },
};

const warrantRight: WarrantConversionRight = {
  type: 'WARRANT_CONVERSION_RIGHT',
  conversion_mechanism: {
    type: 'FIXED_AMOUNT_CONVERSION',
    converts_to_quantity: '100',
  },
};

const convertibleTriggers: ConvertibleConversionTrigger[] = [
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

const warrantTrigger: WarrantExerciseTrigger = {
  type: 'AUTOMATIC_ON_DATE',
  trigger_id: 'warrant-date',
  trigger_date: '2027-06-01',
  conversion_right: warrantRight,
};

// @ts-expect-error condition variants require trigger_condition
const missingCondition: ConvertibleConversionTrigger = {
  type: 'AUTOMATIC_ON_CONDITION',
  trigger_id: 'missing-condition',
  conversion_right: convertibleRight,
};

// @ts-expect-error condition variants forbid date fields
const conditionWithDate: ConvertibleConversionTrigger = {
  type: 'ELECTIVE_ON_CONDITION',
  trigger_id: 'condition-with-date',
  trigger_condition: 'Qualified financing closes',
  trigger_date: '2027-01-01',
  conversion_right: convertibleRight,
};

// @ts-expect-error automatic date variants require trigger_date
const missingTriggerDate: ConvertibleConversionTrigger = {
  type: 'AUTOMATIC_ON_DATE',
  trigger_id: 'missing-date',
  conversion_right: convertibleRight,
};

// @ts-expect-error automatic date variants forbid conditions
const dateWithCondition: WarrantExerciseTrigger = {
  type: 'AUTOMATIC_ON_DATE',
  trigger_id: 'date-with-condition',
  trigger_date: '2027-01-01',
  trigger_condition: 'Not valid on this variant',
  conversion_right: warrantRight,
};

// @ts-expect-error range variants require both boundaries
const incompleteRange: ConvertibleConversionTrigger = {
  type: 'ELECTIVE_IN_RANGE',
  trigger_id: 'incomplete-range',
  start_date: '2027-01-01',
  conversion_right: convertibleRight,
};

// @ts-expect-error payloadless variants forbid every timing field
const atWillWithRange: WarrantExerciseTrigger = {
  type: 'ELECTIVE_AT_WILL',
  trigger_id: 'at-will-with-range',
  start_date: '2027-01-01',
  end_date: '2027-12-31',
  conversion_right: warrantRight,
};

void convertibleTriggers;
void warrantTrigger;
void missingCondition;
void conditionWithDate;
void missingTriggerDate;
void dateWithCondition;
void incompleteRange;
void atWillWithRange;
