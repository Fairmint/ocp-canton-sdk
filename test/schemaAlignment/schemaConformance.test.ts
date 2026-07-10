import Ajv from 'ajv';
import fs from 'fs';
import path from 'path';
import {
  compareConditionalRegistry,
  dereferencePinnedObjectSchemas,
  dereferencePinnedSchemaFile,
  discoverConditionalPathsInValue,
  getNamedTypeProperty,
  inventoryCanonicalOcfObjects,
  inventoryReachableObjectSchemas,
  resolveJsonPointer,
  validateCoverageReferences,
  validateSemanticRefinements,
  type CanonicalOcfObjectInventoryEntry,
} from './schemaConformanceHarness';
import {
  EXPECTED_SEMANTIC_REFINEMENTS,
  OCF_CONDITIONAL_COVERAGE,
  PINNED_REACHABLE_SCHEMA_FINGERPRINT,
} from './schemaConformanceRegistry';

const REPO_ROOT = path.resolve(__dirname, '../..');
const SCHEMA_ROOT = path.join(REPO_ROOT, 'libs', 'Open-Cap-Format-OCF', 'schema');
const CANONICAL_INVENTORY_PATH = path.join(__dirname, 'canonicalOcfObjectInventory.json');
const PPS_SCHEMA_PATH = 'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json';

function readCanonicalInventory(): CanonicalOcfObjectInventoryEntry[] {
  return JSON.parse(fs.readFileSync(CANONICAL_INVENTORY_PATH, 'utf8')) as CanonicalOcfObjectInventoryEntry[];
}

describe('schema-driven OCF conformance guardrail', () => {
  const schemaInventory = inventoryReachableObjectSchemas(SCHEMA_ROOT);

  it('dereferences every pinned object schema using local-only resolution', () => {
    const dereferenced = dereferencePinnedObjectSchemas(SCHEMA_ROOT);
    expect(Object.keys(dereferenced.properties as Record<string, unknown>)).toHaveLength(
      schemaInventory.objectSchemaCount
    );
    expect(JSON.stringify(dereferenced)).not.toContain('"$ref"');
  });

  it('resolves an empty JSON Pointer fragment to the document root', () => {
    const document = { marker: 'root' };

    expect(resolveJsonPointer(document, '', 'synthetic.schema.json')).toBe(document);
  });

  it('resolves a slash JSON Pointer to the empty-string member', () => {
    const document = { '': { type: 'string' }, marker: 'root' };

    expect(resolveJsonPointer(document, '/', 'synthetic.schema.json')).toEqual({ type: 'string' });
  });

  it('decodes escaped slash and tilde JSON Pointer segments in RFC 6901 order', () => {
    const document = {
      'a/b': {
        'm~n': {
          '~1': 'escaped-value',
        },
      },
    };

    expect(resolveJsonPointer(document, '/a~1b/m~0n/~01', 'synthetic.schema.json')).toBe('escaped-value');
  });

  it.each(['/01', '/-0', '/1e0'])('rejects non-canonical array JSON Pointer index %s', (fragment) => {
    expect(() => resolveJsonPointer(['zero', 'one'], fragment, 'synthetic.schema.json')).toThrow(
      'Invalid array JSON Pointer segment'
    );
  });

  it('rejects invalid JSON Pointer escape sequences', () => {
    expect(() => resolveJsonPointer({ '~2': 'invalid' }, '/~2', 'synthetic.schema.json')).toThrow(
      'Invalid JSON Pointer escape sequence'
    );
  });

  it('resolves canonical array indices and rejects out-of-bounds indices', () => {
    expect(resolveJsonPointer(['zero', 'one'], '/0', 'synthetic.schema.json')).toBe('zero');
    expect(resolveJsonPointer(['zero', 'one'], '/1', 'synthetic.schema.json')).toBe('one');
    expect(() => resolveJsonPointer(['zero', 'one'], '/2', 'synthetic.schema.json')).toThrow(
      'Invalid array JSON Pointer segment'
    );
  });

  it('fails on any reachable pinned schema content drift', () => {
    expect(schemaInventory).toMatchObject({
      fingerprint: PINNED_REACHABLE_SCHEMA_FINGERPRINT,
      objectSchemaCount: 56,
      reachableSchemaCount: 160,
    });
  });

  it('registers every conditional exactly once with a live runtime or type-test target', () => {
    const problems = compareConditionalRegistry(
      schemaInventory.conditionals.map((conditional) => conditional.path),
      OCF_CONDITIONAL_COVERAGE
    );
    expect(problems).toEqual([]);
    validateCoverageReferences(REPO_ROOT, OCF_CONDITIONAL_COVERAGE);
    validateSemanticRefinements(SCHEMA_ROOT, OCF_CONDITIONAL_COVERAGE, EXPECTED_SEMANTIC_REFINEMENTS);
  });

  it('detects newly introduced conditional paths', () => {
    const discovered = discoverConditionalPathsInValue(
      { properties: { future_rule: { anyOf: [{ type: 'string' }, { type: 'number' }] } } },
      'schema/objects/Synthetic.schema.json'
    ).map((conditional) => conditional.path);
    expect(compareConditionalRegistry(discovered, [])).toEqual([
      {
        kind: 'missing',
        path: 'schema/objects/Synthetic.schema.json#/properties/future_rule/anyOf',
      },
    ]);
  });

  it('detects stale and duplicate conditional registrations', () => {
    const pathValue = 'schema/objects/Synthetic.schema.json#/oneOf';
    const registration = { coverage: [], path: pathValue };
    expect(compareConditionalRegistry([], [registration])).toEqual([{ kind: 'stale', path: pathValue }]);
    expect(compareConditionalRegistry([pathValue], [registration, registration])).toEqual([
      { kind: 'duplicate', path: pathValue },
    ]);
  });

  it('snapshots compiler-resolved canonical OcfObject properties and discriminators', () => {
    const compilerInventory = inventoryCanonicalOcfObjects(REPO_ROOT);
    // 48 ledger-backed registry entities plus the schema-only Financing object.
    expect(compilerInventory).toHaveLength(49);
    expect(compilerInventory).toEqual(readCanonicalInventory());
  });
});

