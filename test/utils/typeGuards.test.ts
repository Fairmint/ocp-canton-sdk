/**
 * Tests for type guard utilities.
 */
import {
  assertOcfIssuer,
  assertOcfStakeholder,
  assertOcfStockClass,
  detectOcfObjectType,
  isIsoDateString,
  isMonetary,
  isNonEmptyString,
  isNumericValue,
  isObject,
  isOcfConvertibleCancellation,
  isOcfConvertibleIssuance,
  isOcfDocument,
  isOcfEquityCompensationCancellation,
  isOcfEquityCompensationExercise,
  isOcfEquityCompensationIssuance,
  isOcfIssuer,
  isOcfStakeholder,
  isOcfStockCancellation,
  isOcfStockClass,
  isOcfStockIssuance,
  isOcfStockLegendTemplate,
  isOcfStockPlan,
  isOcfStockRepurchase,
  isOcfStockTransfer,
  isOcfValuation,
  isOcfVestingTerms,
  isOcfWarrantCancellation,
  isOcfWarrantIssuance,
  type DetectedOcfType,
} from '../../src/utils/typeGuards';
import { loadFixture, stripSourceMetadata } from './productionFixtures';

describe('Primitive Type Guards', () => {
  describe('isObject', () => {
    it('returns true for plain objects', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ key: 'value' })).toBe(true);
    });

    it('returns false for null', () => {
      expect(isObject(null)).toBe(false);
    });

    it('returns false for primitives', () => {
      expect(isObject('string')).toBe(false);
      expect(isObject(123)).toBe(false);
      expect(isObject(true)).toBe(false);
      expect(isObject(undefined)).toBe(false);
    });

    it('returns true for arrays (they are objects)', () => {
      expect(isObject([])).toBe(true);
    });
  });

  describe('isNonEmptyString', () => {
    it('returns true for non-empty strings', () => {
      expect(isNonEmptyString('hello')).toBe(true);
      expect(isNonEmptyString('a')).toBe(true);
    });

    it('returns false for empty strings', () => {
      expect(isNonEmptyString('')).toBe(false);
    });

    it('returns false for non-strings', () => {
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
      expect(isNonEmptyString(123)).toBe(false);
      expect(isNonEmptyString({})).toBe(false);
    });
  });

  describe('isNumericValue', () => {
    it('returns false for numbers (only accepts strings)', () => {
      expect(isNumericValue(0)).toBe(false);
      expect(isNumericValue(123)).toBe(false);
      expect(isNumericValue(-456)).toBe(false);
      expect(isNumericValue(3.14)).toBe(false);
    });

    it('returns true for valid numeric strings', () => {
      expect(isNumericValue('0')).toBe(true);
      expect(isNumericValue('123')).toBe(true);
      expect(isNumericValue('-456')).toBe(true);
      expect(isNumericValue('3.14')).toBe(true);
    });

    it('returns false for NaN', () => {
      expect(isNumericValue(NaN)).toBe(false);
    });

    it('returns false for non-numeric strings', () => {
      expect(isNumericValue('')).toBe(false);
      expect(isNumericValue('hello')).toBe(false);
      expect(isNumericValue('12.34.56')).toBe(false);
    });

    it('returns false for non-numeric types', () => {
      expect(isNumericValue(null)).toBe(false);
      expect(isNumericValue(undefined)).toBe(false);
      expect(isNumericValue({})).toBe(false);
    });
  });

  describe('isIsoDateString', () => {
    it('returns true for valid ISO date strings', () => {
      expect(isIsoDateString('2024-01-15')).toBe(true);
      expect(isIsoDateString('2000-12-31')).toBe(true);
      expect(isIsoDateString('1999-01-01')).toBe(true);
    });

    it('returns false for invalid date formats', () => {
      expect(isIsoDateString('01-15-2024')).toBe(false);
      expect(isIsoDateString('2024/01/15')).toBe(false);
      expect(isIsoDateString('2024-1-15')).toBe(false);
      expect(isIsoDateString('24-01-15')).toBe(false);
    });

    it('returns false for impossible calendar dates', () => {
      expect(isIsoDateString('2024-13-01')).toBe(false);
      expect(isIsoDateString('2024-02-30')).toBe(false);
      expect(isIsoDateString('2023-02-29')).toBe(false);
      expect(isIsoDateString('2100-02-29')).toBe(false);
      expect(isIsoDateString('2000-02-29')).toBe(true);
    });

    it('returns false for non-strings', () => {
      expect(isIsoDateString(null)).toBe(false);
      expect(isIsoDateString(123)).toBe(false);
    });
  });

  describe('isMonetary', () => {
    it('returns true for valid monetary objects', () => {
      expect(isMonetary({ amount: '100.00', currency: 'USD' })).toBe(true);
      expect(isMonetary({ amount: '100', currency: 'EUR' })).toBe(true);
    });

    it('returns false for invalid monetary objects', () => {
      expect(isMonetary({ amount: '100.00' })).toBe(false);
      expect(isMonetary({ currency: 'USD' })).toBe(false);
      expect(isMonetary({})).toBe(false);
    });

    it('returns false for non-objects', () => {
      expect(isMonetary(null)).toBe(false);
      expect(isMonetary('100 USD')).toBe(false);
    });
  });
});

