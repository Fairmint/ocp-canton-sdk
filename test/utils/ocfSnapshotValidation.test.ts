import fs from 'fs';
import path from 'path';
import {
  OCF_OBJECT_SCHEMA_PATHS,
  OCF_OBJECT_TYPE_TO_ENTITY_TYPE,
  OCF_SCHEMA_ONLY_OBJECT_TYPES,
  getOcfObjectTypeCapability,
  getOcfSchema,
  validateOcfCapTableSnapshot as validateOcfCapTableSnapshotRuntime,
  type OcfCapTableSnapshotValidationResult,
  type OcfSecurityFamily,
} from '../../src';
import convertibleIssuanceFixture from '../fixtures/createOcf/TX_CONVERTIBLE_ISSUANCE-fb3ddea3-2642-41d7-abae-8c5dc63a4103.json';
import warrantIssuanceFixture from '../fixtures/createOcf/TX_WARRANT_ISSUANCE-22b896cb-92df-4fd8-9e52-d0d4112b3f98.json';
import convertibleConversionFixture from '../fixtures/production/convertibleConversion.json';
import equityCompensationIssuanceFixture from '../fixtures/production/equityCompensationIssuance/rsu.json';
import orphanedStockIssuanceSnapshot from '../fixtures/synthetic/orphanedStockIssuanceSnapshot.json';

const orphanedSnapshot = orphanedStockIssuanceSnapshot as OcfCapTableSnapshotObject[];

type OcfCapTableSnapshotObject = Readonly<{
  id: string;
  object_type: string;
  [field: string]: unknown;
}>;

type MutableSnapshotObject = Record<string, unknown> & { id: string; object_type: string };

const DEFAULT_STAKEHOLDER_ID = '__snapshot-test-stakeholder';
const DEFAULT_STOCK_CLASS_ID = '__snapshot-test-stock-class';
const DEFAULT_STOCK_PLAN_ID = '__snapshot-test-stock-plan';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepFreezeValue<Value>(value: Value): Value {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(deepFreezeValue);
    Object.freeze(value);
  }
  return value;
}

function collectFixtureObjects(value: unknown, result: Array<Record<string, unknown>>): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectFixtureObjects(item, result));
    return;
  }
  if (!isRecord(value)) return;
  if (typeof value.object_type === 'string') result.push(value);
  Object.values(value).forEach((item) => collectFixtureObjects(item, result));
}

function fixtureFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return fixtureFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.json') ? [entryPath] : [];
  });
}

function buildFixtureBaselines(): Map<string, Record<string, unknown>> {
  const candidates: Array<Record<string, unknown>> = [];
  for (const fixturePath of fixtureFiles(path.resolve(__dirname, '../fixtures'))) {
    collectFixtureObjects(JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as unknown, candidates);
  }

  const result = new Map<string, Record<string, unknown>>();
  for (const candidate of candidates) {
    const objectType = candidate.object_type;
    if (typeof objectType !== 'string' || result.has(objectType)) continue;
    try {
      if (getOcfSchema(objectType).safeParse(candidate).success) result.set(objectType, candidate);
    } catch {
      // Fixture discovery intentionally ignores non-top-level and unsupported objects.
    }
  }
  result.set('FINANCING', {
    object_type: 'FINANCING',
    id: '__snapshot-test-financing',
    name: 'Snapshot test financing',
    date: '2025-01-01',
    issuance_ids: ['__snapshot-test-financing-issuance'],
  });
  return result;
}

const FIXTURE_BASELINES = buildFixtureBaselines();

function mergeFixtureDefaults(defaults: unknown, value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => mergeFixtureDefaults(undefined, item));
  }
  if (!isRecord(value)) return value;
  const defaultRecord = isRecord(defaults) ? defaults : {};
  const result: Record<string, unknown> = {};
  for (const [key, defaultValue] of Object.entries(defaultRecord)) {
    result[key] = Object.prototype.hasOwnProperty.call(value, key)
      ? mergeFixtureDefaults(defaultValue, value[key])
      : mergeFixtureDefaults(undefined, defaultValue);
  }
  for (const [key, item] of Object.entries(value)) {
    if (!Object.prototype.hasOwnProperty.call(defaultRecord, key)) result[key] = mergeFixtureDefaults(undefined, item);
  }
  return result;
}

function clearInjectedConversionTargets(merged: unknown, original: unknown): void {
  if (Array.isArray(merged)) {
    merged.forEach((item, index) =>
      clearInjectedConversionTargets(item, Array.isArray(original) ? (original[index] ?? original[0]) : undefined)
    );
    return;
  }
  if (!isRecord(merged)) return;
  const originalRecord = isRecord(original) ? original : {};
  for (const [key, value] of Object.entries(merged)) {
    if (key === 'converts_to_stock_class_id' && !Object.prototype.hasOwnProperty.call(originalRecord, key)) {
      merged[key] = '';
      continue;
    }
    clearInjectedConversionTargets(value, originalRecord[key]);
  }
}

const STAKEHOLDER_REFERENCE_TYPES = new Set([
  'CE_STAKEHOLDER_RELATIONSHIP',
  'CE_STAKEHOLDER_STATUS',
  'TX_CONVERTIBLE_ISSUANCE',
  'TX_EQUITY_COMPENSATION_ISSUANCE',
  'TX_STOCK_ISSUANCE',
  'TX_WARRANT_ISSUANCE',
]);
const REQUIRED_STOCK_CLASS_REFERENCE_TYPES = new Set([
  'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
  'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
  'TX_STOCK_CLASS_SPLIT',
  'TX_STOCK_ISSUANCE',
  'VALUATION',
]);
const REQUIRED_STOCK_PLAN_REFERENCE_TYPES = new Set(['TX_STOCK_PLAN_POOL_ADJUSTMENT', 'TX_STOCK_PLAN_RETURN_TO_POOL']);

function hydrateSnapshotObject(input: OcfCapTableSnapshotObject, issuerId: string | undefined): MutableSnapshotObject {
  const baseline = FIXTURE_BASELINES.get(input.object_type);
  const merged = mergeFixtureDefaults(baseline, input) as MutableSnapshotObject;
  const hasOwn = (field: string): boolean => Object.prototype.hasOwnProperty.call(input, field);

  for (const field of ['conversion_triggers', 'exercise_triggers'] as const) {
    const inputTriggers = input[field];
    const baselineTriggers = baseline?.[field];
    if (!Array.isArray(inputTriggers) || !Array.isArray(baselineTriggers) || baselineTriggers.length === 0) continue;
    merged[field] = inputTriggers.map((trigger) =>
      isRecord(trigger) && typeof trigger.type !== 'string'
        ? mergeFixtureDefaults(baselineTriggers[0], trigger)
        : mergeFixtureDefaults(undefined, trigger)
    );
  }
  if (
    input.object_type === 'TX_CONVERTIBLE_ISSUANCE' &&
    Array.isArray(input.conversion_triggers) &&
    input.conversion_triggers.length === 0 &&
    Array.isArray(baseline?.conversion_triggers)
  ) {
    merged.conversion_triggers = baseline.conversion_triggers;
  }

  if (STAKEHOLDER_REFERENCE_TYPES.has(input.object_type) && !hasOwn('stakeholder_id')) {
    merged.stakeholder_id = DEFAULT_STAKEHOLDER_ID;
  }
  if (REQUIRED_STOCK_CLASS_REFERENCE_TYPES.has(input.object_type) && !hasOwn('stock_class_id')) {
    merged.stock_class_id = DEFAULT_STOCK_CLASS_ID;
  }
  if (REQUIRED_STOCK_PLAN_REFERENCE_TYPES.has(input.object_type) && !hasOwn('stock_plan_id')) {
    merged.stock_plan_id = DEFAULT_STOCK_PLAN_ID;
  }
  if (input.object_type === 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT' && !hasOwn('issuer_id')) {
    merged.issuer_id = issuerId ?? '__snapshot-test-issuer';
  }
  if (input.object_type === 'STOCK_PLAN' && !hasOwn('stock_class_id') && !hasOwn('stock_class_ids')) {
    delete merged.stock_class_id;
    merged.stock_class_ids = [DEFAULT_STOCK_CLASS_ID];
  }
  if (
    ['TX_STOCK_ISSUANCE', 'TX_EQUITY_COMPENSATION_ISSUANCE'].includes(input.object_type) &&
    !hasOwn('stock_plan_id')
  ) {
    delete merged.stock_plan_id;
  }
  if (input.object_type === 'TX_EQUITY_COMPENSATION_ISSUANCE' && !hasOwn('stock_class_id')) {
    delete merged.stock_class_id;
  }
  if (
    ['TX_STOCK_ISSUANCE', 'TX_EQUITY_COMPENSATION_ISSUANCE', 'TX_WARRANT_ISSUANCE'].includes(input.object_type) &&
    !hasOwn('vesting_terms_id')
  ) {
    delete merged.vesting_terms_id;
  }
  if (input.object_type === 'TX_STOCK_ISSUANCE' && !hasOwn('stock_legend_ids')) merged.stock_legend_ids = [];
  if (input.object_type === 'TX_STOCK_REISSUANCE' && !hasOwn('split_transaction_id')) {
    delete merged.split_transaction_id;
  }
  if (input.object_type === 'DOCUMENT' && !hasOwn('related_objects')) delete merged.related_objects;
  if (!hasOwn('balance_security_id')) delete merged.balance_security_id;

  if (input.object_type.startsWith('TX_') || input.object_type.startsWith('CE_')) {
    merged.date ??= '2025-01-01';
  }
  if (
    [
      'TX_CONVERTIBLE_RETRACTION',
      'TX_EQUITY_COMPENSATION_RETRACTION',
      'TX_STOCK_RETRACTION',
      'TX_WARRANT_RETRACTION',
    ].includes(input.object_type)
  ) {
    merged.reason_text ??= 'Snapshot test retraction';
  }
  if (input.object_type.endsWith('_CANCELLATION') && input.object_type !== 'TX_CONVERTIBLE_CANCELLATION') {
    merged.quantity ??= '1';
    merged.reason_text ??= 'Snapshot test cancellation';
  }
  if (input.object_type === 'TX_STOCK_CONVERSION') merged.quantity_converted ??= '1';
  if (input.object_type === 'TX_EQUITY_COMPENSATION_RELEASE') {
    merged.quantity ??= '1';
    merged.settlement_date ??= '2025-01-01';
    merged.release_price ??= { amount: '1', currency: 'USD' };
  }
  if (input.object_type === 'TX_STOCK_PLAN_RETURN_TO_POOL') {
    merged.quantity ??= '1';
    merged.reason_text ??= 'Snapshot test return';
  }
  if (
    input.object_type === 'VESTING_TERMS' &&
    Array.isArray(input.vesting_conditions) &&
    input.vesting_conditions.length === 0
  ) {
    const baselineConditions = FIXTURE_BASELINES.get('VESTING_TERMS')?.vesting_conditions;
    if (Array.isArray(baselineConditions)) merged.vesting_conditions = baselineConditions;
  }
  if (
    input.object_type === 'VESTING_TERMS' &&
    Array.isArray(input.vesting_conditions) &&
    input.vesting_conditions.length > 0
  ) {
    merged.vesting_conditions = input.vesting_conditions.map((condition) => {
      if (!isRecord(condition)) return condition;
      return {
        ...condition,
        ...(!Object.prototype.hasOwnProperty.call(condition, 'portion') &&
        !Object.prototype.hasOwnProperty.call(condition, 'quantity')
          ? { quantity: '1' }
          : {}),
        next_condition_ids: Array.isArray(condition.next_condition_ids) ? condition.next_condition_ids : [],
      };
    });
  }

  clearInjectedConversionTargets(merged, input);
  return merged;
}

