/**
 * Tests for validation utilities.
 */
import { OcpValidationError } from '../../src/errors';
import {
  createValidator,
  validateArrayItems,
  validateContractId,
  validateEnum,
  validateNonNegativeNumeric,
  validateNumericRange,
  validateOptionalArray,
  validateOptionalDate,
  validateOptionalEnum,
  validateOptionalMonetary,
  validateOptionalNumeric,
  validateOptionalObject,
  validateOptionalString,
  validatePartyId,
  validatePositiveNumeric,
  validateRequiredArray,
  validateRequiredDate,
  validateRequiredMonetary,
  validateRequiredNumeric,
  validateRequiredObject,
  validateRequiredString,
} from '../../src/utils/validation';

describe('OcpValidationError', () => {
  it('creates error with field path and message', () => {
    const error = new OcpValidationError('stakeholder.id', 'Required field is missing', {
      expectedType: 'non-empty string',
      receivedValue: '',
    });
    expect(error.message).toContain('stakeholder.id');
    expect(error.fieldPath).toBe('stakeholder.id');
    expect(error.expectedType).toBe('non-empty string');
    expect(error.receivedValue).toBe('');
  });

  it('handles null and undefined receivedValue', () => {
    const nullError = new OcpValidationError('field', 'Missing value', {
      expectedType: 'string',
      receivedValue: null,
    });
    expect(nullError.receivedValue).toBe(null);

    const undefinedError = new OcpValidationError('field', 'Missing value', {
      expectedType: 'string',
      receivedValue: undefined,
    });
    expect(undefinedError.receivedValue).toBe(undefined);
  });
});

describe('String Validators', () => {
  describe('validateRequiredString', () => {
    it('passes for non-empty strings', () => {
      expect(() => validateRequiredString('hello', 'field')).not.toThrow();
      expect(() => validateRequiredString('a', 'field')).not.toThrow();
    });

    it('throws for empty strings', () => {
      expect(() => validateRequiredString('', 'field')).toThrow(OcpValidationError);
    });

    it('throws for non-strings', () => {
      expect(() => validateRequiredString(null, 'field')).toThrow(OcpValidationError);
      expect(() => validateRequiredString(undefined, 'field')).toThrow(OcpValidationError);
      expect(() => validateRequiredString(123, 'field')).toThrow(OcpValidationError);
    });
  });

  describe('validateOptionalString', () => {
    it('returns string for non-empty strings', () => {
      expect(validateOptionalString('hello', 'field')).toBe('hello');
    });

    it('returns null for empty strings', () => {
      expect(validateOptionalString('', 'field')).toBeNull();
    });

    it('returns null for null/undefined', () => {
      expect(validateOptionalString(null, 'field')).toBeNull();
      expect(validateOptionalString(undefined, 'field')).toBeNull();
    });

    it('throws for non-strings (except null/undefined)', () => {
      expect(() => validateOptionalString(123, 'field')).toThrow(OcpValidationError);
    });
  });
});

describe('Numeric Validators', () => {
  describe('validateRequiredNumeric', () => {
    it('passes for valid numeric strings', () => {
      expect(() => validateRequiredNumeric('0', 'field')).not.toThrow();
      expect(() => validateRequiredNumeric('123', 'field')).not.toThrow();
      expect(() => validateRequiredNumeric('-456', 'field')).not.toThrow();
    });

    it('passes for valid numeric strings', () => {
      expect(() => validateRequiredNumeric('0', 'field')).not.toThrow();
      expect(() => validateRequiredNumeric('123', 'field')).not.toThrow();
      expect(() => validateRequiredNumeric('3.14', 'field')).not.toThrow();
    });

    it('throws for NaN', () => {
      expect(() => validateRequiredNumeric(NaN, 'field')).toThrow(OcpValidationError);
    });

    it('throws for non-numeric strings', () => {
      expect(() => validateRequiredNumeric('', 'field')).toThrow(OcpValidationError);
      expect(() => validateRequiredNumeric('hello', 'field')).toThrow(OcpValidationError);
    });

    it('throws for non-numeric types', () => {
      expect(() => validateRequiredNumeric(null, 'field')).toThrow(OcpValidationError);
      expect(() => validateRequiredNumeric(undefined, 'field')).toThrow(OcpValidationError);
    });
  });

  describe('validateOptionalNumeric', () => {
    it('returns string for numeric strings', () => {
      expect(validateOptionalNumeric('123', 'field')).toBe('123');
    });

    it('returns string for numeric strings', () => {
      expect(validateOptionalNumeric('123', 'field')).toBe('123');
    });

    it('returns null for null/undefined', () => {
      expect(validateOptionalNumeric(null, 'field')).toBeNull();
      expect(validateOptionalNumeric(undefined, 'field')).toBeNull();
    });
  });

  describe('validateNumericRange', () => {
    it('passes for values within range', () => {
      expect(() => validateNumericRange('5', 'field', 0, 10)).not.toThrow();
      expect(() => validateNumericRange('0', 'field', 0, 10)).not.toThrow();
      expect(() => validateNumericRange('10', 'field', 0, 10)).not.toThrow();
    });

    it('throws for values outside range', () => {
      expect(() => validateNumericRange('-1', 'field', 0, 10)).toThrow(OcpValidationError);
      expect(() => validateNumericRange('11', 'field', 0, 10)).toThrow(OcpValidationError);
    });
  });

  describe('validatePositiveNumeric', () => {
    it('passes for positive values', () => {
      expect(() => validatePositiveNumeric('1', 'field')).not.toThrow();
      expect(() => validatePositiveNumeric('0.001', 'field')).not.toThrow();
    });

    it('throws for zero', () => {
      expect(() => validatePositiveNumeric('0', 'field')).toThrow(OcpValidationError);
    });

    it('throws for negative values', () => {
      expect(() => validatePositiveNumeric('-1', 'field')).toThrow(OcpValidationError);
    });
  });

  describe('validateNonNegativeNumeric', () => {
    it('passes for non-negative values', () => {
      expect(() => validateNonNegativeNumeric('0', 'field')).not.toThrow();
      expect(() => validateNonNegativeNumeric('1', 'field')).not.toThrow();
    });

    it('throws for negative values', () => {
      expect(() => validateNonNegativeNumeric('-1', 'field')).toThrow(OcpValidationError);
    });
  });
});

