import Ajv from 'ajv';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  compareCanonicalNonEmptyArrays,
  compareCanonicalOcfPropertySets,
  compareCodeUnits,
  compareConditionalRegistry,
  dereferencePinnedObjectSchemas,
  dereferencePinnedSchemaFile,
  discoverConditionalPathsInValue,
  getNamedTypeProperty,
  getObjectSchemaDiscriminators,
  inventoryCanonicalOcfNonEmptyArrays,
  inventoryCanonicalOcfObjects,
  inventoryPinnedOcfNonEmptyArrays,
  inventoryPinnedOcfObjectProperties,
  inventoryReachableObjectSchemas,
  normalizeFingerprintText,
  resolveJsonPointer,
  validateCoverageReferences,
  validateSemanticRefinements,
  type CanonicalOcfObjectInventoryEntry,
} from './schemaConformanceHarness';
import {
  CANONICAL_PROPERTY_PARITY_EXCLUSIONS,
  EXPECTED_SEMANTIC_REFINEMENTS,
  OCF_CONDITIONAL_COVERAGE,
  PINNED_CANONICAL_NON_EMPTY_ARRAYS,
  PINNED_REACHABLE_SCHEMA_FINGERPRINT,
  RETIRED_PLAN_SECURITY_SCHEMA_PAIRS,
} from './schemaConformanceRegistry';

const REPO_ROOT = path.resolve(__dirname, '../..');
const SCHEMA_ROOT = path.join(REPO_ROOT, 'libs', 'Open-Cap-Format-OCF', 'schema');
const CANONICAL_INVENTORY_PATH = path.join(__dirname, 'canonicalOcfObjectInventory.json');
const PPS_SCHEMA_PATH = 'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json';

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