function dependencyObject(objectType: string, id: string): OcfCapTableSnapshotObject {
  const baseline = FIXTURE_BASELINES.get(objectType);
  if (baseline === undefined) throw new Error(`Missing fixture baseline for ${objectType}`);
  return { ...baseline, id, object_type: objectType };
}

function hydrateSnapshot(objects: readonly OcfCapTableSnapshotObject[]): OcfCapTableSnapshotObject[] {
  const issuerId = objects.find((item) => item.object_type === 'ISSUER')?.id;
  const hydrated = objects.map((item) => hydrateSnapshotObject(item, issuerId));
  const hasObject = (objectType: string, id: string): boolean =>
    hydrated.some((item) => item.object_type === objectType && item.id === id);

  if (
    hydrated.some((item) => item.stakeholder_id === DEFAULT_STAKEHOLDER_ID) &&
    !hasObject('STAKEHOLDER', DEFAULT_STAKEHOLDER_ID)
  ) {
    hydrated.push(dependencyObject('STAKEHOLDER', DEFAULT_STAKEHOLDER_ID));
  }
  if (
    (hydrated.some((item) => item.stock_class_id === DEFAULT_STOCK_CLASS_ID) ||
      hydrated.some(
        (item) => Array.isArray(item.stock_class_ids) && item.stock_class_ids.includes(DEFAULT_STOCK_CLASS_ID)
      )) &&
    !hasObject('STOCK_CLASS', DEFAULT_STOCK_CLASS_ID)
  ) {
    hydrated.push(dependencyObject('STOCK_CLASS', DEFAULT_STOCK_CLASS_ID));
  }
  if (
    hydrated.some((item) => item.stock_plan_id === DEFAULT_STOCK_PLAN_ID) &&
    !hasObject('STOCK_PLAN', DEFAULT_STOCK_PLAN_ID)
  ) {
    hydrated.push(
      hydrateSnapshotObject(
        {
          ...dependencyObject('STOCK_PLAN', DEFAULT_STOCK_PLAN_ID),
          stock_class_ids: [DEFAULT_STOCK_CLASS_ID],
        },
        issuerId
      )
    );
    if (!hasObject('STOCK_CLASS', DEFAULT_STOCK_CLASS_ID)) {
      hydrated.push(dependencyObject('STOCK_CLASS', DEFAULT_STOCK_CLASS_ID));
    }
  }
  return hydrated;
}

/** Exercise the public JavaScript boundary with adversarial and compatibility inputs. */
function validateRawSnapshot(objects: unknown): OcfCapTableSnapshotValidationResult {
  return (validateOcfCapTableSnapshotRuntime as unknown as (value: unknown) => OcfCapTableSnapshotValidationResult)(
    objects
  );
}

/** Existing graph tests use schema-complete fixture defaults around their focused deltas. */
function validateOcfCapTableSnapshot(
  objects: readonly OcfCapTableSnapshotObject[]
): OcfCapTableSnapshotValidationResult {
  return validateRawSnapshot(hydrateSnapshot(objects));
}

function issueCodes(objects: readonly OcfCapTableSnapshotObject[]): string[] {
  return validateOcfCapTableSnapshot(objects).issues.map((issue) => issue.code);
}

function completeStockSnapshot(): OcfCapTableSnapshotObject[] {
  return [
    ...orphanedSnapshot,
    {
      object_type: 'STAKEHOLDER',
      id: 'stakeholder-moved-to-another-portal',
      name: { legal_name: 'Synthetic Holder' },
      stakeholder_type: 'INDIVIDUAL',
    },
  ];
}

function expectSchemaValid(objects: readonly OcfCapTableSnapshotObject[]): void {
  for (const object of objects) {
    expect(getOcfSchema(object.object_type).safeParse(object).success).toBe(true);
  }
}

function schemaValidWarrantRoot(): OcfCapTableSnapshotObject {
  return {
    ...warrantIssuanceFixture.db,
    id: 'warrant-root',
    security_id: 'warrant-security-root',
    stakeholder_id: 'stakeholder-moved-to-another-portal',
    exercise_triggers: warrantIssuanceFixture.db.exercise_triggers.map((trigger) => ({
      ...trigger,
      conversion_right: {
        ...trigger.conversion_right,
        converts_to_stock_class_id: 'stock-class-common',
      },
    })),
  };
}

function schemaValidConvertibleRoot(): OcfCapTableSnapshotObject {
  return {
    ...convertibleIssuanceFixture.db,
    id: 'convertible-root',
    security_id: 'convertible-security-root',
    stakeholder_id: 'stakeholder-moved-to-another-portal',
    conversion_triggers: convertibleIssuanceFixture.db.conversion_triggers.map((trigger) => ({
      ...trigger,
      conversion_right: {
        ...trigger.conversion_right,
        converts_to_stock_class_id: 'stock-class-common',
      },
    })),
  };
}

function schemaValidEquityCompensationRoot(): OcfCapTableSnapshotObject {
  return {
    object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
    id: 'equity-compensation-root',
    date: equityCompensationIssuanceFixture.date,
    security_id: 'equity-compensation-security-root',
    custom_id: equityCompensationIssuanceFixture.custom_id,
    stakeholder_id: 'stakeholder-moved-to-another-portal',
    compensation_type: equityCompensationIssuanceFixture.compensation_type,
    quantity: equityCompensationIssuanceFixture.quantity,
    expiration_date: null,
    termination_exercise_windows: equityCompensationIssuanceFixture.termination_exercise_windows,
    security_law_exemptions: equityCompensationIssuanceFixture.security_law_exemptions,
    comments: equityCompensationIssuanceFixture.comments,
  };
}

describe('getOcfObjectTypeCapability', () => {
  it('distinguishes ledger-backed, schema-only, compatibility-alias, and unsupported types', () => {
    expect(getOcfObjectTypeCapability('TX_STOCK_ISSUANCE')).toEqual({
      support: 'ledger-backed',
      objectType: 'TX_STOCK_ISSUANCE',
      canonicalObjectType: 'TX_STOCK_ISSUANCE',
      entityType: 'stockIssuance',
    });
    expect(getOcfObjectTypeCapability('TX_PLAN_SECURITY_ISSUANCE')).toEqual({
      support: 'ledger-backed',
      objectType: 'TX_PLAN_SECURITY_ISSUANCE',
      canonicalObjectType: 'TX_EQUITY_COMPENSATION_ISSUANCE',
      entityType: 'equityCompensationIssuance',
    });
    expect(getOcfObjectTypeCapability('FINANCING')).toEqual({
      support: 'schema-only',
      objectType: 'FINANCING',
    });
    expect(getOcfObjectTypeCapability('TX_NOT_REAL')).toEqual({
      support: 'unsupported',
      objectType: 'TX_NOT_REAL',
    });
  });

  it('classifies every source-of-truth OCF schema object type exhaustively', () => {
    const capabilities = Object.keys(OCF_OBJECT_SCHEMA_PATHS).map((objectType) =>
      getOcfObjectTypeCapability(objectType)
    );

    expect(capabilities.filter((capability) => capability.support === 'unsupported')).toEqual([]);
    expect(
      capabilities
        .filter((capability) => capability.support === 'schema-only')
        .map((capability) => capability.objectType)
    ).toEqual(['FINANCING']);
    expect(
      [
        ...new Set(
          capabilities.flatMap((capability) =>
            capability.support === 'ledger-backed' ? [capability.canonicalObjectType] : []
          )
        ),
      ].sort()
    ).toEqual(Object.keys(OCF_OBJECT_TYPE_TO_ENTITY_TYPE).sort());
    for (const capability of capabilities) {
      if (capability.support !== 'ledger-backed') continue;
      expect(OCF_OBJECT_TYPE_TO_ENTITY_TYPE[capability.canonicalObjectType]).toBe(capability.entityType);
    }
  });

  it('publishes immutable object-type capability registries', () => {
    expect(Object.isFrozen(OCF_OBJECT_TYPE_TO_ENTITY_TYPE)).toBe(true);
    expect(Object.isFrozen(OCF_SCHEMA_ONLY_OBJECT_TYPES)).toBe(true);

    expect(() => {
      (OCF_OBJECT_TYPE_TO_ENTITY_TYPE as Record<string, string>).TX_STOCK_ISSUANCE = 'stakeholder';
    }).toThrow(TypeError);
    expect(() => {
      (OCF_SCHEMA_ONLY_OBJECT_TYPES as unknown as string[]).push('NOT_REAL');
    }).toThrow(TypeError);

    expect(OCF_OBJECT_TYPE_TO_ENTITY_TYPE.TX_STOCK_ISSUANCE).toBe('stockIssuance');
    expect(getOcfObjectTypeCapability('FINANCING').support).toBe('schema-only');
  });
});

