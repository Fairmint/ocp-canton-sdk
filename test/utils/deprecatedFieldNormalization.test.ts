/** Unit tests for deprecated OCF field normalization utilities. */

import {
  checkDeprecatedFields,
  checkStockPlanDeprecatedFieldUsage,
  deprecationWarningConfig,
  emitDeprecationWarning,
  getDeprecatedFieldMappings,
  getFieldDeprecation,
  normalizeDeprecatedStockPlanFields,
  normalizeSingularToArray,
  type DeprecationDetails,
} from '../../src/utils/deprecatedFieldNormalization';

describe('normalizeSingularToArray', () => {
  describe('basic normalization', () => {
    test('returns empty array when both inputs are undefined', () => {
      expect(
        normalizeSingularToArray({
          singularValue: undefined,
          arrayValue: undefined,
        })
      ).toEqual([]);
    });

    test('returns empty array when both inputs are null-ish', () => {
      expect(
        normalizeSingularToArray({
          singularValue: null as unknown as string,
          arrayValue: [],
        })
      ).toEqual([]);
    });

    test('returns empty array when singular value is empty string', () => {
      // Empty strings should be treated as invalid/missing values (matching original truthy-check behavior)
      expect(
        normalizeSingularToArray({
          singularValue: '',
          arrayValue: undefined,
        })
      ).toEqual([]);
    });

    test('wraps singular value in array when array is undefined', () => {
      expect(
        normalizeSingularToArray({
          singularValue: 'value-1',
          arrayValue: undefined,
        })
      ).toEqual(['value-1']);
    });

    test('wraps singular value in array when array is empty', () => {
      expect(
        normalizeSingularToArray({
          singularValue: 'value-1',
          arrayValue: [],
        })
      ).toEqual(['value-1']);
    });

    test('prefers array value when array has items', () => {
      expect(
        normalizeSingularToArray({
          singularValue: 'singular-value',
          arrayValue: ['array-value-1', 'array-value-2'],
        })
      ).toEqual(['array-value-1', 'array-value-2']);
    });

    test('returns array as-is when singular is undefined', () => {
      expect(
        normalizeSingularToArray({
          singularValue: undefined,
          arrayValue: ['value-1', 'value-2'],
        })
      ).toEqual(['value-1', 'value-2']);
    });
  });

  describe('with different types', () => {
    test('works with number values', () => {
      expect(
        normalizeSingularToArray({
          singularValue: 42,
          arrayValue: undefined,
        })
      ).toEqual([42]);
    });

    test('works with object values', () => {
      const obj = { id: 'test' };
      expect(
        normalizeSingularToArray({
          singularValue: obj,
          arrayValue: undefined,
        })
      ).toEqual([obj]);
    });
  });

  describe('deprecation warnings', () => {
    let warningHandler: jest.Mock;
    let originalEnabled: boolean;
    let originalHandler: ((message: string, details: DeprecationDetails) => void) | undefined;

    beforeEach(() => {
      // Save original config
      originalEnabled = deprecationWarningConfig.enabled;
      originalHandler = deprecationWarningConfig.handler;

      // Set up mock handler
      warningHandler = jest.fn();
      deprecationWarningConfig.enabled = true;
      deprecationWarningConfig.handler = warningHandler;
    });

    afterEach(() => {
      // Restore original config
      deprecationWarningConfig.enabled = originalEnabled;
      deprecationWarningConfig.handler = originalHandler;
    });

    test('emits warning when using singular value with field names specified', () => {
      normalizeSingularToArray({
        singularValue: 'value-1',
        arrayValue: undefined,
        deprecatedFieldName: 'old_field',
        replacementFieldName: 'new_fields',
      });

      expect(warningHandler).toHaveBeenCalledTimes(1);
      expect(warningHandler).toHaveBeenCalledWith(
        expect.stringContaining("Field 'old_field' is deprecated"),
        expect.objectContaining({
          deprecatedField: 'old_field',
          replacementField: 'new_fields',
          deprecatedValue: 'value-1',
        })
      );
    });

    test('does not emit warning when array value is used', () => {
      normalizeSingularToArray({
        singularValue: 'singular-value',
        arrayValue: ['array-value'],
        deprecatedFieldName: 'old_field',
        replacementFieldName: 'new_fields',
      });

      expect(warningHandler).not.toHaveBeenCalled();
    });

    test('includes context in warning message', () => {
      normalizeSingularToArray({
        singularValue: 'value-1',
        arrayValue: undefined,
        deprecatedFieldName: 'old_field',
        replacementFieldName: 'new_fields',
        context: 'StockPlan.create',
      });

      expect(warningHandler).toHaveBeenCalledWith(
        expect.stringContaining('Context: StockPlan.create'),
        expect.anything()
      );
    });

    test('does not emit warning when field names not specified', () => {
      normalizeSingularToArray({
        singularValue: 'value-1',
        arrayValue: undefined,
      });

      expect(warningHandler).not.toHaveBeenCalled();
    });
  });
});

