import Ajv, { type AnySchema, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import path from 'path';
import { parseOcfObject } from '../../src/utils/ocfZodSchemas';
import { dereferencePinnedSchemaFile, resolveJsonPointer } from './schemaConformanceHarness';

const SCHEMA_ROOT = path.resolve(__dirname, '../../libs/Open-Cap-Format-OCF/schema');
const OUTSIDE = '$outside';

interface AlternativeWitnesses {
  branches: readonly unknown[];
  outside: unknown;
}

interface NotWitnesses {
  accepted: unknown;
  rejected: unknown;
}

const convertibleRight = {
  type: 'CONVERTIBLE_CONVERSION_RIGHT',
  conversion_mechanism: { type: 'SAFE_CONVERSION', conversion_mfn: false },
};
const warrantRight = {
  type: 'WARRANT_CONVERSION_RIGHT',
  conversion_mechanism: { type: 'CUSTOM_CONVERSION', custom_conversion_description: 'Custom conversion' },
};
const stockClassRight = {
  type: 'STOCK_CLASS_CONVERSION_RIGHT',
  converts_to_stock_class_id: 'conditional-stock-class',
  conversion_mechanism: {
    type: 'RATIO_CONVERSION',
    ratio: { numerator: '1', denominator: '1' },
    conversion_price: { amount: '1', currency: 'USD' },
    rounding_type: 'NORMAL',
  },
};

const conversionMechanisms = [
  { type: 'SAFE_CONVERSION', conversion_mfn: false },
  {
    type: 'CONVERTIBLE_NOTE_CONVERSION',
    interest_rates: [],
    day_count_convention: 'ACTUAL_365',
    interest_payout: 'CASH',
    interest_accrual_period: 'ANNUAL',
    compounding_type: 'SIMPLE',
  },
  { type: 'CUSTOM_CONVERSION', custom_conversion_description: 'Custom conversion' },
  { type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION', converts_to_percent: '0.1' },
  { type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: '10' },
  stockClassRight.conversion_mechanism,
  { type: 'VALUATION_BASED_CONVERSION', valuation_type: 'ACTUAL' },
  { type: 'PPS_BASED_CONVERSION', description: 'Future round price', discount: false },
] as const;

const conversionTriggers = [
  {
    type: 'AUTOMATIC_ON_CONDITION',
    trigger_id: 'automatic-condition',
    trigger_condition: 'A financing closes',
    conversion_right: convertibleRight,
  },
  {
    type: 'AUTOMATIC_ON_DATE',
    trigger_id: 'automatic-date',
    trigger_date: '2027-01-01',
    conversion_right: convertibleRight,
  },
  { type: 'ELECTIVE_AT_WILL', trigger_id: 'elective-at-will', conversion_right: convertibleRight },
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
    trigger_condition: 'The holder elects',
    conversion_right: convertibleRight,
  },
  { type: 'UNSPECIFIED', trigger_id: 'unspecified', conversion_right: convertibleRight },
] as const;

const ALTERNATIVE_WITNESSES: Readonly<Record<string, AlternativeWitnesses>> = {
  'schema/objects/Document.schema.json#/oneOf': {
    branches: [{ path: './agreement.pdf' }, { uri: 'https://example.com/agreement.pdf' }],
    outside: {},
  },
  'schema/objects/Issuer.schema.json#/anyOf': {
    branches: [{ country_subdivision_of_formation: 'DE' }, {}],
    outside: {
      country_subdivision_of_formation: 'DE',
      country_subdivision_name_of_formation: 'Delaware',
    },
  },
  'schema/objects/Issuer.schema.json#/anyOf/0/oneOf': {
    branches: [{ country_subdivision_of_formation: 'DE' }, { country_subdivision_name_of_formation: 'Delaware' }],
    outside: {},
  },
  'schema/objects/Issuer.schema.json#/properties/initial_shares_authorized/oneOf': {
    branches: ['UNLIMITED', '1000.5'],
    outside: 'NOT_A_VALID_SHARE_COUNT',
  },
  'schema/objects/StockClass.schema.json#/properties/initial_shares_authorized/oneOf': {
    branches: ['NOT APPLICABLE', '1000.5'],
    outside: 'NOT_A_VALID_SHARE_COUNT',
  },
  'schema/objects/StockPlan.schema.json#/oneOf': {
    branches: [{ stock_class_id: 'legacy-class' }, { stock_class_ids: ['class-1'] }],
    outside: {},
  },
  'schema/objects/transactions/change_event/StakeholderRelationshipChangeEvent.schema.json#/anyOf': {
    branches: [{ relationship_started: 'EMPLOYEE' }, { relationship_ended: 'EMPLOYEE' }],
    outside: {},
  },
  'schema/objects/transactions/issuance/ConvertibleIssuance.schema.json#/properties/conversion_triggers/items/anyOf': {
    branches: conversionTriggers,
    outside: { type: 'UNKNOWN', trigger_id: 'unknown', conversion_right: convertibleRight },
  },
  'schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/anyOf': {
    branches: [
      { compensation_type: 'OPTION', exercise_price: { amount: '1', currency: 'USD' } },
      { compensation_type: 'OPTION_NSO', exercise_price: { amount: '1', currency: 'USD' } },
      { compensation_type: 'OPTION_ISO', exercise_price: { amount: '1', currency: 'USD' } },
      { compensation_type: 'RSU' },
      { compensation_type: 'CSAR', base_price: { amount: '1', currency: 'USD' } },
      { compensation_type: 'SSAR', base_price: { amount: '1', currency: 'USD' } },
    ],
    outside: { compensation_type: 'UNKNOWN' },
  },
  'schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/properties/expiration_date/oneOf': {
    branches: [null, '2027-01-01'],
    outside: { year: 2027 },
  },
  'schema/objects/transactions/issuance/WarrantIssuance.schema.json#/properties/exercise_triggers/items/anyOf': {
    branches: conversionTriggers.map((trigger) => ({ ...trigger, conversion_right: warrantRight })),
    outside: { type: 'UNKNOWN', trigger_id: 'unknown', conversion_right: warrantRight },
  },
  'schema/primitives/types/conversion_rights/ConversionRight.schema.json#/properties/conversion_mechanism/oneOf': {
    branches: conversionMechanisms,
    outside: { type: 'UNKNOWN' },
  },
  'schema/primitives/types/conversion_triggers/ConversionTrigger.schema.json#/properties/conversion_right/oneOf': {
    branches: [convertibleRight, warrantRight, stockClassRight],
    outside: { type: 'UNKNOWN', conversion_mechanism: { type: 'UNKNOWN' } },
  },
  'schema/types/ContactInfo.schema.json#/anyOf': {
    branches: [
      { name: { legal_name: 'Pat' }, phone_numbers: [] },
      { name: { legal_name: 'Pat' }, emails: [] },
    ],
    outside: { name: { legal_name: 'Pat' } },
  },
  'schema/types/ContactInfoWithoutName.schema.json#/anyOf': {
    branches: [{ phone_numbers: [] }, { emails: [] }],
    outside: {},
  },
  'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf': {
    branches: [
      { discount: true, discount_percentage: '0.2' },
      { discount: true, discount_amount: { amount: '1', currency: 'USD' } },
      { discount: false },
    ],
    outside: { discount: true },
  },
  'schema/types/conversion_mechanisms/ValuationBasedConversionMechanism.schema.json#/oneOf': {
    branches: [
      { valuation_type: 'CAP', valuation_amount: { amount: '1000000', currency: 'USD' } },
      { valuation_type: 'FIXED', valuation_amount: { amount: '1000000', currency: 'USD' } },
      { valuation_type: 'ACTUAL' },
    ],
    outside: { valuation_type: 'CAP' },
  },
  'schema/types/conversion_rights/ConvertibleConversionRight.schema.json#/properties/conversion_mechanism/oneOf': {
    branches: conversionMechanisms.slice(0, 5),
    outside: { type: 'UNKNOWN' },
  },
  'schema/types/conversion_rights/StockClassConversionRight.schema.json#/properties/conversion_mechanism/oneOf': {
    branches: [stockClassRight.conversion_mechanism],
    outside: { type: 'UNKNOWN' },
  },
  'schema/types/conversion_rights/WarrantConversionRight.schema.json#/properties/conversion_mechanism/oneOf': {
    branches: [
      conversionMechanisms[2],
      conversionMechanisms[3],
      conversionMechanisms[4],
      conversionMechanisms[6],
      conversionMechanisms[7],
    ],
    outside: { type: 'UNKNOWN' },
  },
  'schema/types/vesting/VestingCondition.schema.json#/oneOf': {
    branches: [{ portion: { numerator: '1', denominator: '4' } }, { quantity: '25' }],
    outside: {},
  },
  'schema/types/vesting/VestingCondition.schema.json#/properties/trigger/oneOf': {
    branches: [
      { type: 'VESTING_START_DATE' },
      { type: 'VESTING_SCHEDULE_ABSOLUTE', date: '2027-01-01' },
      {
        type: 'VESTING_SCHEDULE_RELATIVE',
        period: { type: 'DAYS', length: 1, occurrences: 1 },
        relative_to_condition_id: 'condition-0',
      },
      { type: 'VESTING_EVENT' },
    ],
    outside: { type: 'UNKNOWN' },
  },
  'schema/types/vesting/VestingScheduleRelativeTrigger.schema.json#/properties/period/oneOf': {
    branches: [
      { type: 'DAYS', length: 1, occurrences: 1 },
      { type: 'MONTHS', length: 1, occurrences: 1, day_of_month: '01' },
    ],
    outside: { type: 'YEARS', length: 1, occurrences: 1 },
  },
};

const NOT_WITNESSES: Readonly<Record<string, NotWitnesses>> = {
  'schema/objects/Issuer.schema.json#/anyOf/1/not': {
    accepted: { country_subdivision_of_formation: 'DE' },
    rejected: {
      country_subdivision_of_formation: 'DE',
      country_subdivision_name_of_formation: 'Delaware',
    },
  },
  'schema/objects/StockPlan.schema.json#/oneOf/0/not': {
    accepted: { stock_class_id: 'legacy-class' },
    rejected: { stock_class_ids: ['class-1'] },
  },
  'schema/objects/StockPlan.schema.json#/oneOf/1/not': {
    accepted: { stock_class_ids: ['class-1'] },
    rejected: { stock_class_id: 'legacy-class' },
  },
  'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/0/not': {
    accepted: { discount_percentage: '0.2' },
    rejected: { discount_amount: { amount: '1', currency: 'USD' } },
  },
  'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/1/not': {
    accepted: { discount_amount: { amount: '1', currency: 'USD' } },
    rejected: { discount_percentage: '0.2' },
  },
  'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/2/not': {
    accepted: { discount_percentage: '0.2' },
    rejected: {
      discount_percentage: '0.2',
      discount_amount: { amount: '1', currency: 'USD' },
    },
  },
};

type ProjectObjectBuilder = (conditionalValue: unknown) => Record<string, unknown>;

const issuerBase = {
  object_type: 'ISSUER',
  id: 'conditional-issuer',
  legal_name: 'Conditional Witness Inc.',
  formation_date: '2026-01-01',
  country_of_formation: 'US',
};

const stakeholderBase = {
  object_type: 'STAKEHOLDER',
  id: 'conditional-stakeholder',
  name: { legal_name: 'Conditional Stakeholder' },
  stakeholder_type: 'INDIVIDUAL',
};

function objectFragment(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected conditional object fragment');
  }
  return value as Record<string, unknown>;
}

