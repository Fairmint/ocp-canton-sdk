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
  isOcfDocument,
  isOcfIssuer,
  isOcfStakeholder,
  isOcfStockCancellation,
  isOcfStockClass,
  isOcfStockIssuance,
  isOcfStockLegendTemplate,
  isOcfStockPlan,
  isOcfValuation,
  isOcfVestingTerms,
} from '../../src/utils/typeGuards';

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

    it('returns false for dates with invalid month', () => {
      expect(isIsoDateString('2024-13-01')).toBe(false);
    });

    // Note: JavaScript Date is permissive with day overflow (2024-02-30 becomes 2024-03-01)
    // So we only test clearly invalid month values

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

describe('OCF Type Guards', () => {
  describe('isOcfIssuer', () => {
    const validIssuer = {
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

    it('returns false when required fields are empty', () => {
      expect(isOcfIssuer({ ...validIssuer, id: '' })).toBe(false);
      expect(isOcfIssuer({ ...validIssuer, legal_name: '' })).toBe(false);
    });

    it('returns false for non-objects', () => {
      expect(isOcfIssuer(null)).toBe(false);
      expect(isOcfIssuer('issuer')).toBe(false);
    });
  });

  describe('isOcfStakeholder', () => {
    const validStakeholder = {
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
  });

  describe('isOcfStockClass', () => {
    const validStockClass = {
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
      id: 'issuance-1',
      date: '2024-01-15',
      security_id: 'sec-1',
      custom_id: 'CS-001',
      stakeholder_id: 'sh-1',
      stock_class_id: 'class-1',
      quantity: '1000',
      share_price: { amount: '1.00', currency: 'USD' },
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
  });

  describe('isOcfVestingTerms', () => {
    const validVestingTerms = {
      id: 'vesting-1',
      name: '4-year standard',
      description: 'Standard 4-year vesting with 1-year cliff',
      allocation_type: 'CUMULATIVE_ROUNDING',
      vesting_conditions: [],
    };

    it('returns true for valid vesting terms objects', () => {
      expect(isOcfVestingTerms(validVestingTerms)).toBe(true);
    });

    it('returns false when required fields are missing', () => {
      expect(isOcfVestingTerms({ ...validVestingTerms, allocation_type: undefined })).toBe(false);
    });
  });

  describe('isOcfValuation', () => {
    const validValuation = {
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
      id: 'doc-1',
      md5: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
    };

    it('returns true for valid document objects', () => {
      expect(isOcfDocument(validDocument)).toBe(true);
      expect(isOcfDocument({ ...validDocument, path: '/docs/agreement.pdf' })).toBe(true);
      expect(isOcfDocument({ ...validDocument, uri: 'https://example.com/doc.pdf' })).toBe(true);
    });

    it('returns false when required fields are missing', () => {
      expect(isOcfDocument({ ...validDocument, md5: undefined })).toBe(false);
    });
  });
});

describe('detectOcfObjectType', () => {
  it('detects issuer from structure', () => {
    const issuer = {
      id: 'issuer-1',
      legal_name: 'Test Corp',
      formation_date: '2024-01-01',
      country_of_formation: 'US',
    };
    expect(detectOcfObjectType(issuer)).toBe('ISSUER');
  });

  it('detects stakeholder from structure', () => {
    const stakeholder = {
      id: 'sh-1',
      name: { legal_name: 'John Doe' },
      stakeholder_type: 'INDIVIDUAL',
    };
    expect(detectOcfObjectType(stakeholder)).toBe('STAKEHOLDER');
  });

  it('detects stock class from structure', () => {
    const stockClass = {
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

  it('uses object_type field when available', () => {
    const withObjectType = {
      object_type: 'ISSUER',
      id: 'issuer-1',
    };
    expect(detectOcfObjectType(withObjectType)).toBe('ISSUER');
  });
});

describe('Assertion Functions', () => {
  describe('assertOcfIssuer', () => {
    it('does not throw for valid issuer', () => {
      const issuer = {
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