describe('normalizeDeprecatedStockPlanFields', () => {
  describe('field normalization', () => {
    test('normalizes deprecated stock_class_id to stock_class_ids array', () => {
      const result = normalizeDeprecatedStockPlanFields({
        stock_class_id: 'sc-1',
      });

      expect(result.stock_class_ids).toEqual(['sc-1']);
      expect(result.usedDeprecatedField).toBe(true);
    });

    test('returns stock_class_ids as-is when present and non-empty', () => {
      const result = normalizeDeprecatedStockPlanFields({
        stock_class_ids: ['sc-1', 'sc-2'],
      });

      expect(result.stock_class_ids).toEqual(['sc-1', 'sc-2']);
      expect(result.usedDeprecatedField).toBe(false);
    });

    test('prefers stock_class_ids over deprecated stock_class_id', () => {
      const result = normalizeDeprecatedStockPlanFields({
        stock_class_id: 'deprecated-sc',
        stock_class_ids: ['current-sc-1', 'current-sc-2'],
      });

      expect(result.stock_class_ids).toEqual(['current-sc-1', 'current-sc-2']);
      expect(result.usedDeprecatedField).toBe(false);
    });

    test('returns empty array when both fields are missing', () => {
      const result = normalizeDeprecatedStockPlanFields({});

      expect(result.stock_class_ids).toEqual([]);
      expect(result.usedDeprecatedField).toBe(false);
    });

    test('uses deprecated field when stock_class_ids is empty array', () => {
      const result = normalizeDeprecatedStockPlanFields({
        stock_class_id: 'sc-1',
        stock_class_ids: [],
      });

      expect(result.stock_class_ids).toEqual(['sc-1']);
      expect(result.usedDeprecatedField).toBe(true);
    });

    test('returns empty array when stock_class_ids is empty and no deprecated field', () => {
      const result = normalizeDeprecatedStockPlanFields({
        stock_class_ids: [],
      });

      expect(result.stock_class_ids).toEqual([]);
      expect(result.usedDeprecatedField).toBe(false);
    });

    test('returns empty array when deprecated stock_class_id is empty string', () => {
      // Empty strings should be treated as invalid/missing values (matching original truthy-check behavior)
      const result = normalizeDeprecatedStockPlanFields({
        stock_class_id: '',
      });

      expect(result.stock_class_ids).toEqual([]);
      expect(result.usedDeprecatedField).toBe(false);
    });
  });

  describe('with context parameter', () => {
    let warningHandler: jest.Mock;
    let originalEnabled: boolean;
    let originalHandler: ((message: string, details: DeprecationDetails) => void) | undefined;

    beforeEach(() => {
      originalEnabled = deprecationWarningConfig.enabled;
      originalHandler = deprecationWarningConfig.handler;
      warningHandler = jest.fn();
      deprecationWarningConfig.enabled = true;
      deprecationWarningConfig.handler = warningHandler;
    });

    afterEach(() => {
      deprecationWarningConfig.enabled = originalEnabled;
      deprecationWarningConfig.handler = originalHandler;
    });

    test('uses custom context in warning message', () => {
      normalizeDeprecatedStockPlanFields({ stock_class_id: 'sc-1' }, 'stockPlan.create');

      expect(warningHandler).toHaveBeenCalledWith(expect.stringContaining('stockPlan.create'), expect.anything());
    });

    test('uses default context when not specified', () => {
      normalizeDeprecatedStockPlanFields({ stock_class_id: 'sc-1' });

      expect(warningHandler).toHaveBeenCalledWith(expect.stringContaining('StockPlan'), expect.anything());
    });
  });
});

describe('checkStockPlanDeprecatedFieldUsage', () => {
  test('detects deprecated stock_class_id usage', () => {
    const result = checkStockPlanDeprecatedFieldUsage({
      stock_class_id: 'sc-1',
    });

    expect(result.hasDeprecatedFields).toBe(true);
    expect(result.deprecatedFieldsUsed).toEqual(['stock_class_id']);
  });

  test('reports no deprecated fields when only stock_class_ids is used', () => {
    const result = checkStockPlanDeprecatedFieldUsage({
      stock_class_ids: ['sc-1', 'sc-2'],
    });

    expect(result.hasDeprecatedFields).toBe(false);
    expect(result.deprecatedFieldsUsed).toEqual([]);
  });

  test('detects deprecated field even when modern field is also present', () => {
    const result = checkStockPlanDeprecatedFieldUsage({
      stock_class_id: 'deprecated-sc',
      stock_class_ids: ['current-sc'],
    });

    expect(result.hasDeprecatedFields).toBe(true);
    expect(result.deprecatedFieldsUsed).toEqual(['stock_class_id']);
  });

  test('reports no deprecated fields when data is empty', () => {
    const result = checkStockPlanDeprecatedFieldUsage({});

    expect(result.hasDeprecatedFields).toBe(false);
    expect(result.deprecatedFieldsUsed).toEqual([]);
  });

  test('ignores null values', () => {
    const result = checkStockPlanDeprecatedFieldUsage({
      stock_class_id: null as unknown as string,
    });

    expect(result.hasDeprecatedFields).toBe(false);
    expect(result.deprecatedFieldsUsed).toEqual([]);
  });
});

