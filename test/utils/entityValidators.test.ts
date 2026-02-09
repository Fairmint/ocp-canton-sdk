/**
 * Unit tests for entity validators.
 */
import { OcpValidationError } from '../../src/errors';
import {
  validateAddress,
  validateContactInfo,
  validateContactInfoWithoutName,
  validateDocumentData,
  validateEmail,
  validateIssuerData,
  validateMonetaryObject,
  validateName,
  validateOptionalAddress,
  validateOptionalEmail,
  validateOptionalMonetaryObject,
  validateOptionalPhone,
  validatePhone,
  validateResultingSecurityIds,
  validateStakeholderData,
  validateStockClassData,
  validateStockIssuanceData,
  validateTaxId,
  validateTransactionBase,
  validateValuationData,
} from '../../src/utils/entityValidators';

describe('Entity Validators', () => {
  // ===== Helper Validators =====

  describe('validateEmail', () => {
    it('passes for valid email', () => {
      expect(() => validateEmail({ email_type: 'BUSINESS', email_address: 'test@example.com' }, 'email')).not.toThrow();
    });

    it('throws for missing email_type', () => {
      expect(() => validateEmail({ email_address: 'test@example.com' }, 'email')).toThrow(OcpValidationError);
    });

    it('throws for invalid email_type', () => {
      expect(() => validateEmail({ email_type: 'INVALID', email_address: 'test@example.com' }, 'email')).toThrow(
        OcpValidationError
      );
    });

    it('throws for missing email_address', () => {
      expect(() => validateEmail({ email_type: 'BUSINESS' }, 'email')).toThrow(OcpValidationError);
    });

    it('throws for null', () => {
      expect(() => validateEmail(null, 'email')).toThrow(OcpValidationError);
    });
  });

  describe('validateOptionalEmail', () => {
    it('returns null for null/undefined', () => {
      expect(validateOptionalEmail(null, 'email')).toBeNull();
      expect(validateOptionalEmail(undefined, 'email')).toBeNull();
    });

    it('returns email for valid email', () => {
      const email = { email_type: 'BUSINESS', email_address: 'test@example.com' };
      expect(validateOptionalEmail(email, 'email')).toEqual(email);
    });
  });

  describe('validatePhone', () => {
    it('passes for valid phone', () => {
      expect(() => validatePhone({ phone_type: 'MOBILE', phone_number: '+1234567890' }, 'phone')).not.toThrow();
    });

    it('throws for missing phone_type', () => {
      expect(() => validatePhone({ phone_number: '+1234567890' }, 'phone')).toThrow(OcpValidationError);
    });

    it('throws for invalid phone_type', () => {
      expect(() => validatePhone({ phone_type: 'INVALID', phone_number: '+1234567890' }, 'phone')).toThrow(
        OcpValidationError
      );
    });

    it('throws for missing phone_number', () => {
      expect(() => validatePhone({ phone_type: 'MOBILE' }, 'phone')).toThrow(OcpValidationError);
    });
  });

  describe('validateOptionalPhone', () => {
    it('returns null for null/undefined', () => {
      expect(validateOptionalPhone(null, 'phone')).toBeNull();
      expect(validateOptionalPhone(undefined, 'phone')).toBeNull();
    });

    it('returns phone for valid phone', () => {
      const phone = { phone_type: 'MOBILE', phone_number: '+1234567890' };
      expect(validateOptionalPhone(phone, 'phone')).toEqual(phone);
    });
  });

  describe('validateAddress', () => {
    it('passes for valid address with required fields only', () => {
      expect(() => validateAddress({ address_type: 'LEGAL', country: 'US' }, 'address')).not.toThrow();
    });

    it('passes for valid address with all fields', () => {
      expect(() =>
        validateAddress(
          {
            address_type: 'CONTACT',
            country: 'US',
            street_suite: '123 Main St',
            city: 'San Francisco',
            country_subdivision: 'CA',
            postal_code: '94105',
          },
          'address'
        )
      ).not.toThrow();
    });

    it('throws for missing address_type', () => {
      expect(() => validateAddress({ country: 'US' }, 'address')).toThrow(OcpValidationError);
    });

    it('throws for invalid address_type', () => {
      expect(() => validateAddress({ address_type: 'INVALID', country: 'US' }, 'address')).toThrow(OcpValidationError);
    });

    it('throws for missing country', () => {
      expect(() => validateAddress({ address_type: 'LEGAL' }, 'address')).toThrow(OcpValidationError);
    });
  });

  describe('validateOptionalAddress', () => {
    it('returns null for null/undefined', () => {
      expect(validateOptionalAddress(null, 'address')).toBeNull();
      expect(validateOptionalAddress(undefined, 'address')).toBeNull();
    });
  });

  describe('validateTaxId', () => {
    it('passes for valid tax ID', () => {
      expect(() => validateTaxId({ country: 'US', tax_id: '12-3456789' }, 'taxId')).not.toThrow();
    });

    it('throws for missing country', () => {
      expect(() => validateTaxId({ tax_id: '12-3456789' }, 'taxId')).toThrow(OcpValidationError);
    });

    it('throws for missing tax_id', () => {
      expect(() => validateTaxId({ country: 'US' }, 'taxId')).toThrow(OcpValidationError);
    });
  });

  describe('validateMonetaryObject', () => {
    it('passes for valid monetary object', () => {
      expect(() => validateMonetaryObject({ amount: '100', currency: 'USD' }, 'price')).not.toThrow();
    });

    it('passes for decimal string amount', () => {
      expect(() => validateMonetaryObject({ amount: '100.50', currency: 'USD' }, 'price')).not.toThrow();
    });

    it('throws for missing amount', () => {
      expect(() => validateMonetaryObject({ currency: 'USD' }, 'price')).toThrow(OcpValidationError);
    });

    it('throws for missing currency', () => {
      expect(() => validateMonetaryObject({ amount: '100' }, 'price')).toThrow(OcpValidationError);
    });
  });

  describe('validateOptionalMonetaryObject', () => {
    it('returns null for null/undefined', () => {
      expect(validateOptionalMonetaryObject(null, 'price')).toBeNull();
      expect(validateOptionalMonetaryObject(undefined, 'price')).toBeNull();
    });

    it('returns monetary for valid object', () => {
      const monetary = { amount: '100', currency: 'USD' };
      expect(validateOptionalMonetaryObject(monetary, 'price')).toEqual(monetary);
    });
  });

  describe('validateName', () => {
    it('passes for valid name with legal_name only', () => {
      expect(() => validateName({ legal_name: 'John Doe' }, 'name')).not.toThrow();
    });

    it('passes for valid name with all fields', () => {
      expect(() =>
        validateName({ legal_name: 'John Doe', first_name: 'John', last_name: 'Doe' }, 'name')
      ).not.toThrow();
    });

    it('throws for missing legal_name', () => {
      expect(() => validateName({ first_name: 'John', last_name: 'Doe' }, 'name')).toThrow(OcpValidationError);
    });

    it('throws for empty legal_name', () => {
      expect(() => validateName({ legal_name: '' }, 'name')).toThrow(OcpValidationError);
    });
  });

  describe('validateContactInfo', () => {
    it('passes for valid contact info', () => {
      expect(() =>
        validateContactInfo(
          {
            name: { legal_name: 'John Doe' },
            phone_numbers: [{ phone_type: 'MOBILE', phone_number: '+1234567890' }],
            emails: [{ email_type: 'BUSINESS', email_address: 'test@example.com' }],
          },
          'contact'
        )
      ).not.toThrow();
    });

    it('passes for contact info with name only', () => {
      expect(() => validateContactInfo({ name: { legal_name: 'John Doe' } }, 'contact')).not.toThrow();
    });

    it('throws for missing name', () => {
      expect(() => validateContactInfo({}, 'contact')).toThrow(OcpValidationError);
    });

    it('throws for invalid phone_numbers (not array)', () => {
      expect(() =>
        validateContactInfo({ name: { legal_name: 'John Doe' }, phone_numbers: 'invalid' }, 'contact')
      ).toThrow(OcpValidationError);
    });

    it('throws for invalid emails (not array)', () => {
      expect(() => validateContactInfo({ name: { legal_name: 'John Doe' }, emails: 'invalid' }, 'contact')).toThrow(
        OcpValidationError
      );
    });
  });

  describe('validateContactInfoWithoutName', () => {
    it('passes for valid contact info without name', () => {
      expect(() =>
        validateContactInfoWithoutName(
          {
            phone_numbers: [{ phone_type: 'MOBILE', phone_number: '+1234567890' }],
            emails: [{ email_type: 'BUSINESS', email_address: 'test@example.com' }],
          },
          'contact'
        )
      ).not.toThrow();
    });

    it('passes for empty contact info', () => {
      expect(() => validateContactInfoWithoutName({}, 'contact')).not.toThrow();
    });
  });

  // ===== Entity Validators =====

  describe('validateIssuerData', () => {
    const validIssuer = {
      id: 'issuer-1',
      legal_name: 'Test Corp',
      formation_date: '2024-01-01',
      country_of_formation: 'US',
      tax_ids: [],
    };

    it('passes for valid issuer data', () => {
      expect(() => validateIssuerData(validIssuer, 'issuer')).not.toThrow();
    });

    it('throws for missing id', () => {
      expect(() => validateIssuerData({ ...validIssuer, id: '' }, 'issuer')).toThrow(OcpValidationError);
    });

    it('throws for missing legal_name', () => {
      expect(() => validateIssuerData({ ...validIssuer, legal_name: '' }, 'issuer')).toThrow(OcpValidationError);
    });

    it('throws for missing formation_date', () => {
      const { formation_date: _formation_date, ...rest } = validIssuer;
      expect(() => validateIssuerData(rest, 'issuer')).toThrow(OcpValidationError);
    });

    it('throws for invalid formation_date format', () => {
      expect(() => validateIssuerData({ ...validIssuer, formation_date: '01-01-2024' }, 'issuer')).toThrow(
        OcpValidationError
      );
    });

    it('throws for missing country_of_formation', () => {
      expect(() => validateIssuerData({ ...validIssuer, country_of_formation: '' }, 'issuer')).toThrow(
        OcpValidationError
      );
    });

    it('throws for non-array tax_ids', () => {
      expect(() => validateIssuerData({ ...validIssuer, tax_ids: 'invalid' }, 'issuer')).toThrow(OcpValidationError);
    });
  });

  describe('validateStakeholderData', () => {
    const validStakeholder = {
      id: 'stakeholder-1',
      name: { legal_name: 'John Doe' },
      stakeholder_type: 'INDIVIDUAL',
    };

    it('passes for valid stakeholder data', () => {
      expect(() => validateStakeholderData(validStakeholder, 'stakeholder')).not.toThrow();
    });

    it('throws for missing id', () => {
      expect(() => validateStakeholderData({ ...validStakeholder, id: '' }, 'stakeholder')).toThrow(OcpValidationError);
    });

    it('throws for missing name', () => {
      const { name: _name, ...rest } = validStakeholder;
      expect(() => validateStakeholderData(rest, 'stakeholder')).toThrow(OcpValidationError);
    });

    it('throws for invalid stakeholder_type', () => {
      expect(() =>
        validateStakeholderData({ ...validStakeholder, stakeholder_type: 'INVALID' }, 'stakeholder')
      ).toThrow(OcpValidationError);
    });

    it('throws for invalid current_status', () => {
      expect(() =>
        validateStakeholderData({ ...validStakeholder, current_status: 'INVALID_STATUS' }, 'stakeholder')
      ).toThrow(OcpValidationError);
    });

    it('passes for valid current_status', () => {
      expect(() =>
        validateStakeholderData({ ...validStakeholder, current_status: 'ACTIVE' }, 'stakeholder')
      ).not.toThrow();
    });
  });

  describe('validateStockClassData', () => {
    const validStockClass = {
      id: 'stock-class-1',
      name: 'Common Stock',
      class_type: 'COMMON',
      default_id_prefix: 'CS-',
      initial_shares_authorized: '1000000',
      seniority: '1',
      votes_per_share: '1',
    };

    it('passes for valid stock class data', () => {
      expect(() => validateStockClassData(validStockClass, 'stockClass')).not.toThrow();
    });

    it('throws for missing id', () => {
      expect(() => validateStockClassData({ ...validStockClass, id: '' }, 'stockClass')).toThrow(OcpValidationError);
    });

    it('throws for invalid class_type', () => {
      expect(() => validateStockClassData({ ...validStockClass, class_type: 'INVALID' }, 'stockClass')).toThrow(
        OcpValidationError
      );
    });

    it('throws for missing initial_shares_authorized', () => {
      const { initial_shares_authorized: _initial_shares_authorized, ...rest } = validStockClass;
      expect(() => validateStockClassData(rest, 'stockClass')).toThrow(OcpValidationError);
    });

    it('passes for numeric string initial_shares_authorized', () => {
      expect(() =>
        validateStockClassData({ ...validStockClass, initial_shares_authorized: '1000000' }, 'stockClass')
      ).not.toThrow();
    });
  });

  describe('validateStockIssuanceData', () => {
    const validStockIssuance = {
      id: 'issuance-1',
      date: '2024-01-01',
      security_id: 'sec-1',
      custom_id: 'CS-001',
      stakeholder_id: 'stakeholder-1',
      stock_class_id: 'stock-class-1',
      share_price: { amount: '1.00', currency: 'USD' },
      quantity: '1000',
    };

    it('passes for valid stock issuance data', () => {
      expect(() => validateStockIssuanceData(validStockIssuance, 'stockIssuance')).not.toThrow();
    });

    it('throws for missing id', () => {
      expect(() => validateStockIssuanceData({ ...validStockIssuance, id: '' }, 'stockIssuance')).toThrow(
        OcpValidationError
      );
    });

    it('throws for missing security_id', () => {
      expect(() => validateStockIssuanceData({ ...validStockIssuance, security_id: '' }, 'stockIssuance')).toThrow(
        OcpValidationError
      );
    });

    it('throws for invalid date format', () => {
      expect(() => validateStockIssuanceData({ ...validStockIssuance, date: '01-01-2024' }, 'stockIssuance')).toThrow(
        OcpValidationError
      );
    });

    it('throws for missing share_price', () => {
      const { share_price: _share_price, ...rest } = validStockIssuance;
      expect(() => validateStockIssuanceData(rest, 'stockIssuance')).toThrow(OcpValidationError);
    });

    it('throws for invalid issuance_type', () => {
      expect(() =>
        validateStockIssuanceData({ ...validStockIssuance, issuance_type: 'INVALID' }, 'stockIssuance')
      ).toThrow(OcpValidationError);
    });

    it('passes for valid issuance_type', () => {
      expect(() =>
        validateStockIssuanceData({ ...validStockIssuance, issuance_type: 'RSA' }, 'stockIssuance')
      ).not.toThrow();
    });
  });

  describe('validateValuationData', () => {
    const validValuation = {
      id: 'valuation-1',
      stock_class_id: 'stock-class-1',
      effective_date: '2024-01-01',
      valuation_type: '409A',
      price_per_share: { amount: '10.00', currency: 'USD' },
    };

    it('passes for valid valuation data', () => {
      expect(() => validateValuationData(validValuation, 'valuation')).not.toThrow();
    });

    it('throws for missing id', () => {
      expect(() => validateValuationData({ ...validValuation, id: '' }, 'valuation')).toThrow(OcpValidationError);
    });

    it('throws for missing stock_class_id', () => {
      expect(() => validateValuationData({ ...validValuation, stock_class_id: '' }, 'valuation')).toThrow(
        OcpValidationError
      );
    });

    it('throws for invalid valuation_type', () => {
      expect(() => validateValuationData({ ...validValuation, valuation_type: 'INVALID' }, 'valuation')).toThrow(
        OcpValidationError
      );
    });

    it('throws for missing price_per_share', () => {
      const { price_per_share: _price_per_share, ...rest } = validValuation;
      expect(() => validateValuationData(rest, 'valuation')).toThrow(OcpValidationError);
    });
  });

  describe('validateDocumentData', () => {
    const validDocumentWithPath = {
      id: 'doc-1',
      md5: 'abc123def456',
      path: 'documents/contract.pdf',
    };

    const validDocumentWithUri = {
      id: 'doc-1',
      md5: 'abc123def456',
      uri: 'https://example.com/contract.pdf',
    };

    it('passes for valid document with path', () => {
      expect(() => validateDocumentData(validDocumentWithPath, 'document')).not.toThrow();
    });

    it('passes for valid document with uri', () => {
      expect(() => validateDocumentData(validDocumentWithUri, 'document')).not.toThrow();
    });

    it('throws for missing id', () => {
      expect(() => validateDocumentData({ ...validDocumentWithPath, id: '' }, 'document')).toThrow(OcpValidationError);
    });

    it('throws for missing md5', () => {
      expect(() => validateDocumentData({ ...validDocumentWithPath, md5: '' }, 'document')).toThrow(OcpValidationError);
    });

    it('throws for missing both path and uri', () => {
      expect(() => validateDocumentData({ id: 'doc-1', md5: 'abc123' }, 'document')).toThrow(OcpValidationError);
    });
  });

  // ===== Transaction Validators =====

  describe('validateTransactionBase', () => {
    const validTransaction = {
      id: 'tx-1',
      date: '2024-01-01',
      security_id: 'sec-1',
    };

    it('passes for valid transaction base', () => {
      expect(() => validateTransactionBase(validTransaction, 'tx')).not.toThrow();
    });

    it('throws for missing id', () => {
      expect(() => validateTransactionBase({ ...validTransaction, id: '' }, 'tx')).toThrow(OcpValidationError);
    });

    it('throws for missing date', () => {
      const { date: _date, ...rest } = validTransaction;
      expect(() => validateTransactionBase(rest, 'tx')).toThrow(OcpValidationError);
    });

    it('throws for missing security_id when required', () => {
      const { security_id: _security_id, ...rest } = validTransaction;
      expect(() => validateTransactionBase(rest, 'tx', { requireSecurityId: true })).toThrow(OcpValidationError);
    });

    it('passes when security_id not required', () => {
      const { security_id: _security_id, ...rest } = validTransaction;
      expect(() => validateTransactionBase(rest, 'tx', { requireSecurityId: false })).not.toThrow();
    });

    it('throws for missing quantity when required', () => {
      expect(() => validateTransactionBase(validTransaction, 'tx', { requireQuantity: true })).toThrow(
        OcpValidationError
      );
    });

    it('passes with quantity when required', () => {
      expect(() =>
        validateTransactionBase({ ...validTransaction, quantity: '100' }, 'tx', { requireQuantity: true })
      ).not.toThrow();
    });
  });

  describe('validateResultingSecurityIds', () => {
    it('passes for non-empty array of strings', () => {
      expect(() => validateResultingSecurityIds(['sec-1', 'sec-2'], 'ids')).not.toThrow();
    });

    it('throws for empty array', () => {
      expect(() => validateResultingSecurityIds([], 'ids')).toThrow(OcpValidationError);
    });

    it('throws for non-array', () => {
      expect(() => validateResultingSecurityIds('sec-1', 'ids')).toThrow(OcpValidationError);
    });

    it('throws for array with non-string items', () => {
      expect(() => validateResultingSecurityIds(['sec-1', 123], 'ids')).toThrow(OcpValidationError);
    });

    it('throws for array with empty string items', () => {
      expect(() => validateResultingSecurityIds(['sec-1', ''], 'ids')).toThrow(OcpValidationError);
    });
  });
});
