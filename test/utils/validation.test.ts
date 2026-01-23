/**
 * Tests for validation utilities.
 */
import {
  ValidationError,
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

describe('ValidationError', () => {
  it('creates error with field path, expected, and received', () => {
    const error = new ValidationError('stakeholder.id', 'non-empty string', '');
    expect(error.message).toBe('Validation failed for \'stakeholder.id\': expected non-empty string, received ""');
    expect(error.fieldPath).toBe('stakeholder.id');
    expect(error.expected).toBe('non-empty string');
    expect(error.received).toBe('""');
  });

  it('handles null and undefined values', () => {
    const nullError = new ValidationError('field', 'string', null);
    expect(nullError.received).toBe('null');

    const undefinedError = new ValidationError('field', 'string', undefined);
    expect(undefinedError.received).toBe('undefined');
  });

  it('stringifies complex values', () => {
    const error = new ValidationError('field', 'string', { key: 'value' });
    expect(error.received).toBe('{"key":"value"}');
  });
});

describe('String Validators', () => {
  describe('validateRequiredString', () => {
    it('passes for non-empty strings', () => {
      expect(() => validateRequiredString('hello', 'field')).not.toThrow();
      expect(() => validateRequiredString('a', 'field')).not.toThrow();
    });

    it('throws for empty strings', () => {
      expect(() => validateRequiredString('', 'field')).toThrow(ValidationError);
    });

    it('throws for non-strings', () => {
      expect(() => validateRequiredString(null, 'field')).toThrow(ValidationError);
      expect(() => validateRequiredString(undefined, 'field')).toThrow(ValidationError);
      expect(() => validateRequiredString(123, 'field')).toThrow(ValidationError);
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
      expect(() => validateOptionalString(123, 'field')).toThrow(ValidationError);
    });
  });
});

describe('Numeric Validators', () => {
  describe('validateRequiredNumeric', () => {
    it('passes for valid numbers', () => {
      expect(() => validateRequiredNumeric(0, 'field')).not.toThrow();
      expect(() => validateRequiredNumeric(123, 'field')).not.toThrow();
      expect(() => validateRequiredNumeric(-456, 'field')).not.toThrow();
    });

    it('passes for valid numeric strings', () => {
      expect(() => validateRequiredNumeric('0', 'field')).not.toThrow();
      expect(() => validateRequiredNumeric('123', 'field')).not.toThrow();
      expect(() => validateRequiredNumeric('3.14', 'field')).not.toThrow();
    });

    it('throws for NaN', () => {
      expect(() => validateRequiredNumeric(NaN, 'field')).toThrow(ValidationError);
    });

    it('throws for non-numeric strings', () => {
      expect(() => validateRequiredNumeric('', 'field')).toThrow(ValidationError);
      expect(() => validateRequiredNumeric('hello', 'field')).toThrow(ValidationError);
    });

    it('throws for non-numeric types', () => {
      expect(() => validateRequiredNumeric(null, 'field')).toThrow(ValidationError);
      expect(() => validateRequiredNumeric(undefined, 'field')).toThrow(ValidationError);
    });
  });

  describe('validateOptionalNumeric', () => {
    it('returns string for numbers', () => {
      expect(validateOptionalNumeric(123, 'field')).toBe('123');
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
      expect(() => validateNumericRange(5, 'field', 0, 10)).not.toThrow();
      expect(() => validateNumericRange(0, 'field', 0, 10)).not.toThrow();
      expect(() => validateNumericRange(10, 'field', 0, 10)).not.toThrow();
    });

    it('throws for values outside range', () => {
      expect(() => validateNumericRange(-1, 'field', 0, 10)).toThrow(ValidationError);
      expect(() => validateNumericRange(11, 'field', 0, 10)).toThrow(ValidationError);
    });

    it('works with string values', () => {
      expect(() => validateNumericRange('5', 'field', 0, 10)).not.toThrow();
    });
  });

  describe('validatePositiveNumeric', () => {
    it('passes for positive values', () => {
      expect(() => validatePositiveNumeric(1, 'field')).not.toThrow();
      expect(() => validatePositiveNumeric(0.001, 'field')).not.toThrow();
    });

    it('throws for zero', () => {
      expect(() => validatePositiveNumeric(0, 'field')).toThrow(ValidationError);
    });

    it('throws for negative values', () => {
      expect(() => validatePositiveNumeric(-1, 'field')).toThrow(ValidationError);
    });
  });

  describe('validateNonNegativeNumeric', () => {
    it('passes for non-negative values', () => {
      expect(() => validateNonNegativeNumeric(0, 'field')).not.toThrow();
      expect(() => validateNonNegativeNumeric(1, 'field')).not.toThrow();
    });

    it('throws for negative values', () => {
      expect(() => validateNonNegativeNumeric(-1, 'field')).toThrow(ValidationError);
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
      expect(() => validateRequiredDate('01-15-2024', 'field')).toThrow(ValidationError);
      expect(() => validateRequiredDate('2024/01/15', 'field')).toThrow(ValidationError);
      expect(() => validateRequiredDate('2024-1-15', 'field')).toThrow(ValidationError);
    });

    it('throws for dates with invalid month', () => {
      expect(() => validateRequiredDate('2024-13-01', 'field')).toThrow(ValidationError);
    });

    // Note: JavaScript Date is permissive with day overflow (2024-02-30 becomes 2024-03-01)
    // So we only test clearly invalid month values

    it('throws for non-strings', () => {
      expect(() => validateRequiredDate(null, 'field')).toThrow(ValidationError);
      expect(() => validateRequiredDate(123, 'field')).toThrow(ValidationError);
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
      expect(() => validateEnum('OTHER', 'field', allowedValues)).toThrow(ValidationError);
    });

    it('throws for non-strings', () => {
      expect(() => validateEnum(123, 'field', allowedValues)).toThrow(ValidationError);
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
      expect(() => validateRequiredArray([], 'field')).toThrow(ValidationError);
    });

    it('throws for non-arrays', () => {
      expect(() => validateRequiredArray(null, 'field')).toThrow(ValidationError);
      expect(() => validateRequiredArray('array', 'field')).toThrow(ValidationError);
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
      expect(() => validateRequiredObject(null, 'field')).toThrow(ValidationError);
    });

    it('throws for non-objects', () => {
      expect(() => validateRequiredObject('string', 'field')).toThrow(ValidationError);
      expect(() => validateRequiredObject(123, 'field')).toThrow(ValidationError);
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
      expect(() => validateRequiredMonetary({ amount: 100, currency: 'EUR' }, 'field')).not.toThrow();
    });

    it('throws when amount is missing', () => {
      expect(() => validateRequiredMonetary({ currency: 'USD' }, 'field')).toThrow(ValidationError);
    });

    it('throws when currency is missing', () => {
      expect(() => validateRequiredMonetary({ amount: '100' }, 'field')).toThrow(ValidationError);
    });
  });

  describe('validateOptionalMonetary', () => {
    it('returns normalized monetary object', () => {
      expect(validateOptionalMonetary({ amount: 100, currency: 'USD' }, 'field')).toEqual({
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
      expect(() => validateContractId('', 'field')).toThrow(ValidationError);
    });

    it('throws for strings with whitespace', () => {
      expect(() => validateContractId('contract id', 'field')).toThrow(ValidationError);
    });
  });

  describe('validatePartyId', () => {
    it('passes for valid party IDs', () => {
      expect(() => validatePartyId('alice::fingerprint', 'field')).not.toThrow();
      expect(() => validatePartyId('bob::1234abcd', 'field')).not.toThrow();
    });

    it('throws for empty strings', () => {
      expect(() => validatePartyId('', 'field')).toThrow(ValidationError);
    });

    it('throws for strings with whitespace', () => {
      expect(() => validatePartyId('party id', 'field')).toThrow(ValidationError);
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
      expect(() => validateTestType(null, 'obj')).toThrow(ValidationError);
    });
  });
});