describe('Date Validators', () => {
  describe('validateRequiredDate', () => {
    it('passes for valid ISO date strings', () => {
      expect(() => validateRequiredDate('2024-01-15', 'field')).not.toThrow();
      expect(() => validateRequiredDate('2000-12-31', 'field')).not.toThrow();
    });

    it('throws for invalid format', () => {
      expect(() => validateRequiredDate('01-15-2024', 'field')).toThrow(OcpValidationError);
      expect(() => validateRequiredDate('2024/01/15', 'field')).toThrow(OcpValidationError);
      expect(() => validateRequiredDate('2024-1-15', 'field')).toThrow(OcpValidationError);
    });

    it('throws for dates with invalid month', () => {
      expect(() => validateRequiredDate('2024-13-01', 'field')).toThrow(OcpValidationError);
    });

    // Note: JavaScript Date is permissive with day overflow (2024-02-30 becomes 2024-03-01)
    // So we only test clearly invalid month values

    it('throws for non-strings', () => {
      expect(() => validateRequiredDate(null, 'field')).toThrow(OcpValidationError);
      expect(() => validateRequiredDate(123, 'field')).toThrow(OcpValidationError);
    });
  });

  describe('validateOptionalDate', () => {
    it('returns date string for valid dates', () => {
      expect(validateOptionalDate('2024-01-15', 'field')).toBe('2024-01-15');
    });

    it('returns null for null/undefined', () => {
      expect(validateOptionalDate(null, 'field')).toBeNull();
      expect(validateOptionalDate(undefined, 'field')).toBeNull();
    });
  });
});

describe('Enum Validators', () => {
  const allowedValues = ['INDIVIDUAL', 'INSTITUTION'] as const;

  describe('validateEnum', () => {
    it('passes for allowed values', () => {
      expect(() => validateEnum('INDIVIDUAL', 'field', allowedValues)).not.toThrow();
      expect(() => validateEnum('INSTITUTION', 'field', allowedValues)).not.toThrow();
    });

    it('throws for non-allowed values', () => {
      expect(() => validateEnum('OTHER', 'field', allowedValues)).toThrow(OcpValidationError);
    });

    it('throws for non-strings', () => {
      expect(() => validateEnum(123, 'field', allowedValues)).toThrow(OcpValidationError);
    });
  });

  describe('validateOptionalEnum', () => {
    it('returns value for allowed values', () => {
      expect(validateOptionalEnum('INDIVIDUAL', 'field', allowedValues)).toBe('INDIVIDUAL');
    });

    it('returns null for null/undefined', () => {
      expect(validateOptionalEnum(null, 'field', allowedValues)).toBeNull();
      expect(validateOptionalEnum(undefined, 'field', allowedValues)).toBeNull();
    });
  });
});

describe('Array Validators', () => {
  describe('validateRequiredArray', () => {
    it('passes for non-empty arrays', () => {
      expect(() => validateRequiredArray([1, 2, 3], 'field')).not.toThrow();
      expect(() => validateRequiredArray(['a'], 'field')).not.toThrow();
    });

    it('throws for empty arrays', () => {
      expect(() => validateRequiredArray([], 'field')).toThrow(OcpValidationError);
    });

    it('throws for non-arrays', () => {
      expect(() => validateRequiredArray(null, 'field')).toThrow(OcpValidationError);
      expect(() => validateRequiredArray('array', 'field')).toThrow(OcpValidationError);
    });
  });

  describe('validateOptionalArray', () => {
    it('returns array for non-empty arrays', () => {
      expect(validateOptionalArray([1, 2], 'field')).toEqual([1, 2]);
    });

    it('returns null for empty arrays', () => {
      expect(validateOptionalArray([], 'field')).toBeNull();
    });

    it('returns null for null/undefined', () => {
      expect(validateOptionalArray(null, 'field')).toBeNull();
      expect(validateOptionalArray(undefined, 'field')).toBeNull();
    });
  });
});

