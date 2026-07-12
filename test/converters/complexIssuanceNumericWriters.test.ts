import {
  CapTableBatch,
  type ConvertibleConversionMechanism,
  type OcfConvertibleIssuance,
  type OcfEquityCompensationIssuance,
  type OcfWarrantIssuance,
  type WarrantConversionMechanism,
} from '../../src';
import { OcpErrorCodes, OcpValidationError, type OcpErrorCode } from '../../src/errors';
import { buildOcfCreateData } from '../../src/functions/OpenCapTable/capTable/generatedBatchOperations';
import {
  convertibleIssuanceDataToDaml,
  type ConvertibleIssuanceInput,
} from '../../src/functions/OpenCapTable/convertibleIssuance/createConvertibleIssuance';
import { damlConvertibleIssuanceDataToNative } from '../../src/functions/OpenCapTable/convertibleIssuance/getConvertibleIssuanceAsOcf';
import { equityCompensationIssuanceDataToDaml } from '../../src/functions/OpenCapTable/equityCompensationIssuance/createEquityCompensationIssuance';
import { damlEquityCompensationIssuanceDataToNative } from '../../src/functions/OpenCapTable/equityCompensationIssuance/getEquityCompensationIssuanceAsOcf';
import {
  warrantIssuanceDataToDaml,
  type WarrantIssuanceInput,
} from '../../src/functions/OpenCapTable/warrantIssuance/createWarrantIssuance';
import { damlWarrantIssuanceDataToNative } from '../../src/functions/OpenCapTable/warrantIssuance/getWarrantIssuanceAsOcf';

type ComplexIssuanceEntityType = 'convertibleIssuance' | 'equityCompensationIssuance' | 'warrantIssuance';
type ComplexIssuanceInput = ConvertibleIssuanceInput | OcfEquityCompensationIssuance | WarrantIssuanceInput;
type ComplexIssuanceNative =
  | ReturnType<typeof damlConvertibleIssuanceDataToNative>
  | ReturnType<typeof damlEquityCompensationIssuanceDataToNative>
  | ReturnType<typeof damlWarrantIssuanceDataToNative>;
type ValuePath = ReadonlyArray<string | number>;

interface NumericWriterCase {
  readonly name: string;
  readonly entityType: ComplexIssuanceEntityType;
  readonly fieldPath: string;
  readonly makeInput: () => ComplexIssuanceInput;
  readonly inputPath: ValuePath;
  readonly damlPath: ValuePath;
  readonly nativePath: ValuePath;
}

function convertibleInput(mechanism: ConvertibleConversionMechanism): ConvertibleIssuanceInput {
  return {
    object_type: 'TX_CONVERTIBLE_ISSUANCE',
    id: 'convertible-numeric-writer',
    date: '2026-07-11',
    security_id: 'convertible-security',
    custom_id: 'CN-NUMERIC',
    stakeholder_id: 'stakeholder-1',
    investment_amount: { amount: '1000', currency: 'USD' },
    convertible_type: 'CONVERTIBLE_SECURITY',
    conversion_triggers: [
      {
        type: 'ELECTIVE_AT_WILL',
        trigger_id: 'convertible-trigger',
        conversion_right: {
          type: 'CONVERTIBLE_CONVERSION_RIGHT',
          conversion_mechanism: mechanism,
          converts_to_future_round: true,
        },
      },
    ],
    seniority: 1,
    security_law_exemptions: [],
  };
}

function customConvertibleInput(): ConvertibleIssuanceInput {
  return convertibleInput({
    type: 'CUSTOM_CONVERSION',
    custom_conversion_description: 'Custom conversion',
  });
}

function optionInput(): OcfEquityCompensationIssuance {
  return {
    object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
    id: 'option-numeric-writer',
    date: '2026-07-11',
    security_id: 'option-security',
    custom_id: 'OPTION-NUMERIC',
    stakeholder_id: 'stakeholder-1',
    compensation_type: 'OPTION_ISO',
    exercise_price: { amount: '1', currency: 'USD' },
    quantity: '100',
    expiration_date: null,
    termination_exercise_windows: [],
    security_law_exemptions: [],
    vestings: [{ date: '2027-07-11', amount: '25' }],
  };
}

function sarInput(): OcfEquityCompensationIssuance {
  return {
    object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
    id: 'sar-numeric-writer',
    date: '2026-07-11',
    security_id: 'sar-security',
    custom_id: 'SAR-NUMERIC',
    stakeholder_id: 'stakeholder-1',
    compensation_type: 'CSAR',
    base_price: { amount: '1', currency: 'USD' },
    quantity: '100',
    expiration_date: null,
    termination_exercise_windows: [],
    security_law_exemptions: [],
  };
}

function warrantInput(mechanism?: WarrantConversionMechanism): WarrantIssuanceInput {
  return {
    object_type: 'TX_WARRANT_ISSUANCE',
    id: 'warrant-numeric-writer',
    date: '2026-07-11',
    security_id: 'warrant-security',
    custom_id: 'W-NUMERIC',
    stakeholder_id: 'stakeholder-1',
    quantity: '100',
    purchase_price: { amount: '10', currency: 'USD' },
    exercise_price: { amount: '2', currency: 'USD' },
    exercise_triggers:
      mechanism === undefined
        ? []
        : [
            {
              type: 'ELECTIVE_AT_WILL',
              trigger_id: 'warrant-trigger',
              conversion_right: {
                type: 'WARRANT_CONVERSION_RIGHT',
                conversion_mechanism: mechanism,
              },
            },
          ],
    security_law_exemptions: [],
    vestings: [{ date: '2027-07-11', amount: '25' }],
  };
}

function stockClassWarrantInput(): WarrantIssuanceInput {
  return {
    ...warrantInput(),
    exercise_triggers: [
      {
        type: 'ELECTIVE_AT_WILL',
        trigger_id: 'stock-class-trigger',
        conversion_right: {
          type: 'STOCK_CLASS_CONVERSION_RIGHT',
          conversion_mechanism: {
            type: 'RATIO_CONVERSION',
            ratio: { numerator: '1', denominator: '2' },
            conversion_price: { amount: '3', currency: 'USD' },
            rounding_type: 'NORMAL',
          },
          converts_to_stock_class_id: 'stock-class-1',
        },
      },
    ],
  };
}

function safeInput(): ConvertibleIssuanceInput {
  return convertibleInput({
    type: 'SAFE_CONVERSION',
    conversion_mfn: false,
    conversion_valuation_cap: { amount: '1000000', currency: 'USD' },
    exit_multiple: { numerator: '2', denominator: '1' },
  });
}

function noteInput(): ConvertibleIssuanceInput {
  return convertibleInput({
    type: 'CONVERTIBLE_NOTE_CONVERSION',
    interest_rates: [],
    day_count_convention: 'ACTUAL_365',
    interest_payout: 'DEFERRED',
    interest_accrual_period: 'MONTHLY',
    compounding_type: 'SIMPLE',
    conversion_valuation_cap: { amount: '1000000', currency: 'USD' },
    exit_multiple: { numerator: '2', denominator: '1' },
  });
}

function convertibleInputWithSecondMechanism(mechanism: ConvertibleConversionMechanism): ConvertibleIssuanceInput {
  const input = customConvertibleInput();
  const [secondTrigger] = convertibleInput(mechanism).conversion_triggers;
  return {
    ...input,
    conversion_triggers: [...input.conversion_triggers, { ...secondTrigger, trigger_id: 'convertible-trigger-2' }],
  };
}

function warrantInputWithSecondMechanism(mechanism: WarrantConversionMechanism): WarrantIssuanceInput {
  const input = warrantInput({
    type: 'CUSTOM_CONVERSION',
    custom_conversion_description: 'First warrant trigger',
  });
  const [secondTrigger] = warrantInput(mechanism).exercise_triggers;
  if (secondTrigger === undefined) throw new Error('Missing second warrant trigger fixture');
  return {
    ...input,
    exercise_triggers: [...input.exercise_triggers, { ...secondTrigger, trigger_id: 'warrant-trigger-2' }],
  };
}