type KnownDetectedOcfType = Exclude<DetectedOcfType, 'UNKNOWN'>;

interface OcfGuardCase {
  name: string;
  guard: (value: unknown) => boolean;
  detectedType: KnownDetectedOcfType;
  fixturePath: string;
  requiredFields: readonly string[];
}

const ocfGuardCases = [
  {
    name: 'issuer',
    guard: isOcfIssuer,
    detectedType: 'ISSUER',
    fixturePath: 'production/issuer/basic.json',
    requiredFields: ['object_type', 'id', 'legal_name', 'formation_date', 'country_of_formation'],
  },
  {
    name: 'stakeholder',
    guard: isOcfStakeholder,
    detectedType: 'STAKEHOLDER',
    fixturePath: 'production/stakeholder/individual.json',
    requiredFields: ['object_type', 'id', 'name', 'stakeholder_type'],
  },
  {
    name: 'stock class',
    guard: isOcfStockClass,
    detectedType: 'STOCK_CLASS',
    fixturePath: 'production/stockClass/common.json',
    requiredFields: [
      'object_type',
      'id',
      'class_type',
      'default_id_prefix',
      'initial_shares_authorized',
      'name',
      'seniority',
      'votes_per_share',
    ],
  },
  {
    name: 'stock issuance',
    guard: isOcfStockIssuance,
    detectedType: 'STOCK_ISSUANCE',
    fixturePath: 'production/stockIssuance/founders-stock.json',
    requiredFields: [
      'object_type',
      'id',
      'date',
      'security_id',
      'custom_id',
      'stakeholder_id',
      'security_law_exemptions',
      'stock_class_id',
      'share_price',
      'quantity',
      'stock_legend_ids',
    ],
  },
  {
    name: 'stock transfer',
    guard: isOcfStockTransfer,
    detectedType: 'STOCK_TRANSFER',
    fixturePath: 'production/stockTransfer.json',
    requiredFields: ['object_type', 'id', 'date', 'security_id', 'quantity', 'resulting_security_ids'],
  },
  {
    name: 'stock cancellation',
    guard: isOcfStockCancellation,
    detectedType: 'STOCK_CANCELLATION',
    fixturePath: 'production/stockCancellation.json',
    requiredFields: ['object_type', 'id', 'date', 'security_id', 'quantity', 'reason_text'],
  },
  {
    name: 'stock repurchase',
    guard: isOcfStockRepurchase,
    detectedType: 'STOCK_REPURCHASE',
    fixturePath: 'production/stockRepurchase.json',
    requiredFields: ['object_type', 'id', 'date', 'security_id', 'quantity', 'price'],
  },
  {
    name: 'stock legend template',
    guard: isOcfStockLegendTemplate,
    detectedType: 'STOCK_LEGEND_TEMPLATE',
    fixturePath: 'production/stockLegendTemplate/rule-144.json',
    requiredFields: ['object_type', 'id', 'name', 'text'],
  },
  {
    name: 'stock plan',
    guard: isOcfStockPlan,
    detectedType: 'STOCK_PLAN',
    fixturePath: 'production/stockPlan/basic.json',
    requiredFields: ['object_type', 'id', 'plan_name', 'initial_shares_reserved'],
  },
  {
    name: 'vesting terms',
    guard: isOcfVestingTerms,
    detectedType: 'VESTING_TERMS',
    fixturePath: 'production/vestingTerms/time-based-cliff.json',
    requiredFields: ['object_type', 'id', 'name', 'description', 'allocation_type', 'vesting_conditions'],
  },
  {
    name: 'equity compensation issuance',
    guard: isOcfEquityCompensationIssuance,
    detectedType: 'EQUITY_COMPENSATION_ISSUANCE',
    fixturePath: 'production/equityCompensationIssuance/option-iso.json',
    requiredFields: [
      'object_type',
      'id',
      'date',
      'security_id',
      'custom_id',
      'stakeholder_id',
      'compensation_type',
      'quantity',
      'security_law_exemptions',
      'expiration_date',
      'termination_exercise_windows',
    ],
  },
  {
    name: 'equity compensation exercise',
    guard: isOcfEquityCompensationExercise,
    detectedType: 'EQUITY_COMPENSATION_EXERCISE',
    fixturePath: 'production/equityCompensationExercise.json',
    requiredFields: ['object_type', 'id', 'date', 'security_id', 'quantity', 'resulting_security_ids'],
  },
  {
    name: 'equity compensation cancellation',
    guard: isOcfEquityCompensationCancellation,
    detectedType: 'EQUITY_COMPENSATION_CANCELLATION',
    fixturePath: 'production/equityCompensationCancellation.json',
    requiredFields: ['object_type', 'id', 'date', 'security_id', 'quantity', 'reason_text'],
  },
  {
    name: 'warrant issuance',
    guard: isOcfWarrantIssuance,
    detectedType: 'WARRANT_ISSUANCE',
    fixturePath: 'production/warrantIssuance.json',
    requiredFields: [
      'object_type',
      'id',
      'date',
      'security_id',
      'custom_id',
      'stakeholder_id',
      'security_law_exemptions',
      'purchase_price',
      'exercise_triggers',
    ],
  },
  {
    name: 'warrant cancellation',
    guard: isOcfWarrantCancellation,
    detectedType: 'WARRANT_CANCELLATION',
    fixturePath: 'synthetic/warrantCancellation.json',
    requiredFields: ['object_type', 'id', 'date', 'security_id', 'quantity', 'reason_text'],
  },
  {
    name: 'convertible issuance',
    guard: isOcfConvertibleIssuance,
    detectedType: 'CONVERTIBLE_ISSUANCE',
    fixturePath: 'production/convertibleIssuance/safe-post-money.json',
    requiredFields: [
      'object_type',
      'id',
      'date',
      'security_id',
      'custom_id',
      'stakeholder_id',
      'security_law_exemptions',
      'investment_amount',
      'convertible_type',
      'conversion_triggers',
      'seniority',
    ],
  },
  {
    name: 'convertible cancellation',
    guard: isOcfConvertibleCancellation,
    detectedType: 'CONVERTIBLE_CANCELLATION',
    fixturePath: 'production/convertibleCancellation.json',
    requiredFields: ['object_type', 'id', 'date', 'security_id', 'amount', 'reason_text'],
  },
  {
    name: 'valuation',
    guard: isOcfValuation,
    detectedType: 'VALUATION',
    fixturePath: 'production/valuation/409a.json',
    requiredFields: ['object_type', 'id', 'stock_class_id', 'price_per_share', 'effective_date', 'valuation_type'],
  },
  {
    name: 'document',
    guard: isOcfDocument,
    detectedType: 'DOCUMENT',
    fixturePath: 'production/document/basic.json',
    requiredFields: ['object_type', 'id', 'md5'],
  },
] as const satisfies readonly OcfGuardCase[];

