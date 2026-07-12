import Ajv from 'ajv';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseOcfEntityInput, parseOcfObject } from '../../src/utils/ocfZodSchemas';
import {
  compareCodeUnits,
  compareConditionalRegistry,
  dereferencePinnedObjectSchemas,
  dereferencePinnedSchemaFile,
  describeCanonicalOcfPublicTypeDrift,
  describeReachableSchemaInventoryDrift,
  discoverConditionalPathsInValue,
  getNamedTypeProperty,
  inventoryCanonicalOcfObjects,
  inventoryCanonicalOcfPublicTypes,
  inventoryReachableObjectSchemas,
  normalizeFingerprintText,
  resolveJsonPointer,
  validateCoverageReferences,
  validateSemanticRefinements,
  type CanonicalOcfPublicTypeInventory,
  type ReachableSchemaFingerprintInventory,
} from './schemaConformanceHarness';
import {
  EXPECTED_SEMANTIC_REFINEMENTS,
  OCF_CONDITIONAL_COVERAGE,
  PINNED_REACHABLE_SCHEMA_FINGERPRINT,
} from './schemaConformanceRegistry';

const REPO_ROOT = path.resolve(__dirname, '../..');
const SCHEMA_ROOT = path.join(REPO_ROOT, 'libs', 'Open-Cap-Format-OCF', 'schema');
const CANONICAL_INVENTORY_PATH = path.join(__dirname, 'canonicalOcfObjectInventory.json');
const PINNED_SCHEMA_INVENTORY_PATH = path.join(__dirname, 'pinnedReachableSchemaInventory.json');
const PPS_SCHEMA_PATH = 'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json';

function readCanonicalInventory(): CanonicalOcfPublicTypeInventory {
  return JSON.parse(fs.readFileSync(CANONICAL_INVENTORY_PATH, 'utf8')) as CanonicalOcfPublicTypeInventory;
}

function readPinnedSchemaInventory(): ReachableSchemaFingerprintInventory {
  return JSON.parse(fs.readFileSync(PINNED_SCHEMA_INVENTORY_PATH, 'utf8')) as ReachableSchemaFingerprintInventory;
}

const syntheticRepoRoots: string[] = [];

function createSyntheticOcfRepo(sourceOutput: string, builtOutput?: string): string {
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
  fs.writeFileSync(path.join(repoRoot, 'src', 'types', 'output.ts'), sourceOutput);
  if (builtOutput !== undefined) {
    fs.mkdirSync(path.join(repoRoot, 'dist', 'types'), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, 'dist', 'types', 'output.d.ts'), builtOutput);
  }
  return repoRoot;
}

function simpleSyntheticObject(memberDeclaration: string, prefix = ''): string {
  return `${prefix}
    export type OcfObject = {
      readonly object_type: 'SYNTHETIC';
      ${memberDeclaration}
    };\n`;
}

