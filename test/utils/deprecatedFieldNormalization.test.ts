/** Unit tests for deprecated OCF field normalization utilities. */

import {
  areOcfObjectsEquivalent,
  assertNoDeprecatedFields,
  checkDeprecatedFields,
  checkDeprecatedFieldsBatch,
  checkDeprecatedFieldsForType,
  checkEquityCompensationIssuanceDeprecatedFieldUsage,
  checkStakeholderDeprecatedFieldUsage,
  checkStockPlanDeprecatedFieldUsage,
  compareOcfObjects,
  convertOptionGrantTypeToCompensationType,
  createDeprecatedFieldsValidator,
  deprecationWarningConfig,
  emitDeprecationWarning,
  generateDeprecationReport,
  getAllDeprecatedFieldMappings,
  getDeprecatedFieldMappings,
  getFieldDeprecation,
  getRegisteredObjectTypes,
  hasDeprecationsForEntityType,
  migrateEquityCompensationIssuanceFields,
  migrateEquityCompensationIssuanceFieldsBatch,
  migrateStakeholderFields,
  migrateStakeholderFieldsBatch,
  migrateStockPlanFields,
  migrateStockPlanFieldsBatch,
  normalizeDeprecatedEquityCompensationIssuanceFields,
  normalizeDeprecatedOcfFields,
  normalizeDeprecatedStakeholderFields,
  normalizeDeprecatedStockPlanFields,
  normalizeOcfObject,
  normalizeSingularToArray,
  OCF_DEPRECATED_FIELDS,
  OPTION_GRANT_TYPE_TO_COMPENSATION_TYPE,
  registerDeprecatedFieldMapping,
  registerEntityTypeMapping,
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

// ===== Automatic Normalization Tests =====

describe('normalizeDeprecatedOcfFields', () => {
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

  describe('stockPlan normalization', () => {
    test('automatically converts deprecated stock_class_id to stock_class_ids', () => {
      const result = normalizeDeprecatedOcfFields('stockPlan', {
        id: 'plan-1',
        stock_class_id: 'sc-1',
        plan_name: 'Equity Plan',
      });

      expect(result.normalized).toBe(true);
      expect(result.normalizedFields).toEqual(['stock_class_id']);
      expect((result.data as Record<string, unknown>).stock_class_ids).toEqual(['sc-1']);
      expect((result.data as Record<string, unknown>).stock_class_id).toBeUndefined();
    });

    test('preserves stock_class_ids when already present', () => {
      const result = normalizeDeprecatedOcfFields('stockPlan', {
        id: 'plan-1',
        stock_class_ids: ['sc-1', 'sc-2'],
        plan_name: 'Equity Plan',
      });

      expect(result.normalized).toBe(false);
      expect((result.data as Record<string, unknown>).stock_class_ids).toEqual(['sc-1', 'sc-2']);
    });

    test('warns and uses current field when both are present', () => {
      const result = normalizeDeprecatedOcfFields('stockPlan', {
        id: 'plan-1',
        stock_class_id: 'deprecated-sc',
        stock_class_ids: ['current-sc'],
        plan_name: 'Equity Plan',
      });

      expect(result.normalized).toBe(false);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]).toContain('Both');
      expect((result.data as Record<string, unknown>).stock_class_ids).toEqual(['current-sc']);
    });

    test('emits deprecation warning when converting deprecated field', () => {
      normalizeDeprecatedOcfFields('stockPlan', {
        id: 'plan-1',
        stock_class_id: 'sc-1',
      });

      expect(warningHandler).toHaveBeenCalledWith(
        expect.stringContaining("Field 'stock_class_id' is deprecated"),
        expect.anything()
      );
    });

    test('can suppress warnings when emitWarnings is false', () => {
      normalizeDeprecatedOcfFields(
        'stockPlan',
        {
          id: 'plan-1',
          stock_class_id: 'sc-1',
        },
        { emitWarnings: false }
      );

      expect(warningHandler).not.toHaveBeenCalled();
    });
  });

  describe('unknown entity types', () => {
    test('returns data unchanged for unknown entity types', () => {
      const data = { id: 'test', some_field: 'value' };
      const result = normalizeDeprecatedOcfFields('unknownType', data);

      expect(result.normalized).toBe(false);
      expect(result.data).toEqual(data);
      expect(result.normalizedFields).toEqual([]);
    });

    test('returns data unchanged for entity types without deprecations', () => {
      const data = { id: 'test', name: 'Test Stakeholder' };
      const result = normalizeDeprecatedOcfFields('stakeholder', data);

      expect(result.normalized).toBe(false);
      expect(result.data).toEqual(data);
    });
  });
});

