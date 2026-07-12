import { OcpValidationError } from '../../src/errors';
import { parseOcfObject } from '../../src/utils/ocfZodSchemas';

const documentBase = {
  object_type: 'DOCUMENT',
  id: 'document-1',
  md5: 'd41d8cd98f00b204e9800998ecf8427e',
};

const stockPlanBase = {
  object_type: 'STOCK_PLAN',
  id: 'plan-1',
  plan_name: '2026 Plan',
  initial_shares_reserved: '1000',
};

const issuerBase = {
  object_type: 'ISSUER',
  id: 'issuer-1',
  legal_name: 'Schema Inc.',
  formation_date: '2026-01-01',
  country_of_formation: 'US',
};

const stakeholderBase = {
  object_type: 'STAKEHOLDER',
  id: 'stakeholder-1',
  name: { legal_name: 'Alex Example' },
  stakeholder_type: 'INDIVIDUAL',
};

const relationshipBase = {
  object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
  id: 'relationship-1',
  date: '2026-01-01',
  stakeholder_id: 'stakeholder-1',
};

const vestingTermsBase = {
  object_type: 'VESTING_TERMS',
  id: 'vesting-terms-1',
  name: 'Canonical Vesting',
  description: 'Schema-shaped vesting terms',
  allocation_type: 'CUMULATIVE_ROUNDING',
};

const vestingConditionBase = {
  id: 'condition-1',
  trigger: { type: 'VESTING_START_DATE' },
  next_condition_ids: [],
};

const ratioAdjustmentBase = {
  object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
  id: 'ratio-adjustment-1',
  date: '2026-01-01',
  stock_class_id: 'class-1',
};

const ratioMechanism = {
  type: 'RATIO_CONVERSION',
  conversion_price: { amount: '1', currency: 'USD' },
  ratio: { numerator: '2', denominator: '1' },
  rounding_type: 'NORMAL',
};

const documentWithBothLocations = {
  ...documentBase,
  path: './agreement.pdf',
  uri: 'https://example.com/agreement.pdf',
};

const issuerWithBothSubdivisionRepresentations = {
  ...issuerBase,
  country_subdivision_of_formation: 'DE',
  country_subdivision_name_of_formation: 'Delaware',
};

const vestingTermsWithBothConditionAmounts = {
  ...vestingTermsBase,
  vesting_conditions: [
    {
      ...vestingConditionBase,
      portion: { numerator: '1', denominator: '4' },
      quantity: '250',
    },
  ],
};

const validCases: Array<{ name: string; input: Record<string, unknown> }> = [
  { name: 'document with path', input: { ...documentBase, path: './agreement.pdf' } },
  { name: 'document with uri', input: { ...documentBase, uri: 'https://example.com/agreement.pdf' } },
  { name: 'stock plan with one class', input: { ...stockPlanBase, stock_class_ids: ['class-1'] } },
  { name: 'issuer without subdivision', input: issuerBase },
  { name: 'issuer with subdivision code', input: { ...issuerBase, country_subdivision_of_formation: 'DE' } },
  {
    name: 'issuer with subdivision name',
    input: { ...issuerBase, country_subdivision_name_of_formation: 'Delaware' },
  },
  {
    name: 'named contact with phones collection',
    input: { ...stakeholderBase, primary_contact: { name: { legal_name: 'Pat' }, phone_numbers: [] } },
  },
  {
    name: 'named contact with emails collection',
    input: { ...stakeholderBase, primary_contact: { name: { legal_name: 'Pat' }, emails: [] } },
  },
  {
    name: 'unnamed contact with both collections',
    input: { ...stakeholderBase, contact_info: { phone_numbers: [], emails: [] } },
  },
  {
    name: 'relationship started',
    input: { ...relationshipBase, relationship_started: 'EMPLOYEE' },
  },
  {
    name: 'relationship ended',
    input: { ...relationshipBase, relationship_ended: 'EMPLOYEE' },
  },
  {
    name: 'relationship started and ended',
    input: { ...relationshipBase, relationship_started: 'ADVISOR', relationship_ended: 'EMPLOYEE' },
  },
  {
    name: 'vesting condition with portion',
    input: {
      ...vestingTermsBase,
      vesting_conditions: [{ ...vestingConditionBase, portion: { numerator: '1', denominator: '4' } }],
    },
  },
  {
    name: 'vesting condition with quantity',
    input: { ...vestingTermsBase, vesting_conditions: [{ ...vestingConditionBase, quantity: '250' }] },
  },
  {
    name: 'conversion ratio adjustment with mechanism',
    input: { ...ratioAdjustmentBase, new_ratio_conversion_mechanism: ratioMechanism },
  },
];

const invalidCases: Array<{ name: string; input: Record<string, unknown> }> = [
  { name: 'document without location', input: documentBase },
  { name: 'stock plan with empty class list', input: { ...stockPlanBase, stock_class_ids: [] } },
  {
    name: 'issuer with null subdivision code',
    input: { ...issuerBase, country_subdivision_of_formation: null },
  },
  {
    name: 'issuer with null subdivision name',
    input: { ...issuerBase, country_subdivision_name_of_formation: null },
  },
  {
    name: 'named contact without a collection',
    input: { ...stakeholderBase, primary_contact: { name: { legal_name: 'Pat' } } },
  },
  {
    name: 'named contact with a null collection',
    input: { ...stakeholderBase, primary_contact: { name: { legal_name: 'Pat' }, phone_numbers: null } },
  },
  { name: 'unnamed contact without a collection', input: { ...stakeholderBase, contact_info: {} } },
  {
    name: 'unnamed contact with null collections',
    input: { ...stakeholderBase, contact_info: { phone_numbers: null, emails: null } },
  },
  { name: 'relationship without started or ended', input: relationshipBase },
  {
    name: 'vesting condition without portion or quantity',
    input: { ...vestingTermsBase, vesting_conditions: [vestingConditionBase] },
  },
  { name: 'vesting terms with no conditions', input: { ...vestingTermsBase, vesting_conditions: [] } },
  { name: 'conversion ratio adjustment without mechanism', input: ratioAdjustmentBase },
];

describe('core schema conditional shapes', () => {
  it.each(validCases)('accepts $name', ({ input }) => {
    expect(parseOcfObject(input)).toBeDefined();
  });

  it.each(invalidCases)('rejects $name', ({ input }) => {
    expect(() => parseOcfObject(input)).toThrow(OcpValidationError);
  });

  it('rejects Document when path and uri match multiple oneOf branches', () => {
    expect(() => parseOcfObject(documentWithBothLocations)).toThrow(OcpValidationError);
  });

  it('rejects Issuer when both subdivision fields match multiple nested oneOf branches', () => {
    expect(() => parseOcfObject(issuerWithBothSubdivisionRepresentations)).toThrow(OcpValidationError);
  });

  it('rejects VestingCondition when portion and quantity match multiple oneOf branches', () => {
    expect(() => parseOcfObject(vestingTermsWithBothConditionAmounts)).toThrow(OcpValidationError);
  });
});
