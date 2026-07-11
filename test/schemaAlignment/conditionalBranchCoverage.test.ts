import { OcpValidationError } from '../../src/errors';
import { parseOcfObject } from '../../src/utils/ocfZodSchemas';

const issuerBase = {
  object_type: 'ISSUER',
  id: 'issuer-1',
  legal_name: 'Schema Inc.',
  formation_date: '2026-01-01',
  country_of_formation: 'US',
};

const stockClassBase = {
  object_type: 'STOCK_CLASS',
  id: 'class-1',
  name: 'Common',
  class_type: 'COMMON',
  default_id_prefix: 'CS-',
  votes_per_share: '1',
  seniority: '1',
};

const conversionRight = {
  type: 'CONVERTIBLE_CONVERSION_RIGHT',
  conversion_mechanism: {
    type: 'FIXED_AMOUNT_CONVERSION',
    converts_to_quantity: '1',
  },
};

const convertibleBase = {
  object_type: 'TX_CONVERTIBLE_ISSUANCE',
  id: 'conv-1',
  date: '2026-01-01',
  security_id: 'sec-1',
  custom_id: 'SAFE-1',
  stakeholder_id: 'stakeholder-1',
  security_law_exemptions: [],
  investment_amount: { amount: '100', currency: 'USD' },
  convertible_type: 'SAFE',
  seniority: 1,
};

function expectAcceptedInitialShares(base: Record<string, unknown>, initialSharesAuthorized: string): void {
  expect(parseOcfObject({ ...base, initial_shares_authorized: initialSharesAuthorized })).toMatchObject({
    initial_shares_authorized: initialSharesAuthorized,
  });
}

function expectAcceptedConvertibleTrigger(trigger: Record<string, unknown>): void {
  expect(parseOcfObject({ ...convertibleBase, conversion_triggers: [trigger] })).toMatchObject({
    conversion_triggers: [trigger],
  });
}

describe('exact OCF conditional branch coverage', () => {
  it('accepts Issuer AuthorizedShares initial_shares_authorized branch', () => {
    expectAcceptedInitialShares(issuerBase, 'UNLIMITED');
  });

  it('accepts Issuer Numeric initial_shares_authorized branch', () => {
    expectAcceptedInitialShares(issuerBase, '1000.5');
  });

  it('accepts StockClass AuthorizedShares initial_shares_authorized branch', () => {
    expectAcceptedInitialShares(stockClassBase, 'NOT APPLICABLE');
  });

  it('accepts StockClass Numeric initial_shares_authorized branch', () => {
    expectAcceptedInitialShares(stockClassBase, '1000.5');
  });

  it.each([
    { label: 'Issuer', input: issuerBase },
    { label: 'StockClass', input: stockClassBase },
  ])('rejects $label initial_shares_authorized outside both oneOf branches', ({ input }) => {
    expect(() => parseOcfObject({ ...input, initial_shares_authorized: 'NOT_APPLICABLE' })).toThrow(OcpValidationError);
  });

  it('accepts ConvertibleIssuance AUTOMATIC_ON_CONDITION trigger branch', () => {
    expectAcceptedConvertibleTrigger({
      type: 'AUTOMATIC_ON_CONDITION',
      trigger_id: 'automatic-condition',
      trigger_condition: 'A qualified financing closes',
      conversion_right: conversionRight,
    });
  });

  it('accepts ConvertibleIssuance AUTOMATIC_ON_DATE trigger branch', () => {
    expectAcceptedConvertibleTrigger({
      type: 'AUTOMATIC_ON_DATE',
      trigger_id: 'automatic-date',
      trigger_date: '2027-01-01',
      conversion_right: conversionRight,
    });
  });

  it('accepts ConvertibleIssuance ELECTIVE_AT_WILL trigger branch', () => {
    expectAcceptedConvertibleTrigger({
      type: 'ELECTIVE_AT_WILL',
      trigger_id: 'elective-at-will',
      conversion_right: conversionRight,
    });
  });

  it('accepts ConvertibleIssuance ELECTIVE_IN_RANGE trigger branch', () => {
    expectAcceptedConvertibleTrigger({
      type: 'ELECTIVE_IN_RANGE',
      trigger_id: 'elective-range',
      start_date: '2027-01-01',
      end_date: '2027-12-31',
      conversion_right: conversionRight,
    });
  });

  it('accepts ConvertibleIssuance ELECTIVE_ON_CONDITION trigger branch', () => {
    expectAcceptedConvertibleTrigger({
      type: 'ELECTIVE_ON_CONDITION',
      trigger_id: 'elective-condition',
      trigger_condition: 'The holder elects after a qualified financing',
      conversion_right: conversionRight,
    });
  });

  it('accepts ConvertibleIssuance UNSPECIFIED trigger branch', () => {
    expectAcceptedConvertibleTrigger({
      type: 'UNSPECIFIED',
      trigger_id: 'unspecified',
      conversion_right: conversionRight,
    });
  });

  it('rejects a ConvertibleIssuance trigger outside every anyOf branch', () => {
    expect(() =>
      parseOcfObject({
        ...convertibleBase,
        conversion_triggers: [
          {
            type: 'UNKNOWN',
            trigger_id: 'unknown',
            conversion_right: conversionRight,
          },
        ],
      })
    ).toThrow(OcpValidationError);
  });
});