describe('Object Validators', () => {
  describe('validateRequiredObject', () => {
    it('passes for objects', () => {
      expect(() => validateRequiredObject({}, 'field')).not.toThrow();
      expect(() => validateRequiredObject({ key: 'value' }, 'field')).not.toThrow();
    });

    it('throws for null', () => {
      expect(() => validateRequiredObject(null, 'field')).toThrow(OcpValidationError);
    });

    it('throws for non-objects', () => {
      expect(() => validateRequiredObject('string', 'field')).toThrow(OcpValidationError);
      expect(() => validateRequiredObject(123, 'field')).toThrow(OcpValidationError);
    });
  });

  describe('validateOptionalObject', () => {
    it('returns object for valid objects', () => {
      expect(validateOptionalObject({ key: 'value' }, 'field')).toEqual({ key: 'value' });
    });

    it('returns null for null/undefined', () => {
      expect(validateOptionalObject(null, 'field')).toBeNull();
      expect(validateOptionalObject(undefined, 'field')).toBeNull();
    });
  });
});

describe('Monetary Validators', () => {
  describe('validateRequiredMonetary', () => {
    it('passes for valid monetary objects', () => {
      expect(() => validateRequiredMonetary({ amount: '100', currency: 'USD' }, 'field')).not.toThrow();
      expect(() => validateRequiredMonetary({ amount: '99.99', currency: 'EUR' }, 'field')).not.toThrow();
    });

    it('throws when amount is missing', () => {
      expect(() => validateRequiredMonetary({ currency: 'USD' }, 'field')).toThrow(OcpValidationError);
    });

    it('throws when currency is missing', () => {
      expect(() => validateRequiredMonetary({ amount: '100' }, 'field')).toThrow(OcpValidationError);
    });
  });

  describe('validateOptionalMonetary', () => {
    it('returns normalized monetary object', () => {
      expect(validateOptionalMonetary({ amount: '100', currency: 'USD' }, 'field')).toEqual({
        amount: '100',
        currency: 'USD',
      });
      expect(validateOptionalMonetary({ amount: '100.50', currency: 'EUR' }, 'field')).toEqual({
        amount: '100.50',
        currency: 'EUR',
      });
    });

    it('returns null for null/undefined', () => {
      expect(validateOptionalMonetary(null, 'field')).toBeNull();
      expect(validateOptionalMonetary(undefined, 'field')).toBeNull();
    });
  });
});

describe('Contract and Party Validators', () => {
  describe('validateContractId', () => {
    it('passes for valid contract IDs', () => {
      expect(() => validateContractId('00a1b2c3d4e5f6:00112233', 'field')).not.toThrow();
      expect(() => validateContractId('abcdef123456', 'field')).not.toThrow();
    });

    it('throws for empty strings', () => {
      expect(() => validateContractId('', 'field')).toThrow(OcpValidationError);
    });

    it('throws for strings with whitespace', () => {
      expect(() => validateContractId('contract id', 'field')).toThrow(OcpValidationError);
    });
  });

  describe('validatePartyId', () => {
    it('passes for valid party IDs', () => {
      expect(() => validatePartyId('alice::fingerprint', 'field')).not.toThrow();
      expect(() => validatePartyId('bob::1234abcd', 'field')).not.toThrow();
    });

    it('throws for empty strings', () => {
      expect(() => validatePartyId('', 'field')).toThrow(OcpValidationError);
    });

    it('throws for strings with whitespace', () => {
      expect(() => validatePartyId('party id', 'field')).toThrow(OcpValidationError);
    });
  });
});

describe('Composite Validators', () => {
  describe('validateArrayItems', () => {
    it('passes when all items pass validation', () => {
      const items = ['a', 'b', 'c'];
      expect(() => validateArrayItems(items, 'field', validateRequiredString)).not.toThrow();
    });

    it('throws with correct path when item fails', () => {
      const items = ['a', '', 'c'];
      expect(() => validateArrayItems(items, 'field', validateRequiredString)).toThrow(/field\[1\]/);
    });
  });

  describe('createValidator', () => {
    interface TestType {
      id: string;
      name: string;
    }

    const validateTestType = createValidator<TestType>((value, path) => {
      validateRequiredString(value.id, `${path}.id`);
      validateRequiredString(value.name, `${path}.name`);
    });

    it('passes for valid objects', () => {
      expect(() => validateTestType({ id: '1', name: 'test' }, 'obj')).not.toThrow();
    });

    it('throws for invalid objects', () => {
      expect(() => validateTestType({ id: '', name: 'test' }, 'obj')).toThrow(/obj\.id/);
      expect(() => validateTestType({ id: '1' }, 'obj')).toThrow(/obj\.name/);
    });

    it('throws for non-objects', () => {
      expect(() => validateTestType(null, 'obj')).toThrow(OcpValidationError);
    });
  });
});
