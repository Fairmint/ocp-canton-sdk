/** Unit tests for deprecated OCF field normalization utilities. */

import {
  assertNoDeprecatedFields,
  checkDeprecatedFields,
  checkDeprecatedFieldsBatch,
  checkDeprecatedFieldsForType,
  checkStockPlanDeprecatedFieldUsage,
  createDeprecatedFieldsValidator,
  deprecationWarningConfig,
  emitDeprecationWarning,
  generateDeprecationReport,
  getAllDeprecatedFieldMappings,
  getDeprecatedFieldMappings,
  getFieldDeprecation,
  getRegisteredObjectTypes,
  migrateStockPlanFields,
  migrateStockPlanFieldsBatch,
  normalizeDeprecatedStockPlanFields,
  normalizeSingularToArray,
  OCF_DEPRECATED_FIELDS,
  registerDeprecatedFieldMapping,
  validateDeprecatedFields,
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

// ===== Batch Verification Tests =====

describe('checkDeprecatedFieldsBatch', () => {
  test('returns aggregated results for multiple items', () => {
    const items = [
      { objectType: 'StockPlan', data: { stock_class_id: 'sc-1', plan_name: 'Plan A' }, id: 'plan-1' },
      { objectType: 'StockPlan', data: { stock_class_ids: ['sc-2'], plan_name: 'Plan B' }, id: 'plan-2' },
      { objectType: 'StockPlan', data: { stock_class_id: 'sc-3', plan_name: 'Plan C' }, id: 'plan-3' },
    ];

    const result = checkDeprecatedFieldsBatch(items);

    expect(result.totalChecked).toBe(3);
    expect(result.objectsWithDeprecatedFields).toBe(2);
    expect(result.objectsWithoutDeprecatedFields).toBe(1);
    expect(result.hasDeprecatedFields).toBe(true);
    expect(result.deprecatedFieldSummary).toEqual({ stock_class_id: 2 });
    expect(result.objectTypeSummary.StockPlan).toEqual({ total: 3, withDeprecated: 2 });
  });

  test('handles empty items array', () => {
    const result = checkDeprecatedFieldsBatch([]);

    expect(result.totalChecked).toBe(0);
    expect(result.objectsWithDeprecatedFields).toBe(0);
    expect(result.hasDeprecatedFields).toBe(false);
    expect(result.itemsWithDeprecatedFields).toEqual([]);
  });

  test('uses index-based id when id not provided', () => {
    const items = [{ objectType: 'StockPlan', data: { stock_class_id: 'sc-1' } }];

    const result = checkDeprecatedFieldsBatch(items);

    expect(result.itemsWithDeprecatedFields[0].itemId).toBe('index:0');
  });

  test('handles multiple object types', () => {
    const items = [
      { objectType: 'StockPlan', data: { stock_class_id: 'sc-1' }, id: 'plan-1' },
      { objectType: 'OtherType', data: { some_field: 'value' }, id: 'other-1' },
    ];

    const result = checkDeprecatedFieldsBatch(items);

    expect(result.objectTypeSummary.StockPlan).toEqual({ total: 1, withDeprecated: 1 });
    expect(result.objectTypeSummary.OtherType).toEqual({ total: 1, withDeprecated: 0 });
  });
});

describe('checkDeprecatedFieldsForType', () => {
  test('checks all items as the same object type', () => {
    const stockPlans = [
      { id: 'plan-1', stock_class_id: 'sc-1', plan_name: 'Plan A' },
      { id: 'plan-2', stock_class_ids: ['sc-2'], plan_name: 'Plan B' },
    ];

    const result = checkDeprecatedFieldsForType('StockPlan', stockPlans);

    expect(result.totalChecked).toBe(2);
    expect(result.objectsWithDeprecatedFields).toBe(1);
    expect(result.objectTypeSummary.StockPlan).toEqual({ total: 2, withDeprecated: 1 });
  });

  test('uses item id when available', () => {
    const stockPlans = [{ id: 'plan-1', stock_class_id: 'sc-1' }];

    const result = checkDeprecatedFieldsForType('StockPlan', stockPlans);

    expect(result.itemsWithDeprecatedFields[0].itemId).toBe('plan-1');
  });

  test('falls back to index when id not available', () => {
    const stockPlans = [{ stock_class_id: 'sc-1' }];

    const result = checkDeprecatedFieldsForType('StockPlan', stockPlans);

    expect(result.itemsWithDeprecatedFields[0].itemId).toBe('index:0');
  });
});

// ===== Data Migration Tests =====

describe('migrateStockPlanFields', () => {
  test('migrates deprecated stock_class_id to stock_class_ids', () => {
    const result = migrateStockPlanFields({
      id: 'plan-1',
      stock_class_id: 'sc-1',
      plan_name: 'Equity Plan',
    });

    expect(result.data.stock_class_ids).toEqual(['sc-1']);
    expect(result.data).not.toHaveProperty('stock_class_id');
    expect(result.migrated).toBe(true);
    expect(result.migratedFields).toEqual(['stock_class_id']);
    expect(result.warnings).toEqual([]);
  });

  test('preserves stock_class_ids when already using current format', () => {
    const result = migrateStockPlanFields({
      id: 'plan-1',
      stock_class_ids: ['sc-1', 'sc-2'],
      plan_name: 'Equity Plan',
    });

    expect(result.data.stock_class_ids).toEqual(['sc-1', 'sc-2']);
    expect(result.migrated).toBe(false);
    expect(result.migratedFields).toEqual([]);
  });

  test('warns when both deprecated and current fields are present', () => {
    const result = migrateStockPlanFields({
      id: 'plan-1',
      stock_class_id: 'sc-deprecated',
      stock_class_ids: ['sc-current'],
      plan_name: 'Equity Plan',
    });

    expect(result.data.stock_class_ids).toEqual(['sc-current']);
    expect(result.migrated).toBe(false);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain('Both');
  });

  test('handles empty data', () => {
    const result = migrateStockPlanFields({});

    expect(result.data.stock_class_ids).toEqual([]);
    expect(result.migrated).toBe(false);
    expect(result.migratedFields).toEqual([]);
  });
});

describe('migrateStockPlanFieldsBatch', () => {
  test('migrates multiple items', () => {
    const plans = [
      { id: 'plan-1', stock_class_id: 'sc-1' },
      { id: 'plan-2', stock_class_ids: ['sc-2'] },
      { id: 'plan-3', stock_class_id: 'sc-3' },
    ];

    const result = migrateStockPlanFieldsBatch(plans);

    expect(result.totalProcessed).toBe(3);
    expect(result.itemsMigrated).toBe(2);
    expect(result.migratedFieldsSummary).toEqual({ stock_class_id: 2 });
    expect(result.items[0].migrated).toBe(true);
    expect(result.items[1].migrated).toBe(false);
    expect(result.items[2].migrated).toBe(true);
  });

  test('tracks items with warnings', () => {
    const plans = [
      { id: 'plan-1', stock_class_id: 'sc-1', stock_class_ids: ['sc-2'] }, // Has warning
      { id: 'plan-2', stock_class_ids: ['sc-3'] }, // No warning
    ];

    const result = migrateStockPlanFieldsBatch(plans);

    expect(result.itemsWithWarnings).toBe(1);
  });

  test('handles empty array', () => {
    const result = migrateStockPlanFieldsBatch([]);

    expect(result.totalProcessed).toBe(0);
    expect(result.itemsMigrated).toBe(0);
    expect(result.items).toEqual([]);
  });
});

// ===== Deprecation Report Tests =====

describe('generateDeprecationReport', () => {
  test('generates comprehensive report from batch results', () => {
    const items = [
      { objectType: 'StockPlan', data: { stock_class_id: 'sc-1' }, id: 'plan-1' },
      { objectType: 'StockPlan', data: { stock_class_ids: ['sc-2'] }, id: 'plan-2' },
    ];
    const batchResult = checkDeprecatedFieldsBatch(items);

    const report = generateDeprecationReport(batchResult);

    expect(report.summary.totalObjects).toBe(2);
    expect(report.summary.objectsWithDeprecatedFields).toBe(1);
    expect(report.summary.deprecationPercentage).toBe(50);
    expect(report.summary.totalDeprecatedFieldUsages).toBe(1);
    expect(report.byObjectType.StockPlan).toBeDefined();
    expect(report.byObjectType.StockPlan.total).toBe(2);
    expect(report.byObjectType.StockPlan.withDeprecatedFields).toBe(1);
    expect(report.byField.stock_class_id).toBeDefined();
    expect(report.byField.stock_class_id.totalUsages).toBe(1);
    expect(report.byField.stock_class_id.replacementField).toBe('stock_class_ids');
    expect(report.generatedAt).toBeDefined();
  });

  test('includes affected items when requested', () => {
    const items = [{ objectType: 'StockPlan', data: { stock_class_id: 'sc-1' }, id: 'plan-1' }];
    const batchResult = checkDeprecatedFieldsBatch(items);

    const report = generateDeprecationReport(batchResult, { includeAffectedItems: true });

    expect(report.affectedItems).toBeDefined();
    expect(report.affectedItems?.length).toBe(1);
    expect(report.affectedItems?.[0].itemId).toBe('plan-1');
  });

  test('limits affected items to maxAffectedItems', () => {
    const items = Array.from({ length: 200 }, (_, i) => ({
      objectType: 'StockPlan',
      data: { stock_class_id: `sc-${i}` },
      id: `plan-${i}`,
    }));
    const batchResult = checkDeprecatedFieldsBatch(items);

    const report = generateDeprecationReport(batchResult, {
      includeAffectedItems: true,
      maxAffectedItems: 50,
    });

    expect(report.affectedItems?.length).toBe(50);
  });

  test('handles empty batch result', () => {
    const batchResult = checkDeprecatedFieldsBatch([]);

    const report = generateDeprecationReport(batchResult);

    expect(report.summary.totalObjects).toBe(0);
    expect(report.summary.deprecationPercentage).toBe(0);
    expect(Object.keys(report.byObjectType)).toEqual([]);
    expect(Object.keys(report.byField)).toEqual([]);
  });
});

// ===== Validation Pipeline Tests =====

describe('validateDeprecatedFields', () => {
  test('returns warnings by default for deprecated field usage', () => {
    const result = validateDeprecatedFields('StockPlan', { stock_class_id: 'sc-1' });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain("Field 'stock_class_id' is deprecated");
  });

  test('returns errors when treatAsError is true', () => {
    const result = validateDeprecatedFields('StockPlan', { stock_class_id: 'sc-1' }, { treatAsError: true });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.warnings).toEqual([]);
  });

  test('ignores specified fields', () => {
    const result = validateDeprecatedFields(
      'StockPlan',
      { stock_class_id: 'sc-1' },
      { ignoreFields: ['stock_class_id'] }
    );

    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.checkResult.deprecatedFieldsUsed).toEqual([]);
  });

  test('uses custom error message prefix', () => {
    const result = validateDeprecatedFields(
      'StockPlan',
      { stock_class_id: 'sc-1' },
      { errorMessagePrefix: 'Stock Plan Validation' }
    );

    expect(result.warnings[0]).toContain('Stock Plan Validation:');
  });

  test('returns valid for objects without deprecated fields', () => {
    const result = validateDeprecatedFields('StockPlan', { stock_class_ids: ['sc-1'] });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

describe('createDeprecatedFieldsValidator', () => {
  test('creates reusable validator function', () => {
    const validator = createDeprecatedFieldsValidator('StockPlan');

    const result1 = validator({ stock_class_id: 'sc-1' });
    const result2 = validator({ stock_class_ids: ['sc-2'] });

    expect(result1.warnings.length).toBe(1);
    expect(result2.warnings.length).toBe(0);
  });

  test('respects options passed during creation', () => {
    const validator = createDeprecatedFieldsValidator('StockPlan', { treatAsError: true });

    const result = validator({ stock_class_id: 'sc-1' });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
  });
});

describe('assertNoDeprecatedFields', () => {
  test('throws error when deprecated fields are detected', () => {
    expect(() => {
      assertNoDeprecatedFields('StockPlan', { stock_class_id: 'sc-1' });
    }).toThrow('Deprecated field usage detected');
  });

  test('does not throw when no deprecated fields are present', () => {
    expect(() => {
      assertNoDeprecatedFields('StockPlan', { stock_class_ids: ['sc-1'] });
    }).not.toThrow();
  });

  test('respects ignoreFields option', () => {
    expect(() => {
      assertNoDeprecatedFields('StockPlan', { stock_class_id: 'sc-1' }, { ignoreFields: ['stock_class_id'] });
    }).not.toThrow();
  });
});

// ===== Registry Management Tests =====

describe('registerDeprecatedFieldMapping', () => {
  // Store original mappings to restore after tests
  let originalMappings: Record<string, unknown[]>;

  beforeEach(() => {
    // Save current state
    originalMappings = JSON.parse(JSON.stringify(OCF_DEPRECATED_FIELDS));
  });

  afterEach(() => {
    // Restore original state
    for (const key of Object.keys(OCF_DEPRECATED_FIELDS)) {
      delete OCF_DEPRECATED_FIELDS[key];
    }
    for (const [key, value] of Object.entries(originalMappings)) {
      OCF_DEPRECATED_FIELDS[key] = value as (typeof OCF_DEPRECATED_FIELDS)[string];
    }
  });

  test('registers new mapping for new object type', () => {
    registerDeprecatedFieldMapping('NewType', {
      deprecatedField: 'old_field',
      replacementField: 'new_field',
      deprecationType: 'renamed',
    });

    const mappings = getDeprecatedFieldMappings('NewType');
    expect(mappings.length).toBe(1);
    expect(mappings[0].deprecatedField).toBe('old_field');
  });

  test('registers new mapping for existing object type', () => {
    const originalLength = getDeprecatedFieldMappings('StockPlan').length;

    registerDeprecatedFieldMapping('StockPlan', {
      deprecatedField: 'another_old_field',
      replacementField: 'another_new_field',
      deprecationType: 'renamed',
    });

    const mappings = getDeprecatedFieldMappings('StockPlan');
    expect(mappings.length).toBe(originalLength + 1);
  });

  test('does not duplicate existing mapping', () => {
    const originalLength = getDeprecatedFieldMappings('StockPlan').length;

    registerDeprecatedFieldMapping('StockPlan', {
      deprecatedField: 'stock_class_id', // Already exists
      replacementField: 'stock_class_ids',
      deprecationType: 'singular_to_array',
    });

    const mappings = getDeprecatedFieldMappings('StockPlan');
    expect(mappings.length).toBe(originalLength);
  });
});

describe('getRegisteredObjectTypes', () => {
  test('returns array of object types with registered mappings', () => {
    const types = getRegisteredObjectTypes();

    expect(types).toContain('StockPlan');
    expect(Array.isArray(types)).toBe(true);
  });
});

describe('getAllDeprecatedFieldMappings', () => {
  test('returns copy of all mappings', () => {
    const allMappings = getAllDeprecatedFieldMappings();

    expect(allMappings.StockPlan).toBeDefined();
    expect(allMappings.StockPlan.length).toBeGreaterThan(0);

    // Verify it's a copy by modifying and checking original
    allMappings.StockPlan.push({
      deprecatedField: 'test',
      replacementField: 'test2',
      deprecationType: 'renamed',
    });

    const originalMappings = getDeprecatedFieldMappings('StockPlan');
    expect(originalMappings.find((m) => m.deprecatedField === 'test')).toBeUndefined();
  });
});