const missingRequiredFieldCases = ocfGuardCases.flatMap((guardCase) =>
  guardCase.requiredFields.map((requiredField) => ({ ...guardCase, requiredField }))
);

function loadOcfGuardFixture(fixturePath: string): Record<string, unknown> {
  return stripSourceMetadata(loadFixture<Record<string, unknown>>(fixturePath));
}

function withoutField(value: Record<string, unknown>, field: string): Record<string, unknown> {
  const copy = { ...value };
  delete copy[field];
  return copy;
}

describe('OCF type guard schema soundness', () => {
  test.each(ocfGuardCases)('$name accepts a complete canonical fixture', ({ guard, fixturePath }) => {
    expect(guard(loadOcfGuardFixture(fixturePath))).toBe(true);
  });

  test.each(missingRequiredFieldCases)(
    '$name rejects missing required member $requiredField',
    ({ guard, fixturePath, requiredField }) => {
      const fixture = loadOcfGuardFixture(fixturePath);
      expect(guard(withoutField(fixture, requiredField))).toBe(false);
    }
  );

  test.each(ocfGuardCases)('$name rejects a malformed present optional member', ({ guard, fixturePath }) => {
    const fixture = loadOcfGuardFixture(fixturePath);
    expect(guard({ ...fixture, comments: [42] })).toBe(false);
  });

  test.each(ocfGuardCases)('$name rejects non-objects without throwing', ({ guard }) => {
    expect(() => guard(null)).not.toThrow();
    expect(guard(null)).toBe(false);
    expect(guard([])).toBe(false);
  });

  test.each(ocfGuardCases)(
    'detector validates the complete $name object before identifying it',
    ({ detectedType, fixturePath }) => {
      const fixture = loadOcfGuardFixture(fixturePath);
      expect(detectOcfObjectType(fixture)).toBe(detectedType);
      expect(detectOcfObjectType({ ...fixture, comments: [42] })).toBe('UNKNOWN');
    }
  );

  test.each(missingRequiredFieldCases)(
    'detector rejects $name missing required member $requiredField',
    ({ fixturePath, requiredField }) => {
      const fixture = loadOcfGuardFixture(fixturePath);
      expect(detectOcfObjectType(withoutField(fixture, requiredField))).toBe('UNKNOWN');
    }
  );
});