function triggerWithRight(conversionRight: unknown): Record<string, unknown> {
  return {
    type: 'ELECTIVE_AT_WILL',
    trigger_id: 'conditional-trigger',
    conversion_right: conversionRight,
  };
}

function convertibleIssuance(trigger: unknown): Record<string, unknown> {
  return {
    object_type: 'TX_CONVERTIBLE_ISSUANCE',
    id: 'conditional-convertible',
    date: '2026-01-01',
    security_id: 'conditional-convertible-security',
    custom_id: 'CN-CONDITIONAL',
    stakeholder_id: 'conditional-stakeholder',
    convertible_type: 'NOTE',
    seniority: 1,
    investment_amount: { amount: '1000', currency: 'USD' },
    conversion_triggers: [trigger],
    security_law_exemptions: [],
  };
}

function warrantIssuance(trigger: unknown): Record<string, unknown> {
  return {
    object_type: 'TX_WARRANT_ISSUANCE',
    id: 'conditional-warrant',
    date: '2026-01-01',
    security_id: 'conditional-warrant-security',
    custom_id: 'W-CONDITIONAL',
    stakeholder_id: 'conditional-stakeholder',
    purchase_price: { amount: '1', currency: 'USD' },
    exercise_triggers: [trigger],
    security_law_exemptions: [],
  };
}