function stockClassWarrantInputWithSecondTrigger(numerator: string): WarrantIssuanceInput {
  const input = warrantInput({
    type: 'CUSTOM_CONVERSION',
    custom_conversion_description: 'First warrant trigger',
  });
  const [secondTrigger] = stockClassWarrantInput().exercise_triggers;
  if (secondTrigger === undefined) throw new Error('Missing second stock-class trigger fixture');
  if (secondTrigger.conversion_right.type !== 'STOCK_CLASS_CONVERSION_RIGHT') {
    throw new Error('Expected a stock-class conversion right fixture');
  }
  return {
    ...input,
    exercise_triggers: [
      ...input.exercise_triggers,
      {
        ...secondTrigger,
        trigger_id: 'stock-class-trigger-2',
        conversion_right: {
          ...secondTrigger.conversion_right,
          conversion_mechanism: {
            ...secondTrigger.conversion_right.conversion_mechanism,
            ratio: {
              ...secondTrigger.conversion_right.conversion_mechanism.ratio,
              numerator,
            },
          },
        },
      },
    ],
  };
}

function noteInputWithSecondRate(rate: string): ConvertibleIssuanceInput {
  return convertibleInputWithSecondMechanism({
    type: 'CONVERTIBLE_NOTE_CONVERSION',
    interest_rates: [
      { rate: '0.05', accrual_start_date: '2026-01-01' },
      { rate, accrual_start_date: '2026-07-01' },
    ],
    day_count_convention: 'ACTUAL_365',
    interest_payout: 'DEFERRED',
    interest_accrual_period: 'MONTHLY',
    compounding_type: 'SIMPLE',
  });
}

const CONVERTIBLE_MECHANISM_INPUT_PATH = [
  'conversion_triggers',
  0,
  'conversion_right',
  'conversion_mechanism',
] as const;
const CONVERTIBLE_MECHANISM_FIELD_PATH =
  'convertibleIssuance.conversion_triggers[0].conversion_right.conversion_mechanism';
const CONVERTIBLE_MECHANISM_DAML_PATH = [
  'conversion_triggers',
  0,
  'conversion_right',
  'conversion_mechanism',
  'value',
] as const;
const WARRANT_MECHANISM_INPUT_PATH = ['exercise_triggers', 0, 'conversion_right', 'conversion_mechanism'] as const;
const WARRANT_MECHANISM_FIELD_PATH = 'warrantIssuance.exercise_triggers[0].conversion_right.conversion_mechanism';
const WARRANT_MECHANISM_DAML_PATH = [
  'exercise_triggers',
  0,
  'conversion_right',
  'value',
  'conversion_mechanism',
  'value',
] as const;
const STOCK_CLASS_INPUT_PATH = ['exercise_triggers', 0, 'conversion_right', 'conversion_mechanism'] as const;
const STOCK_CLASS_DAML_PATH = ['exercise_triggers', 0, 'conversion_right', 'value'] as const;

const numericWriterCases: readonly NumericWriterCase[] = [
  {
    name: 'convertible investment amount',
    entityType: 'convertibleIssuance',
    fieldPath: 'convertibleIssuance.investment_amount.amount',
    makeInput: customConvertibleInput,
    inputPath: ['investment_amount', 'amount'],
    damlPath: ['investment_amount', 'amount'],
    nativePath: ['investment_amount', 'amount'],
  },
  {
    name: 'convertible pro rata',
    entityType: 'convertibleIssuance',
    fieldPath: 'convertibleIssuance.pro_rata',
    makeInput: customConvertibleInput,
    inputPath: ['pro_rata'],
    damlPath: ['pro_rata'],
    nativePath: ['pro_rata'],
  },
  {
    name: 'convertible fixed quantity',
    entityType: 'convertibleIssuance',
    fieldPath: `${CONVERTIBLE_MECHANISM_FIELD_PATH}.converts_to_quantity`,
    makeInput: () => convertibleInput({ type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: '100' }),
    inputPath: [...CONVERTIBLE_MECHANISM_INPUT_PATH, 'converts_to_quantity'],
    damlPath: [...CONVERTIBLE_MECHANISM_DAML_PATH, 'converts_to_quantity'],
    nativePath: [...CONVERTIBLE_MECHANISM_INPUT_PATH, 'converts_to_quantity'],
  },
  ...(['numerator', 'denominator'] as const).map(
    (part): NumericWriterCase => ({
      name: `convertible SAFE exit-multiple ${part}`,
      entityType: 'convertibleIssuance',
      fieldPath: `${CONVERTIBLE_MECHANISM_FIELD_PATH}.exit_multiple.${part}`,
      makeInput: safeInput,
      inputPath: [...CONVERTIBLE_MECHANISM_INPUT_PATH, 'exit_multiple', part],
      damlPath: [...CONVERTIBLE_MECHANISM_DAML_PATH, 'exit_multiple', part],
      nativePath: [...CONVERTIBLE_MECHANISM_INPUT_PATH, 'exit_multiple', part],
    })
  ),
  {
    name: 'convertible SAFE valuation cap',
    entityType: 'convertibleIssuance',
    fieldPath: `${CONVERTIBLE_MECHANISM_FIELD_PATH}.conversion_valuation_cap.amount`,
    makeInput: safeInput,
    inputPath: [...CONVERTIBLE_MECHANISM_INPUT_PATH, 'conversion_valuation_cap', 'amount'],
    damlPath: [...CONVERTIBLE_MECHANISM_DAML_PATH, 'conversion_valuation_cap', 'amount'],
    nativePath: [...CONVERTIBLE_MECHANISM_INPUT_PATH, 'conversion_valuation_cap', 'amount'],
  },
  ...(['numerator', 'denominator'] as const).map(
    (part): NumericWriterCase => ({
      name: `convertible note exit-multiple ${part}`,
      entityType: 'convertibleIssuance',
      fieldPath: `${CONVERTIBLE_MECHANISM_FIELD_PATH}.exit_multiple.${part}`,
      makeInput: noteInput,
      inputPath: [...CONVERTIBLE_MECHANISM_INPUT_PATH, 'exit_multiple', part],
      damlPath: [...CONVERTIBLE_MECHANISM_DAML_PATH, 'exit_multiple', part],
      nativePath: [...CONVERTIBLE_MECHANISM_INPUT_PATH, 'exit_multiple', part],
    })
  ),
  {
    name: 'convertible note valuation cap',
    entityType: 'convertibleIssuance',
    fieldPath: `${CONVERTIBLE_MECHANISM_FIELD_PATH}.conversion_valuation_cap.amount`,
    makeInput: noteInput,
    inputPath: [...CONVERTIBLE_MECHANISM_INPUT_PATH, 'conversion_valuation_cap', 'amount'],
    damlPath: [...CONVERTIBLE_MECHANISM_DAML_PATH, 'conversion_valuation_cap', 'amount'],
    nativePath: [...CONVERTIBLE_MECHANISM_INPUT_PATH, 'conversion_valuation_cap', 'amount'],
  },
  {
    name: 'equity compensation quantity',
    entityType: 'equityCompensationIssuance',
    fieldPath: 'equityCompensationIssuance.quantity',
    makeInput: optionInput,
    inputPath: ['quantity'],
    damlPath: ['quantity'],
    nativePath: ['quantity'],
  },
  {
    name: 'equity compensation exercise price',
    entityType: 'equityCompensationIssuance',
    fieldPath: 'equityCompensationIssuance.exercise_price.amount',
    makeInput: optionInput,
    inputPath: ['exercise_price', 'amount'],
    damlPath: ['exercise_price', 'amount'],
    nativePath: ['exercise_price', 'amount'],
  },
  {
    name: 'equity compensation base price',
    entityType: 'equityCompensationIssuance',
    fieldPath: 'equityCompensationIssuance.base_price.amount',
    makeInput: sarInput,
    inputPath: ['base_price', 'amount'],
    damlPath: ['base_price', 'amount'],
    nativePath: ['base_price', 'amount'],
  },
  {
    name: 'equity compensation vesting amount',
    entityType: 'equityCompensationIssuance',
    fieldPath: 'equityCompensationIssuance.vestings[0].amount',
    makeInput: optionInput,
    inputPath: ['vestings', 0, 'amount'],
    damlPath: ['vestings', 0, 'amount'],
    nativePath: ['vestings', 0, 'amount'],
  },
  {
    name: 'warrant quantity',
    entityType: 'warrantIssuance',
    fieldPath: 'warrantIssuance.quantity',
    makeInput: warrantInput,
    inputPath: ['quantity'],
    damlPath: ['quantity'],
    nativePath: ['quantity'],
  },
  {
    name: 'warrant purchase price',
    entityType: 'warrantIssuance',
    fieldPath: 'warrantIssuance.purchase_price.amount',
    makeInput: warrantInput,
    inputPath: ['purchase_price', 'amount'],
    damlPath: ['purchase_price', 'amount'],
    nativePath: ['purchase_price', 'amount'],
  },
  {
    name: 'warrant exercise price',
    entityType: 'warrantIssuance',
    fieldPath: 'warrantIssuance.exercise_price.amount',
    makeInput: warrantInput,
    inputPath: ['exercise_price', 'amount'],
    damlPath: ['exercise_price', 'amount'],
    nativePath: ['exercise_price', 'amount'],
  },
  {
    name: 'warrant vesting amount',
    entityType: 'warrantIssuance',
    fieldPath: 'warrantIssuance.vestings[0].amount',
    makeInput: warrantInput,
    inputPath: ['vestings', 0, 'amount'],
    damlPath: ['vestings', 0, 'amount'],
    nativePath: ['vestings', 0, 'amount'],
  },
  {
    name: 'warrant fixed quantity',
    entityType: 'warrantIssuance',
    fieldPath: `${WARRANT_MECHANISM_FIELD_PATH}.converts_to_quantity`,
    makeInput: () => warrantInput({ type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: '100' }),
    inputPath: [...WARRANT_MECHANISM_INPUT_PATH, 'converts_to_quantity'],
    damlPath: [...WARRANT_MECHANISM_DAML_PATH, 'converts_to_quantity'],
    nativePath: [...WARRANT_MECHANISM_INPUT_PATH, 'converts_to_quantity'],
  },
  {
    name: 'warrant valuation amount',
    entityType: 'warrantIssuance',
    fieldPath: `${WARRANT_MECHANISM_FIELD_PATH}.valuation_amount.amount`,
    makeInput: () =>
      warrantInput({
        type: 'VALUATION_BASED_CONVERSION',
        valuation_type: 'CAP',
        valuation_amount: { amount: '1000000', currency: 'USD' },
      }),
    inputPath: [...WARRANT_MECHANISM_INPUT_PATH, 'valuation_amount', 'amount'],
    damlPath: [...WARRANT_MECHANISM_DAML_PATH, 'valuation_amount', 'amount'],
    nativePath: [...WARRANT_MECHANISM_INPUT_PATH, 'valuation_amount', 'amount'],
  },
  {
    name: 'warrant PPS discount amount',
    entityType: 'warrantIssuance',
    fieldPath: `${WARRANT_MECHANISM_FIELD_PATH}.discount_amount.amount`,
    makeInput: () =>
      warrantInput({
        type: 'PPS_BASED_CONVERSION',
        description: 'Fixed discount',
        discount: true,
        discount_amount: { amount: '1', currency: 'USD' },
      }),
    inputPath: [...WARRANT_MECHANISM_INPUT_PATH, 'discount_amount', 'amount'],
    damlPath: [...WARRANT_MECHANISM_DAML_PATH, 'discount_amount', 'amount'],
    nativePath: [...WARRANT_MECHANISM_INPUT_PATH, 'discount_amount', 'amount'],
  },
  ...(['numerator', 'denominator'] as const).map(
    (part): NumericWriterCase => ({
      name: `stock-class ratio ${part}`,
      entityType: 'warrantIssuance',
      fieldPath: `${WARRANT_MECHANISM_FIELD_PATH}.ratio.${part}`,
      makeInput: stockClassWarrantInput,
      inputPath: [...STOCK_CLASS_INPUT_PATH, 'ratio', part],
      damlPath: [...STOCK_CLASS_DAML_PATH, 'ratio', part],
      nativePath: [...STOCK_CLASS_INPUT_PATH, 'ratio', part],
    })
  ),
  {
    name: 'stock-class conversion price',
    entityType: 'warrantIssuance',
    fieldPath: `${WARRANT_MECHANISM_FIELD_PATH}.conversion_price.amount`,
    makeInput: stockClassWarrantInput,
    inputPath: [...STOCK_CLASS_INPUT_PATH, 'conversion_price', 'amount'],
    damlPath: [...STOCK_CLASS_DAML_PATH, 'conversion_price', 'amount'],
    nativePath: [...STOCK_CLASS_INPUT_PATH, 'conversion_price', 'amount'],
  },
];