describe('OCF Type Guards', () => {
  describe('isOcfIssuer', () => {
    const validIssuer = {
      object_type: 'ISSUER',
      id: 'issuer-1',
      legal_name: 'Acme Corp',
      formation_date: '2024-01-01',
      country_of_formation: 'US',
      tax_ids: [],
    };

    it('returns true for valid issuer objects', () => {
      expect(isOcfIssuer(validIssuer)).toBe(true);
    });

    it('returns false when required fields are missing', () => {
      expect(isOcfIssuer({ ...validIssuer, id: undefined })).toBe(false);
      expect(isOcfIssuer({ ...validIssuer, legal_name: undefined })).toBe(false);
      expect(isOcfIssuer({ ...validIssuer, formation_date: undefined })).toBe(false);
      expect(isOcfIssuer({ ...validIssuer, country_of_formation: undefined })).toBe(false);
    });

    it('returns false when required fields have the wrong type', () => {
      expect(isOcfIssuer({ ...validIssuer, id: 42 })).toBe(false);
      expect(isOcfIssuer({ ...validIssuer, legal_name: false })).toBe(false);
    });

    it('returns false for non-objects', () => {
      expect(isOcfIssuer(null)).toBe(false);
      expect(isOcfIssuer('issuer')).toBe(false);
    });
  });

  describe('isOcfStakeholder', () => {
    const validStakeholder = {
      object_type: 'STAKEHOLDER',
      id: 'stakeholder-1',
      name: { legal_name: 'John Doe' },
      stakeholder_type: 'INDIVIDUAL',
    };

    it('returns true for valid stakeholder objects', () => {
      expect(isOcfStakeholder(validStakeholder)).toBe(true);
      expect(isOcfStakeholder({ ...validStakeholder, stakeholder_type: 'INSTITUTION' })).toBe(true);
    });

    it('returns false when required fields are missing', () => {
      expect(isOcfStakeholder({ ...validStakeholder, id: undefined })).toBe(false);
      expect(isOcfStakeholder({ ...validStakeholder, name: undefined })).toBe(false);
      expect(isOcfStakeholder({ ...validStakeholder, stakeholder_type: undefined })).toBe(false);
    });

    it('returns false for invalid stakeholder_type', () => {
      expect(isOcfStakeholder({ ...validStakeholder, stakeholder_type: 'OTHER' })).toBe(false);
    });

    it('requires the canonical discriminator', () => {
      const { object_type: _, ...shapeOnly } = validStakeholder;
      expect(isOcfStakeholder(shapeOnly)).toBe(false);
      expect(isOcfStakeholder({ ...validStakeholder, object_type: 'STOCK_CLASS' })).toBe(false);
    });
  });

  describe('isOcfStockClass', () => {
    const validStockClass = {
      object_type: 'STOCK_CLASS',
      id: 'stock-class-1',
      name: 'Common Stock',
      default_id_prefix: 'CS-',
      class_type: 'COMMON',
      initial_shares_authorized: '10000000',
      votes_per_share: '1',
      seniority: '1',
    };

    it('returns true for valid stock class objects', () => {
      expect(isOcfStockClass(validStockClass)).toBe(true);
      expect(isOcfStockClass({ ...validStockClass, class_type: 'PREFERRED' })).toBe(true);
    });

    it('returns false when required fields are missing', () => {
      expect(isOcfStockClass({ ...validStockClass, id: undefined })).toBe(false);
      expect(isOcfStockClass({ ...validStockClass, name: undefined })).toBe(false);
      expect(isOcfStockClass({ ...validStockClass, class_type: undefined })).toBe(false);
    });

    it('returns false for invalid class_type', () => {
      expect(isOcfStockClass({ ...validStockClass, class_type: 'OTHER' })).toBe(false);
    });
  });

  describe('isOcfStockIssuance', () => {
    const validIssuance = {
      object_type: 'TX_STOCK_ISSUANCE',
      id: 'issuance-1',
      date: '2024-01-15',
      security_id: 'sec-1',
      custom_id: 'CS-001',
      stakeholder_id: 'sh-1',
      stock_class_id: 'class-1',
      quantity: '1000',
      share_price: { amount: '1.00', currency: 'USD' },
      security_law_exemptions: [],
      stock_legend_ids: ['legend-1'],
    };

    it('returns true for valid stock issuance objects', () => {
      expect(isOcfStockIssuance(validIssuance)).toBe(true);
    });

    it('returns false when required fields are missing', () => {
      expect(isOcfStockIssuance({ ...validIssuance, security_id: undefined })).toBe(false);
      expect(isOcfStockIssuance({ ...validIssuance, share_price: undefined })).toBe(false);
    });
  });

  describe('isOcfStockCancellation', () => {
    const validCancellation = {
      object_type: 'TX_STOCK_CANCELLATION',
      id: 'cancel-1',
      date: '2024-01-20',
      security_id: 'sec-1',
      quantity: '500',
      reason_text: 'Cancelled by agreement',
    };

    it('returns true for valid stock cancellation objects', () => {
      expect(isOcfStockCancellation(validCancellation)).toBe(true);
    });

    it('returns false when required fields are missing', () => {
      expect(isOcfStockCancellation({ ...validCancellation, reason_text: undefined })).toBe(false);
    });
  });

  describe('isOcfStockLegendTemplate', () => {
    const validTemplate = {
      object_type: 'STOCK_LEGEND_TEMPLATE',
      id: 'legend-1',
      name: 'Standard Legend',
      text: 'These securities have not been registered...',
    };

    it('returns true for valid legend template objects', () => {
      expect(isOcfStockLegendTemplate(validTemplate)).toBe(true);
    });

    it('returns false when required fields are missing', () => {
      expect(isOcfStockLegendTemplate({ ...validTemplate, text: undefined })).toBe(false);
    });
  });

  describe('isOcfStockPlan', () => {
    const validPlan = {
      object_type: 'STOCK_PLAN',
      id: 'plan-1',
      plan_name: '2024 Equity Incentive Plan',
      initial_shares_reserved: '1000000',
      stock_class_ids: ['class-1'],
    };

    it('returns true for valid stock plan objects', () => {
      expect(isOcfStockPlan(validPlan)).toBe(true);
    });

    it('returns false when required fields are missing', () => {
      expect(isOcfStockPlan({ ...validPlan, stock_class_ids: undefined })).toBe(false);
    });

    it('returns false for an empty stock_class_ids array', () => {
      expect(isOcfStockPlan({ ...validPlan, stock_class_ids: [] })).toBe(false);
    });

    it('returns false for the deprecated singular stock_class_id shape', () => {
      const { stock_class_ids: _, ...withoutCanonicalIds } = validPlan;
      expect(isOcfStockPlan({ ...withoutCanonicalIds, stock_class_id: 'class-1' })).toBe(false);
    });
  });

  describe('isOcfVestingTerms', () => {
    const validVestingTerms = loadOcfGuardFixture('production/vestingTerms/time-based-cliff.json');

    it('returns true for valid vesting terms objects', () => {
      expect(isOcfVestingTerms(validVestingTerms)).toBe(true);
    });

    it('returns false when required fields are missing', () => {
      expect(isOcfVestingTerms({ ...validVestingTerms, allocation_type: undefined })).toBe(false);
    });
  });

  describe('isOcfValuation', () => {
    const validValuation = {
      object_type: 'VALUATION',
      id: 'val-1',
      stock_class_id: 'class-1',
      effective_date: '2024-01-01',
      valuation_type: '409A',
      price_per_share: { amount: '0.50', currency: 'USD' },
    };

    it('returns true for valid valuation objects', () => {
      expect(isOcfValuation(validValuation)).toBe(true);
    });

    it('returns false when required fields are missing', () => {
      expect(isOcfValuation({ ...validValuation, price_per_share: undefined })).toBe(false);
    });
  });

  describe('isOcfDocument', () => {
    const validDocument = {
      object_type: 'DOCUMENT',
      id: 'doc-1',
      md5: 'd41d8cd98f00b204e9800998ecf8427e',
      path: '/docs/agreement.pdf',
    };

    it('returns true for valid document objects', () => {
      expect(isOcfDocument(validDocument)).toBe(true);
      expect(isOcfDocument({ ...validDocument, path: '/docs/agreement.pdf' })).toBe(true);
      const { path: _, ...documentWithoutPath } = validDocument;
      expect(isOcfDocument({ ...documentWithoutPath, uri: 'https://example.com/doc.pdf' })).toBe(true);
    });

    it('returns false when required fields are missing', () => {
      expect(isOcfDocument({ ...validDocument, md5: undefined })).toBe(false);
    });
  });
});

