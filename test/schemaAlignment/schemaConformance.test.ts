import Ajv from 'ajv';
import fs from 'fs';
import path from 'path';
import {
  compareCanonicalNonEmptyArrays,
  compareCanonicalOcfPropertySets,
  compareConditionalRegistry,
  dereferencePinnedObjectSchemas,
  dereferencePinnedSchemaFile,
  discoverConditionalPathsInValue,
  getNamedTypeProperty,
  inventoryCanonicalOcfNonEmptyArrays,
  inventoryCanonicalOcfObjects,
  inventoryPinnedOcfNonEmptyArrays,
  inventoryPinnedOcfObjectProperties,
  inventoryReachableObjectSchemas,
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
} from './schemaConformanceRegistry';

const REPO_ROOT = path.resolve(__dirname, '../..');
const SCHEMA_ROOT = path.join(REPO_ROOT, 'libs', 'Open-Cap-Format-OCF', 'schema');
const CANONICAL_INVENTORY_PATH = path.join(__dirname, 'canonicalOcfObjectInventory.json');

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

  it('keeps deprecated root-exported PlanSecurity aliases aligned with inherited minItems constraints', () => {
    expect(getNamedTypeProperty(REPO_ROOT, 'OcfPlanSecurityIssuance', 'vestings')).toEqual({
      optional: true,
      type: 'NonEmptyArray<Vesting>',
    });
    expect(getNamedTypeProperty(REPO_ROOT, 'OcfPlanSecurityTransfer', 'resulting_security_ids')).toEqual({
      optional: false,
      type: 'NonEmptyArray<string>',
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

  it('records the PPS discount exclusivity that is stricter than the pinned draft-07 schema', () => {
    const ppsSchema = dereferencePinnedSchemaFile(
      SCHEMA_ROOT,
      'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json'
    );
    const validate = new Ajv({ allErrors: true, strict: false }).compile(ppsSchema);
    const schemaLoophole = {
      type: 'PPS_BASED_CONVERSION',
      description: '20% discount',
      discount: false,
      discount_percentage: '0.2',
    };

    expect(validate(schemaLoophole)).toBe(true);
    expect(EXPECTED_SEMANTIC_REFINEMENTS).toContainEqual(
      expect.objectContaining({
        expectedSdkContract: expect.stringContaining('discount=false with neither field'),
        id: 'pps-discount-exclusivity',
      })
    );
  });
});