describe('hasDeprecationsForEntityType', () => {
  test('returns true for entity types with registered deprecations', () => {
    expect(hasDeprecationsForEntityType('stockPlan')).toBe(true);
    expect(hasDeprecationsForEntityType('stakeholder')).toBe(true);
    expect(hasDeprecationsForEntityType('equityCompensationIssuance')).toBe(true);
  });

  test('returns false for entity types without registered deprecations', () => {
    expect(hasDeprecationsForEntityType('unknownType')).toBe(false);
    expect(hasDeprecationsForEntityType('stockClass')).toBe(false);
  });
});

describe('registerEntityTypeMapping', () => {
  test('registers new entity type to object type mapping', () => {
    // Register a new mapping
    registerEntityTypeMapping('testEntity', 'StockPlan');

    // Should now recognize the entity type
    expect(hasDeprecationsForEntityType('testEntity')).toBe(true);
  });
});

// ===== Stakeholder Deprecation Tests =====

describe('normalizeDeprecatedStakeholderFields', () => {
  test('normalizes deprecated current_relationship to current_relationships array', () => {
    const result = normalizeDeprecatedStakeholderFields({ current_relationship: 'FOUNDER' });
    expect(result.current_relationships).toEqual(['FOUNDER']);
    expect(result.usedDeprecatedField).toBe(true);
  });

  test('returns current_relationships as-is when present', () => {
    const result = normalizeDeprecatedStakeholderFields({ current_relationships: ['FOUNDER', 'BOARD_MEMBER'] });
    expect(result.current_relationships).toEqual(['FOUNDER', 'BOARD_MEMBER']);
    expect(result.usedDeprecatedField).toBe(false);
  });

  test('prefers current_relationships over deprecated current_relationship', () => {
    const result = normalizeDeprecatedStakeholderFields({
      current_relationship: 'DEPRECATED',
      current_relationships: ['EMPLOYEE'],
    });
    expect(result.current_relationships).toEqual(['EMPLOYEE']);
    expect(result.usedDeprecatedField).toBe(false);
  });
});

describe('checkStakeholderDeprecatedFieldUsage', () => {
  test('detects deprecated current_relationship usage', () => {
    const result = checkStakeholderDeprecatedFieldUsage({ current_relationship: 'FOUNDER' });
    expect(result.hasDeprecatedFields).toBe(true);
    expect(result.deprecatedFieldsUsed).toEqual(['current_relationship']);
  });
});

describe('migrateStakeholderFields', () => {
  test('migrates deprecated current_relationship to current_relationships', () => {
    const result = migrateStakeholderFields({ id: 'sh-1', current_relationship: 'FOUNDER' });
    expect(result.data.current_relationships).toEqual(['FOUNDER']);
    expect(result.data).not.toHaveProperty('current_relationship');
    expect(result.migrated).toBe(true);
  });
});

describe('migrateStakeholderFieldsBatch', () => {
  test('migrates multiple items', () => {
    const stakeholders = [
      { id: 'sh-1', current_relationship: 'FOUNDER' },
      { id: 'sh-2', current_relationships: ['EMPLOYEE'] },
      { id: 'sh-3', current_relationship: 'ADVISOR' },
    ];
    const result = migrateStakeholderFieldsBatch(stakeholders);
    expect(result.totalProcessed).toBe(3);
    expect(result.itemsMigrated).toBe(2);
    expect(result.migratedFieldsSummary).toEqual({ current_relationship: 2 });
    expect(result.items[0].migrated).toBe(true);
    expect(result.items[1].migrated).toBe(false);
    expect(result.items[2].migrated).toBe(true);
  });

  test('tracks items with warnings when both fields present', () => {
    const stakeholders = [{ id: 'sh-1', current_relationship: 'DEPRECATED', current_relationships: ['CURRENT'] }];
    const result = migrateStakeholderFieldsBatch(stakeholders);
    expect(result.itemsWithWarnings).toBe(1);
    expect(result.items[0].warnings.length).toBe(1);
  });
});

// ===== Equity Compensation Issuance Deprecation Tests =====

describe('OPTION_GRANT_TYPE_TO_COMPENSATION_TYPE', () => {
  test('contains correct value mappings', () => {
    expect(OPTION_GRANT_TYPE_TO_COMPENSATION_TYPE).toEqual({ NSO: 'OPTION_NSO', ISO: 'OPTION_ISO', INTL: 'OPTION' });
  });
});