describe('validateOcfCapTableSnapshot', () => {
  it('returns structured immutable diagnostics for malformed runtime snapshot boundaries', () => {
    const malformedSnapshot = validateRawSnapshot(null);
    expect(malformedSnapshot).toEqual({
      valid: false,
      issues: [
        expect.objectContaining({
          code: 'MALFORMED_SNAPSHOT',
          path: '$',
          expectedType: 'array',
          receivedType: 'null',
        }),
      ],
    });
    expect(validateRawSnapshot(undefined).issues).toEqual([
      expect.objectContaining({
        code: 'MALFORMED_SNAPSHOT',
        path: '$',
        receivedType: 'undefined',
      }),
    ]);

    const malformedEntries = validateRawSnapshot([null, [], {}, { object_type: 'ISSUER' }, { id: 'issuer' }]);
    expect(malformedEntries.valid).toBe(false);
    expect(malformedEntries.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'MALFORMED_SNAPSHOT_OBJECT', index: 0, path: '$[0]' }),
        expect.objectContaining({ code: 'MALFORMED_SNAPSHOT_OBJECT', index: 1, path: '$[1]' }),
        expect.objectContaining({ code: 'MALFORMED_SNAPSHOT_OBJECT', index: 2, path: '$[2].id' }),
        expect.objectContaining({ code: 'MALFORMED_SNAPSHOT_OBJECT', index: 2, path: '$[2].object_type' }),
        expect.objectContaining({ code: 'MALFORMED_SNAPSHOT_OBJECT', index: 3, path: '$[3].id' }),
        expect.objectContaining({ code: 'MALFORMED_SNAPSHOT_OBJECT', index: 4, path: '$[4].object_type' }),
      ])
    );
    expect(Object.isFrozen(malformedEntries)).toBe(true);
    expect(Object.isFrozen(malformedEntries.issues)).toBe(true);
    malformedEntries.issues.forEach((issue) => expect(Object.isFrozen(issue)).toBe(true));

    const sparseSnapshot: unknown[] = [];
    sparseSnapshot.length = 1;
    expect(validateRawSnapshot(sparseSnapshot).issues).toEqual([
      expect.objectContaining({
        code: 'MALFORMED_SNAPSHOT_OBJECT',
        index: 0,
        path: '$[0]',
        receivedType: 'undefined',
      }),
    ]);
  });

  it('reports required schema fields before graph traversal without throwing raw runtime errors', () => {
    const result = validateRawSnapshot([
      {
        object_type: 'ISSUER',
        id: 'issuer-1',
        legal_name: 'Issuer',
        formation_date: '2025-01-01',
        country_of_formation: 'US',
      },
      { object_type: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT', id: 'adjustment-1' },
    ]);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'SCHEMA_VALIDATION_ERROR',
          objectId: 'adjustment-1',
          path: '$[1].issuer_id',
        }),
      ])
    );
    expect(result.issues.every((issue) => issue.code === 'SCHEMA_VALIDATION_ERROR')).toBe(true);
  });

  it('does not mutate deeply frozen schema-valid input during preflight or graph validation', () => {
    const objects = deepFreezeValue(structuredClone(completeStockSnapshot()));
    const before = JSON.stringify(objects);

    expect(validateRawSnapshot(objects)).toEqual({ valid: true, issues: [] });
    expect(JSON.stringify(objects)).toBe(before);
  });

  it('reports a zero-issuer snapshot explicitly', () => {
    expect(validateOcfCapTableSnapshot([])).toEqual({
      valid: false,
      issues: [
        {
          code: 'ISSUER_CARDINALITY',
          message: 'Expected exactly one ISSUER, found 0',
          objectType: 'ISSUER',
          count: 0,
        },
      ],
    });
  });

  it('returns deeply immutable diagnostics without leaking mutable rule arrays', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      { object_type: 'ISSUER', id: 'issuer-1' },
      {
        object_type: 'TX_STOCK_RETRACTION',
        id: 'missing-security-retraction',
        security_id: 'missing-security',
      },
    ];
    const result = validateOcfCapTableSnapshot(objects);

    expect(result.valid).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.issues)).toBe(true);
    const issue = result.issues[0];
    expect(Object.isFrozen(issue)).toBe(true);
    if (issue?.code !== 'MISSING_SECURITY_REFERENCE') {
      throw new Error('Expected a missing security diagnostic');
    }
    expect(Object.isFrozen(issue.expectedSecurityFamilies)).toBe(true);
    expect(() => {
      (issue.expectedSecurityFamilies as unknown as OcfSecurityFamily[]).push('warrant');
    }).toThrow(TypeError);

    expect(validateOcfCapTableSnapshot(objects)).toEqual(result);
  });

  it('reproduces the sanitized orphaned stock-issuance incident', () => {
    for (const object of orphanedSnapshot) {
      expect(getOcfSchema(object.object_type).safeParse(object).success).toBe(true);
    }

    const result = validateOcfCapTableSnapshot(orphanedSnapshot);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'MISSING_REFERENCE',
        objectType: 'TX_STOCK_ISSUANCE',
        objectId: 'stock-issuance-orphaned',
        path: 'stakeholder_id',
        referenceId: 'stakeholder-moved-to-another-portal',
        targetObjectTypes: ['STAKEHOLDER'],
      }),
    ]);
  });

  it('accepts deleting a stakeholder and all dependents in the same final snapshot', () => {
    const completeSnapshot: OcfCapTableSnapshotObject[] = [
      ...orphanedSnapshot,
      {
        object_type: 'STAKEHOLDER',
        id: 'stakeholder-moved-to-another-portal',
        name: { legal_name: 'Synthetic Holder' },
        stakeholder_type: 'INDIVIDUAL',
      },
    ];

    expect(validateOcfCapTableSnapshot(completeSnapshot).valid).toBe(true);
    expect(
      validateOcfCapTableSnapshot(
        completeSnapshot.filter((object) => !['STAKEHOLDER', 'TX_STOCK_ISSUANCE'].includes(object.object_type))
      )
    ).toEqual({ valid: true, issues: [] });
  });

  it('does not fail ledger graph validation for schema-only FINANCING references', () => {
    expect(
      validateOcfCapTableSnapshot([
        { object_type: 'ISSUER', id: 'issuer-1' },
        {
          object_type: 'FINANCING',
          id: 'financing-1',
          issuance_ids: ['historical-issuance-not-materialized-on-ledger'],
        },
      ])
    ).toEqual({ valid: true, issues: [] });
  });

  it('ignores empty strings only for optional references', () => {
    const optionalEmptyReferences: OcfCapTableSnapshotObject[] = [
      { object_type: 'ISSUER', id: 'issuer-1' },
      { object_type: 'STAKEHOLDER', id: 'stakeholder-1' },
      { object_type: 'STOCK_CLASS', id: 'class-1' },
      {
        object_type: 'TX_STOCK_ISSUANCE',
        id: 'stock-1',
        security_id: 'stock-security-1',
        stakeholder_id: 'stakeholder-1',
        stock_class_id: 'class-1',
        stock_plan_id: '',
        vesting_terms_id: '',
        stock_legend_ids: [],
      },
      {
        object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
        id: 'equity-1',
        security_id: 'equity-security-1',
        stakeholder_id: 'stakeholder-1',
        stock_class_id: '',
        stock_plan_id: '',
        vesting_terms_id: '',
      },
      {
        object_type: 'TX_WARRANT_ISSUANCE',
        id: 'warrant-1',
        security_id: 'warrant-security-1',
        stakeholder_id: 'stakeholder-1',
        vesting_terms_id: '',
        exercise_triggers: [{ conversion_right: { converts_to_stock_class_id: '' } }],
      },
      {
        object_type: 'TX_CONVERTIBLE_ISSUANCE',
        id: 'convertible-1',
        security_id: 'convertible-security-1',
        stakeholder_id: 'stakeholder-1',
        conversion_triggers: [{ conversion_right: { converts_to_stock_class_id: '' } }],
      },
      {
        object_type: 'TX_STOCK_REISSUANCE',
        id: 'reissuance-1',
        security_id: 'stock-security-1',
        resulting_security_ids: ['stock-security-2'],
        split_transaction_id: '',
      },
    ];

    expect(validateOcfCapTableSnapshot(optionalEmptyReferences)).toEqual({ valid: true, issues: [] });

    const requiredEmptyReference = optionalEmptyReferences.map((object) =>
      object.id === 'stock-1' ? { ...object, stakeholder_id: '' } : object
    );
    expect(validateOcfCapTableSnapshot(requiredEmptyReference).issues).toEqual([
      expect.objectContaining({
        code: 'MISSING_REFERENCE',
        objectId: 'stock-1',
        path: 'stakeholder_id',
        referenceId: '',
      }),
    ]);
  });

  it('resolves stock-plan returns and permits plan rollovers', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      { object_type: 'ISSUER', id: 'issuer-1' },
      { object_type: 'STAKEHOLDER', id: 'stakeholder-1' },
      { object_type: 'STOCK_CLASS', id: 'class-1' },
      { object_type: 'STOCK_PLAN', id: 'plan-1', stock_class_ids: ['class-1'] },
      { object_type: 'STOCK_PLAN', id: 'plan-2', stock_class_ids: ['class-1'] },
      {
        object_type: 'TX_STOCK_ISSUANCE',
        id: 'stock-1',
        security_id: 'stock-security-1',
        stakeholder_id: 'stakeholder-1',
        stock_class_id: 'class-1',
        stock_plan_id: 'plan-1',
        stock_legend_ids: [],
      },
      {
        object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
        id: 'equity-1',
        security_id: 'equity-security-1',
        stakeholder_id: 'stakeholder-1',
        stock_class_id: 'class-1',
        stock_plan_id: 'plan-1',
      },
      {
        object_type: 'TX_STOCK_PLAN_RETURN_TO_POOL',
        id: 'return-valid',
        security_id: 'equity-security-1',
        stock_plan_id: 'plan-1',
      },
      {
        object_type: 'TX_STOCK_PLAN_RETURN_TO_POOL',
        id: 'return-wrong-plan',
        security_id: 'stock-security-1',
        stock_plan_id: 'plan-2',
      },
      {
        object_type: 'TX_STOCK_PLAN_RETURN_TO_POOL',
        id: 'return-missing-security',
        security_id: 'missing-security',
        stock_plan_id: 'plan-1',
      },
    ];

    expect(validateOcfCapTableSnapshot(objects).issues).toEqual([
      expect.objectContaining({
        code: 'MISSING_SECURITY_REFERENCE',
        objectId: 'return-missing-security',
        path: 'security_id',
        referenceId: 'missing-security',
        expectedSecurityFamilies: ['stock', 'equity-compensation'],
      }),
    ]);
  });

  it('rejects document references to schema-only FINANCING objects', () => {
    const result = validateOcfCapTableSnapshot([
      { object_type: 'ISSUER', id: 'issuer-1' },
      { object_type: 'FINANCING', id: 'financing-1' },
      {
        object_type: 'DOCUMENT',
        id: 'document-1',
        related_objects: [{ object_type: 'FINANCING', object_id: 'financing-1' }],
      },
    ]);

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'SCHEMA_ONLY_REFERENCE',
        objectId: 'document-1',
        path: 'related_objects[0].object_type',
        referenceId: 'financing-1',
        targetObjectTypes: ['FINANCING'],
      }),
    ]);
  });

  it('validates core object, security, plan-membership, and trigger references', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      { object_type: 'ISSUER', id: 'issuer-1' },
      { object_type: 'STAKEHOLDER', id: 'stakeholder-1' },
      { object_type: 'STOCK_CLASS', id: 'class-1' },
      { object_type: 'STOCK_CLASS', id: 'class-2' },
      { object_type: 'STOCK_PLAN', id: 'plan-1', stock_class_ids: ['class-1'] },
      { object_type: 'VESTING_TERMS', id: 'vesting-1', vesting_conditions: [] },
      {
        object_type: 'TX_WARRANT_ISSUANCE',
        id: 'warrant-1',
        stakeholder_id: 'stakeholder-1',
        security_id: 'security-warrant-1',
        vesting_terms_id: 'vesting-1',
        exercise_triggers: [{ trigger_id: 'exercise-1' }],
      },
      {
        object_type: 'TX_WARRANT_EXERCISE',
        id: 'exercise-transaction-1',
        security_id: 'security-warrant-1',
        trigger_id: 'missing-trigger',
        resulting_security_ids: ['resulting-stock-1'],
      },
      {
        object_type: 'TX_STOCK_ISSUANCE',
        id: 'stock-1',
        stakeholder_id: 'missing-stakeholder',
        stock_class_id: 'class-2',
        stock_plan_id: 'plan-1',
        stock_legend_ids: [],
        security_id: 'duplicate-security',
      },
      {
        object_type: 'TX_CONVERTIBLE_ISSUANCE',
        id: 'convertible-1',
        stakeholder_id: 'stakeholder-1',
        security_id: 'duplicate-security',
        conversion_triggers: [],
      },
    ];

    expect(issueCodes(objects)).toEqual([
      'DUPLICATE_SECURITY_PRODUCER',
      'MISSING_REFERENCE',
      'MISSING_TRIGGER',
      'STOCK_PLAN_CLASS_MISMATCH',
    ]);
  });

  it('validates every capitalization-definition ID array with indexed duplicate and missing evidence', () => {
    const convertible = schemaValidConvertibleRoot();
    const triggers = convertible.conversion_triggers;
    if (!Array.isArray(triggers) || !isRecord(triggers[0]) || typeof triggers[0].trigger_id !== 'string') {
      throw new Error('Expected a schema-valid convertible trigger');
    }
    const conversion: OcfCapTableSnapshotObject = {
      ...convertibleConversionFixture,
      id: 'capitalization-conversion',
      security_id: 'convertible-security-root',
      trigger_id: triggers[0].trigger_id,
      resulting_security_ids: [],
      capitalization_definition: {
        include_stock_class_ids: ['stock-class-common', 'missing-class', 'missing-class'],
        include_stock_plans_ids: ['stock-plan-1', 'missing-plan', 'missing-plan'],
        include_security_ids: ['security-orphaned', 'missing-security', 'missing-security'],
        exclude_security_ids: ['convertible-security-root', 'missing-excluded-security', 'missing-excluded-security'],
      },
    };
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      {
        object_type: 'STOCK_PLAN',
        id: 'stock-plan-1',
        plan_name: 'Snapshot Plan',
        initial_shares_reserved: '1000',
        stock_class_ids: ['stock-class-common'],
      },
      convertible,
      conversion,
    ];

    expectSchemaValid(objects);
    const result = validateOcfCapTableSnapshot(objects);
    expect(validateOcfCapTableSnapshot([...objects].reverse())).toEqual(result);
    const duplicateIssues = result.issues.filter((issue) => issue.code === 'DUPLICATE_REFERENCE');
    expect(duplicateIssues).toEqual([
      expect.objectContaining({
        path: 'capitalization_definition.exclude_security_ids[2]',
        firstPath: 'capitalization_definition.exclude_security_ids[1]',
        referenceId: 'missing-excluded-security',
        count: 2,
      }),
      expect.objectContaining({
        path: 'capitalization_definition.include_security_ids[2]',
        firstPath: 'capitalization_definition.include_security_ids[1]',
        referenceId: 'missing-security',
        count: 2,
      }),
      expect.objectContaining({
        path: 'capitalization_definition.include_stock_class_ids[2]',
        firstPath: 'capitalization_definition.include_stock_class_ids[1]',
        referenceId: 'missing-class',
        count: 2,
      }),
      expect.objectContaining({
        path: 'capitalization_definition.include_stock_plans_ids[2]',
        firstPath: 'capitalization_definition.include_stock_plans_ids[1]',
        referenceId: 'missing-plan',
        count: 2,
      }),
    ]);
    expect(
      result.issues
        .filter((issue) => issue.code === 'MISSING_REFERENCE')
        .flatMap((issue) => ('path' in issue ? [issue.path] : []))
    ).toEqual([
      'capitalization_definition.include_stock_class_ids[1]',
      'capitalization_definition.include_stock_class_ids[2]',
      'capitalization_definition.include_stock_plans_ids[1]',
      'capitalization_definition.include_stock_plans_ids[2]',
    ]);
    expect(
      result.issues
        .filter((issue) => issue.code === 'MISSING_SECURITY_REFERENCE')
        .flatMap((issue) => ('path' in issue ? [issue.path] : []))
    ).toEqual([
      'capitalization_definition.exclude_security_ids[1]',
      'capitalization_definition.exclude_security_ids[2]',
      'capitalization_definition.include_security_ids[1]',
      'capitalization_definition.include_security_ids[2]',
    ]);
  });

  it('preserves exact indices for every many-object-reference diagnostic', () => {
    const objects = completeStockSnapshot().map((object) =>
      object.object_type === 'TX_STOCK_ISSUANCE'
        ? {
            ...object,
            stock_legend_ids: ['legend-standard', 'missing-legend', 'missing-legend'],
          }
        : object
    );
    objects.push({
      object_type: 'STOCK_PLAN',
      id: 'indexed-plan',
      plan_name: 'Indexed Plan',
      initial_shares_reserved: '1000',
      stock_class_ids: ['stock-class-common', 'missing-class', 'missing-class'],
    });

    expectSchemaValid(objects);
    const result = validateOcfCapTableSnapshot(objects);
    expect(
      result.issues
        .filter((issue) => issue.code === 'DUPLICATE_REFERENCE')
        .flatMap((issue) => ('path' in issue ? [issue.path] : []))
    ).toEqual(['stock_class_ids[2]', 'stock_legend_ids[2]']);
    expect(
      result.issues
        .filter((issue) => issue.code === 'MISSING_REFERENCE')
        .flatMap((issue) => ('path' in issue ? [issue.path] : []))
    ).toEqual(['stock_class_ids[1]', 'stock_class_ids[2]', 'stock_legend_ids[1]', 'stock_legend_ids[2]']);
  });

  it('tracks transition-produced security nodes without requiring duplicate issuance producers', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      {
        object_type: 'TX_STOCK_TRANSFER',
        id: 'transfer-1',
        date: '2025-01-01',
        security_id: 'security-orphaned',
        quantity: '40',
        balance_security_id: 'stock-balance-1',
        resulting_security_ids: ['stock-result-1'],
      },
      {
        object_type: 'TX_STOCK_ACCEPTANCE',
        id: 'accept-result',
        date: '2025-01-02',
        security_id: 'stock-result-1',
      },
      {
        object_type: 'TX_STOCK_ACCEPTANCE',
        id: 'accept-balance',
        date: '2025-01-02',
        security_id: 'stock-balance-1',
      },
    ];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects)).toEqual({ valid: true, issues: [] });
  });

  it.each([
    ['TX_CONVERTIBLE_CANCELLATION', 'TX_CONVERTIBLE_ISSUANCE', 'security_id', undefined],
    ['TX_CONVERTIBLE_CONVERSION', 'TX_CONVERTIBLE_ISSUANCE', 'security_id', 'resulting_security_ids'],
    ['TX_CONVERTIBLE_RETRACTION', 'TX_CONVERTIBLE_ISSUANCE', 'security_id', undefined],
    ['TX_CONVERTIBLE_TRANSFER', 'TX_CONVERTIBLE_ISSUANCE', 'security_id', 'resulting_security_ids'],
    ['TX_EQUITY_COMPENSATION_CANCELLATION', 'TX_EQUITY_COMPENSATION_ISSUANCE', 'security_id', undefined],
    ['TX_EQUITY_COMPENSATION_EXERCISE', 'TX_EQUITY_COMPENSATION_ISSUANCE', 'security_id', 'resulting_security_ids'],
    ['TX_EQUITY_COMPENSATION_RELEASE', 'TX_EQUITY_COMPENSATION_ISSUANCE', 'security_id', 'resulting_security_ids'],
    ['TX_EQUITY_COMPENSATION_RETRACTION', 'TX_EQUITY_COMPENSATION_ISSUANCE', 'security_id', undefined],
    ['TX_EQUITY_COMPENSATION_TRANSFER', 'TX_EQUITY_COMPENSATION_ISSUANCE', 'security_id', 'resulting_security_ids'],
    ['TX_STOCK_CANCELLATION', 'TX_STOCK_ISSUANCE', 'security_id', undefined],
    ['TX_STOCK_CONSOLIDATION', 'TX_STOCK_ISSUANCE', 'security_ids', 'resulting_security_id'],
    ['TX_STOCK_CONVERSION', 'TX_STOCK_ISSUANCE', 'security_id', 'resulting_security_ids'],
    ['TX_STOCK_REISSUANCE', 'TX_STOCK_ISSUANCE', 'security_id', 'resulting_security_ids'],
    ['TX_STOCK_REPURCHASE', 'TX_STOCK_ISSUANCE', 'security_id', undefined],
    ['TX_STOCK_RETRACTION', 'TX_STOCK_ISSUANCE', 'security_id', undefined],
    ['TX_STOCK_TRANSFER', 'TX_STOCK_ISSUANCE', 'security_id', 'resulting_security_ids'],
    ['TX_WARRANT_CANCELLATION', 'TX_WARRANT_ISSUANCE', 'security_id', undefined],
    ['TX_WARRANT_EXERCISE', 'TX_WARRANT_ISSUANCE', 'security_id', 'resulting_security_ids'],
    ['TX_WARRANT_RETRACTION', 'TX_WARRANT_ISSUANCE', 'security_id', undefined],
    ['TX_WARRANT_TRANSFER', 'TX_WARRANT_ISSUANCE', 'security_id', 'resulting_security_ids'],
  ] as const)(
    'covers terminal transition semantics for %s',
    (transactionType, issuanceType, inputField, outputField) => {
      const rootSecurityId = `${transactionType}-root`;
      const issuance: OcfCapTableSnapshotObject = {
        object_type: issuanceType,
        id: `${transactionType}-issuance`,
        security_id: rootSecurityId,
        ...(issuanceType === 'TX_CONVERTIBLE_ISSUANCE' ? { conversion_triggers: [{ trigger_id: 'trigger-1' }] } : {}),
        ...(issuanceType === 'TX_WARRANT_ISSUANCE' ? { exercise_triggers: [{ trigger_id: 'trigger-1' }] } : {}),
      };
      const transaction: OcfCapTableSnapshotObject = {
        object_type: transactionType,
        id: `${transactionType}-transaction`,
        ...(inputField === 'security_ids' ? { security_ids: [rootSecurityId] } : { security_id: rootSecurityId }),
        ...(outputField === 'resulting_security_ids'
          ? { resulting_security_ids: [`${transactionType}-output`] }
          : outputField === 'resulting_security_id'
            ? { resulting_security_id: `${transactionType}-output` }
            : {}),
        ...(transactionType === 'TX_CONVERTIBLE_CONVERSION' || transactionType === 'TX_WARRANT_EXERCISE'
          ? { trigger_id: 'trigger-1' }
          : {}),
      };

      expect(validateOcfCapTableSnapshot([{ object_type: 'ISSUER', id: 'issuer-1' }, issuance, transaction])).toEqual({
        valid: true,
        issues: [],
      });
    }
  );

  it('tracks cross-family exercise outputs as stock security nodes', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      schemaValidWarrantRoot(),
      {
        object_type: 'TX_WARRANT_EXERCISE',
        id: 'exercise-warrant',
        date: '2025-01-01',
        security_id: 'warrant-security-root',
        trigger_id: 'warrant1_trigger',
        resulting_security_ids: ['exercise-stock-result'],
      },
      {
        object_type: 'TX_STOCK_ACCEPTANCE',
        id: 'accept-exercise-result',
        date: '2025-01-02',
        security_id: 'exercise-stock-result',
      },
    ];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects)).toEqual({ valid: true, issues: [] });
  });

  it('accepts the official schema-valid empty release output representation', () => {
    const release: OcfCapTableSnapshotObject = {
      object_type: 'TX_EQUITY_COMPENSATION_RELEASE',
      id: 'official-empty-release',
      security_id: 'equity-compensation-security-root',
      date: '2017-07-22',
      settlement_date: '2017-07-22',
      quantity: '9000',
      release_price: { amount: '9.00', currency: 'CAD' },
      resulting_security_ids: [],
    };
    const objects = [...completeStockSnapshot(), schemaValidEquityCompensationRoot(), release];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects)).toEqual({ valid: true, issues: [] });
  });

  it.each([
    ['TX_CONVERTIBLE_CONVERSION', 'TX_CONVERTIBLE_ISSUANCE', { reason_text: 'Conversion', trigger_id: 'trigger-1' }],
    ['TX_STOCK_CONVERSION', 'TX_STOCK_ISSUANCE', { quantity_converted: '1' }],
    ['TX_EQUITY_COMPENSATION_EXERCISE', 'TX_EQUITY_COMPENSATION_ISSUANCE', { quantity: '1' }],
    [
      'TX_EQUITY_COMPENSATION_RELEASE',
      'TX_EQUITY_COMPENSATION_ISSUANCE',
      {
        settlement_date: '2025-01-01',
        release_price: { amount: '1', currency: 'USD' },
        quantity: '1',
      },
    ],
    ['TX_WARRANT_EXERCISE', 'TX_WARRANT_ISSUANCE', { trigger_id: 'trigger-1' }],
    ['TX_STOCK_REISSUANCE', 'TX_STOCK_ISSUANCE', {}],
  ] as const)('accepts schema-valid empty resulting_security_ids for %s', (transactionType, issuanceType, extra) => {
    const transaction: OcfCapTableSnapshotObject = {
      object_type: transactionType,
      id: `${transactionType}-empty-output`,
      date: '2025-01-01',
      security_id: 'root-security',
      resulting_security_ids: [],
      ...extra,
    };
    const issuance: OcfCapTableSnapshotObject = {
      object_type: issuanceType,
      id: `${issuanceType}-root`,
      security_id: 'root-security',
      ...(issuanceType === 'TX_CONVERTIBLE_ISSUANCE' ? { conversion_triggers: [{ trigger_id: 'trigger-1' }] } : {}),
      ...(issuanceType === 'TX_WARRANT_ISSUANCE' ? { exercise_triggers: [{ trigger_id: 'trigger-1' }] } : {}),
    };

    expectSchemaValid([transaction]);
    expect(validateOcfCapTableSnapshot([{ object_type: 'ISSUER', id: 'issuer-1' }, issuance, transaction])).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('treats an empty optional balance_security_id as omitted', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      {
        object_type: 'TX_STOCK_TRANSFER',
        id: 'empty-balance-transfer',
        date: '2025-01-01',
        security_id: 'security-orphaned',
        quantity: '10',
        balance_security_id: '',
        resulting_security_ids: ['stock-result'],
      },
    ];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects)).toEqual({ valid: true, issues: [] });
  });

  it('retains schema minItems rules for transfer outputs and consolidation inputs', () => {
    const emptyTransfer: OcfCapTableSnapshotObject = {
      object_type: 'TX_STOCK_TRANSFER',
      id: 'empty-transfer-output',
      date: '2025-01-01',
      security_id: 'security-orphaned',
      quantity: '1',
      resulting_security_ids: [],
    };
    const emptyConsolidation: OcfCapTableSnapshotObject = {
      object_type: 'TX_STOCK_CONSOLIDATION',
      id: 'empty-consolidation-input',
      date: '2025-01-01',
      security_ids: [],
      resulting_security_id: 'consolidated-output',
      reason_text: 'Nothing to consolidate',
    };

    expect(getOcfSchema(emptyTransfer.object_type).safeParse(emptyTransfer).success).toBe(false);
    expect(getOcfSchema(emptyConsolidation.object_type).safeParse(emptyConsolidation).success).toBe(false);
    expect(issueCodes([...completeStockSnapshot(), emptyTransfer, emptyConsolidation])).toEqual([
      'SCHEMA_VALIDATION_ERROR',
      'SCHEMA_VALIDATION_ERROR',
    ]);
  });

  it('rejects duplicate transition output IDs from schema-valid arrays', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      schemaValidWarrantRoot(),
      {
        object_type: 'TX_WARRANT_EXERCISE',
        id: 'exercise-duplicate-output',
        date: '2025-01-01',
        security_id: 'warrant-security-root',
        trigger_id: 'warrant1_trigger',
        resulting_security_ids: ['duplicate-stock-output', 'duplicate-stock-output'],
      },
    ];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects).issues).toEqual([
      expect.objectContaining({
        code: 'DUPLICATE_SECURITY_PRODUCER',
        path: 'resulting_security_ids[0]',
        referenceId: 'duplicate-stock-output',
        producerObjectTypes: ['TX_WARRANT_EXERCISE'],
        count: 2,
      }),
    ]);
  });

  it('rejects duplicate trigger IDs and ambiguous trigger references', () => {
    const warrant = schemaValidWarrantRoot();
    const triggers = warrant.exercise_triggers;
    if (!Array.isArray(triggers) || triggers.length !== 1) throw new Error('Expected one warrant trigger');
    const firstTrigger = triggers[0];
    if (typeof firstTrigger !== 'object' || firstTrigger === null) throw new Error('Expected a warrant trigger object');
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      {
        ...warrant,
        exercise_triggers: [firstTrigger, { ...firstTrigger, nickname: 'Duplicate trigger id' }],
      },
      {
        object_type: 'TX_WARRANT_EXERCISE',
        id: 'exercise-ambiguous-trigger',
        date: '2025-01-01',
        security_id: 'warrant-security-root',
        trigger_id: 'warrant1_trigger',
        resulting_security_ids: ['exercise-stock-result'],
      },
    ];

    expectSchemaValid(objects);
    expect(issueCodes(objects)).toEqual(['AMBIGUOUS_TRIGGER', 'DUPLICATE_TRIGGER_ID']);
  });

  it('permits stock-plan rollovers through produced security lineage', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot().map((object) =>
        object.object_type === 'TX_STOCK_ISSUANCE' ? { ...object, stock_plan_id: 'plan-1' } : object
      ),
      {
        object_type: 'STOCK_PLAN',
        id: 'plan-1',
        plan_name: 'Original Plan',
        initial_shares_reserved: '1000',
        stock_class_ids: ['stock-class-common'],
      },
      {
        object_type: 'STOCK_PLAN',
        id: 'plan-2',
        plan_name: 'Rollover Plan',
        initial_shares_reserved: '1000',
        stock_class_ids: ['stock-class-common'],
      },
      {
        object_type: 'TX_STOCK_TRANSFER',
        id: 'plan-transfer',
        date: '2025-01-01',
        security_id: 'security-orphaned',
        quantity: '10',
        resulting_security_ids: ['plan-stock-result'],
      },
      {
        object_type: 'TX_STOCK_PLAN_RETURN_TO_POOL',
        id: 'return-produced-security',
        date: '2025-01-02',
        security_id: 'plan-stock-result',
        stock_plan_id: 'plan-2',
        quantity: '10',
        reason_text: 'Return transferred plan stock',
      },
    ];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects)).toEqual({ valid: true, issues: [] });
  });

  it('allows cancellation and return-to-pool accounting for the same security', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot().map((object) =>
        object.object_type === 'TX_STOCK_ISSUANCE' ? { ...object, stock_plan_id: 'plan-1' } : object
      ),
      {
        object_type: 'STOCK_PLAN',
        id: 'plan-1',
        plan_name: 'Original Plan',
        initial_shares_reserved: '1000',
        stock_class_ids: ['stock-class-common'],
      },
      {
        object_type: 'STOCK_PLAN',
        id: 'plan-2',
        plan_name: 'Rollover Plan',
        initial_shares_reserved: '1000',
        stock_class_ids: ['stock-class-common'],
      },
      {
        object_type: 'TX_STOCK_CANCELLATION',
        id: 'cancel-plan-security',
        date: '2025-01-01',
        security_id: 'security-orphaned',
        quantity: '10',
        reason_text: 'Cancelled into rollover',
      },
      {
        object_type: 'TX_STOCK_PLAN_RETURN_TO_POOL',
        id: 'return-cancelled-security',
        date: '2025-01-01',
        security_id: 'security-orphaned',
        stock_plan_id: 'plan-2',
        quantity: '10',
        reason_text: 'Return to rollover plan',
      },
    ];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects)).toEqual({ valid: true, issues: [] });
  });

  it('rejects returning a lineage that contains a non-plan issuance', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      {
        object_type: 'STOCK_PLAN',
        id: 'plan-1',
        plan_name: 'Synthetic Plan',
        initial_shares_reserved: '1000',
        stock_class_ids: ['stock-class-common'],
      },
      {
        object_type: 'TX_STOCK_PLAN_RETURN_TO_POOL',
        id: 'return-non-plan-security',
        date: '2025-01-01',
        security_id: 'security-orphaned',
        stock_plan_id: 'plan-1',
        quantity: '10',
        reason_text: 'Invalid non-plan return',
      },
    ];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects).issues).toEqual([
      expect.objectContaining({
        code: 'STOCK_PLAN_SECURITY_MISMATCH',
        objectId: 'return-non-plan-security',
        stockPlanId: 'plan-1',
        securityId: 'security-orphaned',
      }),
    ]);
  });

  it('rejects missing and wrong-family transition inputs while preserving observers', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      {
        object_type: 'TX_STOCK_ACCEPTANCE',
        id: 'observer-1',
        date: '2025-01-01',
        security_id: 'security-orphaned',
      },
      {
        object_type: 'TX_STOCK_ACCEPTANCE',
        id: 'observer-2',
        date: '2025-01-02',
        security_id: 'security-orphaned',
      },
      {
        object_type: 'TX_STOCK_RETRACTION',
        id: 'missing-input',
        date: '2025-01-03',
        security_id: 'security-missing',
        reason_text: 'Missing source',
      },
      {
        object_type: 'TX_WARRANT_RETRACTION',
        id: 'wrong-family-input',
        date: '2025-01-04',
        security_id: 'security-orphaned',
        reason_text: 'Wrong family',
      },
    ];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects).issues).toEqual([
      expect.objectContaining({
        code: 'MISSING_SECURITY_REFERENCE',
        objectId: 'missing-input',
        path: 'security_id',
        referenceId: 'security-missing',
      }),
      expect.objectContaining({
        code: 'SECURITY_FAMILY_MISMATCH',
        objectId: 'wrong-family-input',
        path: 'security_id',
        expectedSecurityFamilies: ['warrant'],
        actualSecurityFamily: 'stock',
      }),
    ]);
  });

  it('does not cascade missing or wrong-family inputs into consumer or cycle diagnostics', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      ...['missing-a', 'missing-b'].map((id) => ({
        object_type: 'TX_STOCK_TRANSFER',
        id,
        date: '2025-01-01',
        security_id: 'missing-security',
        quantity: '1',
        resulting_security_ids: [`${id}-output`],
      })),
      ...['wrong-family-a', 'wrong-family-b'].map((id) => ({
        object_type: 'TX_WARRANT_TRANSFER',
        id,
        date: '2025-01-01',
        security_id: 'security-orphaned',
        quantity: '1',
        resulting_security_ids: [`${id}-output`],
      })),
    ];

    expectSchemaValid(objects);
    expect(issueCodes(objects)).toEqual([
      'MISSING_SECURITY_REFERENCE',
      'MISSING_SECURITY_REFERENCE',
      'SECURITY_FAMILY_MISMATCH',
      'SECURITY_FAMILY_MISMATCH',
    ]);
  });

  it('does not run stock-plan semantics for a wrong-family observed security', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      schemaValidWarrantRoot(),
      {
        object_type: 'STOCK_PLAN',
        id: 'plan-1',
        plan_name: 'Synthetic Plan',
        initial_shares_reserved: '1000',
        stock_class_ids: ['stock-class-common'],
      },
      {
        object_type: 'TX_STOCK_PLAN_RETURN_TO_POOL',
        id: 'wrong-family-return',
        date: '2025-01-01',
        security_id: 'warrant-security-root',
        stock_plan_id: 'plan-1',
        quantity: '1',
        reason_text: 'Invalid warrant return',
      },
    ];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects).issues).toEqual([
      expect.objectContaining({
        code: 'SECURITY_FAMILY_MISMATCH',
        objectId: 'wrong-family-return',
        expectedSecurityFamilies: ['stock', 'equity-compensation'],
        actualSecurityFamily: 'warrant',
      }),
    ]);
  });

  it('does not run vesting semantics for a wrong-family observed security', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      schemaValidConvertibleRoot(),
      {
        object_type: 'TX_VESTING_EVENT',
        id: 'wrong-family-vesting-event',
        date: '2025-01-01',
        security_id: 'convertible-security-root',
        vesting_condition_id: 'condition-1',
        comments: [],
      },
    ];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects).issues).toEqual([
      expect.objectContaining({
        code: 'SECURITY_FAMILY_MISMATCH',
        objectId: 'wrong-family-vesting-event',
        expectedSecurityFamilies: ['stock', 'warrant', 'equity-compensation'],
        actualSecurityFamily: 'convertible',
      }),
    ]);
  });

  it('does not validate triggers after a cross-family transition input mismatch', () => {
    const convertible = schemaValidConvertibleRoot();
    const trigger = convertible.conversion_triggers;
    if (!Array.isArray(trigger) || typeof trigger[0] !== 'object' || trigger[0] === null) {
      throw new Error('Expected a convertible trigger fixture');
    }
    const triggerId = trigger[0].trigger_id;
    if (typeof triggerId !== 'string') throw new Error('Expected a convertible trigger id');
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      convertible,
      {
        object_type: 'TX_CONVERTIBLE_CONVERSION',
        id: 'valid-conversion',
        date: '2025-01-01',
        security_id: 'convertible-security-root',
        trigger_id: triggerId,
        reason_text: 'Valid first conversion',
        resulting_security_ids: ['converted-stock'],
      },
      {
        object_type: 'TX_CONVERTIBLE_CONVERSION',
        id: 'wrong-family-conversion',
        date: '2025-01-02',
        security_id: 'converted-stock',
        trigger_id: 'missing-trigger-that-must-not-be-checked',
        reason_text: 'Invalid second conversion',
        resulting_security_ids: ['invalid-output'],
      },
    ];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects).issues).toEqual([
      expect.objectContaining({
        code: 'SECURITY_FAMILY_MISMATCH',
        objectId: 'wrong-family-conversion',
        expectedSecurityFamilies: ['convertible'],
        actualSecurityFamily: 'stock',
      }),
    ]);
  });

  it('does not consume a valid item from a malformed many-input container', () => {
    const result = validateOcfCapTableSnapshot([
      ...completeStockSnapshot(),
      {
        object_type: 'TX_STOCK_CONSOLIDATION',
        id: 'mixed-consolidation',
        security_ids: ['security-orphaned', 42],
        resulting_security_id: 'mixed-output',
      },
      {
        object_type: 'TX_STOCK_RETRACTION',
        id: 'valid-consumer',
        security_id: 'security-orphaned',
      },
    ]);

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'SCHEMA_VALIDATION_ERROR',
        objectId: 'mixed-consolidation',
        path: '$[5].security_ids[1]',
      }),
    ]);
  });

  it('rejects duplicate producers without cascading consumer diagnostics', () => {
    const originalIssuance = orphanedSnapshot.find((object) => object.object_type === 'TX_STOCK_ISSUANCE');
    expect(originalIssuance).toBeDefined();
    if (originalIssuance === undefined) throw new Error('Synthetic stock issuance fixture is missing');
    const secondIssuance = {
      ...originalIssuance,
      id: 'stock-issuance-second',
      security_id: 'security-second',
    };
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      secondIssuance,
      {
        object_type: 'TX_STOCK_TRANSFER',
        id: 'producer-1',
        date: '2025-01-01',
        security_id: 'security-orphaned',
        quantity: '10',
        resulting_security_ids: ['duplicate-output'],
      },
      {
        object_type: 'TX_STOCK_TRANSFER',
        id: 'producer-2',
        date: '2025-01-01',
        security_id: 'security-second',
        quantity: '10',
        resulting_security_ids: ['duplicate-output'],
      },
      {
        object_type: 'TX_STOCK_RETRACTION',
        id: 'consumer-1',
        date: '2025-01-02',
        security_id: 'duplicate-output',
        reason_text: 'First terminal consumer',
      },
      {
        object_type: 'TX_STOCK_RETRACTION',
        id: 'consumer-2',
        date: '2025-01-03',
        security_id: 'duplicate-output',
        reason_text: 'Second terminal consumer',
      },
    ];

    expectSchemaValid(objects);
    const result = validateOcfCapTableSnapshot(objects);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'AMBIGUOUS_SECURITY_REFERENCE',
      'AMBIGUOUS_SECURITY_REFERENCE',
      'DUPLICATE_SECURITY_PRODUCER',
    ]);
    expect(result.issues.filter((issue) => issue.code === 'AMBIGUOUS_SECURITY_REFERENCE')).toEqual([
      expect.objectContaining({
        expectedSecurityFamilies: ['stock'],
        producerObjectTypes: ['TX_STOCK_TRANSFER'],
      }),
      expect.objectContaining({
        expectedSecurityFamilies: ['stock'],
        producerObjectTypes: ['TX_STOCK_TRANSFER'],
      }),
    ]);
  });

  it('rejects multiple terminal consumers of one uniquely produced security', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      {
        object_type: 'TX_STOCK_RETRACTION',
        id: 'consumer-1',
        date: '2025-01-02',
        security_id: 'security-orphaned',
        reason_text: 'First terminal consumer',
      },
      {
        object_type: 'TX_STOCK_RETRACTION',
        id: 'consumer-2',
        date: '2025-01-03',
        security_id: 'security-orphaned',
        reason_text: 'Second terminal consumer',
      },
    ];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects).issues).toEqual([
      expect.objectContaining({
        code: 'MULTIPLE_SECURITY_CONSUMERS',
        referenceId: 'security-orphaned',
        consumerObjectTypes: ['TX_STOCK_RETRACTION'],
        count: 2,
      }),
    ]);
  });

  it('rejects self-contained security-lineage cycles deterministically', () => {
    const issuer = orphanedSnapshot.find((object) => object.object_type === 'ISSUER');
    expect(issuer).toBeDefined();
    const objects: OcfCapTableSnapshotObject[] = [
      issuer as OcfCapTableSnapshotObject,
      {
        object_type: 'TX_STOCK_TRANSFER',
        id: 'cycle-a',
        date: '2025-01-01',
        security_id: 'security-a',
        quantity: '1',
        resulting_security_ids: ['security-b'],
      },
      {
        object_type: 'TX_STOCK_TRANSFER',
        id: 'cycle-b',
        date: '2025-01-02',
        security_id: 'security-b',
        quantity: '1',
        resulting_security_ids: ['security-a'],
      },
    ];

    expectSchemaValid(objects);
    const forward = validateOcfCapTableSnapshot(objects);
    const reverse = validateOcfCapTableSnapshot([...objects].reverse());
    expect(reverse).toEqual(forward);
    expect(forward.issues).toEqual([
      expect.objectContaining({
        code: 'SECURITY_LINEAGE_CYCLE',
        referenceId: 'security-a',
        cycleIds: ['security-a', 'security-b'],
      }),
    ]);
  });

  it('validates long security lineages with repeated root-dependent observers', () => {
    const transitionCount = 15_000;
    const objects: OcfCapTableSnapshotObject[] = [
      { object_type: 'ISSUER', id: 'issuer-1' },
      {
        object_type: 'VESTING_TERMS',
        id: 'vesting-terms',
        vesting_conditions: [{ id: 'condition', trigger: { type: 'VESTING_EVENT' } }],
      },
      {
        object_type: 'TX_STOCK_ISSUANCE',
        id: 'root-issuance',
        security_id: 'security-0',
        vesting_terms_id: 'vesting-terms',
      },
      ...Array.from({ length: transitionCount }, (_, index) => ({
        object_type: 'TX_STOCK_TRANSFER',
        id: `transfer-${String(index).padStart(5, '0')}`,
        security_id: `security-${index}`,
        resulting_security_ids: [`security-${index + 1}`],
      })),
      ...Array.from({ length: transitionCount + 1 }, (_, index) => ({
        object_type: 'TX_VESTING_EVENT',
        id: `vesting-event-${String(index).padStart(5, '0')}`,
        security_id: `security-${index}`,
        vesting_condition_id: 'condition',
      })),
    ];

    expect(validateOcfCapTableSnapshot(objects)).toEqual({ valid: true, issues: [] });
  });

  it('validates cumulative consolidation lineage without materializing every root list', () => {
    const rootCount = 8_000;
    const objects: OcfCapTableSnapshotObject[] = [
      { object_type: 'ISSUER', id: 'issuer-1' },
      ...Array.from({ length: rootCount }, (_, index) => ({
        object_type: 'VESTING_TERMS',
        id: `vesting-${String(index).padStart(5, '0')}`,
        vesting_conditions: [],
      })),
      ...Array.from({ length: rootCount }, (_, index) => ({
        object_type: 'TX_STOCK_ISSUANCE',
        id: `issuance-${String(index).padStart(5, '0')}`,
        security_id: `root-security-${index}`,
        vesting_terms_id: `vesting-${String(index).padStart(5, '0')}`,
      })),
      ...Array.from({ length: rootCount - 1 }, (_, offset) => {
        const index = offset + 1;
        return {
          object_type: 'TX_STOCK_CONSOLIDATION',
          id: `consolidation-${String(index).padStart(5, '0')}`,
          security_ids: [index === 1 ? 'root-security-0' : `consolidated-${index - 1}`, `root-security-${index}`],
          resulting_security_id: `consolidated-${index}`,
        };
      }),
      {
        object_type: 'TX_VESTING_EVENT',
        id: 'final-vesting-event',
        security_id: `consolidated-${rootCount - 1}`,
        vesting_condition_id: 'condition',
      },
    ];

    expect(validateOcfCapTableSnapshot(objects).issues).toEqual([
      expect.objectContaining({
        code: 'AMBIGUOUS_VESTING_TERMS',
        witnessVestingTermsIds: ['vesting-00000', 'vesting-00001'],
      }),
    ]);
  });

  it('reports deterministic exemplar vesting terms for a lineage with three roots', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      { object_type: 'ISSUER', id: 'issuer-1' },
      ...['vesting-c', 'vesting-a', 'vesting-b'].map((id) => ({
        object_type: 'VESTING_TERMS',
        id,
        vesting_conditions: [],
      })),
      ...[
        ['security-c', 'vesting-c'],
        ['security-a', 'vesting-a'],
        ['security-b', 'vesting-b'],
      ].map(([securityId, vestingTermsId]) => ({
        object_type: 'TX_STOCK_ISSUANCE',
        id: `issuance-${securityId}`,
        security_id: securityId,
        vesting_terms_id: vestingTermsId,
      })),
      {
        object_type: 'TX_STOCK_CONSOLIDATION',
        id: 'consolidation-ca',
        security_ids: ['security-c', 'security-a'],
        resulting_security_id: 'security-ca',
      },
      {
        object_type: 'TX_STOCK_CONSOLIDATION',
        id: 'consolidation-cab',
        security_ids: ['security-ca', 'security-b'],
        resulting_security_id: 'security-cab',
      },
      {
        object_type: 'TX_VESTING_EVENT',
        id: 'ambiguous-vesting-event',
        security_id: 'security-cab',
        vesting_condition_id: 'condition',
      },
    ];

    const result = validateOcfCapTableSnapshot(objects);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'AMBIGUOUS_VESTING_TERMS',
        securityId: 'security-cab',
        witnessVestingTermsIds: ['vesting-a', 'vesting-b'],
      }),
    ]);
    const issue = result.issues[0];
    expect(issue).not.toHaveProperty('count');
    expect(Object.isFrozen(issue)).toBe(true);
    if (issue?.code === 'AMBIGUOUS_VESTING_TERMS') {
      expect(Object.isFrozen(issue.witnessVestingTermsIds)).toBe(true);
    }
  });

  it('reports malformed transition output containers with exact paths', () => {
    const result = validateOcfCapTableSnapshot([
      ...completeStockSnapshot(),
      {
        object_type: 'TX_STOCK_TRANSFER',
        id: 'malformed-output',
        security_id: 'security-orphaned',
        resulting_security_ids: ['valid-output', 42, ''],
        balance_security_id: null,
      },
    ]);

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'SCHEMA_VALIDATION_ERROR',
        objectId: 'malformed-output',
        path: '$[5].balance_security_id',
      }),
      expect.objectContaining({
        code: 'SCHEMA_VALIDATION_ERROR',
        objectId: 'malformed-output',
        path: '$[5].resulting_security_ids[1]',
      }),
    ]);
  });

  it('reports each canonical object type once for a duplicate security id', () => {
    const result = validateOcfCapTableSnapshot([
      { object_type: 'ISSUER', id: 'issuer-1' },
      { object_type: 'TX_STOCK_ISSUANCE', id: 'stock-1', security_id: 'duplicate-security' },
      { object_type: 'TX_STOCK_ISSUANCE', id: 'stock-2', security_id: 'duplicate-security' },
    ]);

    expect(result.issues.find((issue) => issue.code === 'DUPLICATE_SECURITY_PRODUCER')).toEqual(
      expect.objectContaining({
        producerObjectTypes: ['TX_STOCK_ISSUANCE'],
        count: 2,
      })
    );
  });

  it('validates vesting condition identity and trigger kind from the referenced issuance', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      { object_type: 'ISSUER', id: 'issuer-1' },
      { object_type: 'STAKEHOLDER', id: 'stakeholder-1' },
      {
        object_type: 'VESTING_TERMS',
        id: 'vesting-1',
        vesting_conditions: [{ id: 'condition-1', trigger: { type: 'VESTING_EVENT' } }],
      },
      {
        object_type: 'TX_WARRANT_ISSUANCE',
        id: 'warrant-1',
        stakeholder_id: 'stakeholder-1',
        security_id: 'security-1',
        vesting_terms_id: 'vesting-1',
        exercise_triggers: [],
      },
      {
        object_type: 'TX_VESTING_START',
        id: 'vesting-start-1',
        security_id: 'security-1',
        vesting_condition_id: 'condition-1',
      },
      {
        object_type: 'TX_VESTING_EVENT',
        id: 'vesting-event-1',
        security_id: 'security-1',
        vesting_condition_id: 'missing-condition',
      },
    ];

    expect(issueCodes(objects)).toEqual(['MISSING_VESTING_CONDITION', 'VESTING_TRIGGER_MISMATCH']);
  });

  it('treats an empty issuance vesting_terms_id as absent for a vesting transaction', () => {
    const result = validateOcfCapTableSnapshot([
      { object_type: 'ISSUER', id: 'issuer-1' },
      { object_type: 'STAKEHOLDER', id: 'stakeholder-1' },
      {
        object_type: 'TX_WARRANT_ISSUANCE',
        id: 'warrant-1',
        stakeholder_id: 'stakeholder-1',
        security_id: 'security-1',
        vesting_terms_id: '',
        exercise_triggers: [],
      },
      {
        object_type: 'TX_VESTING_START',
        id: 'vesting-start-1',
        security_id: 'security-1',
        vesting_condition_id: 'condition-1',
      },
    ]);

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'MISSING_VESTING_TERMS',
        objectId: 'vesting-start-1',
        path: 'security_id.vesting_terms_id',
        targetObjectTypes: ['VESTING_TERMS'],
      }),
    ]);
  });

  it('rejects duplicate, dangling, and self-referencing vesting conditions after schema validation', () => {
    const issuer = orphanedSnapshot.find((object) => object.object_type === 'ISSUER');
    expect(issuer).toBeDefined();
    const vestingTerms: OcfCapTableSnapshotObject = {
      object_type: 'VESTING_TERMS',
      id: 'vesting-graph-invalid',
      name: 'Invalid graph',
      description: 'Schema-valid but structurally invalid',
      allocation_type: 'CUMULATIVE_ROUNDING',
      vesting_conditions: [
        {
          id: 'duplicate-condition',
          quantity: '1',
          trigger: { type: 'VESTING_START_DATE' },
          next_condition_ids: ['duplicate-condition', 'missing-condition'],
        },
        {
          id: 'duplicate-condition',
          quantity: '1',
          trigger: { type: 'VESTING_EVENT' },
          next_condition_ids: [],
        },
      ],
    };
    const objects = [issuer as OcfCapTableSnapshotObject, vestingTerms];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects).issues).toEqual([
      expect.objectContaining({
        code: 'DUPLICATE_VESTING_CONDITION_ID',
        objectId: 'vesting-graph-invalid',
        referenceId: 'duplicate-condition',
        count: 2,
      }),
      expect.objectContaining({
        code: 'MISSING_VESTING_CONDITION',
        path: 'vesting_conditions[0].next_condition_ids[1]',
        referenceId: 'missing-condition',
      }),
      expect.objectContaining({
        code: 'SELF_VESTING_CONDITION_REFERENCE',
        path: 'vesting_conditions[0].next_condition_ids[0]',
        referenceId: 'duplicate-condition',
      }),
    ]);
  });

  it('detects cycles across next-condition and relative-trigger dependency edges', () => {
    const issuer = orphanedSnapshot.find((object) => object.object_type === 'ISSUER');
    expect(issuer).toBeDefined();
    const vestingTerms: OcfCapTableSnapshotObject = {
      object_type: 'VESTING_TERMS',
      id: 'vesting-graph-cycle',
      name: 'Cyclic graph',
      description: 'Mixed dependency cycle',
      allocation_type: 'CUMULATIVE_ROUNDING',
      vesting_conditions: [
        {
          id: 'condition-a',
          quantity: '1',
          trigger: {
            type: 'VESTING_SCHEDULE_RELATIVE',
            period: { type: 'DAYS', length: 30, occurrences: 1 },
            relative_to_condition_id: 'condition-b',
          },
          next_condition_ids: ['condition-b'],
        },
        {
          id: 'condition-b',
          quantity: '1',
          trigger: { type: 'VESTING_EVENT' },
          next_condition_ids: [],
        },
      ],
    };
    const objects = [issuer as OcfCapTableSnapshotObject, vestingTerms];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects).issues).toEqual([
      expect.objectContaining({
        code: 'VESTING_CONDITION_CYCLE',
        objectId: 'vesting-graph-cycle',
        referenceId: 'condition-a',
        cycleIds: ['condition-a', 'condition-b'],
      }),
    ]);
  });

  it('rejects dangling and self-relative vesting trigger references', () => {
    const issuer = orphanedSnapshot.find((object) => object.object_type === 'ISSUER');
    expect(issuer).toBeDefined();
    const relativeTrigger = (relativeToConditionId: string) => ({
      type: 'VESTING_SCHEDULE_RELATIVE',
      period: { type: 'DAYS', length: 30, occurrences: 1 },
      relative_to_condition_id: relativeToConditionId,
    });
    const vestingTerms: OcfCapTableSnapshotObject = {
      object_type: 'VESTING_TERMS',
      id: 'vesting-relative-invalid',
      name: 'Invalid relative graph',
      description: 'Bad relative references',
      allocation_type: 'CUMULATIVE_ROUNDING',
      vesting_conditions: [
        {
          id: 'condition-self',
          quantity: '1',
          trigger: relativeTrigger('condition-self'),
          next_condition_ids: [],
        },
        {
          id: 'condition-missing',
          quantity: '1',
          trigger: relativeTrigger('not-present'),
          next_condition_ids: [],
        },
      ],
    };
    const objects = [issuer as OcfCapTableSnapshotObject, vestingTerms];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects).issues).toEqual([
      expect.objectContaining({
        code: 'MISSING_VESTING_CONDITION',
        path: 'vesting_conditions[1].trigger.relative_to_condition_id',
        referenceId: 'not-present',
      }),
      expect.objectContaining({
        code: 'SELF_VESTING_CONDITION_REFERENCE',
        path: 'vesting_conditions[0].trigger.relative_to_condition_id',
        referenceId: 'condition-self',
      }),
    ]);
  });

  it('returns the same issue ordering regardless of input order', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      { object_type: 'TX_NOT_REAL', id: 'unsupported-1' },
      { object_type: 'ISSUER', id: 'issuer-1' },
      { object_type: 'ISSUER', id: 'issuer-1' },
      {
        object_type: 'TX_STOCK_ISSUANCE',
        id: 'stock-1',
        security_id: 'security-1',
        stakeholder_id: 'missing-stakeholder',
        stock_class_id: 'missing-class',
        stock_legend_ids: [],
      },
    ];

    const forward = validateOcfCapTableSnapshot(objects);
    const reverse = validateOcfCapTableSnapshot([...objects].reverse());

    expect(reverse).toEqual(forward);
    expect(forward.issues.map((issue) => issue.code)).toEqual(['UNSUPPORTED_OBJECT_TYPE']);
  });

  it('does not select an arbitrary duplicate stock plan when validating membership', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      { object_type: 'ISSUER', id: 'issuer-1' },
      { object_type: 'STAKEHOLDER', id: 'stakeholder-1' },
      { object_type: 'STOCK_CLASS', id: 'class-1' },
      { object_type: 'STOCK_CLASS', id: 'class-2' },
      { object_type: 'STOCK_PLAN', id: 'duplicate-plan', stock_class_ids: ['class-1'] },
      { object_type: 'STOCK_PLAN', id: 'duplicate-plan', stock_class_ids: ['class-2'] },
      {
        object_type: 'TX_STOCK_ISSUANCE',
        id: 'stock-1',
        security_id: 'security-1',
        stakeholder_id: 'stakeholder-1',
        stock_class_id: 'class-2',
        stock_plan_id: 'duplicate-plan',
        stock_legend_ids: [],
      },
    ];

    const forward = validateOcfCapTableSnapshot(objects);
    const reverse = validateOcfCapTableSnapshot([...objects].reverse());

    expect(reverse).toEqual(forward);
    expect(forward.issues).toEqual([
      expect.objectContaining({
        code: 'DUPLICATE_OBJECT_ID',
        objectType: 'STOCK_PLAN',
        objectId: 'duplicate-plan',
      }),
    ]);
  });
});