describe('detectOcfObjectType', () => {
  it('detects issuer from its discriminator', () => {
    const issuer = {
      object_type: 'ISSUER',
      id: 'issuer-1',
      legal_name: 'Test Corp',
      formation_date: '2024-01-01',
      country_of_formation: 'US',
    };
    expect(detectOcfObjectType(issuer)).toBe('ISSUER');
  });

  it('detects stakeholder from its discriminator', () => {
    const stakeholder = {
      object_type: 'STAKEHOLDER',
      id: 'sh-1',
      name: { legal_name: 'John Doe' },
      stakeholder_type: 'INDIVIDUAL',
    };
    expect(detectOcfObjectType(stakeholder)).toBe('STAKEHOLDER');
  });

  it('detects stock class from its discriminator', () => {
    const stockClass = {
      object_type: 'STOCK_CLASS',
      id: 'class-1',
      name: 'Common',
      default_id_prefix: 'CS-',
      class_type: 'COMMON',
      initial_shares_authorized: '10000000',
      votes_per_share: '1',
      seniority: '1',
    };
    expect(detectOcfObjectType(stockClass)).toBe('STOCK_CLASS');
  });

  it('returns UNKNOWN for unrecognized objects', () => {
    expect(detectOcfObjectType({})).toBe('UNKNOWN');
    expect(detectOcfObjectType({ random: 'data' })).toBe('UNKNOWN');
    expect(detectOcfObjectType(null)).toBe('UNKNOWN');
    expect(detectOcfObjectType('string')).toBe('UNKNOWN');
  });

  it('does not infer identity from an untagged shape', () => {
    expect(
      detectOcfObjectType({
        id: 'issuer-1',
        legal_name: 'Test Corp',
        formation_date: '2024-01-01',
        country_of_formation: 'US',
      })
    ).toBe('UNKNOWN');
  });

  it('does not identify an incomplete object from object_type alone', () => {
    const withObjectType = {
      object_type: 'ISSUER',
      id: 'issuer-1',
    };
    expect(detectOcfObjectType(withObjectType)).toBe('UNKNOWN');
  });
});