function recordValue(value: unknown, description: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected ${description} to be an object`);
  }
  return value as Record<string, unknown>;
}

function valueAtPath(value: unknown, path: ValuePath): unknown {
  let current = value;
  for (const part of path) {
    if (typeof part === 'number') {
      if (!Array.isArray(current)) return undefined;
      current = current[part];
    } else {
      if (current === null || typeof current !== 'object' || Array.isArray(current)) return undefined;
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}

function setValueAtPath(value: unknown, path: ValuePath, nextValue: unknown): void {
  const finalPart = path[path.length - 1];
  if (finalPart === undefined) throw new Error('Cannot set an empty path');
  let parent = value;
  for (const part of path.slice(0, -1)) {
    parent =
      typeof part === 'number'
        ? (parent as readonly unknown[])[part]
        : recordValue(parent, `path parent ${String(part)}`)[part];
  }
  if (typeof finalPart === 'number') {
    (parent as unknown[])[finalPart] = nextValue;
  } else {
    recordValue(parent, `path parent ${finalPart}`)[finalPart] = nextValue;
  }
}

function deleteValueAtPath(value: unknown, path: ValuePath): void {
  const finalPart = path[path.length - 1];
  if (typeof finalPart !== 'string') throw new Error('Expected a property path');
  let parent = value;
  for (const part of path.slice(0, -1)) {
    parent =
      typeof part === 'number'
        ? (parent as readonly unknown[])[part]
        : recordValue(parent, `path parent ${String(part)}`)[part];
  }
  delete recordValue(parent, `path parent ${finalPart}`)[finalPart];
}

function sharedWriterDag(depth: number, width: number, containers?: WeakSet<object>): Record<string, unknown> {
  let value: Record<string, unknown> = { leaf: true };
  containers?.add(value);
  for (let level = 0; level < depth; level += 1) {
    const parent: Record<string, unknown> = {};
    for (let branch = 0; branch < width; branch += 1) parent[`branch_${branch}`] = value;
    containers?.add(parent);
    value = parent;
  }
  return value;
}

function deepWriterChain(depth: number): Record<string, unknown> {
  let value: Record<string, unknown> = { leaf: true };
  for (let level = 0; level < depth; level += 1) value = { child: value };
  return value;
}

function directWrite(entityType: ComplexIssuanceEntityType, input: ComplexIssuanceInput): Record<string, unknown> {
  switch (entityType) {
    case 'convertibleIssuance':
      return convertibleIssuanceDataToDaml(input as ConvertibleIssuanceInput);
    case 'equityCompensationIssuance':
      return equityCompensationIssuanceDataToDaml(input as OcfEquityCompensationIssuance);
    case 'warrantIssuance':
      return warrantIssuanceDataToDaml(input as WarrantIssuanceInput);
  }
}

function publicWrite(entityType: ComplexIssuanceEntityType, input: ComplexIssuanceInput): Record<string, unknown> {
  switch (entityType) {
    case 'convertibleIssuance':
      return buildOcfCreateData('convertibleIssuance', input as OcfConvertibleIssuance).value;
    case 'equityCompensationIssuance':
      return buildOcfCreateData('equityCompensationIssuance', input as OcfEquityCompensationIssuance).value;
    case 'warrantIssuance':
      return buildOcfCreateData('warrantIssuance', input as OcfWarrantIssuance).value;
  }
}

function addToPublicBatch(entityType: ComplexIssuanceEntityType, input: ComplexIssuanceInput): void {
  const batch = new CapTableBatch({ capTableContractId: 'cap-table', actAs: ['issuer::party'] });
  switch (entityType) {
    case 'convertibleIssuance': {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Correlate the runtime entity branch for the variadic tuple overload without reading hostile input.
      batch.create('convertibleIssuance', input as OcfConvertibleIssuance);
      return;
    }
    case 'equityCompensationIssuance': {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Correlate the runtime entity branch for the variadic tuple overload without reading hostile input.
      batch.create('equityCompensationIssuance', input as OcfEquityCompensationIssuance);
      return;
    }
    case 'warrantIssuance': {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Correlate the runtime entity branch for the variadic tuple overload without reading hostile input.
      batch.create('warrantIssuance', input as OcfWarrantIssuance);
    }
  }
}

const writerSurfaces = [
  { name: 'direct writer', write: directWrite },
  { name: 'generated public writer', write: publicWrite },
  { name: 'typed CapTableBatch writer', write: addToPublicBatch },
] as const;

function readNative(entityType: ComplexIssuanceEntityType, daml: Record<string, unknown>): ComplexIssuanceNative {
  switch (entityType) {
    case 'convertibleIssuance':
      return damlConvertibleIssuanceDataToNative(daml as Parameters<typeof damlConvertibleIssuanceDataToNative>[0]);
    case 'equityCompensationIssuance':
      return damlEquityCompensationIssuanceDataToNative(
        daml as Parameters<typeof damlEquityCompensationIssuanceDataToNative>[0]
      );
    case 'warrantIssuance':
      return damlWarrantIssuanceDataToNative(daml as Parameters<typeof damlWarrantIssuanceDataToNative>[0]);
  }
}

function inputWithValue(testCase: NumericWriterCase, value: string): ComplexIssuanceInput {
  const input = testCase.makeInput();
  setValueAtPath(input, testCase.inputPath, value);
  return input;
}

function expectNumericError(action: () => unknown, testCase: NumericWriterCase, receivedValue: string): void {
  try {
    action();
    throw new Error(`Expected ${testCase.name} to reject ${receivedValue}`);
  } catch (error) {
    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: testCase.fieldPath,
      receivedValue,
    });
  }
}

function expectBoundedOverlongNumericError(action: () => unknown, testCase: NumericWriterCase): void {
  try {
    action();
    throw new Error(`Expected ${testCase.name} to reject overlong Numeric input`);
  } catch (error) {
    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: testCase.fieldPath,
    });
    expect(JSON.stringify(error).length).toBeLessThan(2_000);
  }
}

function expectContextualError(
  action: () => unknown,
  expected: {
    readonly code: OcpErrorCode;
    readonly fieldPath: string;
    readonly receivedValue: unknown;
  }
): void {
  try {
    action();
    throw new Error(`Expected validation to fail at ${expected.fieldPath}`);
  } catch (error) {
    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error).toMatchObject(expected);
  }
}

describe('strict complex issuance Numeric(10) writers', () => {
  const tooManyIntegralDigits = '9'.repeat(29);
  const tooManyFractionalDigits = '1.12345678901';
  const overlongZero = '0'.repeat(257);

  test.each(writerSurfaces.flatMap((surface) => numericWriterCases.map((testCase) => ({ surface, testCase }))))(
    '$testCase.name $surface.name rejects an overlong all-zero Numeric',
    ({ surface, testCase }) => {
      expectBoundedOverlongNumericError(
        () => surface.write(testCase.entityType, inputWithValue(testCase, overlongZero)),
        testCase
      );
    }
  );

  test.each(numericWriterCases)('$name direct writer rejects 29 integral digits', (testCase) => {
    expectNumericError(
      () => directWrite(testCase.entityType, inputWithValue(testCase, tooManyIntegralDigits)),
      testCase,
      tooManyIntegralDigits
    );
  });

  test.each(numericWriterCases)('$name direct writer rejects 11 fractional digits', (testCase) => {
    expectNumericError(
      () => directWrite(testCase.entityType, inputWithValue(testCase, tooManyFractionalDigits)),
      testCase,
      tooManyFractionalDigits
    );
  });

  test.each(numericWriterCases)('$name rejects exponent notation at the OCF writer boundary', (testCase) => {
    for (const write of [directWrite, publicWrite]) {
      expectNumericError(() => write(testCase.entityType, inputWithValue(testCase, '1e3')), testCase, '1e3');
    }
  });

  test.each(numericWriterCases)('$name generated public writer rejects 29 integral digits', (testCase) => {
    expectNumericError(
      () => publicWrite(testCase.entityType, inputWithValue(testCase, tooManyIntegralDigits)),
      testCase,
      tooManyIntegralDigits
    );
  });

  test.each(numericWriterCases)('$name typed CapTableBatch writer rejects 29 integral digits', (testCase) => {
    expectNumericError(
      () => addToPublicBatch(testCase.entityType, inputWithValue(testCase, tooManyIntegralDigits)),
      testCase,
      tooManyIntegralDigits
    );
  });

  test.each(numericWriterCases)('$name generated public writer rejects 11 fractional digits', (testCase) => {
    expect(() => publicWrite(testCase.entityType, inputWithValue(testCase, tooManyFractionalDigits))).toThrow(
      OcpValidationError
    );
  });

  test.each(
    numericWriterCases.flatMap((testCase) => [
      { testCase, input: '9'.repeat(28), expected: '9'.repeat(28) },
      { testCase, input: '1.1234567890', expected: '1.123456789' },
    ])
  )(
    '$testCase.name preserves valid boundary $input through direct and public round trips',
    ({ testCase, input, expected }) => {
      for (const write of [directWrite, publicWrite]) {
        const daml = write(testCase.entityType, inputWithValue(testCase, input));
        expect(valueAtPath(daml, testCase.damlPath)).toBe(expected);
        expect(valueAtPath(readNative(testCase.entityType, daml), testCase.nativePath)).toBe(expected);
      }
    }
  );

  const requiresPositiveNumeric = (testCase: NumericWriterCase): boolean =>
    testCase.name.includes('fixed quantity') ||
    testCase.name.includes('exit-multiple') ||
    testCase.name.includes('ratio numerator') ||
    testCase.name.includes('ratio denominator') ||
    testCase.name.endsWith('vesting amount');

  test.each(
    numericWriterCases
      .filter((testCase) => !requiresPositiveNumeric(testCase))
      .flatMap((testCase) => [
        { testCase, input: '-0' },
        { testCase, input: '-0.0000000000' },
      ])
  )('$testCase.name never emits negative zero for $input', ({ testCase, input }) => {
    for (const write of [directWrite, publicWrite]) {
      const daml = write(testCase.entityType, inputWithValue(testCase, input));
      expect(valueAtPath(daml, testCase.damlPath)).toBe('0');
      expect(valueAtPath(readNative(testCase.entityType, daml), testCase.nativePath)).toBe('0');
    }
  });

  test.each(
    numericWriterCases.filter(requiresPositiveNumeric).flatMap((testCase) => [
      { testCase, input: '-0' },
      { testCase, input: '-0.0000000000' },
    ])
  )('$testCase.name rejects negative zero because the field is strictly positive', ({ testCase, input }) => {
    for (const write of [directWrite, publicWrite]) {
      expectContextualError(() => write(testCase.entityType, inputWithValue(testCase, input)), {
        code: OcpErrorCodes.OUT_OF_RANGE,
        fieldPath: testCase.fieldPath,
        receivedValue: input,
      });
    }
  });

  test.each(numericWriterCases.filter(({ name }) => name.endsWith('vesting amount')))(
    '$name rejects a negative vesting amount',
    (testCase) => {
      for (const write of [directWrite, publicWrite]) {
        expectContextualError(() => write(testCase.entityType, inputWithValue(testCase, '-1.2300000000')), {
          code: OcpErrorCodes.OUT_OF_RANGE,
          fieldPath: testCase.fieldPath,
          receivedValue: '-1.2300000000',
        });
      }
    }
  );
});

describe('strict complex issuance monetary writers', () => {
  const monetaryCaseNames = new Set([
    'convertible investment amount',
    'convertible SAFE valuation cap',
    'convertible note valuation cap',
    'equity compensation exercise price',
    'equity compensation base price',
    'warrant purchase price',
    'warrant exercise price',
    'warrant valuation amount',
    'warrant PPS discount amount',
    'stock-class conversion price',
  ]);
  const monetaryCases = numericWriterCases
    .filter(({ name }) => monetaryCaseNames.has(name))
    .map((testCase) => ({
      ...testCase,
      currencyFieldPath: testCase.fieldPath.replace(/\.amount$/, '.currency'),
      currencyInputPath: [...testCase.inputPath.slice(0, -1), 'currency'] as ValuePath,
    }));

  test.each(monetaryCases.flatMap((testCase) => writerSurfaces.map((surface) => ({ testCase, surface }))))(
    '$testCase.name $surface.name rejects a negative nonzero Monetary amount',
    ({ testCase, surface }) => {
      const input = inputWithValue(testCase, '-1');
      expectContextualError(() => surface.write(testCase.entityType, input), {
        code: OcpErrorCodes.OUT_OF_RANGE,
        fieldPath: testCase.fieldPath,
        receivedValue: '-1',
      });
    }
  );

  test.each(
    monetaryCases.flatMap((testCase) =>
      ['usd', 'US', 'USDX'].flatMap((currency) => writerSurfaces.map((surface) => ({ testCase, currency, surface })))
    )
  )('$testCase.name $surface.name rejects non-canonical currency $currency', ({ testCase, currency, surface }) => {
    const input = testCase.makeInput();
    setValueAtPath(input, testCase.currencyInputPath, currency);
    expectContextualError(() => surface.write(testCase.entityType, input), {
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: testCase.currencyFieldPath,
      receivedValue: currency,
    });
  });

  test.each(
    monetaryCases.flatMap((testCase) =>
      [
        { value: null, code: OcpErrorCodes.INVALID_TYPE },
        { value: undefined, code: OcpErrorCodes.REQUIRED_FIELD_MISSING },
      ].flatMap(({ value, code }) => writerSurfaces.map((surface) => ({ testCase, value, code, surface })))
    )
  )('$testCase.name $surface.name distinguishes missing and null currency', ({ testCase, value, code, surface }) => {
    const input = testCase.makeInput();
    setValueAtPath(input, testCase.currencyInputPath, value);
    expectContextualError(() => surface.write(testCase.entityType, input), {
      code,
      fieldPath: testCase.currencyFieldPath,
      receivedValue: value,
    });
  });
});

describe('exact equity-compensation termination-period writers', () => {
  const fieldPath = 'equityCompensationIssuance.termination_exercise_windows[1].period';

  function inputWithTerminationPeriod(period: unknown): OcfEquityCompensationIssuance {
    return {
      ...optionInput(),
      termination_exercise_windows: [
        { reason: 'VOLUNTARY_OTHER', period: 90, period_type: 'DAYS' },
        { reason: 'INVOLUNTARY_OTHER', period, period_type: 'MONTHS' },
      ],
    } as OcfEquityCompensationIssuance;
  }

  test.each(
    [
      { value: undefined, code: OcpErrorCodes.REQUIRED_FIELD_MISSING },
      { value: null, code: OcpErrorCodes.INVALID_TYPE },
      { value: '90', code: OcpErrorCodes.INVALID_TYPE },
      { value: 1.5, code: OcpErrorCodes.INVALID_FORMAT },
      { value: Number.POSITIVE_INFINITY, code: OcpErrorCodes.INVALID_FORMAT },
      { value: Number.MAX_SAFE_INTEGER + 1, code: OcpErrorCodes.OUT_OF_RANGE },
      { value: -1, code: OcpErrorCodes.OUT_OF_RANGE },
      { value: Number.MIN_SAFE_INTEGER, code: OcpErrorCodes.OUT_OF_RANGE },
    ].flatMap(({ value, code }) => writerSurfaces.map((surface) => ({ value, code, surface })))
  )('$surface.name rejects non-exact period $value at its indexed path', ({ value, code, surface }) => {
    expectContextualError(() => surface.write('equityCompensationIssuance', inputWithTerminationPeriod(value)), {
      code,
      fieldPath,
      receivedValue:
        typeof value === 'number' && !Number.isFinite(value) ? { valueType: 'number', value: 'Infinity' } : value,
    });
  });

  test.each([0, Number.MAX_SAFE_INTEGER])(
    'preserves safe integer boundary %p through direct and generated public round trips',
    (period) => {
      for (const write of [directWrite, publicWrite]) {
        const daml = write('equityCompensationIssuance', inputWithTerminationPeriod(period));
        expect(valueAtPath(daml, ['termination_exercise_windows', 1, 'period'])).toBe(period.toString());
        expect(
          valueAtPath(readNative('equityCompensationIssuance', daml), ['termination_exercise_windows', 1, 'period'])
        ).toBe(period);
      }
    }
  );

  test.each(
    [
      { field: 'reason', value: 'toString' },
      { field: 'reason', value: 'constructor' },
      { field: 'period_type', value: 'toString' },
      { field: 'period_type', value: 'constructor' },
    ].flatMap((invalid) => writerSurfaces.map((surface) => ({ ...invalid, surface })))
  )('$surface.name rejects inherited map key $value for $field', ({ field, value, surface }) => {
    const input = inputWithTerminationPeriod(90);
    (input.termination_exercise_windows[1] as unknown as Record<string, unknown>)[field] = value;
    expectContextualError(() => surface.write('equityCompensationIssuance', input), {
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      fieldPath: `equityCompensationIssuance.termination_exercise_windows[1].${field}`,
      receivedValue: value,
    });
  });
});

describe('lossless schema-valid optional text writers', () => {
  const cases = [
    {
      name: 'convertible consideration text',
      entityType: 'convertibleIssuance' as const,
      makeInput: customConvertibleInput,
      path: ['consideration_text'] as ValuePath,
      fieldPath: 'convertibleIssuance.consideration_text',
    },
    ...(['consideration_text', 'stock_plan_id', 'stock_class_id', 'vesting_terms_id'] as const).map((field) => ({
      name: `equity compensation ${field}`,
      entityType: 'equityCompensationIssuance' as const,
      makeInput: optionInput,
      path: [field] as ValuePath,
      fieldPath: `equityCompensationIssuance.${field}`,
    })),
    ...(['consideration_text', 'vesting_terms_id'] as const).map((field) => ({
      name: `warrant ${field}`,
      entityType: 'warrantIssuance' as const,
      makeInput: warrantInput,
      path: [field] as ValuePath,
      fieldPath: `warrantIssuance.${field}`,
    })),
  ];

  test.each(cases)('$name preserves a present whitespace-only string', (testCase) => {
    for (const write of [directWrite, publicWrite]) {
      const input = testCase.makeInput();
      setValueAtPath(input, testCase.path, '   ');
      const daml = write(testCase.entityType, input);
      expect(valueAtPath(daml, testCase.path)).toBe('   ');
      expect(valueAtPath(readNative(testCase.entityType, daml), testCase.path)).toBe('   ');
    }
  });

  test.each(cases.flatMap((testCase) => writerSurfaces.map((surface) => ({ testCase, surface }))))(
    '$testCase.name $surface.name rejects a present empty string',
    ({ testCase, surface }) => {
      const input = testCase.makeInput();
      setValueAtPath(input, testCase.path, '');
      expectContextualError(() => surface.write(testCase.entityType, input), {
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: testCase.fieldPath,
        receivedValue: '',
      });
    }
  );

  test.each(cases.flatMap((testCase) => writerSurfaces.map((surface) => ({ testCase, surface }))))(
    '$testCase.name $surface.name rejects explicit null instead of conflating it with omission',
    ({ testCase, surface }) => {
      const input = testCase.makeInput();
      setValueAtPath(input, testCase.path, null);
      expectContextualError(() => surface.write(testCase.entityType, input), {
        code: OcpErrorCodes.INVALID_TYPE,
        fieldPath: testCase.fieldPath,
        receivedValue: null,
      });
    }
  );
});

describe('lossless plain writer input boundaries', () => {
  const cases = [
    {
      entityType: 'convertibleIssuance' as const,
      fieldPath: 'convertibleIssuance',
      makeInput: customConvertibleInput,
    },
    {
      entityType: 'equityCompensationIssuance' as const,
      fieldPath: 'equityCompensationIssuance',
      makeInput: optionInput,
    },
    { entityType: 'warrantIssuance' as const, fieldPath: 'warrantIssuance', makeInput: warrantInput },
  ];

  function expectStructureError(
    action: () => unknown,
    expected: { readonly code?: OcpErrorCode; readonly fieldPath: string }
  ): void {
    try {
      action();
      throw new Error(`Expected writer structure validation to fail at ${expected.fieldPath}`);
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({ code: expected.code ?? OcpErrorCodes.INVALID_TYPE, fieldPath: expected.fieldPath });
    }
  }

  test.each(cases.flatMap((testCase) => writerSurfaces.map((surface) => ({ testCase, surface }))))(
    '$testCase.entityType $surface.name rejects inherited top-level fields',
    ({ testCase, surface }) => {
      const input = Object.create(testCase.makeInput()) as ComplexIssuanceInput;
      expectStructureError(() => surface.write(testCase.entityType, input), {
        fieldPath: `${testCase.fieldPath}.object_type`,
      });
    }
  );

  it('keeps a huge sparse-array error safe and bounded to inspect or serialize', () => {
    const input = customConvertibleInput();
    const comments: string[] = [];
    comments.length = 0xffff_ffff;
    input.comments = comments;

    let thrown: unknown;
    try {
      directWrite('convertibleIssuance', input);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(OcpValidationError);
    expect(thrown).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: 'convertibleIssuance.comments[0]',
      receivedValue: { containerType: 'array', length: 0xffff_ffff },
    });
    const serialized = JSON.stringify(thrown);
    expect(serialized).toContain('"containerType":"array"');
    expect(serialized.length).toBeLessThan(2_000);
  });

  test.each([
    {
      name: 'benign Proxy',
      makeProxy: () => new Proxy(customConvertibleInput(), {}),
    },
    {
      name: 'throwing Proxy',
      makeProxy: () =>
        new Proxy(customConvertibleInput(), {
          get: () => {
            throw new Error('get trap must not run');
          },
          getOwnPropertyDescriptor: () => {
            throw new Error('descriptor trap must not run');
          },
          getPrototypeOf: () => {
            throw new Error('prototype trap must not run');
          },
          ownKeys: () => {
            throw new Error('ownKeys trap must not run');
          },
        }),
    },
    {
      name: 'revoked Proxy',
      makeProxy: () => {
        const revocable = Proxy.revocable(customConvertibleInput(), {});
        revocable.revoke();
        return revocable.proxy;
      },
    },
  ])('rejects a $name without invoking traps on every writer surface', ({ makeProxy }) => {
    for (const { write } of writerSurfaces) {
      let thrown: unknown;
      try {
        write('convertibleIssuance', makeProxy());
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(OcpValidationError);
      expect(thrown).toMatchObject({
        code: OcpErrorCodes.INVALID_TYPE,
        fieldPath: 'convertibleIssuance',
        receivedValue: { containerType: 'proxy' },
      });
      expect(JSON.stringify(thrown).length).toBeLessThan(2_000);
    }
  });

  test.each(cases.flatMap((testCase) => writerSurfaces.map((surface) => ({ testCase, surface }))))(
    '$testCase.entityType $surface.name rejects inherited nested record fields',
    ({ testCase, surface }) => {
      const input = testCase.makeInput();
      (input as { security_law_exemptions: unknown }).security_law_exemptions = [
        Object.create({ description: 'Reg D', jurisdiction: 'US' }),
      ];
      expectStructureError(() => surface.write(testCase.entityType, input), {
        fieldPath: `${testCase.fieldPath}.security_law_exemptions[0].description`,
      });
    }
  );

  test.each(cases.flatMap((testCase) => writerSurfaces.map((surface) => ({ testCase, surface }))))(
    '$testCase.entityType $surface.name rejects a huge sparse array in time proportional to its own keys',
    ({ testCase, surface }) => {
      const input = testCase.makeInput();
      const comments: string[] = [];
      comments.length = 0xffff_ffff;
      (input as { comments?: string[] }).comments = comments;
      expectStructureError(() => surface.write(testCase.entityType, input), {
        fieldPath: `${testCase.fieldPath}.comments[0]`,
      });
    }
  );

  test.each(cases.flatMap((testCase) => writerSurfaces.map((surface) => ({ testCase, surface }))))(
    '$testCase.entityType $surface.name rejects an accessor without invoking it',
    ({ testCase, surface }) => {
      const input = testCase.makeInput();
      let invocations = 0;
      Object.defineProperty(input, 'consideration_text', {
        configurable: true,
        enumerable: true,
        get: () => {
          invocations += 1;
          return 'must not run';
        },
      });

      expectStructureError(() => surface.write(testCase.entityType, input), {
        fieldPath: `${testCase.fieldPath}.consideration_text`,
      });
      expect(invocations).toBe(0);
    }
  );

  test.each(cases.flatMap((testCase) => writerSurfaces.map((surface) => ({ testCase, surface }))))(
    '$testCase.entityType $surface.name rejects an array-element accessor without invoking it',
    ({ testCase, surface }) => {
      const input = testCase.makeInput();
      let invocations = 0;
      const comments = ['safe'];
      Object.defineProperty(comments, '0', {
        configurable: true,
        enumerable: true,
        get: () => {
          invocations += 1;
          return 'must not run';
        },
      });
      (input as { comments?: string[] }).comments = comments;

      expectStructureError(() => surface.write(testCase.entityType, input), {
        fieldPath: `${testCase.fieldPath}.comments[0]`,
      });
      expect(invocations).toBe(0);
    }
  );

  test.each(cases)('$entityType rejects a present undefined array element at its indexed path', (testCase) => {
    const input = testCase.makeInput();
    (input as { comments?: unknown[] }).comments = [undefined];
    expectStructureError(() => directWrite(testCase.entityType, input), {
      fieldPath: `${testCase.fieldPath}.comments[0]`,
    });
  });

  test.each(
    cases.flatMap((testCase) =>
      [
        { value: 1n, code: OcpErrorCodes.INVALID_TYPE },
        { value: Symbol('value'), code: OcpErrorCodes.INVALID_TYPE },
        { value: () => 'value', code: OcpErrorCodes.INVALID_TYPE },
        { value: Number.NaN, code: OcpErrorCodes.INVALID_FORMAT },
        { value: Number.NEGATIVE_INFINITY, code: OcpErrorCodes.INVALID_FORMAT },
      ].map(({ value, code }) => ({ testCase, value, code }))
    )
  )('$testCase.entityType rejects non-JSON primitive $value at its exact path', ({ testCase, value, code }) => {
    const input = testCase.makeInput();
    (input as { consideration_text?: unknown }).consideration_text = value;
    expectStructureError(() => directWrite(testCase.entityType, input), {
      code,
      fieldPath: `${testCase.fieldPath}.consideration_text`,
    });
  });

  test.each(cases)('$entityType rejects symbol and non-enumerable extra fields at exact paths', (testCase) => {
    const symbol = Symbol('hidden');
    const symbolInput = testCase.makeInput() as ComplexIssuanceInput & Record<PropertyKey, unknown>;
    symbolInput[symbol] = true;
    expectStructureError(() => directWrite(testCase.entityType, symbolInput), {
      fieldPath: `${testCase.fieldPath}[Symbol(hidden)]`,
    });

    const hiddenInput = testCase.makeInput();
    Object.defineProperty(hiddenInput, 'hidden', { configurable: true, enumerable: false, value: true });
    expectStructureError(() => directWrite(testCase.entityType, hiddenInput), {
      fieldPath: `${testCase.fieldPath}.hidden`,
    });
  });

  test.each(cases)('$entityType distinguishes a missing required id from explicit null', (testCase) => {
    for (const { value, code } of [
      { value: undefined, code: OcpErrorCodes.REQUIRED_FIELD_MISSING },
      { value: null, code: OcpErrorCodes.INVALID_TYPE },
    ]) {
      const input = testCase.makeInput();
      (input as { id: unknown }).id = value;
      expectStructureError(() => directWrite(testCase.entityType, input), {
        code,
        fieldPath: `${testCase.fieldPath}.id`,
      });
    }
  });

  test.each(writerSurfaces)('$name bounds very large scalar and container diagnostics', (surface) => {
    for (const makeInput of [
      () => {
        const input = customConvertibleInput();
        input.investment_amount.amount = '9'.repeat(100_000);
        return input;
      },
      () => {
        const input = customConvertibleInput();
        (input as { investment_amount: unknown }).investment_amount = Array(100_000).fill('x');
        return input;
      },
    ]) {
      let thrown: unknown;
      try {
        surface.write('convertibleIssuance', makeInput());
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(OcpValidationError);
      const serialized = JSON.stringify(thrown);
      expect(JSON.parse(serialized)).toEqual(expect.any(Object));
      expect(serialized.length).toBeLessThan(2_000);
    }
  });

  test.each(writerSurfaces)('$name rejects null-prototype enum values without coercion', (surface) => {
    const input = customConvertibleInput();
    (input as { convertible_type: unknown }).convertible_type = Object.create(null);

    let thrown: unknown;
    try {
      surface.write('convertibleIssuance', input);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(OcpValidationError);
    expect(thrown).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: 'convertibleIssuance.convertible_type',
    });
    expect(JSON.stringify(thrown).length).toBeLessThan(2_000);
  });

  test.each(writerSurfaces)('$name rejects a hostile Proxy prototype without invoking its traps', (surface) => {
    const input = customConvertibleInput();
    Object.setPrototypeOf(
      input,
      new Proxy(
        {},
        {
          getOwnPropertyDescriptor: () => {
            throw new Error('prototype descriptor trap must not run');
          },
          getPrototypeOf: () => {
            throw new Error('prototype traversal trap must not run');
          },
          ownKeys: () => {
            throw new Error('prototype ownKeys trap must not run');
          },
        }
      )
    );

    let thrown: unknown;
    try {
      surface.write('convertibleIssuance', input);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(OcpValidationError);
    expect(thrown).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: 'convertibleIssuance',
    });
    expect(JSON.stringify(thrown).length).toBeLessThan(2_000);
  });

  it.each([
    {
      name: 'function with a hostile name',
      makeValue: () => {
        const value = () => 'value';
        Object.defineProperty(value, 'name', { value: Object.create(null) });
        return value;
      },
    },
    { name: 'very large symbol', makeValue: () => Symbol('x'.repeat(100_000)) },
    { name: 'BigInt', makeValue: () => 1n },
    {
      name: 'cyclic object',
      makeValue: () => {
        const value: Record<string, unknown> = {};
        value.self = value;
        return value;
      },
    },
  ])('keeps a rejected $name diagnostic bounded and JSON-safe', ({ name, makeValue }) => {
    const input = customConvertibleInput();
    (input as { consideration_text?: unknown }).consideration_text = makeValue();

    let thrown: unknown;
    try {
      directWrite('convertibleIssuance', input);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(OcpValidationError);
    expect(thrown).toMatchObject({
      code: name === 'cyclic object' ? OcpErrorCodes.INVALID_FORMAT : OcpErrorCodes.INVALID_TYPE,
      fieldPath:
        name === 'cyclic object'
          ? 'convertibleIssuance.consideration_text.self'
          : 'convertibleIssuance.consideration_text',
    });
    expect(JSON.stringify(thrown).length).toBeLessThan(2_000);
  });
});

describe('contextual nested mechanism writer diagnostics', () => {
  const tooManyIntegralDigits = '9'.repeat(29);
  const surfaces = [
    { name: 'direct writer', write: directWrite },
    { name: 'buildOcfCreateData', write: publicWrite },
    { name: 'typed CapTableBatch', write: addToPublicBatch },
  ] as const;
  const multiTriggerCases = [
    {
      name: 'second convertible fixed-amount trigger',
      entityType: 'convertibleIssuance' as const,
      makeInput: () =>
        convertibleInputWithSecondMechanism({
          type: 'FIXED_AMOUNT_CONVERSION',
          converts_to_quantity: tooManyIntegralDigits,
        }),
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath:
        'convertibleIssuance.conversion_triggers[1].conversion_right.conversion_mechanism.converts_to_quantity',
      receivedValue: tooManyIntegralDigits,
    },
    {
      name: 'second warrant fixed-amount trigger',
      entityType: 'warrantIssuance' as const,
      makeInput: () =>
        warrantInputWithSecondMechanism({
          type: 'FIXED_AMOUNT_CONVERSION',
          converts_to_quantity: tooManyIntegralDigits,
        }),
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'warrantIssuance.exercise_triggers[1].conversion_right.conversion_mechanism.converts_to_quantity',
      receivedValue: tooManyIntegralDigits,
    },
    {
      name: 'second warrant stock-class ratio trigger',
      entityType: 'warrantIssuance' as const,
      makeInput: () => stockClassWarrantInputWithSecondTrigger(tooManyIntegralDigits),
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'warrantIssuance.exercise_triggers[1].conversion_right.conversion_mechanism.ratio.numerator',
      receivedValue: tooManyIntegralDigits,
    },
  ] as const;

  test.each(multiTriggerCases.flatMap((testCase) => surfaces.map((surface) => ({ ...testCase, surface }))))(
    '$surface.name reports the exact path for the $name',
    ({ surface, entityType, makeInput, code, fieldPath, receivedValue }) => {
      expectContextualError(() => surface.write(entityType, makeInput()), { code, fieldPath, receivedValue });
    }
  );

  const percentageCases = [
    {
      name: 'second SAFE discount',
      entityType: 'convertibleIssuance' as const,
      makeInput: () =>
        convertibleInputWithSecondMechanism({
          type: 'SAFE_CONVERSION',
          conversion_mfn: false,
          conversion_discount: '2',
        }),
      fieldPath: 'convertibleIssuance.conversion_triggers[1].conversion_right.conversion_mechanism.conversion_discount',
    },
    {
      name: 'second note discount',
      entityType: 'convertibleIssuance' as const,
      makeInput: () =>
        convertibleInputWithSecondMechanism({
          type: 'CONVERTIBLE_NOTE_CONVERSION',
          interest_rates: [],
          day_count_convention: 'ACTUAL_365',
          interest_payout: 'DEFERRED',
          interest_accrual_period: 'MONTHLY',
          compounding_type: 'SIMPLE',
          conversion_discount: '2',
        }),
      fieldPath: 'convertibleIssuance.conversion_triggers[1].conversion_right.conversion_mechanism.conversion_discount',
    },
    {
      name: 'second trigger and second note interest rate',
      entityType: 'convertibleIssuance' as const,
      makeInput: () => noteInputWithSecondRate('2'),
      fieldPath:
        'convertibleIssuance.conversion_triggers[1].conversion_right.conversion_mechanism.interest_rates[1].rate',
    },
    {
      name: 'second convertible capitalization percentage',
      entityType: 'convertibleIssuance' as const,
      makeInput: () =>
        convertibleInputWithSecondMechanism({
          type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
          converts_to_percent: '2',
        }),
      fieldPath: 'convertibleIssuance.conversion_triggers[1].conversion_right.conversion_mechanism.converts_to_percent',
    },
    {
      name: 'second warrant capitalization percentage',
      entityType: 'warrantIssuance' as const,
      makeInput: () =>
        warrantInputWithSecondMechanism({
          type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
          converts_to_percent: '2',
        }),
      fieldPath: 'warrantIssuance.exercise_triggers[1].conversion_right.conversion_mechanism.converts_to_percent',
    },
    {
      name: 'second warrant PPS discount percentage',
      entityType: 'warrantIssuance' as const,
      makeInput: () =>
        warrantInputWithSecondMechanism({
          type: 'PPS_BASED_CONVERSION',
          description: 'Percentage discount',
          discount: true,
          discount_percentage: '2',
        }),
      fieldPath: 'warrantIssuance.exercise_triggers[1].conversion_right.conversion_mechanism.discount_percentage',
    },
  ] as const;

  test.each(percentageCases)('reports the exact indexed path for the $name', ({ entityType, makeInput, fieldPath }) => {
    expectContextualError(() => directWrite(entityType, makeInput()), {
      code: OcpErrorCodes.OUT_OF_RANGE,
      fieldPath,
      receivedValue: '2',
    });
  });
});

describe('malformed nested complex-issuance writer records', () => {
  const malformedCases = [
    {
      name: 'convertible scalar conversion right',
      entityType: 'convertibleIssuance' as const,
      makeInput: () => {
        const input = customConvertibleInput();
        setValueAtPath(input, ['conversion_triggers', 0, 'conversion_right'], 42);
        return input;
      },
      fieldPath: 'convertibleIssuance.conversion_triggers[0].conversion_right',
    },
    {
      name: 'convertible conversion right without a type',
      entityType: 'convertibleIssuance' as const,
      makeInput: () => {
        const input = customConvertibleInput();
        setValueAtPath(input, ['conversion_triggers', 0, 'conversion_right'], {});
        return input;
      },
      fieldPath: 'convertibleIssuance.conversion_triggers[0].conversion_right.type',
    },
    {
      name: 'convertible conversion right without a mechanism',
      entityType: 'convertibleIssuance' as const,
      makeInput: () => {
        const input = customConvertibleInput();
        deleteValueAtPath(input, ['conversion_triggers', 0, 'conversion_right', 'conversion_mechanism']);
        return input;
      },
      fieldPath: 'convertibleIssuance.conversion_triggers[0].conversion_right.conversion_mechanism',
    },
    {
      name: 'convertible note without interest rates',
      entityType: 'convertibleIssuance' as const,
      makeInput: () => {
        const input = noteInput();
        deleteValueAtPath(input, [
          'conversion_triggers',
          0,
          'conversion_right',
          'conversion_mechanism',
          'interest_rates',
        ]);
        return input;
      },
      fieldPath: 'convertibleIssuance.conversion_triggers[0].conversion_right.conversion_mechanism.interest_rates',
    },
    {
      name: 'convertible note with null interest rates',
      entityType: 'convertibleIssuance' as const,
      makeInput: () => {
        const input = noteInput();
        setValueAtPath(
          input,
          ['conversion_triggers', 0, 'conversion_right', 'conversion_mechanism', 'interest_rates'],
          null
        );
        return input;
      },
      fieldPath: 'convertibleIssuance.conversion_triggers[0].conversion_right.conversion_mechanism.interest_rates',
    },
    {
      name: 'convertible note with a null interest-rate record',
      entityType: 'convertibleIssuance' as const,
      makeInput: () => {
        const input = noteInput();
        setValueAtPath(
          input,
          ['conversion_triggers', 0, 'conversion_right', 'conversion_mechanism', 'interest_rates'],
          [null]
        );
        return input;
      },
      fieldPath: 'convertibleIssuance.conversion_triggers[0].conversion_right.conversion_mechanism.interest_rates[0]',
    },
    {
      name: 'warrant conversion right without a type',
      entityType: 'warrantIssuance' as const,
      makeInput: () => {
        const input = warrantInput({
          type: 'CUSTOM_CONVERSION',
          custom_conversion_description: 'Custom conversion',
        });
        setValueAtPath(input, ['exercise_triggers', 0, 'conversion_right'], {});
        return input;
      },
      fieldPath: 'warrantIssuance.exercise_triggers[0].conversion_right.type',
    },
    ...(['missing', 'null'] as const).map((shape) => ({
      name: `warrant stock-class mechanism with ${shape} ratio`,
      entityType: 'warrantIssuance' as const,
      makeInput: () => {
        const input = stockClassWarrantInput();
        const path = ['exercise_triggers', 0, 'conversion_right', 'conversion_mechanism', 'ratio'] as const;
        if (shape === 'missing') deleteValueAtPath(input, path);
        else setValueAtPath(input, path, null);
        return input;
      },
      fieldPath: 'warrantIssuance.exercise_triggers[0].conversion_right.conversion_mechanism.ratio',
    })),
    {
      name: 'equity-compensation null vesting record',
      entityType: 'equityCompensationIssuance' as const,
      makeInput: () => {
        const input = optionInput();
        setValueAtPath(input, ['vestings', 0], null);
        return input;
      },
      fieldPath: 'equityCompensationIssuance.vestings[0]',
    },
    {
      name: 'equity-compensation null termination-window record',
      entityType: 'equityCompensationIssuance' as const,
      makeInput: () => {
        const input = optionInput();
        setValueAtPath(input, ['termination_exercise_windows', 0], null);
        return input;
      },
      fieldPath: 'equityCompensationIssuance.termination_exercise_windows[0]',
    },
  ] as const;

  test.each(malformedCases.flatMap((testCase) => writerSurfaces.map((surface) => ({ ...testCase, surface }))))(
    '$surface.name rejects $name with an exact bounded SDK error',
    ({ surface, entityType, makeInput, fieldPath }) => {
      let thrown: unknown;
      try {
        surface.write(entityType, makeInput());
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(OcpValidationError);
      expect(thrown).toMatchObject({ fieldPath });
      expect(JSON.stringify(thrown).length).toBeLessThan(2_000);
    }
  );

  test.each(writerSurfaces)('$name validates a deep shared DAG in O(unique nodes)', (surface) => {
    const input = customConvertibleInput();
    input.consideration_text = sharedWriterDag(8, 10) as unknown as string;
    const originalOwnKeys = Reflect.ownKeys.bind(Reflect);
    let ownKeysCalls = 0;
    const ownKeysSpy = jest.spyOn(Reflect, 'ownKeys').mockImplementation((value) => {
      ownKeysCalls += 1;
      if (ownKeysCalls > 512) throw new Error('plain-data work budget exceeded');
      return originalOwnKeys(value);
    });

    let thrown: unknown;
    try {
      surface.write('convertibleIssuance', input);
    } catch (error) {
      thrown = error;
    } finally {
      ownKeysSpy.mockRestore();
    }

    expect(ownKeysCalls).toBeLessThan(512);
    expect(thrown).toBeInstanceOf(OcpValidationError);
    expect(JSON.stringify(thrown).length).toBeLessThan(2_000);
  });

  test.each(writerSurfaces)('$name visits an unknown-root shared DAG once per unique container', (surface) => {
    const depth = 8;
    const containers = new WeakSet<object>();
    const input = customConvertibleInput() as ConvertibleIssuanceInput & { extra: unknown };
    input.extra = sharedWriterDag(depth, 10, containers);

    const originalEntries = Object.entries.bind(Object);
    let dagEntriesCalls = 0;
    const entriesSpy = jest.spyOn(Object, 'entries').mockImplementation((value) => {
      if (containers.has(value)) {
        dagEntriesCalls += 1;
        if (dagEntriesCalls > depth + 1) throw new Error('semantic work budget exceeded');
      }
      return originalEntries(value);
    });

    let thrown: unknown;
    try {
      surface.write('convertibleIssuance', input);
    } catch (error) {
      thrown = error;
    } finally {
      entriesSpy.mockRestore();
    }

    expect(dagEntriesCalls).toBeLessThanOrEqual(depth + 1);
    expect(thrown).toBeInstanceOf(OcpValidationError);
    expect(JSON.stringify(thrown).length).toBeLessThan(2_000);
  });

  test.each(writerSurfaces)('$name bounds a 20,000-deep unknown-root chain', (surface) => {
    const input = customConvertibleInput() as ConvertibleIssuanceInput & { extra: unknown };
    input.extra = deepWriterChain(20_000);

    let thrown: unknown;
    try {
      surface.write('convertibleIssuance', input);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(OcpValidationError);
    expect(thrown).not.toBeInstanceOf(RangeError);
    expect(JSON.stringify(thrown).length).toBeLessThan(2_000);
  });

  test('reports the first deterministic path to a shared invalid conversion mechanism', () => {
    const mechanism = { type: 'SAFE_CONVERSION', conversion_discount: null };
    const input = customConvertibleInput() as ConvertibleIssuanceInput & {
      first: unknown;
      second: unknown;
    };
    input.first = mechanism;
    input.second = mechanism;

    expectContextualError(() => directWrite('convertibleIssuance', input), {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      fieldPath: 'convertibleIssuance.first',
      receivedValue: mechanism,
    });
  });
});

describe('optional convertible conversion discount taxonomy', () => {
  const surfaces = [
    { name: 'direct writer', write: directWrite },
    { name: 'buildOcfCreateData', write: publicWrite },
    { name: 'typed CapTableBatch', write: addToPublicBatch },
  ] as const;
  const mechanismCases = [
    {
      name: 'SAFE',
      makeMechanism: (conversionDiscount: unknown): ConvertibleConversionMechanism =>
        ({
          type: 'SAFE_CONVERSION',
          conversion_mfn: false,
          conversion_discount: conversionDiscount,
        }) as unknown as ConvertibleConversionMechanism,
    },
    {
      name: 'note',
      makeMechanism: (conversionDiscount: unknown): ConvertibleConversionMechanism =>
        ({
          type: 'CONVERTIBLE_NOTE_CONVERSION',
          interest_rates: [],
          day_count_convention: 'ACTUAL_365',
          interest_payout: 'DEFERRED',
          interest_accrual_period: 'MONTHLY',
          compounding_type: 'SIMPLE',
          conversion_discount: conversionDiscount,
        }) as unknown as ConvertibleConversionMechanism,
    },
  ] as const;

  test.each(mechanismCases.flatMap((mechanismCase) => surfaces.map((surface) => ({ ...mechanismCase, surface }))))(
    '$surface.name rejects explicit null for a second $name trigger as INVALID_TYPE',
    ({ makeMechanism, surface }) => {
      const fieldPath =
        'convertibleIssuance.conversion_triggers[1].conversion_right.conversion_mechanism.conversion_discount';
      expectContextualError(
        () => surface.write('convertibleIssuance', convertibleInputWithSecondMechanism(makeMechanism(null))),
        {
          code: OcpErrorCodes.INVALID_TYPE,
          fieldPath,
          receivedValue: null,
        }
      );
    }
  );

  test.each(mechanismCases)('rejects explicit undefined $name conversion_discount', ({ makeMechanism }) => {
    expectContextualError(
      () => directWrite('convertibleIssuance', convertibleInputWithSecondMechanism(makeMechanism(undefined))),
      {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        fieldPath:
          'convertibleIssuance.conversion_triggers[1].conversion_right.conversion_mechanism.conversion_discount',
        receivedValue: undefined,
      }
    );
  });
});