function vestingTerms(condition: unknown): Record<string, unknown> {
  return {
    object_type: 'VESTING_TERMS',
    id: 'conditional-vesting-terms',
    name: 'Conditional vesting terms',
    description: 'Exercises a pinned conditional through the public parser.',
    allocation_type: 'CUMULATIVE_ROUNDING',
    vesting_conditions: [condition],
  };
}

function rightForMechanism(mechanism: unknown): Record<string, unknown> {
  const mechanismType = objectFragment(mechanism).type;
  if (mechanismType === 'RATIO_CONVERSION') {
    return {
      type: 'STOCK_CLASS_CONVERSION_RIGHT',
      converts_to_stock_class_id: 'conditional-stock-class',
      conversion_mechanism: mechanism,
    };
  }
  if (mechanismType === 'VALUATION_BASED_CONVERSION' || mechanismType === 'PPS_BASED_CONVERSION') {
    return { type: 'WARRANT_CONVERSION_RIGHT', conversion_mechanism: mechanism };
  }
  return { type: 'CONVERTIBLE_CONVERSION_RIGHT', conversion_mechanism: mechanism };
}

const PROJECT_OBJECT_BUILDERS: Readonly<Record<string, ProjectObjectBuilder>> = {
  'schema/objects/Document.schema.json#/oneOf': (value) => ({
    object_type: 'DOCUMENT',
    id: 'conditional-document',
    md5: 'd41d8cd98f00b204e9800998ecf8427e',
    ...objectFragment(value),
  }),
  'schema/objects/Issuer.schema.json#/anyOf': (value) => ({ ...issuerBase, ...objectFragment(value) }),
  'schema/objects/Issuer.schema.json#/anyOf/0/oneOf': (value) => ({ ...issuerBase, ...objectFragment(value) }),
  'schema/objects/Issuer.schema.json#/properties/initial_shares_authorized/oneOf': (value) => ({
    ...issuerBase,
    initial_shares_authorized: value,
  }),
  'schema/objects/StockClass.schema.json#/properties/initial_shares_authorized/oneOf': (value) => ({
    object_type: 'STOCK_CLASS',
    id: 'conditional-stock-class',
    name: 'Conditional Common',
    class_type: 'COMMON',
    default_id_prefix: 'CC-',
    initial_shares_authorized: value,
    votes_per_share: '1',
    seniority: '1',
  }),
  'schema/objects/StockPlan.schema.json#/oneOf': (value) => ({
    object_type: 'STOCK_PLAN',
    id: 'conditional-stock-plan',
    plan_name: 'Conditional Plan',
    initial_shares_reserved: '1000',
    ...objectFragment(value),
  }),
  'schema/objects/transactions/change_event/StakeholderRelationshipChangeEvent.schema.json#/anyOf': (value) => ({
    object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
    id: 'conditional-relationship-event',
    date: '2026-01-01',
    stakeholder_id: 'conditional-stakeholder',
    ...objectFragment(value),
  }),
  'schema/objects/transactions/issuance/ConvertibleIssuance.schema.json#/properties/conversion_triggers/items/anyOf': (
    value
  ) => convertibleIssuance(value),
  'schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/anyOf': (value) => ({
    object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
    id: 'conditional-equity-compensation',
    date: '2026-01-01',
    security_id: 'conditional-equity-security',
    custom_id: 'EQ-CONDITIONAL',
    stakeholder_id: 'conditional-stakeholder',
    quantity: '100',
    expiration_date: null,
    termination_exercise_windows: [],
    security_law_exemptions: [],
    ...objectFragment(value),
  }),
  'schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/properties/expiration_date/oneOf': (
    value
  ) => ({
    object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
    id: 'conditional-equity-expiration',
    date: '2026-01-01',
    security_id: 'conditional-equity-expiration-security',
    custom_id: 'EQ-EXPIRATION',
    stakeholder_id: 'conditional-stakeholder',
    compensation_type: 'OPTION',
    quantity: '100',
    exercise_price: { amount: '1', currency: 'USD' },
    expiration_date: value,
    termination_exercise_windows: [],
    security_law_exemptions: [],
  }),
  'schema/objects/transactions/issuance/WarrantIssuance.schema.json#/properties/exercise_triggers/items/anyOf': (
    value
  ) => warrantIssuance(value),
  'schema/primitives/types/conversion_rights/ConversionRight.schema.json#/properties/conversion_mechanism/oneOf': (
    value
  ) => warrantIssuance(triggerWithRight(rightForMechanism(value))),
  'schema/primitives/types/conversion_triggers/ConversionTrigger.schema.json#/properties/conversion_right/oneOf': (
    value
  ) => warrantIssuance(triggerWithRight(value)),
  'schema/types/ContactInfo.schema.json#/anyOf': (value) => ({
    ...stakeholderBase,
    stakeholder_type: 'INSTITUTION',
    primary_contact: value,
  }),
  'schema/types/ContactInfoWithoutName.schema.json#/anyOf': (value) => ({
    ...stakeholderBase,
    contact_info: value,
  }),
  'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf': (value) =>
    warrantIssuance(
      triggerWithRight({
        type: 'WARRANT_CONVERSION_RIGHT',
        conversion_mechanism: {
          type: 'PPS_BASED_CONVERSION',
          description: 'Conditional PPS conversion',
          ...objectFragment(value),
        },
      })
    ),
  'schema/types/conversion_mechanisms/ValuationBasedConversionMechanism.schema.json#/oneOf': (value) =>
    warrantIssuance(
      triggerWithRight({
        type: 'WARRANT_CONVERSION_RIGHT',
        conversion_mechanism: { type: 'VALUATION_BASED_CONVERSION', ...objectFragment(value) },
      })
    ),
  'schema/types/conversion_rights/ConvertibleConversionRight.schema.json#/properties/conversion_mechanism/oneOf': (
    value
  ) => convertibleIssuance(triggerWithRight({ type: 'CONVERTIBLE_CONVERSION_RIGHT', conversion_mechanism: value })),
  'schema/types/conversion_rights/StockClassConversionRight.schema.json#/properties/conversion_mechanism/oneOf': (
    value
  ) =>
    warrantIssuance(
      triggerWithRight({
        type: 'STOCK_CLASS_CONVERSION_RIGHT',
        converts_to_stock_class_id: 'conditional-stock-class',
        conversion_mechanism: value,
      })
    ),
  'schema/types/conversion_rights/WarrantConversionRight.schema.json#/properties/conversion_mechanism/oneOf': (value) =>
    warrantIssuance(triggerWithRight({ type: 'WARRANT_CONVERSION_RIGHT', conversion_mechanism: value })),
  'schema/types/vesting/VestingCondition.schema.json#/oneOf': (value) =>
    vestingTerms({
      id: 'conditional-vesting-condition',
      trigger: { type: 'VESTING_START_DATE' },
      next_condition_ids: [],
      ...objectFragment(value),
    }),
  'schema/types/vesting/VestingCondition.schema.json#/properties/trigger/oneOf': (value) =>
    vestingTerms({
      id: 'conditional-vesting-trigger',
      quantity: '1',
      trigger: value,
      next_condition_ids: [],
    }),
  'schema/types/vesting/VestingScheduleRelativeTrigger.schema.json#/properties/period/oneOf': (value) =>
    vestingTerms({
      id: 'conditional-relative-period',
      quantity: '1',
      trigger: {
        type: 'VESTING_SCHEDULE_RELATIVE',
        period: value,
        relative_to_condition_id: 'conditional-vesting-start',
      },
      next_condition_ids: [],
    }),
};