describe('Assertion Functions', () => {
  describe('assertOcfIssuer', () => {
    it('does not throw for valid issuer', () => {
      const issuer = {
        object_type: 'ISSUER',
        id: 'issuer-1',
        legal_name: 'Test Corp',
        formation_date: '2024-01-01',
        country_of_formation: 'US',
      };
      expect(() => assertOcfIssuer(issuer)).not.toThrow();
    });

    it('throws for invalid issuer', () => {
      expect(() => assertOcfIssuer({})).toThrow('Expected OcfIssuer object');
      expect(() => assertOcfIssuer(null)).toThrow('Expected OcfIssuer object');
    });

    it('uses custom message when provided', () => {
      expect(() => assertOcfIssuer({}, 'Custom error message')).toThrow('Custom error message');
    });
  });

  describe('assertOcfStakeholder', () => {
    it('does not throw for valid stakeholder', () => {
      const stakeholder = {
        object_type: 'STAKEHOLDER',
        id: 'sh-1',
        name: { legal_name: 'John Doe' },
        stakeholder_type: 'INDIVIDUAL',
      };
      expect(() => assertOcfStakeholder(stakeholder)).not.toThrow();
    });

    it('throws for invalid stakeholder', () => {
      expect(() => assertOcfStakeholder({})).toThrow('Expected OcfStakeholder object');
    });
  });

  describe('assertOcfStockClass', () => {
    it('does not throw for valid stock class', () => {
      const stockClass = {
        object_type: 'STOCK_CLASS',
        id: 'class-1',
        name: 'Common',
        default_id_prefix: 'CS-',
        class_type: 'COMMON',
        initial_shares_authorized: '10000000',
        votes_per_share: '1',
        seniority: '1',
      };
      expect(() => assertOcfStockClass(stockClass)).not.toThrow();
    });

    it('throws for invalid stock class', () => {
      expect(() => assertOcfStockClass({})).toThrow('Expected OcfStockClass object');
    });
  });
});