describe('convertOptionGrantTypeToCompensationType', () => {
  test('converts NSO to OPTION_NSO', () => {
    expect(convertOptionGrantTypeToCompensationType('NSO')).toBe('OPTION_NSO');
  });

  test('converts ISO to OPTION_ISO', () => {
    expect(convertOptionGrantTypeToCompensationType('ISO')).toBe('OPTION_ISO');
  });

  test('converts INTL to OPTION', () => {
    expect(convertOptionGrantTypeToCompensationType('INTL')).toBe('OPTION');
  });

  test('returns original value if no mapping exists', () => {
    expect(convertOptionGrantTypeToCompensationType('RSU')).toBe('RSU');
  });
});

describe('normalizeDeprecatedEquityCompensationIssuanceFields', () => {
  test('converts deprecated option_grant_type NSO to compensation_type OPTION_NSO', () => {
    const result = normalizeDeprecatedEquityCompensationIssuanceFields({ option_grant_type: 'NSO' });
    expect(result.compensation_type).toBe('OPTION_NSO');
    expect(result.usedDeprecatedField).toBe(true);
  });

  test('returns compensation_type as-is when present', () => {
    const result = normalizeDeprecatedEquityCompensationIssuanceFields({ compensation_type: 'RSU' });
    expect(result.compensation_type).toBe('RSU');
    expect(result.usedDeprecatedField).toBe(false);
  });

  test('prefers compensation_type over deprecated option_grant_type', () => {
    const result = normalizeDeprecatedEquityCompensationIssuanceFields({
      option_grant_type: 'NSO',
      compensation_type: 'RSU',
    });
    expect(result.compensation_type).toBe('RSU');
    expect(result.usedDeprecatedField).toBe(false);
  });
});

describe('checkEquityCompensationIssuanceDeprecatedFieldUsage', () => {
  test('detects deprecated option_grant_type usage', () => {
    const result = checkEquityCompensationIssuanceDeprecatedFieldUsage({ option_grant_type: 'NSO' });
    expect(result.hasDeprecatedFields).toBe(true);
    expect(result.deprecatedFieldsUsed).toEqual(['option_grant_type']);
  });
});

describe('migrateEquityCompensationIssuanceFields', () => {
  test('migrates deprecated option_grant_type to compensation_type with value conversion', () => {
    const result = migrateEquityCompensationIssuanceFields({ id: 'eci-1', option_grant_type: 'NSO' });
    expect(result.data.compensation_type).toBe('OPTION_NSO');
    expect(result.data).not.toHaveProperty('option_grant_type');
    expect(result.migrated).toBe(true);
  });
});

describe('migrateEquityCompensationIssuanceFieldsBatch', () => {
  test('migrates multiple items', () => {
    const issuances = [
      { id: 'eci-1', option_grant_type: 'NSO' },
      { id: 'eci-2', compensation_type: 'RSU' },
      { id: 'eci-3', option_grant_type: 'ISO' },
    ];
    const result = migrateEquityCompensationIssuanceFieldsBatch(issuances);
    expect(result.totalProcessed).toBe(3);
    expect(result.itemsMigrated).toBe(2);
    expect(result.migratedFieldsSummary).toEqual({ option_grant_type: 2 });
    expect(result.items[0].data.compensation_type).toBe('OPTION_NSO');
    expect(result.items[2].data.compensation_type).toBe('OPTION_ISO');
  });

  test('tracks items with warnings when both fields present', () => {
    const issuances = [{ id: 'eci-1', option_grant_type: 'NSO', compensation_type: 'RSU' }];
    const result = migrateEquityCompensationIssuanceFieldsBatch(issuances);
    expect(result.itemsWithWarnings).toBe(1);
    expect(result.items[0].warnings.length).toBe(1);
  });
});

// ===== Unified normalizeOcfObject Tests =====

