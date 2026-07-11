import {
  CapTableBatch,
  type ConvertibleConversionMechanism,
  type OcfConvertibleIssuance,
  type OcfEquityCompensationIssuance,
  type OcfWarrantIssuance,
  type WarrantConversionMechanism,
} from '../../src';
import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
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
  readonly zeroIsFiltered?: boolean;
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

const CONVERTIBLE_MECHANISM_INPUT_PATH = [
  'conversion_triggers',
  0,
  'conversion_right',
  'conversion_mechanism',
] as const;
const CONVERTIBLE_MECHANISM_DAML_PATH = [
  'conversion_triggers',
  0,
  'conversion_right',
  'conversion_mechanism',
  'value',
] as const;
const WARRANT_MECHANISM_INPUT_PATH = ['exercise_triggers', 0, 'conversion_right', 'conversion_mechanism'] as const;
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
    fieldPath: 'conversion_mechanism.converts_to_quantity',
    makeInput: () => convertibleInput({ type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: '100' }),
    inputPath: [...CONVERTIBLE_MECHANISM_INPUT_PATH, 'converts_to_quantity'],
    damlPath: [...CONVERTIBLE_MECHANISM_DAML_PATH, 'converts_to_quantity'],
    nativePath: [...CONVERTIBLE_MECHANISM_INPUT_PATH, 'converts_to_quantity'],
  },
  ...(['numerator', 'denominator'] as const).map(
    (part): NumericWriterCase => ({
      name: `convertible SAFE exit-multiple ${part}`,
      entityType: 'convertibleIssuance',
      fieldPath: `conversion_mechanism.exit_multiple.${part}`,
      makeInput: safeInput,
      inputPath: [...CONVERTIBLE_MECHANISM_INPUT_PATH, 'exit_multiple', part],
      damlPath: [...CONVERTIBLE_MECHANISM_DAML_PATH, 'exit_multiple', part],
      nativePath: [...CONVERTIBLE_MECHANISM_INPUT_PATH, 'exit_multiple', part],
    })
  ),
  {
    name: 'convertible SAFE valuation cap',
    entityType: 'convertibleIssuance',
    fieldPath: 'conversion_mechanism.conversion_valuation_cap.amount',
    makeInput: safeInput,
    inputPath: [...CONVERTIBLE_MECHANISM_INPUT_PATH, 'conversion_valuation_cap', 'amount'],
    damlPath: [...CONVERTIBLE_MECHANISM_DAML_PATH, 'conversion_valuation_cap', 'amount'],
    nativePath: [...CONVERTIBLE_MECHANISM_INPUT_PATH, 'conversion_valuation_cap', 'amount'],
  },
  ...(['numerator', 'denominator'] as const).map(
    (part): NumericWriterCase => ({
      name: `convertible note exit-multiple ${part}`,
      entityType: 'convertibleIssuance',
      fieldPath: `conversion_mechanism.exit_multiple.${part}`,
      makeInput: noteInput,
      inputPath: [...CONVERTIBLE_MECHANISM_INPUT_PATH, 'exit_multiple', part],
      damlPath: [...CONVERTIBLE_MECHANISM_DAML_PATH, 'exit_multiple', part],
      nativePath: [...CONVERTIBLE_MECHANISM_INPUT_PATH, 'exit_multiple', part],
    })
  ),
  {
    name: 'convertible note valuation cap',
    entityType: 'convertibleIssuance',
    fieldPath: 'conversion_mechanism.conversion_valuation_cap.amount',
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
    zeroIsFiltered: true,
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
    zeroIsFiltered: true,
  },
  {
    name: 'warrant fixed quantity',
    entityType: 'warrantIssuance',
    fieldPath: 'conversion_mechanism.converts_to_quantity',
    makeInput: () => warrantInput({ type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: '100' }),
    inputPath: [...WARRANT_MECHANISM_INPUT_PATH, 'converts_to_quantity'],
    damlPath: [...WARRANT_MECHANISM_DAML_PATH, 'converts_to_quantity'],
    nativePath: [...WARRANT_MECHANISM_INPUT_PATH, 'converts_to_quantity'],
  },
  {
    name: 'warrant valuation amount',
    entityType: 'warrantIssuance',
    fieldPath: 'conversion_mechanism.valuation_amount.amount',
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
    fieldPath: 'conversion_mechanism.discount_amount.amount',
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
      fieldPath: `conversion_right.conversion_mechanism.ratio.${part}`,
      makeInput: stockClassWarrantInput,
      inputPath: [...STOCK_CLASS_INPUT_PATH, 'ratio', part],
      damlPath: [...STOCK_CLASS_DAML_PATH, 'ratio', part],
      nativePath: [...STOCK_CLASS_INPUT_PATH, 'ratio', part],
    })
  ),
  {
    name: 'stock-class conversion price',
    entityType: 'warrantIssuance',
    fieldPath: 'conversion_right.conversion_mechanism.conversion_price.amount',
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

function setValueAtPath(value: unknown, path: ValuePath, nextValue: string): void {
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
      if (input.object_type !== 'TX_CONVERTIBLE_ISSUANCE') throw new Error('Mismatched convertible input');
      batch.create('convertibleIssuance', { ...input, object_type: 'TX_CONVERTIBLE_ISSUANCE' });
      return;
    }
    case 'equityCompensationIssuance': {
      if (input.object_type !== 'TX_EQUITY_COMPENSATION_ISSUANCE') throw new Error('Mismatched equity input');
      batch.create('equityCompensationIssuance', input);
      return;
    }
    case 'warrantIssuance': {
      if (input.object_type !== 'TX_WARRANT_ISSUANCE') throw new Error('Mismatched warrant input');
      batch.create('warrantIssuance', { ...input, object_type: 'TX_WARRANT_ISSUANCE' });
    }
  }
}

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

describe('strict complex issuance Numeric(10) writers', () => {
  const tooManyIntegralDigits = '9'.repeat(29);
  const tooManyFractionalDigits = '1.12345678901';

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

  test.each(
    numericWriterCases.flatMap((testCase) => [
      { testCase, input: '-0' },
      { testCase, input: '-0.0000000000' },
    ])
  )('$testCase.name never emits negative zero for $input', ({ testCase, input }) => {
    for (const write of [directWrite, publicWrite]) {
      const daml = write(testCase.entityType, inputWithValue(testCase, input));
      if (testCase.zeroIsFiltered) {
        expect(valueAtPath(daml, testCase.damlPath)).toBeUndefined();
        expect(valueAtPath(readNative(testCase.entityType, daml), testCase.nativePath)).toBeUndefined();
      } else {
        expect(valueAtPath(daml, testCase.damlPath)).toBe('0');
        expect(valueAtPath(readNative(testCase.entityType, daml), testCase.nativePath)).toBe('0');
      }
    }
  });
});