function createSyntheticNonEmptySchemaRoot(keyword: 'anyOf' | 'oneOf'): string {
  const schemaRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ocp-non-empty-schema-'));
  syntheticRepoRoots.push(schemaRoot);
  const objectRoot = path.join(schemaRoot, 'objects');
  fs.mkdirSync(objectRoot, { recursive: true });
  fs.writeFileSync(
    path.join(objectRoot, 'Synthetic.schema.json'),
    JSON.stringify({
      [keyword]: [
        {
          properties: {
            object_type: { const: 'SYNTHETIC' },
            branch_only_items: { type: 'array', minItems: 1 },
            items: { type: 'array', minItems: 2 },
          },
          type: 'object',
        },
        {
          properties: {
            object_type: { const: 'SYNTHETIC' },
            items: { type: 'array', minItems: 1 },
          },
          type: 'object',
        },
      ],
    })
  );
  return schemaRoot;
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

  it('matches every canonical public DTO property set to its pinned dereferenced object schema', () => {
    const compilerInventory = inventoryCanonicalOcfObjects(REPO_ROOT);
    const pinnedPropertyInventory = inventoryPinnedOcfObjectProperties(SCHEMA_ROOT);
    expect(
      compareCanonicalOcfPropertySets(compilerInventory, pinnedPropertyInventory, CANONICAL_PROPERTY_PARITY_EXCLUSIONS)
    ).toEqual([]);
  });

  it('discovers object_type literals across composed object schemas', () => {
    expect(
      getObjectSchemaDiscriminators(
        {
          allOf: [
            { properties: { object_type: { enum: ['ALL_OF_OBJECT', 'OTHER_OBJECT'] } } },
            { properties: { object_type: { const: 'ALL_OF_OBJECT' } } },
          ],
        },
        'synthetic-all-of-object.schema.json'
      )
    ).toEqual(['ALL_OF_OBJECT']);

    expect(
      getObjectSchemaDiscriminators(
        {
          anyOf: [
            { properties: { object_type: { const: 'ANY_OF_OBJECT' } } },
            { properties: { object_type: { enum: ['ANY_OF_ALTERNATE', 'ANY_OF_OBJECT'] } } },
          ],
        },
        'synthetic-any-of-object.schema.json'
      )
    ).toEqual(['ANY_OF_ALTERNATE', 'ANY_OF_OBJECT']);

    expect(
      getObjectSchemaDiscriminators(
        {
          oneOf: [
            { properties: { object_type: { const: 'ONE_OF_OBJECT' } } },
            {
              allOf: [
                { properties: { object_type: { enum: ['ONE_OF_ALTERNATE', 'OTHER_OBJECT'] } } },
                { properties: { object_type: { const: 'ONE_OF_ALTERNATE' } } },
              ],
            },
          ],
        },
        'synthetic-one-of-object.schema.json'
      )
    ).toEqual(['ONE_OF_ALTERNATE', 'ONE_OF_OBJECT']);
  });

  it('terminates discriminator discovery for cyclic in-memory composition graphs', () => {
    const cyclicSchema: Record<string, unknown> = {
      properties: { object_type: { const: 'CYCLIC_OBJECT' } },
    };
    cyclicSchema.allOf = [cyclicSchema];

    expect(getObjectSchemaDiscriminators(cyclicSchema, 'synthetic-cyclic-object.schema.json')).toEqual([
      'CYCLIC_OBJECT',
    ]);
  });

  it('rejects excessively deep in-memory composition graphs', () => {
    const root: Record<string, unknown> = {};
    let current = root;
    for (let depth = 0; depth <= 100; depth += 1) {
      const next: Record<string, unknown> = {};
      current.allOf = [next];
      current = next;
    }
    current.properties = { object_type: { const: 'TOO_DEEP_OBJECT' } };

    expect(() => getObjectSchemaDiscriminators(root, 'synthetic-deep-object.schema.json')).toThrow(
      'Object schema composition exceeds 100 levels: synthetic-deep-object.schema.json'
    );
  });

  it('rejects malformed object_type declarations in composed schemas', () => {
    expect(() =>
      getObjectSchemaDiscriminators(
        { allOf: [{ properties: { object_type: { type: 'string' } } }] },
        'synthetic-malformed-object.schema.json'
      )
    ).toThrow('Object schema has no literal object_type discriminator: synthetic-malformed-object.schema.json');
  });

  it('intersects compatible const and enum object_type constraints', () => {
    expect(
      getObjectSchemaDiscriminators(
        { properties: { object_type: { const: 'COMPATIBLE_OBJECT', enum: ['OTHER_OBJECT', 'COMPATIBLE_OBJECT'] } } },
        'synthetic-compatible-object.schema.json'
      )
    ).toEqual(['COMPATIBLE_OBJECT']);
  });

  it('rejects conflicting const and enum object_type constraints', () => {
    expect(() =>
      getObjectSchemaDiscriminators(
        { properties: { object_type: { const: 'CONST_OBJECT', enum: ['ENUM_OBJECT'] } } },
        'synthetic-conflicting-object.schema.json'
      )
    ).toThrow('Object schema has conflicting object_type discriminators: synthetic-conflicting-object.schema.json');
  });

  it.each([
    {
      expectedMessage: 'Object schema has invalid object_type.const: synthetic-malformed-const.schema.json',
      objectType: { const: '', enum: ['VALID_OBJECT'] },
      source: 'synthetic-malformed-const.schema.json',
    },
    {
      expectedMessage: 'Object schema has invalid object_type.enum: synthetic-malformed-enum.schema.json',
      objectType: { const: 'VALID_OBJECT', enum: [''] },
      source: 'synthetic-malformed-enum.schema.json',
    },
  ])('rejects a malformed present literal keyword in $source', ({ expectedMessage, objectType, source }) => {
    expect(() => getObjectSchemaDiscriminators({ properties: { object_type: objectType } }, source)).toThrow(
      expectedMessage
    );
  });

  it('keeps all seven retired PlanSecurity wrappers schema-identical but outside the public union', () => {
    const compilerInventory = inventoryCanonicalOcfObjects(REPO_ROOT);
    const pinnedPropertyInventory = inventoryPinnedOcfObjectProperties(SCHEMA_ROOT);
    const publicDiscriminators = new Set(compilerInventory.map(({ discriminator }) => discriminator));

    expect(RETIRED_PLAN_SECURITY_SCHEMA_PAIRS).toHaveLength(7);
    for (const pair of RETIRED_PLAN_SECURITY_SCHEMA_PAIRS) {
      expect(publicDiscriminators.has(pair.retiredDiscriminator)).toBe(false);
      expect(publicDiscriminators.has(pair.canonicalDiscriminator)).toBe(true);

      const canonicalSchemas = pinnedPropertyInventory.filter(
        ({ discriminator }) => discriminator === pair.canonicalDiscriminator
      );
      expect(canonicalSchemas).toHaveLength(1);
      const canonicalSchema = canonicalSchemas[0];
      if (!canonicalSchema) throw new Error(`Missing pinned schema for ${pair.canonicalDiscriminator}`);

      const retiredSchemas = pinnedPropertyInventory.filter(
        ({ discriminator }) => discriminator === pair.retiredDiscriminator
      );
      expect(retiredSchemas.map(({ schemaPath }) => schemaPath).sort()).toEqual(
        [canonicalSchema.schemaPath, pair.wrapperSchemaPath].sort()
      );
      for (const retiredSchema of retiredSchemas) {
        expect(retiredSchema.properties).toEqual(canonicalSchema.properties);
      }
    }
  });

  it('detects a newly introduced public DTO property even when the snapshot is regenerated', () => {
    expect(
      compareCanonicalOcfPropertySets(
        [
          {
            discriminator: 'SYNTHETIC',
            optionalProperties: ['rogue_extension'],
            requiredProperties: ['id', 'object_type'],
          },
        ],
        [
          {
            discriminator: 'SYNTHETIC',
            properties: ['id', 'object_type'],
            schemaPath: 'schema/objects/Synthetic.schema.json',
          },
        ],
        []
      )
    ).toEqual([
      {
        discriminator: 'SYNTHETIC',
        kind: 'sdk-only',
        property: 'rogue_extension',
        schemaPath: 'schema/objects/Synthetic.schema.json',
      },
    ]);
  });

  it('detects unexpected schema properties and stale parity exclusions', () => {
    expect(
      compareCanonicalOcfPropertySets(
        [{ discriminator: 'SYNTHETIC', optionalProperties: [], requiredProperties: ['id', 'object_type'] }],
        [
          {
            discriminator: 'SYNTHETIC',
            properties: ['future_schema_field', 'id', 'object_type'],
            schemaPath: 'schema/objects/Synthetic.schema.json',
          },
        ],
        [
          {
            discriminator: 'SYNTHETIC',
            kind: 'schema-only',
            property: 'retired_schema_field',
            rationale: 'Synthetic stale exclusion test.',
          },
        ]
      )
    ).toEqual([
      {
        discriminator: 'SYNTHETIC',
        kind: 'schema-only',
        property: 'future_schema_field',
        schemaPath: 'schema/objects/Synthetic.schema.json',
      },
      {
        discriminator: 'SYNTHETIC',
        kind: 'stale-exclusion',
        property: 'retired_schema_field',
      },
    ]);
  });

  it('marks a property-parity exclusion stale once the underlying property sets match', () => {
    expect(
      compareCanonicalOcfPropertySets(
        [{ discriminator: 'SYNTHETIC', optionalProperties: [], requiredProperties: ['id', 'object_type'] }],
        [
          {
            discriminator: 'SYNTHETIC',
            properties: ['id', 'object_type'],
            schemaPath: 'schema/objects/Synthetic.schema.json',
          },
        ],
        [
          {
            discriminator: 'SYNTHETIC',
            kind: 'schema-only',
            property: 'retired_schema_field',
            rationale: 'Synthetic exclusion that should become stale.',
          },
        ]
      )
    ).toEqual([
      {
        discriminator: 'SYNTHETIC',
        kind: 'stale-exclusion',
        property: 'retired_schema_field',
      },
    ]);
  });

  it('matches every pinned canonical minItems constraint to an SDK NonEmptyArray property', () => {
    const canonicalInventory = inventoryCanonicalOcfObjects(REPO_ROOT);
    const canonicalDiscriminators = new Set(canonicalInventory.map((entry) => entry.discriminator));
    const pinnedInventory = inventoryPinnedOcfNonEmptyArrays(SCHEMA_ROOT).filter((entry) =>
      canonicalDiscriminators.has(entry.discriminator)
    );
    const sdkInventory = inventoryCanonicalOcfNonEmptyArrays(REPO_ROOT);

    expect(pinnedInventory).toEqual(PINNED_CANONICAL_NON_EMPTY_ARRAYS);
    expect(compareCanonicalNonEmptyArrays(canonicalInventory, sdkInventory, pinnedInventory)).toEqual([]);
  });

  it.each(['anyOf', 'oneOf'] as const)(
    'retains only top-level minItems constraints guaranteed across every %s branch',
    (keyword) => {
      expect(inventoryPinnedOcfNonEmptyArrays(createSyntheticNonEmptySchemaRoot(keyword))).toEqual([
        {
          discriminator: 'SYNTHETIC',
          minItems: 1,
          property: 'items',
          schemaPath: 'schema/objects/Synthetic.schema.json',
        },
      ]);
    }
  );

  it('detects missing, extra, and unsupported NonEmptyArray mappings', () => {
    const canonical = [
      { discriminator: 'SYNTHETIC', optionalProperties: ['optional_items'], requiredProperties: ['items'] },
    ];
    expect(
      compareCanonicalNonEmptyArrays(
        canonical,
        [
          { discriminator: 'SYNTHETIC', property: 'extra_items' },
          { discriminator: 'SYNTHETIC', property: 'optional_items' },
        ],
        [
          {
            discriminator: 'SYNTHETIC',
            minItems: 1,
            property: 'items',
            schemaPath: 'schema/objects/Synthetic.schema.json',
          },
          {
            discriminator: 'SYNTHETIC',
            minItems: 2,
            property: 'optional_items',
            schemaPath: 'schema/objects/Synthetic.schema.json',
          },
        ]
      )
    ).toEqual([
      {
        discriminator: 'SYNTHETIC',
        kind: 'schema-only',
        minItems: 1,
        property: 'items',
        schemaPath: 'schema/objects/Synthetic.schema.json',
      },
      {
        discriminator: 'SYNTHETIC',
        kind: 'sdk-only',
        property: 'extra_items',
      },
      {
        discriminator: 'SYNTHETIC',
        kind: 'unsupported-min-items',
        minItems: 2,
        property: 'optional_items',
        schemaPath: 'schema/objects/Synthetic.schema.json',
      },
    ]);
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