describe('checkDeprecatedFields', () => {
  test('checks for known deprecated fields in StockPlan', () => {
    const result = checkDeprecatedFields('StockPlan', {
      stock_class_id: 'sc-1',
      plan_name: 'Test Plan',
    });

    expect(result.hasDeprecatedFields).toBe(true);
    expect(result.deprecatedFieldsUsed).toEqual(['stock_class_id']);
  });

  test('returns empty for unknown object types', () => {
    const result = checkDeprecatedFields('UnknownType', {
      some_field: 'value',
    });

    expect(result.hasDeprecatedFields).toBe(false);
    expect(result.deprecatedFieldsUsed).toEqual([]);
  });

  test('returns empty when no deprecated fields are used', () => {
    const result = checkDeprecatedFields('StockPlan', {
      stock_class_ids: ['sc-1'],
      plan_name: 'Test Plan',
    });

    expect(result.hasDeprecatedFields).toBe(false);
    expect(result.deprecatedFieldsUsed).toEqual([]);
  });
});

describe('getDeprecatedFieldMappings', () => {
  test('returns mappings for StockPlan', () => {
    const mappings = getDeprecatedFieldMappings('StockPlan');

    expect(mappings).toHaveLength(1);
    expect(mappings[0]).toEqual({
      deprecatedField: 'stock_class_id',
      replacementField: 'stock_class_ids',
      deprecationType: 'singular_to_array',
    });
  });

  test('returns empty array for unknown object types', () => {
    const mappings = getDeprecatedFieldMappings('UnknownType');

    expect(mappings).toEqual([]);
  });
});

describe('getFieldDeprecation', () => {
  test('returns deprecation info for known deprecated field', () => {
    const deprecation = getFieldDeprecation('StockPlan', 'stock_class_id');

    expect(deprecation).toEqual({
      deprecatedField: 'stock_class_id',
      replacementField: 'stock_class_ids',
      deprecationType: 'singular_to_array',
    });
  });

  test('returns undefined for non-deprecated field', () => {
    const deprecation = getFieldDeprecation('StockPlan', 'plan_name');

    expect(deprecation).toBeUndefined();
  });

  test('returns undefined for unknown object type', () => {
    const deprecation = getFieldDeprecation('UnknownType', 'some_field');

    expect(deprecation).toBeUndefined();
  });
});

describe('emitDeprecationWarning', () => {
  let warningHandler: jest.Mock;
  let consoleWarnSpy: jest.SpyInstance;
  let originalEnabled: boolean;
  let originalHandler: ((message: string, details: DeprecationDetails) => void) | undefined;

  beforeEach(() => {
    originalEnabled = deprecationWarningConfig.enabled;
    originalHandler = deprecationWarningConfig.handler;
    warningHandler = jest.fn();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    deprecationWarningConfig.enabled = originalEnabled;
    deprecationWarningConfig.handler = originalHandler;
    consoleWarnSpy.mockRestore();
  });

  test('emits warning via custom handler when configured', () => {
    deprecationWarningConfig.enabled = true;
    deprecationWarningConfig.handler = warningHandler;

    const details: DeprecationDetails = {
      deprecatedField: 'old_field',
      replacementField: 'new_field',
      deprecatedValue: 'test-value',
    };

    emitDeprecationWarning(details);

    expect(warningHandler).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  test('emits warning via console.warn when no custom handler', () => {
    deprecationWarningConfig.enabled = true;
    deprecationWarningConfig.handler = undefined;

    emitDeprecationWarning({
      deprecatedField: 'old_field',
      replacementField: 'new_field',
      deprecatedValue: 'test-value',
    });

    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Field 'old_field' is deprecated"));
  });

  test('does not emit warning when disabled', () => {
    deprecationWarningConfig.enabled = false;
    deprecationWarningConfig.handler = warningHandler;

    emitDeprecationWarning({
      deprecatedField: 'old_field',
      replacementField: 'new_field',
      deprecatedValue: 'test-value',
    });

    expect(warningHandler).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  test('includes context in warning message when provided', () => {
    deprecationWarningConfig.enabled = true;
    deprecationWarningConfig.handler = undefined;

    emitDeprecationWarning({
      deprecatedField: 'old_field',
      replacementField: 'new_field',
      deprecatedValue: 'test-value',
      context: 'TestContext',
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Context: TestContext'));
  });
});