function nestedSyntheticObject(memberType: 'number' | 'string', recursive = false): string {
  return `export interface NestedValue {
      readonly member: ${memberType};
      ${recursive ? 'readonly next?: NestedValue;' : ''}
    }
    export type OcfObject = {
      readonly object_type: 'SYNTHETIC';
      readonly nested: NestedValue;
    };\n`;
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

  it('percent-decodes a JSON Pointer URI fragment before RFC 6901 segment decoding', () => {
    const document = { definitions: { 'space key': { 'slash/key': 'encoded-value' } } };

    expect(resolveJsonPointer(document, '/definitions/space%20key/slash~1key', 'synthetic.schema.json')).toBe(
      'encoded-value'
    );
  });

  it.each(['/definitions/%', '/definitions/%ZZ', '/definitions/%E0%A4%A'])(
    'rejects malformed percent-encoding in JSON Pointer fragment %s',
    (fragment) => {
      expect(() => resolveJsonPointer({ definitions: {} }, fragment, 'synthetic.schema.json')).toThrow(
        'Invalid percent-encoding in JSON Pointer fragment'
      );
    }
  );

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
    const expectedSchemaInventory = readPinnedSchemaInventory();
    expect(expectedSchemaInventory.fingerprint).toBe(PINNED_REACHABLE_SCHEMA_FINGERPRINT);
    const drift = describeReachableSchemaInventoryDrift(expectedSchemaInventory, schemaInventory);
    if (drift !== undefined) throw new Error(`Pinned reachable schema inventory drift: ${drift}`);
  });

  it('identifies the first changed schema resource in fingerprint diagnostics', () => {
    const expectedSchemaInventory = readPinnedSchemaInventory();
    const [changedSchemaPath] = Object.keys(expectedSchemaInventory.schemaFingerprints).sort(compareCodeUnits);
    if (!changedSchemaPath) throw new Error('Pinned schema fingerprint inventory is empty');
    const actualSchemaInventory = {
      ...expectedSchemaInventory,
      fingerprint: 'changed-aggregate-fingerprint',
      schemaFingerprints: {
        ...expectedSchemaInventory.schemaFingerprints,
        [changedSchemaPath]: 'changed-resource-fingerprint',
      },
    };

    expect(describeReachableSchemaInventoryDrift(expectedSchemaInventory, actualSchemaInventory)).toBe(
      `schema content changed at ${changedSchemaPath}: expected sha256 ` +
        `${expectedSchemaInventory.schemaFingerprints[changedSchemaPath]}, actual sha256 changed-resource-fingerprint`
    );
  });

  it('registers every conditional exactly once with a live runtime or type-test target', () => {
    const problems = compareConditionalRegistry(
      schemaInventory.conditionals.map((conditional) => conditional.path),
      OCF_CONDITIONAL_COVERAGE
    );
    expect(problems).toEqual([]);
    validateCoverageReferences(REPO_ROOT, OCF_CONDITIONAL_COVERAGE);
    validateSemanticRefinements(REPO_ROOT, SCHEMA_ROOT, OCF_CONDITIONAL_COVERAGE, EXPECTED_SEMANTIC_REFINEMENTS);
  });

  it('detects newly introduced conditional paths', () => {
    const discovered = discoverConditionalPathsInValue(
      { properties: { future_rule: { anyOf: [{ type: 'string' }, { type: 'number' }] } } },
      'schema/objects/Synthetic.schema.json'
    ).map((conditional) => conditional.path);
    expect(compareConditionalRegistry(discovered, [])).toEqual([
      {
        kind: 'missing',
        path: 'schema/objects/Synthetic.schema.json#/properties/future_rule/anyOf/$outside',
      },
      {
        kind: 'missing',
        path: 'schema/objects/Synthetic.schema.json#/properties/future_rule/anyOf/0',
      },
      {
        kind: 'missing',
        path: 'schema/objects/Synthetic.schema.json#/properties/future_rule/anyOf/1',
      },
    ]);
  });

  it('detects one missing branch row even when sibling and outside rows are registered', () => {
    const basePath = 'schema/objects/Synthetic.schema.json#/oneOf';
    const discovered = [`${basePath}/0`, `${basePath}/1`, `${basePath}/$outside`];
    const coverage = { file: 'test/synthetic.test.ts', kind: 'runtime' as const, target: 'synthetic witness' };

    expect(
      compareConditionalRegistry(discovered, [
        { coverage: [coverage], path: `${basePath}/0` },
        { coverage: [{ ...coverage, target: 'outside witness' }], path: `${basePath}/$outside` },
      ])
    ).toEqual([{ kind: 'missing', path: `${basePath}/1` }]);
  });

  it('registers both draft-07 if outcomes and nested applicable conditionals', () => {
    expect(
      discoverConditionalPathsInValue(
        {
          if: { oneOf: [{ required: ['kind'] }, { not: { required: ['kind'] } }] },
          then: { anyOf: [{ required: ['a'] }, { required: ['b'] }] },
          else: { oneOf: [{ required: ['c'] }, { required: ['d'] }] },
        },
        'schema/objects/Synthetic.schema.json'
      ).map((conditional) => conditional.path)
    ).toEqual([
      'schema/objects/Synthetic.schema.json#/else/oneOf/$outside',
      'schema/objects/Synthetic.schema.json#/else/oneOf/0',
      'schema/objects/Synthetic.schema.json#/else/oneOf/1',
      'schema/objects/Synthetic.schema.json#/if/$else',
      'schema/objects/Synthetic.schema.json#/if/$then',
      'schema/objects/Synthetic.schema.json#/if/oneOf/$outside',
      'schema/objects/Synthetic.schema.json#/if/oneOf/0',
      'schema/objects/Synthetic.schema.json#/if/oneOf/1',
      'schema/objects/Synthetic.schema.json#/if/oneOf/1/not',
      'schema/objects/Synthetic.schema.json#/then/anyOf/$outside',
      'schema/objects/Synthetic.schema.json#/then/anyOf/0',
      'schema/objects/Synthetic.schema.json#/then/anyOf/1',
    ]);
  });

  it('ignores lone draft-07 then and else values including nested conditional-looking data', () => {
    expect(
      discoverConditionalPathsInValue(
        {
          then: { oneOf: [{ required: ['ignored'] }] },
          else: { anyOf: [{ required: ['ignored'] }] },
        },
        'schema/objects/Synthetic.schema.json'
      )
    ).toEqual([]);
  });

  it('detects stale and duplicate conditional registrations', () => {
    const pathValue = 'schema/objects/Synthetic.schema.json#/oneOf/0';
    const registration = { coverage: [], path: pathValue };
    expect(compareConditionalRegistry([], [registration])).toEqual([{ kind: 'stale', path: pathValue }]);
    expect(compareConditionalRegistry([pathValue], [registration, registration])).toEqual([
      { kind: 'duplicate', path: pathValue },
    ]);
  });

  it('ignores conditional-looking keys inside annotation instance data', () => {
    expect(
      discoverConditionalPathsInValue(
        {
          type: 'object',
          examples: [{ oneOf: 'ordinary instance property', $ref: 'ordinary instance value' }],
          default: { anyOf: [] },
        },
        'schema/objects/Synthetic.schema.json'
      )
    ).toEqual([]);
  });

  it('does not follow annotation $ref values while inventorying reachable schemas', () => {
    const schemaRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ocp-schema-annotation-'));
    try {
      fs.mkdirSync(path.join(schemaRoot, 'objects'), { recursive: true });
      fs.writeFileSync(
        path.join(schemaRoot, 'objects', 'Synthetic.schema.json'),
        JSON.stringify({ type: 'object', examples: [{ $ref: 'not-a-schema-reference.schema.json' }] })
      );

      expect(inventoryReachableObjectSchemas(schemaRoot)).toMatchObject({
        conditionals: [],
        objectSchemaCount: 1,
        reachableSchemaCount: 1,
      });
    } finally {
      fs.rmSync(schemaRoot, { force: true, recursive: true });
    }
  });

  it('ignores draft-07 $ref siblings when discovering conditional obligations', () => {
    const schemaRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ocp-schema-ref-sibling-'));
    try {
      fs.mkdirSync(path.join(schemaRoot, 'objects'), { recursive: true });
      fs.mkdirSync(path.join(schemaRoot, 'types'), { recursive: true });
      fs.writeFileSync(path.join(schemaRoot, 'types', 'Target.schema.json'), JSON.stringify({ type: 'object' }));
      fs.writeFileSync(
        path.join(schemaRoot, 'objects', 'Synthetic.schema.json'),
        JSON.stringify({
          $ref: '../types/Target.schema.json',
          oneOf: [{ required: ['ignored'] }, { not: { required: ['ignored'] } }],
        })
      );

      expect(inventoryReachableObjectSchemas(schemaRoot).conditionals).toEqual([]);
    } finally {
      fs.rmSync(schemaRoot, { force: true, recursive: true });
    }
  });

  it('follows percent-encoded local $ref fragments and reports decoded target obligations', () => {
    const schemaRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ocp-schema-percent-ref-'));
    try {
      fs.mkdirSync(path.join(schemaRoot, 'objects'), { recursive: true });
      fs.mkdirSync(path.join(schemaRoot, 'types'), { recursive: true });
      fs.writeFileSync(
        path.join(schemaRoot, 'types', 'Target.schema.json'),
        JSON.stringify({ definitions: { 'space key': { oneOf: [{ type: 'string' }, { type: 'number' }] } } })
      );
      fs.writeFileSync(
        path.join(schemaRoot, 'objects', 'Synthetic.schema.json'),
        JSON.stringify({ $ref: '../types/Target.schema.json#/definitions/space%20key' })
      );

      expect(inventoryReachableObjectSchemas(schemaRoot).conditionals.map((conditional) => conditional.path)).toEqual([
        'schema/types/Target.schema.json#/definitions/space key/oneOf/$outside',
        'schema/types/Target.schema.json#/definitions/space key/oneOf/0',
        'schema/types/Target.schema.json#/definitions/space key/oneOf/1',
      ]);
    } finally {
      fs.rmSync(schemaRoot, { force: true, recursive: true });
    }
  });

  it('rejects malformed percent-encoding in a local $ref fragment', () => {
    const schemaRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ocp-schema-invalid-percent-ref-'));
    try {
      fs.mkdirSync(path.join(schemaRoot, 'objects'), { recursive: true });
      fs.writeFileSync(
        path.join(schemaRoot, 'objects', 'Synthetic.schema.json'),
        JSON.stringify({ $ref: '#/definitions/%ZZ', definitions: {} })
      );

      expect(() => inventoryReachableObjectSchemas(schemaRoot)).toThrow(
        'Invalid percent-encoding in JSON Pointer fragment'
      );
    } finally {
      fs.rmSync(schemaRoot, { force: true, recursive: true });
    }
  });

  it('inventories recursive local $ref graphs once without looping', () => {
    const schemaRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ocp-schema-cycle-'));
    try {
      fs.mkdirSync(path.join(schemaRoot, 'objects'), { recursive: true });
      fs.mkdirSync(path.join(schemaRoot, 'types'), { recursive: true });
      fs.writeFileSync(
        path.join(schemaRoot, 'types', 'Node.schema.json'),
        JSON.stringify({
          definitions: {
            node: {
              oneOf: [{ type: 'null' }, { properties: { next: { $ref: '#/definitions/node' } }, type: 'object' }],
            },
          },
        })
      );
      fs.writeFileSync(
        path.join(schemaRoot, 'objects', 'Synthetic.schema.json'),
        JSON.stringify({ $ref: '../types/Node.schema.json#/definitions/node' })
      );

      expect(inventoryReachableObjectSchemas(schemaRoot)).toMatchObject({
        objectSchemaCount: 1,
        reachableSchemaCount: 2,
        conditionals: [
          { keyword: 'oneOf', path: 'schema/types/Node.schema.json#/definitions/node/oneOf/$outside' },
          { keyword: 'oneOf', path: 'schema/types/Node.schema.json#/definitions/node/oneOf/0' },
          { keyword: 'oneOf', path: 'schema/types/Node.schema.json#/definitions/node/oneOf/1' },
        ],
      });
    } finally {
      fs.rmSync(schemaRoot, { force: true, recursive: true });
    }
  });

  it('snapshots complete compiler-resolved canonical source union variants', () => {
    const compilerInventory = inventoryCanonicalOcfPublicTypes(REPO_ROOT, 'source');
    // 48 ledger-backed registry entities plus the schema-only Financing object.
    expect(new Set(compilerInventory.objects.map((entry) => entry.discriminator)).size).toBe(49);
    expect(compilerInventory.objects.length).toBeGreaterThan(49);
    expect(Object.keys(compilerInventory.schemaIngestionAliases)).toHaveLength(14);
    expect(compilerInventory).toEqual(readCanonicalInventory());
  });

  it('detects canonical OcfObject member-type drift without a property-name change', () => {
    const stringMemberInventory = inventoryCanonicalOcfObjects(
      createSyntheticOcfRepo(
        simpleSyntheticObject(
          'readonly optional_member?: string; readonly optional_member_with_explicit_undefined?: string | undefined; readonly required_member: string;'
        )
      )
    );
    const numberMemberInventory = inventoryCanonicalOcfObjects(
      createSyntheticOcfRepo(
        simpleSyntheticObject(
          'readonly optional_member?: number; readonly optional_member_with_explicit_undefined?: number | undefined; readonly required_member: number;'
        )
      )
    );

    expect(stringMemberInventory[0]?.signature).toContain('readonly "optional_member"?:string');
    expect(stringMemberInventory[0]?.signature).toContain(
      'readonly "optional_member_with_explicit_undefined"?:union(string|undefined)'
    );
    expect(stringMemberInventory[0]?.signature).toContain('readonly "required_member":string');
    expect(numberMemberInventory).not.toEqual(stringMemberInventory);
    expect(numberMemberInventory[0]?.signature).toContain('readonly "required_member":number');
  });

  it('detects nested public member drift hidden behind a named alias', () => {
    const stringMemberInventory = inventoryCanonicalOcfObjects(createSyntheticOcfRepo(nestedSyntheticObject('string')));
    const numberMemberInventory = inventoryCanonicalOcfObjects(createSyntheticOcfRepo(nestedSyntheticObject('number')));

    expect(stringMemberInventory[0]?.signature).toContain('readonly "member":string');
    expect(numberMemberInventory[0]?.signature).toContain('readonly "member":number');
    expect(numberMemberInventory).not.toEqual(stringMemberInventory);
  });

  it('detects top-level readonly property drift', () => {
    const readonlyInventory = inventoryCanonicalOcfObjects(
      createSyntheticOcfRepo(simpleSyntheticObject('readonly member: string;'))
    );
    const mutableInventory = inventoryCanonicalOcfObjects(
      createSyntheticOcfRepo(simpleSyntheticObject('member: string;'))
    );

    expect(readonlyInventory[0]?.signature).toContain('readonly "member":string');
    expect(mutableInventory).not.toEqual(readonlyInventory);
  });

  it('detects readonly array and tuple drift', () => {
    const readonlyArray = inventoryCanonicalOcfObjects(
      createSyntheticOcfRepo(simpleSyntheticObject('member: readonly string[];'))
    );
    const mutableArray = inventoryCanonicalOcfObjects(
      createSyntheticOcfRepo(simpleSyntheticObject('member: string[];'))
    );
    const readonlyTuple = inventoryCanonicalOcfObjects(
      createSyntheticOcfRepo(simpleSyntheticObject('member: readonly [label: string, count: number];'))
    );
    const mutableTuple = inventoryCanonicalOcfObjects(
      createSyntheticOcfRepo(simpleSyntheticObject('member: [label: string, count: number];'))
    );

    expect(readonlyArray[0]?.signature).toContain('readonly-array(string)');
    expect(readonlyArray).not.toEqual(mutableArray);
    expect(readonlyTuple[0]?.signature).toContain('readonly-tuple(label:string,count:number)');
    expect(readonlyTuple).not.toEqual(mutableTuple);
  });

  it('detects readonly drift introduced by a mapped type', () => {
    const readonlyInventory = inventoryCanonicalOcfObjects(
      createSyntheticOcfRepo(simpleSyntheticObject('nested: Readonly<Value>;', 'interface Value { member: string }'))
    );
    const mutableInventory = inventoryCanonicalOcfObjects(
      createSyntheticOcfRepo(simpleSyntheticObject('nested: Value;', 'interface Value { member: string }'))
    );

    expect(readonlyInventory[0]?.signature).toContain('readonly "member":string');
    expect(mutableInventory).not.toEqual(readonlyInventory);
  });

  it('preserves correlation between union members sharing one discriminator', () => {
    const correlated = inventoryCanonicalOcfObjects(
      createSyntheticOcfRepo(
        `export type OcfObject =
          | { readonly object_type: 'SYNTHETIC'; kind: 'A'; a: string }
          | { readonly object_type: 'SYNTHETIC'; kind: 'B'; b: number };`
      )
    );
    const flattened = inventoryCanonicalOcfObjects(
      createSyntheticOcfRepo(
        `export type OcfObject = {
          readonly object_type: 'SYNTHETIC';
          kind: 'A' | 'B';
          a?: string | undefined;
          b?: number | undefined;
        };`
      )
    );

    expect(correlated).toHaveLength(2);
    expect(flattened).toHaveLength(1);
    expect(flattened).not.toEqual(correlated);
  });

  it('expands named aliases inside call signatures', () => {
    const stringArgument = inventoryCanonicalOcfObjects(
      createSyntheticOcfRepo(
        simpleSyntheticObject(
          'member: Handler;',
          'interface Argument { member: string } type Handler = (value: Argument) => Argument;'
        )
      )
    );
    const numberArgument = inventoryCanonicalOcfObjects(
      createSyntheticOcfRepo(
        simpleSyntheticObject(
          'member: Handler;',
          'interface Argument { member: number } type Handler = (value: Argument) => Argument;'
        )
      )
    );

    expect(stringArgument[0]?.signature).toContain('"member":string');
    expect(numberArgument).not.toEqual(stringArgument);
  });

  it('fingerprints recursive public shapes without recursing forever', () => {
    const inventory = inventoryCanonicalOcfObjects(createSyntheticOcfRepo(nestedSyntheticObject('string', true)));

    expect(inventory[0]?.signature).toContain('cycle:1');
  });

  it('detects source and built declaration drift without mutual-assignability shortcuts', () => {
    const repoRoot = createSyntheticOcfRepo(
      simpleSyntheticObject('member: readonly string[];'),
      simpleSyntheticObject('member: string[];')
    );

    expect(inventoryCanonicalOcfObjects(repoRoot, 'built')).not.toEqual(
      inventoryCanonicalOcfObjects(repoRoot, 'source')
    );
  });

  it('identifies the first discriminator or alias in declaration drift diagnostics', () => {
    const sourceInventory: CanonicalOcfPublicTypeInventory = {
      fingerprint: 'source-fingerprint',
      objects: [
        { discriminator: 'A_OBJECT', signature: 'object("member":string)' },
        { discriminator: 'B_OBJECT', signature: 'object("member":string)' },
      ],
      schemaIngestionAliases: { AliasA: 'object("member":string)', AliasB: 'object("member":string)' },
    };
    const builtObjectDrift: CanonicalOcfPublicTypeInventory = {
      ...sourceInventory,
      fingerprint: 'built-object-fingerprint',
      objects: [
        { discriminator: 'A_OBJECT', signature: 'object("member":number)' },
        { discriminator: 'B_OBJECT', signature: 'object("member":string)' },
      ],
    };
    const builtAliasDrift: CanonicalOcfPublicTypeInventory = {
      ...sourceInventory,
      fingerprint: 'built-alias-fingerprint',
      schemaIngestionAliases: { AliasA: 'object("member":number)', AliasB: 'object("member":string)' },
    };

    expect(describeCanonicalOcfPublicTypeDrift(sourceInventory, builtObjectDrift)).toContain(
      'OcfObject discriminator "A_OBJECT" variant 1 differs'
    );
    expect(describeCanonicalOcfPublicTypeDrift(sourceInventory, builtAliasDrift)).toContain(
      'schema-ingestion alias "AliasA" differs'
    );
  });
});

describe('intentional SDK semantic refinements', () => {
  it('keeps canonical StockPlan typing plural while raw ingestion accepts the deprecated singular branch', () => {
    const singularStockPlan = {
      object_type: 'STOCK_PLAN',
      id: 'legacy-plan',
      plan_name: 'Legacy Plan',
      initial_shares_reserved: '100',
      stock_class_id: 'class-1',
    };

    expect(parseOcfObject(singularStockPlan)).toMatchObject({ stock_class_ids: ['class-1'] });
    expect(() => parseOcfEntityInput('stockPlan', singularStockPlan)).toThrow(
      'Typed stock plan input requires canonical stock_class_ids'
    );
  });

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
    expect(ppsRegistrations).toHaveLength(7);
    expect(ppsRegistrations.every((entry) => entry.refinement === 'pps-discount-exclusivity')).toBe(true);
    expect(EXPECTED_SEMANTIC_REFINEMENTS).toContainEqual(
      expect.objectContaining({
        expectedSdkContract: expect.stringContaining('discount=false with neither field'),
        id: 'pps-discount-exclusivity',
      })
    );
  });
});