describe('intentional SDK semantic refinements', () => {
  it('keeps conversion-right discriminators required despite the upstream omission', () => {
    const schemaFilesAndSdkTypes = [
      [
        'schema/types/conversion_rights/ConvertibleConversionRight.schema.json',
        'ConvertibleConversionRight',
        '"CONVERTIBLE_CONVERSION_RIGHT"',
      ],
      [
        'schema/types/conversion_rights/StockClassConversionRight.schema.json',
        'StockClassConversionRight',
        '"STOCK_CLASS_CONVERSION_RIGHT"',
      ],
      [
        'schema/types/conversion_rights/WarrantConversionRight.schema.json',
        'WarrantConversionRight',
        '"WARRANT_CONVERSION_RIGHT"',
      ],
    ] as const;

    for (const [schemaPath, sdkType, expectedDiscriminator] of schemaFilesAndSdkTypes) {
      const rawSchema = JSON.parse(
        fs.readFileSync(path.join(SCHEMA_ROOT, schemaPath.replace(/^schema\//, '')), 'utf8')
      ) as { properties?: { type?: { const?: unknown } }; required?: string[] };
      expect(rawSchema.properties?.type?.const).toBeDefined();
      expect(rawSchema.required).not.toContain('type');

      const typeProperty = getNamedTypeProperty(REPO_ROOT, sdkType, 'type');
      expect(typeProperty.optional).toBe(false);
      expect(typeProperty.type).toBe(expectedDiscriminator);
    }
  });

  it('requires the stock-class destination needed by the generated DAML contract', () => {
    const rawSchema = JSON.parse(
      fs.readFileSync(path.join(SCHEMA_ROOT, 'types/conversion_rights/StockClassConversionRight.schema.json'), 'utf8')
    ) as { required?: string[] };
    expect(rawSchema.required).not.toContain('converts_to_stock_class_id');

    const targetProperty = getNamedTypeProperty(REPO_ROOT, 'StockClassConversionRight', 'converts_to_stock_class_id');
    expect(targetProperty.optional).toBe(false);
    expect(targetProperty.type).toBe('string');
  });

  it('enforces PPS discount exclusivity beyond the pinned draft-07 schema gap', () => {
    const ppsSchema = dereferencePinnedSchemaFile(SCHEMA_ROOT, PPS_SCHEMA_PATH);
    const validate = new Ajv({ allErrors: true, strict: false }).compile(ppsSchema);
    const schemaLoophole = {
      type: 'PPS_BASED_CONVERSION',
      description: 'Stale discount details remain',
      discount: false,
      discount_percentage: '0.2',
    };

    expect(validate(schemaLoophole)).toBe(true);

    const ppsRegistrations = OCF_CONDITIONAL_COVERAGE.filter((entry) => entry.path.startsWith(PPS_SCHEMA_PATH));
    expect(ppsRegistrations).toHaveLength(4);
    expect(ppsRegistrations.every((entry) => entry.refinement === 'pps-discount-exclusivity')).toBe(true);
    expect(EXPECTED_SEMANTIC_REFINEMENTS).toContainEqual(
      expect.objectContaining({
        expectedSdkContract: expect.stringContaining('discount=false with neither field'),
        id: 'pps-discount-exclusivity',
      })
    );
  });
});
