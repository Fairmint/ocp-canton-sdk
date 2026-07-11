import Ajv from 'ajv';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { ConvertibleMechanismPpsBased, WarrantMechanismPpsBased } from '../../src/types/native';
import {
  compareCodeUnits,
  compareConditionalRegistry,
  dereferencePinnedObjectSchemas,
  dereferencePinnedSchemaFile,
  discoverConditionalPathsInValue,
  getNamedTypeProperty,
  inventoryCanonicalOcfObjects,
  inventoryReachableObjectSchemas,
  normalizeFingerprintText,
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

// PR #419 records the upstream PPS branches without claiming an SDK refinement
// that the current public types do not enforce. PR #420 can replace these
// assignable counterexamples with an exact refinement assertion when its
// discriminated conversion-mechanism type lands.
const CURRENTLY_ASSIGNABLE_PPS_COUNTEREXAMPLES = {
  discountedWithoutDetail: {
    type: 'PPS_BASED_CONVERSION',
    description: 'Discount details are missing',
    discount: true,
  } satisfies ConvertibleMechanismPpsBased,
  nonDiscountedWithPercentage: {
    type: 'PPS_BASED_CONVERSION',
    description: 'Stale discount details remain',
    discount: false,
    discount_percentage: '0.2',
  } satisfies WarrantMechanismPpsBased,
} as const;

function readCanonicalInventory(): CanonicalOcfObjectInventoryEntry[] {
  return JSON.parse(fs.readFileSync(CANONICAL_INVENTORY_PATH, 'utf8')) as CanonicalOcfObjectInventoryEntry[];
}

const syntheticRepoRoots: string[] = [];

function createSyntheticOcfRepo(memberType: 'number' | 'string'): string {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ocp-schema-inventory-'));
  syntheticRepoRoots.push(repoRoot);
  fs.mkdirSync(path.join(repoRoot, 'src', 'types'), { recursive: true });
  fs.writeFileSync(
    path.join(repoRoot, 'tsconfig.tests.json'),
    JSON.stringify({
      compilerOptions: { module: 'commonjs', noEmit: true, strict: true, target: 'ES2020' },
      include: ['src/**/*.ts'],
    })
  );
  fs.writeFileSync(
    path.join(repoRoot, 'src', 'types', 'output.ts'),
    `export type OcfObject = {
      readonly object_type: 'SYNTHETIC';
      readonly optional_member?: ${memberType};
      readonly optional_member_with_explicit_undefined?: ${memberType} | undefined;
      readonly required_member: ${memberType};
    };\n`
  );
  return repoRoot;
}

afterAll(() => {
  syntheticRepoRoots.forEach((repoRoot) => fs.rmSync(repoRoot, { force: true, recursive: true }));
});

describe('schema-driven OCF conformance guardrail', () => {
  const schemaInventory = inventoryReachableObjectSchemas(SCHEMA_ROOT);

  it('uses locale-independent code-unit ordering for canonical inventories', () => {
    expect(['issuance/Issuance.schema.json', 'IssuerTransaction.schema.json'].sort(compareCodeUnits)).toEqual([
      'IssuerTransaction.schema.json',
      'issuance/Issuance.schema.json',
    ]);
  });

  it('normalizes checkout-specific line endings before hashing schemas', () => {
    expect(normalizeFingerprintText('first\r\nsecond\rthird\n')).toBe('first\nsecond\nthird\n');
  });

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

  it('detects canonical OcfObject member-type drift without a property-name change', () => {
    const stringMemberInventory = inventoryCanonicalOcfObjects(createSyntheticOcfRepo('string'));
    const numberMemberInventory = inventoryCanonicalOcfObjects(createSyntheticOcfRepo('number'));

    expect(stringMemberInventory).toEqual([
      {
        discriminator: 'SYNTHETIC',
        optionalProperties: ['optional_member', 'optional_member_with_explicit_undefined'],
        propertyTypes: {
          object_type: '"SYNTHETIC"',
          optional_member: 'string',
          optional_member_with_explicit_undefined: 'string | undefined',
          required_member: 'string',
        },
        requiredProperties: ['object_type', 'required_member'],
      },
    ]);
    expect(numberMemberInventory).not.toEqual(stringMemberInventory);
    expect(numberMemberInventory[0]?.propertyTypes).toMatchObject({
      optional_member: 'number',
      optional_member_with_explicit_undefined: 'number | undefined',
      required_member: 'number',
    });
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
        'WarrantStockClassConversionRight',
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

  it('defers PPS discount exclusivity until the SDK contract enforces it', () => {
    const ppsSchema = dereferencePinnedSchemaFile(SCHEMA_ROOT, PPS_SCHEMA_PATH);
    const validate = new Ajv({ allErrors: true, strict: false }).compile(ppsSchema);

    expect(validate(CURRENTLY_ASSIGNABLE_PPS_COUNTEREXAMPLES.nonDiscountedWithPercentage)).toBe(true);
    expect(CURRENTLY_ASSIGNABLE_PPS_COUNTEREXAMPLES.discountedWithoutDetail).toMatchObject({
      discount: true,
    });

    const ppsRegistrations = OCF_CONDITIONAL_COVERAGE.filter((entry) => entry.path.startsWith(PPS_SCHEMA_PATH));
    expect(ppsRegistrations).toHaveLength(4);
    expect(ppsRegistrations.every((entry) => entry.refinement === undefined)).toBe(true);
    expect(EXPECTED_SEMANTIC_REFINEMENTS.map((refinement) => refinement.id)).not.toContain('pps-discount-exclusivity');
  });
});