const PROJECT_OUTSIDE_ACCEPTED_PATHS = new Set([
  // The enclosing Issuer anyOf deliberately accepts omission through its sibling branch.
  'schema/objects/Issuer.schema.json#/anyOf/0/oneOf',
]);

const PROJECT_REJECTED_NOT_ACCEPTED_PATHS = new Set([
  'schema/objects/StockPlan.schema.json#/oneOf/0/not',
  'schema/objects/StockPlan.schema.json#/oneOf/1/not',
  'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/0/not',
  'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/1/not',
]);

function assertProjectParserWitness(basePath: string, value: unknown, accepted: boolean): void {
  const builder = PROJECT_OBJECT_BUILDERS[basePath];
  if (!builder) throw new Error(`No project-object witness builder registered for ${basePath}`);
  const parse = () => parseOcfObject(builder(value));
  if (accepted) {
    expect(parse).not.toThrow();
  } else {
    expect(parse).toThrow();
  }
}

function projectNotWitness(pathValue: string, value: unknown): unknown {
  if (pathValue.includes('SharePriceBasedConversionMechanism')) {
    return { discount: true, ...objectFragment(value) };
  }
  return value;
}

function stripSchemaIdentifiers(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSchemaIdentifiers);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== '$id' && key !== '$schema')
      .map(([key, child]) => [key, stripSchemaIdentifiers(child)])
  );
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const alternativeValidators = new Map<string, { keyword: 'anyOf' | 'oneOf'; validators: ValidateFunction[] }>();
const notValidators = new Map<string, ValidateFunction>();

function schemaLocation(pathValue: string): { pointer: string; relativePath: string } {
  const hashIndex = pathValue.indexOf('#');
  if (!pathValue.startsWith('schema/') || hashIndex === -1) throw new Error(`Invalid witness path: ${pathValue}`);
  return {
    pointer: pathValue.slice(hashIndex + 1),
    relativePath: pathValue.slice('schema/'.length, hashIndex),
  };
}

function validatorsForAlternatives(basePath: string): { keyword: 'anyOf' | 'oneOf'; validators: ValidateFunction[] } {
  const cached = alternativeValidators.get(basePath);
  if (cached) return cached;
  const { pointer, relativePath } = schemaLocation(basePath);
  const schema = dereferencePinnedSchemaFile(SCHEMA_ROOT, relativePath);
  const alternatives = resolveJsonPointer(schema, pointer, basePath);
  const keyword = pointer.endsWith('/anyOf') ? 'anyOf' : pointer.endsWith('/oneOf') ? 'oneOf' : undefined;
  if (!keyword || !Array.isArray(alternatives))
    throw new Error(`Witness path is not an alternatives array: ${basePath}`);
  const compiled: { keyword: 'anyOf' | 'oneOf'; validators: ValidateFunction[] } = {
    keyword,
    validators: alternatives.map((branch) => ajv.compile(stripSchemaIdentifiers(branch) as AnySchema)),
  };
  alternativeValidators.set(basePath, compiled);
  return compiled;
}

function validatorForNot(pathValue: string): ValidateFunction {
  const cached = notValidators.get(pathValue);
  if (cached) return cached;
  const { pointer, relativePath } = schemaLocation(pathValue);
  const schema = dereferencePinnedSchemaFile(SCHEMA_ROOT, relativePath);
  const negatedSchema = resolveJsonPointer(schema, pointer, pathValue);
  const compiled = ajv.compile(stripSchemaIdentifiers({ not: negatedSchema }) as AnySchema);
  notValidators.set(pathValue, compiled);
  return compiled;
}

function assertConditionalWitness(pathValue: string): void {
  const notWitnesses = NOT_WITNESSES[pathValue];
  if (notWitnesses) {
    const validate = validatorForNot(pathValue);
    expect(validate(notWitnesses.accepted)).toBe(true);
    expect(validate(notWitnesses.rejected)).toBe(false);
    const basePath = pathValue.replace(/\/\d+\/not$/, '');
    assertProjectParserWitness(basePath, projectNotWitness(pathValue, notWitnesses.accepted), true);
    assertProjectParserWitness(
      basePath,
      projectNotWitness(pathValue, notWitnesses.rejected),
      PROJECT_REJECTED_NOT_ACCEPTED_PATHS.has(pathValue)
    );
    return;
  }

  const match = /\/(\d+|\$outside)$/.exec(pathValue);
  if (!match) throw new Error(`No conditional witness registered for ${pathValue}`);
  const branchSegment = match[1];
  if (!branchSegment) throw new Error(`Missing conditional branch segment for ${pathValue}`);
  const basePath = pathValue.slice(0, -branchSegment.length - 1);
  const witnesses = ALTERNATIVE_WITNESSES[basePath];
  if (!witnesses) throw new Error(`No alternative witness set registered for ${basePath}`);
  const { keyword, validators } = validatorsForAlternatives(basePath);
  expect(witnesses.branches).toHaveLength(validators.length);

  if (branchSegment === OUTSIDE) {
    expect(validators.map((validate) => validate(witnesses.outside))).toEqual(validators.map(() => false));
    assertProjectParserWitness(basePath, witnesses.outside, PROJECT_OUTSIDE_ACCEPTED_PATHS.has(basePath));
    return;
  }

  const branchIndex = Number(branchSegment);
  const witness = witnesses.branches[branchIndex];
  if (witness === undefined) throw new Error(`Missing witness for ${pathValue}`);
  const matches = validators.map((validate) => validate(witness));
  expect(matches[branchIndex]).toBe(true);
  if (keyword === 'oneOf') expect(matches.filter(Boolean)).toHaveLength(1);
  assertProjectParserWitness(basePath, witness, true);
}