describe('normalizeOcfObject', () => {
  test('normalizes TX_PLAN_SECURITY_ISSUANCE to TX_EQUITY_COMPENSATION_ISSUANCE', () => {
    const result = normalizeOcfObject({ object_type: 'TX_PLAN_SECURITY_ISSUANCE', id: 'test-1' });
    expect(result.data.object_type).toBe('TX_EQUITY_COMPENSATION_ISSUANCE');
    expect(result.normalized).toBe(true);
  });

  test('normalizes current_relationship for STAKEHOLDER', () => {
    const result = normalizeOcfObject({ object_type: 'STAKEHOLDER', id: 'sh-1', current_relationship: 'FOUNDER' });
    expect((result.data as Record<string, unknown>).current_relationships).toEqual(['FOUNDER']);
    expect(result.data).not.toHaveProperty('current_relationship');
  });

  test('normalizes option_grant_type for TX_EQUITY_COMPENSATION_ISSUANCE', () => {
    const result = normalizeOcfObject({
      object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
      id: 'eci-1',
      option_grant_type: 'NSO',
    });
    expect((result.data as Record<string, unknown>).compensation_type).toBe('OPTION_NSO');
    expect(result.data).not.toHaveProperty('option_grant_type');
  });

  test('normalizes both object_type and option_grant_type for TX_PLAN_SECURITY_ISSUANCE', () => {
    const result = normalizeOcfObject({
      object_type: 'TX_PLAN_SECURITY_ISSUANCE',
      id: 'eci-1',
      option_grant_type: 'ISO',
    });
    expect((result.data as Record<string, unknown>).object_type).toBe('TX_EQUITY_COMPENSATION_ISSUANCE');
    expect((result.data as Record<string, unknown>).compensation_type).toBe('OPTION_ISO');
    expect(result.data).not.toHaveProperty('option_grant_type');
    expect(result.normalizedFields).toContain('object_type');
    expect(result.normalizedFields).toContain('option_grant_type');
  });

  test('returns data unchanged for unknown object types', () => {
    const data = { object_type: 'UNKNOWN_TYPE', id: 'test-1' };
    const result = normalizeOcfObject(data);
    expect(result.normalized).toBe(false);
    expect(result.data).toEqual(data);
  });
});

// ===== OCF Equivalence Comparison Tests =====

describe('areOcfObjectsEquivalent', () => {
  test('returns true for identical objects', () => {
    const obj = { object_type: 'STAKEHOLDER', id: 'sh-1', name: 'Test' };
    expect(areOcfObjectsEquivalent(obj, { ...obj })).toBe(true);
  });

  test('returns false for different objects', () => {
    const obj1 = { object_type: 'STAKEHOLDER', id: 'sh-1', name: 'Test1' };
    const obj2 = { object_type: 'STAKEHOLDER', id: 'sh-1', name: 'Test2' };
    expect(areOcfObjectsEquivalent(obj1, obj2)).toBe(false);
  });

  test('treats deprecated current_relationship as equivalent to current_relationships', () => {
    const dbObject = { object_type: 'STAKEHOLDER', id: 'sh-1', current_relationship: 'FOUNDER' };
    const chainObject = { object_type: 'STAKEHOLDER', id: 'sh-1', current_relationships: ['FOUNDER'] };
    expect(areOcfObjectsEquivalent(dbObject, chainObject)).toBe(true);
  });

  test('treats deprecated option_grant_type as equivalent to compensation_type', () => {
    const dbObject = { object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE', id: 'eci-1', option_grant_type: 'NSO' };
    const chainObject = {
      object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
      id: 'eci-1',
      compensation_type: 'OPTION_NSO',
    };
    expect(areOcfObjectsEquivalent(dbObject, chainObject)).toBe(true);
  });

  test('treats TX_PLAN_SECURITY_ISSUANCE as equivalent to TX_EQUITY_COMPENSATION_ISSUANCE', () => {
    const dbObject = { object_type: 'TX_PLAN_SECURITY_ISSUANCE', id: 'eci-1', compensation_type: 'OPTION_NSO' };
    const chainObject = {
      object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
      id: 'eci-1',
      compensation_type: 'OPTION_NSO',
    };
    expect(areOcfObjectsEquivalent(dbObject, chainObject)).toBe(true);
  });

  test('skips normalization when normalizeBeforeCompare is false', () => {
    const dbObject = { object_type: 'STAKEHOLDER', id: 'sh-1', current_relationship: 'FOUNDER' };
    const chainObject = { object_type: 'STAKEHOLDER', id: 'sh-1', current_relationships: ['FOUNDER'] };
    expect(areOcfObjectsEquivalent(dbObject, chainObject, { normalizeBeforeCompare: false })).toBe(false);
  });
});

describe('compareOcfObjects', () => {
  test('returns detailed comparison result', () => {
    const dbObject = { object_type: 'STAKEHOLDER', id: 'sh-1', current_relationship: 'FOUNDER' };
    const chainObject = { object_type: 'STAKEHOLDER', id: 'sh-1', current_relationships: ['FOUNDER'] };

    const result = compareOcfObjects(dbObject, chainObject);

    expect(result.equivalent).toBe(true);
    expect(result.normalizationA.wasNormalized).toBe(true);
    expect(result.normalizationA.normalizedFields).toContain('current_relationship');
    expect(result.normalizationB.wasNormalized).toBe(false);
  });
});