describe('literal witnesses for every pinned conditional outcome', () => {
  it('covers schema/objects/Document.schema.json#/oneOf/0', () =>
    assertConditionalWitness('schema/objects/Document.schema.json#/oneOf/0'));
  it('covers schema/objects/Document.schema.json#/oneOf/1', () =>
    assertConditionalWitness('schema/objects/Document.schema.json#/oneOf/1'));
  it('covers schema/objects/Document.schema.json#/oneOf/$outside', () =>
    assertConditionalWitness('schema/objects/Document.schema.json#/oneOf/$outside'));
  it('covers schema/objects/Issuer.schema.json#/anyOf/0', () =>
    assertConditionalWitness('schema/objects/Issuer.schema.json#/anyOf/0'));
  it('covers schema/objects/Issuer.schema.json#/anyOf/1', () =>
    assertConditionalWitness('schema/objects/Issuer.schema.json#/anyOf/1'));
  it('covers schema/objects/Issuer.schema.json#/anyOf/$outside', () =>
    assertConditionalWitness('schema/objects/Issuer.schema.json#/anyOf/$outside'));
  it('covers schema/objects/Issuer.schema.json#/anyOf/0/oneOf/0', () =>
    assertConditionalWitness('schema/objects/Issuer.schema.json#/anyOf/0/oneOf/0'));
  it('covers schema/objects/Issuer.schema.json#/anyOf/0/oneOf/1', () =>
    assertConditionalWitness('schema/objects/Issuer.schema.json#/anyOf/0/oneOf/1'));
  it('covers schema/objects/Issuer.schema.json#/anyOf/0/oneOf/$outside', () =>
    assertConditionalWitness('schema/objects/Issuer.schema.json#/anyOf/0/oneOf/$outside'));
  it('covers schema/objects/Issuer.schema.json#/anyOf/1/not', () =>
    assertConditionalWitness('schema/objects/Issuer.schema.json#/anyOf/1/not'));
  it('covers schema/objects/Issuer.schema.json#/properties/initial_shares_authorized/oneOf/0', () =>
    assertConditionalWitness('schema/objects/Issuer.schema.json#/properties/initial_shares_authorized/oneOf/0'));
  it('covers schema/objects/Issuer.schema.json#/properties/initial_shares_authorized/oneOf/1', () =>
    assertConditionalWitness('schema/objects/Issuer.schema.json#/properties/initial_shares_authorized/oneOf/1'));
  it('covers schema/objects/Issuer.schema.json#/properties/initial_shares_authorized/oneOf/$outside', () =>
    assertConditionalWitness('schema/objects/Issuer.schema.json#/properties/initial_shares_authorized/oneOf/$outside'));
  it('covers schema/objects/StockClass.schema.json#/properties/initial_shares_authorized/oneOf/0', () =>
    assertConditionalWitness('schema/objects/StockClass.schema.json#/properties/initial_shares_authorized/oneOf/0'));
  it('covers schema/objects/StockClass.schema.json#/properties/initial_shares_authorized/oneOf/1', () =>
    assertConditionalWitness('schema/objects/StockClass.schema.json#/properties/initial_shares_authorized/oneOf/1'));
  it('covers schema/objects/StockClass.schema.json#/properties/initial_shares_authorized/oneOf/$outside', () =>
    assertConditionalWitness(
      'schema/objects/StockClass.schema.json#/properties/initial_shares_authorized/oneOf/$outside'
    ));
  it('covers schema/objects/StockPlan.schema.json#/oneOf/0', () =>
    assertConditionalWitness('schema/objects/StockPlan.schema.json#/oneOf/0'));
  it('covers schema/objects/StockPlan.schema.json#/oneOf/1', () =>
    assertConditionalWitness('schema/objects/StockPlan.schema.json#/oneOf/1'));
  it('covers schema/objects/StockPlan.schema.json#/oneOf/$outside', () =>
    assertConditionalWitness('schema/objects/StockPlan.schema.json#/oneOf/$outside'));
  it('covers schema/objects/StockPlan.schema.json#/oneOf/0/not', () =>
    assertConditionalWitness('schema/objects/StockPlan.schema.json#/oneOf/0/not'));
  it('covers schema/objects/StockPlan.schema.json#/oneOf/1/not', () =>
    assertConditionalWitness('schema/objects/StockPlan.schema.json#/oneOf/1/not'));
  it('covers schema/objects/transactions/change_event/StakeholderRelationshipChangeEvent.schema.json#/anyOf/0', () =>
    assertConditionalWitness(
      'schema/objects/transactions/change_event/StakeholderRelationshipChangeEvent.schema.json#/anyOf/0'
    ));
  it('covers schema/objects/transactions/change_event/StakeholderRelationshipChangeEvent.schema.json#/anyOf/1', () =>
    assertConditionalWitness(
      'schema/objects/transactions/change_event/StakeholderRelationshipChangeEvent.schema.json#/anyOf/1'
    ));
  it('covers schema/objects/transactions/change_event/StakeholderRelationshipChangeEvent.schema.json#/anyOf/$outside', () =>
    assertConditionalWitness(
      'schema/objects/transactions/change_event/StakeholderRelationshipChangeEvent.schema.json#/anyOf/$outside'
    ));
  it('covers schema/objects/transactions/issuance/ConvertibleIssuance.schema.json#/properties/conversion_triggers/items/anyOf/0', () =>
    assertConditionalWitness(
      'schema/objects/transactions/issuance/ConvertibleIssuance.schema.json#/properties/conversion_triggers/items/anyOf/0'
    ));
  it('covers schema/objects/transactions/issuance/ConvertibleIssuance.schema.json#/properties/conversion_triggers/items/anyOf/1', () =>
    assertConditionalWitness(
      'schema/objects/transactions/issuance/ConvertibleIssuance.schema.json#/properties/conversion_triggers/items/anyOf/1'
    ));
  it('covers schema/objects/transactions/issuance/ConvertibleIssuance.schema.json#/properties/conversion_triggers/items/anyOf/2', () =>
    assertConditionalWitness(
      'schema/objects/transactions/issuance/ConvertibleIssuance.schema.json#/properties/conversion_triggers/items/anyOf/2'
    ));
  it('covers schema/objects/transactions/issuance/ConvertibleIssuance.schema.json#/properties/conversion_triggers/items/anyOf/3', () =>
    assertConditionalWitness(
      'schema/objects/transactions/issuance/ConvertibleIssuance.schema.json#/properties/conversion_triggers/items/anyOf/3'
    ));
  it('covers schema/objects/transactions/issuance/ConvertibleIssuance.schema.json#/properties/conversion_triggers/items/anyOf/4', () =>
    assertConditionalWitness(
      'schema/objects/transactions/issuance/ConvertibleIssuance.schema.json#/properties/conversion_triggers/items/anyOf/4'
    ));
  it('covers schema/objects/transactions/issuance/ConvertibleIssuance.schema.json#/properties/conversion_triggers/items/anyOf/5', () =>
    assertConditionalWitness(
      'schema/objects/transactions/issuance/ConvertibleIssuance.schema.json#/properties/conversion_triggers/items/anyOf/5'
    ));
  it('covers schema/objects/transactions/issuance/ConvertibleIssuance.schema.json#/properties/conversion_triggers/items/anyOf/$outside', () =>
    assertConditionalWitness(
      'schema/objects/transactions/issuance/ConvertibleIssuance.schema.json#/properties/conversion_triggers/items/anyOf/$outside'
    ));
  it('covers schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/anyOf/0', () =>
    assertConditionalWitness('schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/anyOf/0'));
  it('covers schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/anyOf/1', () =>
    assertConditionalWitness('schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/anyOf/1'));
  it('covers schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/anyOf/2', () =>
    assertConditionalWitness('schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/anyOf/2'));
  it('covers schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/anyOf/3', () =>
    assertConditionalWitness('schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/anyOf/3'));
  it('covers schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/anyOf/4', () =>
    assertConditionalWitness('schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/anyOf/4'));
  it('covers schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/anyOf/5', () =>
    assertConditionalWitness('schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/anyOf/5'));
  it('covers schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/anyOf/$outside', () =>
    assertConditionalWitness(
      'schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/anyOf/$outside'
    ));
  it('covers schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/properties/expiration_date/oneOf/0', () =>
    assertConditionalWitness(
      'schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/properties/expiration_date/oneOf/0'
    ));
  it('covers schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/properties/expiration_date/oneOf/1', () =>
    assertConditionalWitness(
      'schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/properties/expiration_date/oneOf/1'
    ));
  it('covers schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/properties/expiration_date/oneOf/$outside', () =>
    assertConditionalWitness(
      'schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/properties/expiration_date/oneOf/$outside'
    ));
  it('covers schema/objects/transactions/issuance/WarrantIssuance.schema.json#/properties/exercise_triggers/items/anyOf/0', () =>
    assertConditionalWitness(
      'schema/objects/transactions/issuance/WarrantIssuance.schema.json#/properties/exercise_triggers/items/anyOf/0'
    ));
  it('covers schema/objects/transactions/issuance/WarrantIssuance.schema.json#/properties/exercise_triggers/items/anyOf/1', () =>
    assertConditionalWitness(
      'schema/objects/transactions/issuance/WarrantIssuance.schema.json#/properties/exercise_triggers/items/anyOf/1'
    ));
  it('covers schema/objects/transactions/issuance/WarrantIssuance.schema.json#/properties/exercise_triggers/items/anyOf/2', () =>
    assertConditionalWitness(
      'schema/objects/transactions/issuance/WarrantIssuance.schema.json#/properties/exercise_triggers/items/anyOf/2'
    ));
  it('covers schema/objects/transactions/issuance/WarrantIssuance.schema.json#/properties/exercise_triggers/items/anyOf/3', () =>
    assertConditionalWitness(
      'schema/objects/transactions/issuance/WarrantIssuance.schema.json#/properties/exercise_triggers/items/anyOf/3'
    ));
  it('covers schema/objects/transactions/issuance/WarrantIssuance.schema.json#/properties/exercise_triggers/items/anyOf/4', () =>
    assertConditionalWitness(
      'schema/objects/transactions/issuance/WarrantIssuance.schema.json#/properties/exercise_triggers/items/anyOf/4'
    ));
  it('covers schema/objects/transactions/issuance/WarrantIssuance.schema.json#/properties/exercise_triggers/items/anyOf/5', () =>
    assertConditionalWitness(
      'schema/objects/transactions/issuance/WarrantIssuance.schema.json#/properties/exercise_triggers/items/anyOf/5'
    ));
  it('covers schema/objects/transactions/issuance/WarrantIssuance.schema.json#/properties/exercise_triggers/items/anyOf/$outside', () =>
    assertConditionalWitness(
      'schema/objects/transactions/issuance/WarrantIssuance.schema.json#/properties/exercise_triggers/items/anyOf/$outside'
    ));
  it('covers schema/primitives/types/conversion_rights/ConversionRight.schema.json#/properties/conversion_mechanism/oneOf/0', () =>
    assertConditionalWitness(
      'schema/primitives/types/conversion_rights/ConversionRight.schema.json#/properties/conversion_mechanism/oneOf/0'
    ));
  it('covers schema/primitives/types/conversion_rights/ConversionRight.schema.json#/properties/conversion_mechanism/oneOf/1', () =>
    assertConditionalWitness(
      'schema/primitives/types/conversion_rights/ConversionRight.schema.json#/properties/conversion_mechanism/oneOf/1'
    ));
  it('covers schema/primitives/types/conversion_rights/ConversionRight.schema.json#/properties/conversion_mechanism/oneOf/2', () =>
    assertConditionalWitness(
      'schema/primitives/types/conversion_rights/ConversionRight.schema.json#/properties/conversion_mechanism/oneOf/2'
    ));
  it('covers schema/primitives/types/conversion_rights/ConversionRight.schema.json#/properties/conversion_mechanism/oneOf/3', () =>
    assertConditionalWitness(
      'schema/primitives/types/conversion_rights/ConversionRight.schema.json#/properties/conversion_mechanism/oneOf/3'
    ));
  it('covers schema/primitives/types/conversion_rights/ConversionRight.schema.json#/properties/conversion_mechanism/oneOf/4', () =>
    assertConditionalWitness(
      'schema/primitives/types/conversion_rights/ConversionRight.schema.json#/properties/conversion_mechanism/oneOf/4'
    ));
  it('covers schema/primitives/types/conversion_rights/ConversionRight.schema.json#/properties/conversion_mechanism/oneOf/5', () =>
    assertConditionalWitness(
      'schema/primitives/types/conversion_rights/ConversionRight.schema.json#/properties/conversion_mechanism/oneOf/5'
    ));
  it('covers schema/primitives/types/conversion_rights/ConversionRight.schema.json#/properties/conversion_mechanism/oneOf/6', () =>
    assertConditionalWitness(
      'schema/primitives/types/conversion_rights/ConversionRight.schema.json#/properties/conversion_mechanism/oneOf/6'
    ));
  it('covers schema/primitives/types/conversion_rights/ConversionRight.schema.json#/properties/conversion_mechanism/oneOf/7', () =>
    assertConditionalWitness(
      'schema/primitives/types/conversion_rights/ConversionRight.schema.json#/properties/conversion_mechanism/oneOf/7'
    ));
  it('covers schema/primitives/types/conversion_rights/ConversionRight.schema.json#/properties/conversion_mechanism/oneOf/$outside', () =>
    assertConditionalWitness(
      'schema/primitives/types/conversion_rights/ConversionRight.schema.json#/properties/conversion_mechanism/oneOf/$outside'
    ));
  it('covers schema/primitives/types/conversion_triggers/ConversionTrigger.schema.json#/properties/conversion_right/oneOf/0', () =>
    assertConditionalWitness(
      'schema/primitives/types/conversion_triggers/ConversionTrigger.schema.json#/properties/conversion_right/oneOf/0'
    ));
  it('covers schema/primitives/types/conversion_triggers/ConversionTrigger.schema.json#/properties/conversion_right/oneOf/1', () =>
    assertConditionalWitness(
      'schema/primitives/types/conversion_triggers/ConversionTrigger.schema.json#/properties/conversion_right/oneOf/1'
    ));
  it('covers schema/primitives/types/conversion_triggers/ConversionTrigger.schema.json#/properties/conversion_right/oneOf/2', () =>
    assertConditionalWitness(
      'schema/primitives/types/conversion_triggers/ConversionTrigger.schema.json#/properties/conversion_right/oneOf/2'
    ));
  it('covers schema/primitives/types/conversion_triggers/ConversionTrigger.schema.json#/properties/conversion_right/oneOf/$outside', () =>
    assertConditionalWitness(
      'schema/primitives/types/conversion_triggers/ConversionTrigger.schema.json#/properties/conversion_right/oneOf/$outside'
    ));
  it('covers schema/types/ContactInfo.schema.json#/anyOf/0', () =>
    assertConditionalWitness('schema/types/ContactInfo.schema.json#/anyOf/0'));
  it('covers schema/types/ContactInfo.schema.json#/anyOf/1', () =>
    assertConditionalWitness('schema/types/ContactInfo.schema.json#/anyOf/1'));
  it('covers schema/types/ContactInfo.schema.json#/anyOf/$outside', () =>
    assertConditionalWitness('schema/types/ContactInfo.schema.json#/anyOf/$outside'));
  it('covers schema/types/ContactInfoWithoutName.schema.json#/anyOf/0', () =>
    assertConditionalWitness('schema/types/ContactInfoWithoutName.schema.json#/anyOf/0'));
  it('covers schema/types/ContactInfoWithoutName.schema.json#/anyOf/1', () =>
    assertConditionalWitness('schema/types/ContactInfoWithoutName.schema.json#/anyOf/1'));
  it('covers schema/types/ContactInfoWithoutName.schema.json#/anyOf/$outside', () =>
    assertConditionalWitness('schema/types/ContactInfoWithoutName.schema.json#/anyOf/$outside'));
  it('covers schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/0', () =>
    assertConditionalWitness(
      'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/0'
    ));
  it('covers schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/1', () =>
    assertConditionalWitness(
      'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/1'
    ));
  it('covers schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/2', () =>
    assertConditionalWitness(
      'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/2'
    ));
  it('covers schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/$outside', () =>
    assertConditionalWitness(
      'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/$outside'
    ));
  it('covers schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/0/not', () =>
    assertConditionalWitness(
      'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/0/not'
    ));
  it('covers schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/1/not', () =>
    assertConditionalWitness(
      'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/1/not'
    ));
  it('covers schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/2/not', () =>
    assertConditionalWitness(
      'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/2/not'
    ));
  it('covers schema/types/conversion_mechanisms/ValuationBasedConversionMechanism.schema.json#/oneOf/0', () =>
    assertConditionalWitness(
      'schema/types/conversion_mechanisms/ValuationBasedConversionMechanism.schema.json#/oneOf/0'
    ));
  it('covers schema/types/conversion_mechanisms/ValuationBasedConversionMechanism.schema.json#/oneOf/1', () =>
    assertConditionalWitness(
      'schema/types/conversion_mechanisms/ValuationBasedConversionMechanism.schema.json#/oneOf/1'
    ));
  it('covers schema/types/conversion_mechanisms/ValuationBasedConversionMechanism.schema.json#/oneOf/2', () =>
    assertConditionalWitness(
      'schema/types/conversion_mechanisms/ValuationBasedConversionMechanism.schema.json#/oneOf/2'
    ));
  it('covers schema/types/conversion_mechanisms/ValuationBasedConversionMechanism.schema.json#/oneOf/$outside', () =>
    assertConditionalWitness(
      'schema/types/conversion_mechanisms/ValuationBasedConversionMechanism.schema.json#/oneOf/$outside'
    ));
  it('covers schema/types/conversion_rights/ConvertibleConversionRight.schema.json#/properties/conversion_mechanism/oneOf/0', () =>
    assertConditionalWitness(
      'schema/types/conversion_rights/ConvertibleConversionRight.schema.json#/properties/conversion_mechanism/oneOf/0'
    ));
  it('covers schema/types/conversion_rights/ConvertibleConversionRight.schema.json#/properties/conversion_mechanism/oneOf/1', () =>
    assertConditionalWitness(
      'schema/types/conversion_rights/ConvertibleConversionRight.schema.json#/properties/conversion_mechanism/oneOf/1'
    ));
  it('covers schema/types/conversion_rights/ConvertibleConversionRight.schema.json#/properties/conversion_mechanism/oneOf/2', () =>
    assertConditionalWitness(
      'schema/types/conversion_rights/ConvertibleConversionRight.schema.json#/properties/conversion_mechanism/oneOf/2'
    ));
  it('covers schema/types/conversion_rights/ConvertibleConversionRight.schema.json#/properties/conversion_mechanism/oneOf/3', () =>
    assertConditionalWitness(
      'schema/types/conversion_rights/ConvertibleConversionRight.schema.json#/properties/conversion_mechanism/oneOf/3'
    ));
  it('covers schema/types/conversion_rights/ConvertibleConversionRight.schema.json#/properties/conversion_mechanism/oneOf/4', () =>
    assertConditionalWitness(
      'schema/types/conversion_rights/ConvertibleConversionRight.schema.json#/properties/conversion_mechanism/oneOf/4'
    ));
  it('covers schema/types/conversion_rights/ConvertibleConversionRight.schema.json#/properties/conversion_mechanism/oneOf/$outside', () =>
    assertConditionalWitness(
      'schema/types/conversion_rights/ConvertibleConversionRight.schema.json#/properties/conversion_mechanism/oneOf/$outside'
    ));
  it('covers schema/types/conversion_rights/StockClassConversionRight.schema.json#/properties/conversion_mechanism/oneOf/0', () =>
    assertConditionalWitness(
      'schema/types/conversion_rights/StockClassConversionRight.schema.json#/properties/conversion_mechanism/oneOf/0'
    ));
  it('covers schema/types/conversion_rights/StockClassConversionRight.schema.json#/properties/conversion_mechanism/oneOf/$outside', () =>
    assertConditionalWitness(
      'schema/types/conversion_rights/StockClassConversionRight.schema.json#/properties/conversion_mechanism/oneOf/$outside'
    ));
  it('covers schema/types/conversion_rights/WarrantConversionRight.schema.json#/properties/conversion_mechanism/oneOf/0', () =>
    assertConditionalWitness(
      'schema/types/conversion_rights/WarrantConversionRight.schema.json#/properties/conversion_mechanism/oneOf/0'
    ));
  it('covers schema/types/conversion_rights/WarrantConversionRight.schema.json#/properties/conversion_mechanism/oneOf/1', () =>
    assertConditionalWitness(
      'schema/types/conversion_rights/WarrantConversionRight.schema.json#/properties/conversion_mechanism/oneOf/1'
    ));
  it('covers schema/types/conversion_rights/WarrantConversionRight.schema.json#/properties/conversion_mechanism/oneOf/2', () =>
    assertConditionalWitness(
      'schema/types/conversion_rights/WarrantConversionRight.schema.json#/properties/conversion_mechanism/oneOf/2'
    ));
  it('covers schema/types/conversion_rights/WarrantConversionRight.schema.json#/properties/conversion_mechanism/oneOf/3', () =>
    assertConditionalWitness(
      'schema/types/conversion_rights/WarrantConversionRight.schema.json#/properties/conversion_mechanism/oneOf/3'
    ));
  it('covers schema/types/conversion_rights/WarrantConversionRight.schema.json#/properties/conversion_mechanism/oneOf/4', () =>
    assertConditionalWitness(
      'schema/types/conversion_rights/WarrantConversionRight.schema.json#/properties/conversion_mechanism/oneOf/4'
    ));
  it('covers schema/types/conversion_rights/WarrantConversionRight.schema.json#/properties/conversion_mechanism/oneOf/$outside', () =>
    assertConditionalWitness(
      'schema/types/conversion_rights/WarrantConversionRight.schema.json#/properties/conversion_mechanism/oneOf/$outside'
    ));
  it('covers schema/types/vesting/VestingCondition.schema.json#/oneOf/0', () =>
    assertConditionalWitness('schema/types/vesting/VestingCondition.schema.json#/oneOf/0'));
  it('covers schema/types/vesting/VestingCondition.schema.json#/oneOf/1', () =>
    assertConditionalWitness('schema/types/vesting/VestingCondition.schema.json#/oneOf/1'));
  it('covers schema/types/vesting/VestingCondition.schema.json#/oneOf/$outside', () =>
    assertConditionalWitness('schema/types/vesting/VestingCondition.schema.json#/oneOf/$outside'));
  it('covers schema/types/vesting/VestingCondition.schema.json#/properties/trigger/oneOf/0', () =>
    assertConditionalWitness('schema/types/vesting/VestingCondition.schema.json#/properties/trigger/oneOf/0'));
  it('covers schema/types/vesting/VestingCondition.schema.json#/properties/trigger/oneOf/1', () =>
    assertConditionalWitness('schema/types/vesting/VestingCondition.schema.json#/properties/trigger/oneOf/1'));
  it('covers schema/types/vesting/VestingCondition.schema.json#/properties/trigger/oneOf/2', () =>
    assertConditionalWitness('schema/types/vesting/VestingCondition.schema.json#/properties/trigger/oneOf/2'));
  it('covers schema/types/vesting/VestingCondition.schema.json#/properties/trigger/oneOf/3', () =>
    assertConditionalWitness('schema/types/vesting/VestingCondition.schema.json#/properties/trigger/oneOf/3'));
  it('covers schema/types/vesting/VestingCondition.schema.json#/properties/trigger/oneOf/$outside', () =>
    assertConditionalWitness('schema/types/vesting/VestingCondition.schema.json#/properties/trigger/oneOf/$outside'));
  it('covers schema/types/vesting/VestingScheduleRelativeTrigger.schema.json#/properties/period/oneOf/0', () =>
    assertConditionalWitness(
      'schema/types/vesting/VestingScheduleRelativeTrigger.schema.json#/properties/period/oneOf/0'
    ));
  it('covers schema/types/vesting/VestingScheduleRelativeTrigger.schema.json#/properties/period/oneOf/1', () =>
    assertConditionalWitness(
      'schema/types/vesting/VestingScheduleRelativeTrigger.schema.json#/properties/period/oneOf/1'
    ));
  it('covers schema/types/vesting/VestingScheduleRelativeTrigger.schema.json#/properties/period/oneOf/$outside', () =>
    assertConditionalWitness(
      'schema/types/vesting/VestingScheduleRelativeTrigger.schema.json#/properties/period/oneOf/$outside'
    ));
});
