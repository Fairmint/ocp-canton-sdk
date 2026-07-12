import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

export const OCF_GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/';

const CONDITIONAL_KEYWORDS = ['anyOf', 'if', 'oneOf', 'not'] as const;
const SCHEMA_SUFFIX = '.schema.json';
const SINGLE_SUBSCHEMA_KEYWORDS = ['additionalProperties', 'contains', 'not', 'propertyNames'] as const;
const ARRAY_SUBSCHEMA_KEYWORDS = ['allOf', 'anyOf', 'oneOf'] as const;
const MAP_SUBSCHEMA_KEYWORDS = ['definitions', 'patternProperties', 'properties'] as const;
const OUTSIDE_ALL_BRANCH_SEGMENT = '$outside';
const IF_ELSE_BRANCH_SEGMENT = '$else';
const IF_THEN_BRANCH_SEGMENT = '$then';

type ConditionalKeyword = (typeof CONDITIONAL_KEYWORDS)[number];
type JsonObject = Record<string, unknown>;

export interface SchemaConditional {
  keyword: ConditionalKeyword;
  path: string;
}

export interface ReachableSchemaFingerprintInventory {
  fingerprint: string;
  objectSchemaCount: number;
  reachableSchemaCount: number;
  schemaFingerprints: Record<string, string>;
}

export interface ReachableSchemaInventory extends ReachableSchemaFingerprintInventory {
  conditionals: SchemaConditional[];
  reachableSchemaPaths: string[];
}

export interface CanonicalOcfObjectInventoryEntry {
  discriminator: string;
  signature: string;
}

export interface CanonicalOcfPublicTypeInventory {
  fingerprint: string;
  objects: CanonicalOcfObjectInventoryEntry[];
  schemaIngestionAliases: Record<string, string>;
}

export interface CoverageReference {
  file: string;
  kind: 'runtime' | 'type';
  target: string;
}

export interface ConditionalCoverageRegistration {
  coverage: CoverageReference[];
  path: string;
  refinement?: string;
}

export interface SemanticRefinement {
  coverage: CoverageReference[];
  expectedSdkContract: string;
  id: string;
  rationale: string;
  schemaPaths: string[];
}

export interface ConditionalRegistryProblem {
  kind: 'duplicate' | 'missing' | 'stale';
  path: string;
}

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertJsonObject(value: unknown, source: string): asserts value is JsonObject {
  if (!isJsonObject(value)) {
    throw new Error(`Expected a JSON object in ${source}`);
  }
}

function escapeJsonPointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

function decodeJsonPointerSegment(segment: string, source: string): string {
  if (/~(?:[^01]|$)/.test(segment)) {
    throw new Error(`Invalid JSON Pointer escape sequence "${segment}" in ${source}`);
  }
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function normalizeSlashes(value: string): string {
  return value.split(path.sep).join('/');
}

/** Locale-independent ordering for inventories and fingerprints. */
export function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Normalize checkout-specific line endings before hashing pinned schemas. */
export function normalizeFingerprintText(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}

/** Identify the first concrete resource responsible for pinned-schema drift. */
export function describeReachableSchemaInventoryDrift(
  expected: ReachableSchemaFingerprintInventory,
  actual: ReachableSchemaFingerprintInventory
): string | undefined {
  const schemaPaths = [
    ...new Set([...Object.keys(expected.schemaFingerprints), ...Object.keys(actual.schemaFingerprints)]),
  ].sort(compareCodeUnits);

  for (const schemaPath of schemaPaths) {
    const expectedFingerprint = expected.schemaFingerprints[schemaPath];
    const actualFingerprint = actual.schemaFingerprints[schemaPath];
    if (expectedFingerprint === undefined) {
      return `unexpected reachable schema ${schemaPath} (actual sha256 ${actualFingerprint})`;
    }
    if (actualFingerprint === undefined) {
      return `missing reachable schema ${schemaPath} (expected sha256 ${expectedFingerprint})`;
    }
    if (actualFingerprint !== expectedFingerprint) {
      return (
        `schema content changed at ${schemaPath}: ` +
        `expected sha256 ${expectedFingerprint}, actual sha256 ${actualFingerprint}`
      );
    }
  }

  if (actual.objectSchemaCount !== expected.objectSchemaCount) {
    return `object schema count changed: expected ${expected.objectSchemaCount}, actual ${actual.objectSchemaCount}`;
  }
  if (actual.reachableSchemaCount !== expected.reachableSchemaCount) {
    return `reachable schema count changed: expected ${expected.reachableSchemaCount}, actual ${actual.reachableSchemaCount}`;
  }
  if (actual.fingerprint !== expected.fingerprint) {
    return `aggregate schema fingerprint changed: expected ${expected.fingerprint}, actual ${actual.fingerprint}`;
  }
  return undefined;
}

function listSchemaFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSchemaFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(SCHEMA_SUFFIX)) {
      files.push(fullPath);
    }
  }
  return files.sort(compareCodeUnits);
}

function readSchemaFile(schemaPath: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as unknown;
  assertJsonObject(parsed, schemaPath);
  return parsed;
}

function forEachSubschema(schema: JsonObject, pointer: string, visit: (value: unknown, pointer: string) => void): void {
  for (const keyword of SINGLE_SUBSCHEMA_KEYWORDS) {
    if (Object.prototype.hasOwnProperty.call(schema, keyword)) {
      visit(schema[keyword], `${pointer}/${keyword}`);
    }
  }

  const { items } = schema;
  if (Array.isArray(items)) {
    items.forEach((item, index) => visit(item, `${pointer}/items/${index}`));
    if (Object.prototype.hasOwnProperty.call(schema, 'additionalItems')) {
      visit(schema.additionalItems, `${pointer}/additionalItems`);
    }
  } else if (items !== undefined) {
    visit(items, `${pointer}/items`);
  }

  // In draft-07, `then` and `else` have no effect without a sibling `if`.
  // Do not interpret ignored values as schemas or manufacture obligations from
  // conditional-looking instance data stored inside them.
  if (Object.prototype.hasOwnProperty.call(schema, 'if')) {
    visit(schema.if, `${pointer}/if`);
    if (Object.prototype.hasOwnProperty.call(schema, 'then')) visit(schema.then, `${pointer}/then`);
    if (Object.prototype.hasOwnProperty.call(schema, 'else')) visit(schema.else, `${pointer}/else`);
  }

  for (const keyword of ARRAY_SUBSCHEMA_KEYWORDS) {
    const children = schema[keyword];
    if (children === undefined) continue;
    if (!Array.isArray(children)) {
      throw new Error(`Expected ${keyword} to be an array at #${pointer}/${keyword}`);
    }
    children.forEach((child, index) => visit(child, `${pointer}/${keyword}/${index}`));
  }

  for (const keyword of MAP_SUBSCHEMA_KEYWORDS) {
    const children = schema[keyword];
    if (children === undefined) continue;
    if (!isJsonObject(children)) {
      throw new Error(`Expected ${keyword} to be an object at #${pointer}/${keyword}`);
    }
    for (const [name, child] of Object.entries(children)) {
      visit(child, `${pointer}/${keyword}/${escapeJsonPointerSegment(name)}`);
    }
  }

  const { dependencies } = schema;
  if (dependencies !== undefined) {
    if (!isJsonObject(dependencies)) {
      throw new Error(`Expected dependencies to be an object at #${pointer}/dependencies`);
    }
    for (const [name, dependency] of Object.entries(dependencies)) {
      if (!Array.isArray(dependency)) {
        visit(dependency, `${pointer}/dependencies/${escapeJsonPointerSegment(name)}`);
      }
    }
  }
}

function discoverConditionalsAtSchema(schema: JsonObject, sourcePath: string, pointer: string): SchemaConditional[] {
  const discovered: SchemaConditional[] = [];
  for (const keyword of CONDITIONAL_KEYWORDS) {
    if (!Object.prototype.hasOwnProperty.call(schema, keyword)) continue;
    const conditionalPath = `${sourcePath}#${pointer}/${keyword}`;
    if (keyword === 'if') {
      discovered.push({ keyword, path: `${conditionalPath}/${IF_THEN_BRANCH_SEGMENT}` });
      discovered.push({ keyword, path: `${conditionalPath}/${IF_ELSE_BRANCH_SEGMENT}` });
      continue;
    }
    if (keyword === 'not') {
      discovered.push({ keyword, path: conditionalPath });
      continue;
    }

    const branches = schema[keyword];
    if (!Array.isArray(branches)) {
      throw new Error(`Expected ${keyword} to be an array at ${conditionalPath}`);
    }
    branches.forEach((_branch, index) => discovered.push({ keyword, path: `${conditionalPath}/${index}` }));
    discovered.push({ keyword, path: `${conditionalPath}/${OUTSIDE_ALL_BRANCH_SEGMENT}` });
  }
  return discovered;
}

function decodeUriFragment(fragment: string, source: string): string {
  try {
    return decodeURIComponent(fragment);
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : '';
    throw new Error(`Invalid percent-encoding in JSON Pointer fragment for ${source}: #${fragment}${detail}`);
  }
}

function resolveDecodedJsonPointer(document: unknown, fragment: string, source: string): unknown {
  if (fragment === '') return document;
  if (!fragment.startsWith('/')) {
    throw new Error(`Only JSON Pointer fragments are supported in ${source}: #${fragment}`);
  }

  let current = document;
  for (const encodedSegment of fragment.slice(1).split('/')) {
    const segment = decodeJsonPointerSegment(encodedSegment, `${source}#${fragment}`);
    if (Array.isArray(current)) {
      if (!/^(?:0|[1-9]\d*)$/.test(segment)) {
        throw new Error(`Invalid array JSON Pointer segment "${segment}" in ${source}#${fragment}`);
      }
      const index = Number(segment);
      if (!Number.isSafeInteger(index) || index >= current.length) {
        throw new Error(`Invalid array JSON Pointer segment "${segment}" in ${source}#${fragment}`);
      }
      current = current[index];
      continue;
    }
    if (!isJsonObject(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
      throw new Error(`Invalid object JSON Pointer segment "${segment}" in ${source}#${fragment}`);
    }
    current = current[segment];
  }
  return current;
}

/** Resolve an RFC 6901 JSON Pointer encoded as a URI fragment. */
export function resolveJsonPointer(document: unknown, fragment: string, source: string): unknown {
  return resolveDecodedJsonPointer(document, decodeUriFragment(fragment, source), source);
}

function assertInsideSchemaRoot(schemaPath: string, schemaRoot: string): void {
  const relativePath = path.relative(schemaRoot, schemaPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Schema reference escapes the pinned schema root: ${schemaPath}`);
  }
}

function resolveRefPath(ref: string, sourcePath: string, schemaRoot: string): { fragment: string; schemaPath: string } {
  const hashIndex = ref.indexOf('#');
  const refPath = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
  const rawFragment = hashIndex === -1 ? '' : ref.slice(hashIndex + 1);
  let schemaPath: string;

  if (refPath.startsWith(OCF_GITHUB_RAW_BASE)) {
    schemaPath = path.join(path.dirname(schemaRoot), refPath.slice(OCF_GITHUB_RAW_BASE.length));
  } else if (refPath.startsWith('file://')) {
    schemaPath = new URL(refPath).pathname;
  } else if (refPath.length === 0) {
    schemaPath = sourcePath;
  } else if (/^[a-z][a-z\d+.-]*:/i.test(refPath)) {
    throw new Error(`Unpinned external schema reference: ${ref}`);
  } else {
    schemaPath = path.resolve(path.dirname(sourcePath), refPath);
  }

  assertInsideSchemaRoot(schemaPath, schemaRoot);
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema reference does not exist locally: ${ref} -> ${schemaPath}`);
  }
  return { fragment: decodeUriFragment(rawFragment, ref), schemaPath };
}

/** Discover draft-07 conditional obligations in one schema without following references. */
export function discoverConditionalPathsInValue(value: unknown, sourcePath: string): SchemaConditional[] {
  const discovered: SchemaConditional[] = [];

  function visit(current: unknown, pointer: string): void {
    if (!isJsonObject(current)) return;
    // Draft-07 treats a schema object containing $ref as the referenced schema;
    // sibling keywords are ignored and therefore cannot create obligations.
    if (typeof current.$ref === 'string') return;
    discovered.push(...discoverConditionalsAtSchema(current, sourcePath, pointer));
    forEachSubschema(current, pointer, visit);
  }

  visit(value, '');
  return discovered.sort((left, right) => compareCodeUnits(left.path, right.path));
}

/**
 * Follow every reference reachable from the pinned object schemas. Conditional
 * paths retain their source-file origin instead of the repeated expansion path,
 * so the registry stays stable and each schema rule is represented once.
 */
export function inventoryReachableObjectSchemas(schemaRoot: string): ReachableSchemaInventory {
  const objectRoot = path.join(schemaRoot, 'objects');
  if (!fs.existsSync(objectRoot)) {
    throw new Error(`Pinned OCF object schema directory is missing: ${objectRoot}`);
  }

  const objectSchemaPaths = listSchemaFiles(objectRoot);
  const visitedLocations = new Set<string>();
  const reachableSchemaPaths = new Set<string>();
  const conditionalByPath = new Map<string, SchemaConditional>();

  function visit(current: unknown, sourcePath: string, sourcePointer: string): void {
    if (!isJsonObject(current)) return;

    const ref = current.$ref;
    if (typeof ref === 'string') {
      const target = resolveRefPath(ref, sourcePath, schemaRoot);
      visitLocation(target.schemaPath, target.fragment);
      return;
    }

    const relativeSource = normalizeSlashes(path.relative(schemaRoot, sourcePath));
    for (const conditional of discoverConditionalsAtSchema(current, `schema/${relativeSource}`, sourcePointer)) {
      conditionalByPath.set(conditional.path, conditional);
    }
    forEachSubschema(current, sourcePointer, (child, pointer) => visit(child, sourcePath, pointer));
  }

  function visitLocation(schemaPath: string, fragment: string): void {
    const locationKey = `${schemaPath}#${fragment}`;
    if (visitedLocations.has(locationKey)) return;
    visitedLocations.add(locationKey);
    reachableSchemaPaths.add(schemaPath);

    const document = readSchemaFile(schemaPath);
    const pointedValue = resolveDecodedJsonPointer(document, fragment, schemaPath);
    visit(pointedValue, schemaPath, fragment);
  }

  objectSchemaPaths.forEach((schemaPath) => visitLocation(schemaPath, ''));

  const sortedReachablePaths = [...reachableSchemaPaths]
    .map((schemaPath) => normalizeSlashes(path.relative(schemaRoot, schemaPath)))
    .sort(compareCodeUnits);
  const fingerprintHash = createHash('sha256');
  const schemaFingerprints: Record<string, string> = {};
  for (const relativePath of sortedReachablePaths) {
    fingerprintHash.update(relativePath);
    fingerprintHash.update('\0');
    const normalizedSchemaText = normalizeFingerprintText(fs.readFileSync(path.join(schemaRoot, relativePath), 'utf8'));
    schemaFingerprints[`schema/${relativePath}`] = createHash('sha256').update(normalizedSchemaText).digest('hex');
    fingerprintHash.update(normalizedSchemaText);
    fingerprintHash.update('\0');
  }

  return {
    conditionals: [...conditionalByPath.values()].sort((left, right) => compareCodeUnits(left.path, right.path)),
    fingerprint: fingerprintHash.digest('hex'),
    objectSchemaCount: objectSchemaPaths.length,
    reachableSchemaCount: sortedReachablePaths.length,
    reachableSchemaPaths: sortedReachablePaths.map((relativePath) => `schema/${relativePath}`),
    schemaFingerprints,
  };
}

function dereferenceValue(
  value: unknown,
  sourcePath: string,
  schemaRoot: string,
  activeLocations: ReadonlySet<string>
): unknown {
  if (!isJsonObject(value)) return value;

  if (typeof value.$ref === 'string') {
    const target = resolveRefPath(value.$ref, sourcePath, schemaRoot);
    const locationKey = `${target.schemaPath}#${target.fragment}`;
    if (activeLocations.has(locationKey)) {
      throw new Error(`Circular OCF schema reference cannot be fully dereferenced: ${locationKey}`);
    }
    const document = readSchemaFile(target.schemaPath);
    const pointedValue = resolveDecodedJsonPointer(document, target.fragment, target.schemaPath);
    return dereferenceValue(pointedValue, target.schemaPath, schemaRoot, new Set([...activeLocations, locationKey]));
  }

  const dereferenced: JsonObject = { ...value };
  const dereferenceChild = (child: unknown): unknown =>
    dereferenceValue(child, sourcePath, schemaRoot, activeLocations);

  for (const keyword of SINGLE_SUBSCHEMA_KEYWORDS) {
    if (Object.prototype.hasOwnProperty.call(value, keyword)) {
      dereferenced[keyword] = dereferenceChild(value[keyword]);
    }
  }
  if (Array.isArray(value.items)) {
    dereferenced.items = value.items.map(dereferenceChild);
    if (Object.prototype.hasOwnProperty.call(value, 'additionalItems')) {
      dereferenced.additionalItems = dereferenceChild(value.additionalItems);
    }
  } else if (value.items !== undefined) {
    dereferenced.items = dereferenceChild(value.items);
  }
  if (Object.prototype.hasOwnProperty.call(value, 'if')) {
    dereferenced.if = dereferenceChild(value.if);
    if (Object.prototype.hasOwnProperty.call(value, 'then')) dereferenced.then = dereferenceChild(value.then);
    if (Object.prototype.hasOwnProperty.call(value, 'else')) dereferenced.else = dereferenceChild(value.else);
  }
  for (const keyword of ARRAY_SUBSCHEMA_KEYWORDS) {
    const children = value[keyword];
    if (Array.isArray(children)) dereferenced[keyword] = children.map(dereferenceChild);
  }
  for (const keyword of MAP_SUBSCHEMA_KEYWORDS) {
    const children = value[keyword];
    if (isJsonObject(children)) {
      dereferenced[keyword] = Object.fromEntries(
        Object.entries(children).map(([name, child]) => [name, dereferenceChild(child)])
      );
    }
  }
  if (isJsonObject(value.dependencies)) {
    dereferenced.dependencies = Object.fromEntries(
      Object.entries(value.dependencies).map(([name, dependency]) => [
        name,
        Array.isArray(dependency) ? dependency : dereferenceChild(dependency),
      ])
    );
  }
  return dereferenced;
}

/** Dereference all pinned OCF object schemas through local-only resolution. */
export function dereferencePinnedObjectSchemas(schemaRoot: string): JsonObject {
  const objectSchemaPaths = listSchemaFiles(path.join(schemaRoot, 'objects'));
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    properties: Object.fromEntries(
      objectSchemaPaths.map((schemaPath) => {
        const locationKey = `${schemaPath}#`;
        return [
          normalizeSlashes(path.relative(path.join(schemaRoot, 'objects'), schemaPath)),
          dereferenceValue(readSchemaFile(schemaPath), schemaPath, schemaRoot, new Set([locationKey])),
        ];
      })
    ),
    type: 'object',
  };
}

/** Dereference one pinned schema file for focused anomaly assertions. */
export function dereferencePinnedSchemaFile(schemaRoot: string, relativePath: string): JsonObject {
  const schemaPath = path.join(schemaRoot, relativePath.replace(/^schema\//, ''));
  assertInsideSchemaRoot(schemaPath, schemaRoot);
  const dereferenced = dereferenceValue(
    readSchemaFile(schemaPath),
    schemaPath,
    schemaRoot,
    new Set([`${schemaPath}#`])
  );
  assertJsonObject(dereferenced, `dereferenced ${relativePath}`);
  return dereferenced;
}

export function compareConditionalRegistry(
  discoveredPaths: readonly string[],
  registry: readonly ConditionalCoverageRegistration[]
): ConditionalRegistryProblem[] {
  const problems: ConditionalRegistryProblem[] = [];
  const discovered = new Set(discoveredPaths);
  const registered = new Set<string>();

  for (const entry of registry) {
    if (registered.has(entry.path)) problems.push({ kind: 'duplicate', path: entry.path });
    registered.add(entry.path);
  }
  for (const conditionalPath of discovered) {
    if (!registered.has(conditionalPath)) problems.push({ kind: 'missing', path: conditionalPath });
  }
  for (const registeredPath of registered) {
    if (!discovered.has(registeredPath)) problems.push({ kind: 'stale', path: registeredPath });
  }

  return problems.sort(
    (left, right) => compareCodeUnits(left.path, right.path) || compareCodeUnits(left.kind, right.kind)
  );
}

type RuntimeTestTargetStatus = 'active' | 'incomplete' | 'parameterized' | 'skipped' | 'todo';
interface RuntimeTestTarget {
  callback?: ts.ArrowFunction | ts.FunctionExpression;
  modifiers: ReadonlySet<string>;
  runner: 'describe' | 'it' | 'test' | 'type';
  status: RuntimeTestTargetStatus;
}
interface FocusedRuntimeTest {
  line: number;
  runner: 'describe' | 'it' | 'test';
  target?: string;
}
interface RuntimeTestTargetInventory {
  focusedTests: FocusedRuntimeTest[];
  targets: Map<string, RuntimeTestTarget[]>;
}

interface RuntimeTestCall {
  modifiers: ReadonlySet<string>;
  runner: 'describe' | 'it' | 'test';
}

function parseRuntimeTestCall(expression: ts.Expression): RuntimeTestCall | undefined {
  if (ts.isCallExpression(expression)) return parseRuntimeTestCall(expression.expression);
  if (ts.isTaggedTemplateExpression(expression)) return parseRuntimeTestCall(expression.tag);
  if (ts.isPropertyAccessExpression(expression)) {
    const parsed = parseRuntimeTestCall(expression.expression);
    if (!parsed) return undefined;
    return { modifiers: new Set([...parsed.modifiers, expression.name.text]), runner: parsed.runner };
  }
  if (!ts.isIdentifier(expression)) return undefined;

  switch (expression.text) {
    case 'describe':
    case 'it':
    case 'test':
      return { modifiers: new Set(), runner: expression.text };
    case 'fdescribe':
      return { modifiers: new Set(['only']), runner: 'describe' };
    case 'fit':
      return { modifiers: new Set(['only']), runner: 'it' };
    case 'xdescribe':
      return { modifiers: new Set(['skip']), runner: 'describe' };
    case 'xit':
      return { modifiers: new Set(['skip']), runner: 'it' };
    case 'xtest':
      return { modifiers: new Set(['skip']), runner: 'test' };
    default:
      return undefined;
  }
}

function collectRuntimeTestTargets(sourceFile: ts.SourceFile): RuntimeTestTargetInventory {
  const targets = new Map<string, RuntimeTestTarget[]>();
  const focusedTests: FocusedRuntimeTest[] = [];

  function recordTarget(target: string, candidate: RuntimeTestTarget): void {
    const existing = targets.get(target) ?? [];
    existing.push(candidate);
    targets.set(target, existing);
  }

  function inlineCallback(node: ts.CallExpression): ts.ArrowFunction | ts.FunctionExpression | undefined {
    for (let index = node.arguments.length - 1; index >= 0; index -= 1) {
      const argument = node.arguments[index];
      if (argument && (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument))) return argument;
    }
    return undefined;
  }

  function visitStatements(
    statements: ts.NodeArray<ts.Statement>,
    inheritedStatus?: Exclude<RuntimeTestTargetStatus, 'active'>,
    inheritedModifiers: ReadonlySet<string> = new Set()
  ): void {
    for (const statement of statements) {
      // A Jest registration is executable at module load only when the call is
      // a direct statement in the module or in an already-registered describe
      // callback. Never descend into arbitrary functions, branches, or loops.
      if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) continue;
      const node = statement.expression;
      const [firstArgument] = node.arguments;
      const call = parseRuntimeTestCall(node.expression);
      if (!call || !firstArgument || !ts.isStringLiteralLike(firstArgument)) continue;

      const callback = inlineCallback(node);
      const modifiers = new Set([...inheritedModifiers, ...call.modifiers]);
      const modifierStatus =
        inheritedStatus ??
        (modifiers.has('todo')
          ? 'todo'
          : modifiers.has('skip')
            ? 'skipped'
            : modifiers.has('each')
              ? 'parameterized'
              : 'active');
      const localStatus =
        modifierStatus === 'active' && call.runner !== 'describe' && callback === undefined
          ? 'incomplete'
          : modifierStatus;
      recordTarget(firstArgument.text, { callback, modifiers, runner: call.runner, status: localStatus });

      if (call.runner !== 'describe') continue;
      if (!callback || !ts.isBlock(callback.body)) continue;
      visitStatements(callback.body.statements, localStatus === 'active' ? undefined : localStatus, modifiers);
    }
  }

  function findFocusedTests(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const call = parseRuntimeTestCall(node.expression);
      if (call?.modifiers.has('only')) {
        const [firstArgument] = node.arguments;
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        focusedTests.push({
          line: line + 1,
          runner: call.runner,
          ...(firstArgument && ts.isStringLiteralLike(firstArgument) ? { target: firstArgument.text } : {}),
        });
      }
    }
    ts.forEachChild(node, findFocusedTests);
  }

  visitStatements(sourceFile.statements);
  findFocusedTests(sourceFile);
  return { focusedTests, targets };
}

const SUPPORTED_RUNTIME_TEST_MODIFIERS = new Set(['each', 'only', 'skip', 'todo']);

function isAssertConditionalWitnessCall(node: ts.Node): node is ts.CallExpression {
  return (
    ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'assertConditionalWitness'
  );
}

function directWitnessCalls(callback: ts.ArrowFunction | ts.FunctionExpression): {
  all: ts.CallExpression[];
  direct: ts.CallExpression[];
} {
  const all: ts.CallExpression[] = [];

  function collect(node: ts.Node): void {
    if (isAssertConditionalWitnessCall(node)) all.push(node);
    ts.forEachChild(node, collect);
  }

  collect(callback.body);
  const direct = ts.isBlock(callback.body)
    ? callback.body.statements.flatMap((statement) =>
        ts.isExpressionStatement(statement) && isAssertConditionalWitnessCall(statement.expression)
          ? [statement.expression]
          : []
      )
    : isAssertConditionalWitnessCall(callback.body)
      ? [callback.body]
      : [];
  return { all, direct };
}

function validateLiteralWitnessBinding(
  coverage: CoverageReference,
  registeredPath: string,
  target: RuntimeTestTarget
): void {
  if (!coverage.target.startsWith('covers ')) return;

  const expectedTarget = `covers ${registeredPath}`;
  if (coverage.target !== expectedTarget) {
    throw new Error(
      `Conditional coverage witness title must exactly name its registered path: ${coverage.file}#${coverage.target} (${registeredPath})`
    );
  }

  const { callback } = target;
  if (!callback) return;
  const calls = directWitnessCalls(callback);
  const [onlyCall] = calls.all;
  const [onlyDirectCall] = calls.direct;
  const [argument] = onlyCall?.arguments ?? [];
  const hasExactLiteral =
    calls.all.length === 1 &&
    calls.direct.length === 1 &&
    onlyCall !== undefined &&
    onlyDirectCall !== undefined &&
    onlyCall === onlyDirectCall &&
    onlyCall.arguments.length === 1 &&
    argument !== undefined &&
    ts.isStringLiteralLike(argument) &&
    argument.text === registeredPath;

  if (!hasExactLiteral) {
    throw new Error(
      `Conditional coverage witness must directly call assertConditionalWitness with its exact registered path once: ${coverage.file}#${coverage.target} (${registeredPath})`
    );
  }
}

function collectTypeTargets(sourceFile: ts.SourceFile): Set<string> {
  const targets = new Set<string>();

  function addBindingName(name: ts.BindingName): void {
    if (ts.isIdentifier(name)) {
      targets.add(name.text);
      return;
    }
    for (const element of name.elements) {
      if (!ts.isOmittedExpression(element)) addBindingName(element.name);
    }
  }

  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node)) addBindingName(node.name);
    if (
      (ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node)) &&
      node.name
    ) {
      targets.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return targets;
}

export function validateCoverageReferences(
  repoRoot: string,
  registry: readonly ConditionalCoverageRegistration[]
): void {
  const targetCache = new Map<string, RuntimeTestTargetInventory>();
  const registeredReferences = new Map<string, string>();
  for (const entry of registry) {
    if (entry.coverage.length === 0) {
      throw new Error(`Conditional coverage registration has no tests: ${entry.path}`);
    }
    for (const coverage of entry.coverage) {
      const absolutePath = path.resolve(repoRoot, coverage.file);
      const relativePath = path.relative(repoRoot, absolutePath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        throw new Error(`Conditional coverage file escapes the repository: ${coverage.file} (${entry.path})`);
      }
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Conditional coverage file does not exist: ${coverage.file} (${entry.path})`);
      }
      const cacheKey = `${coverage.kind}:${absolutePath}`;
      const referenceKey = `${cacheKey}:${coverage.target}`;
      const existingPath = registeredReferences.get(referenceKey);
      if (existingPath !== undefined) {
        throw new Error(
          `Conditional coverage target is reused: ${coverage.file}#${coverage.target} (${existingPath}, ${entry.path})`
        );
      }
      registeredReferences.set(referenceKey, entry.path);
      let targets = targetCache.get(cacheKey);
      if (!targets) {
        const sourceFile = ts.createSourceFile(
          absolutePath,
          fs.readFileSync(absolutePath, 'utf8'),
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TS
        );
        targets =
          coverage.kind === 'runtime'
            ? collectRuntimeTestTargets(sourceFile)
            : {
                focusedTests: [],
                targets: new Map(
                  [...collectTypeTargets(sourceFile)].map(
                    (target) =>
                      [
                        target,
                        [{ modifiers: new Set(), runner: 'type', status: 'active' } satisfies RuntimeTestTarget],
                      ] as const
                  )
                ),
              };
        targetCache.set(cacheKey, targets);
      }
      if (coverage.kind === 'runtime' && targets.focusedTests.length > 0) {
        const [focusedTest] = targets.focusedTests;
        if (!focusedTest) throw new Error('Focused runtime-test inventory unexpectedly became empty');
        const targetDescription = focusedTest.target ? `#${focusedTest.target}` : '';
        throw new Error(
          `Conditional coverage file contains a focused ${focusedTest.runner} registration: ${coverage.file}:${focusedTest.line}${targetDescription} (${entry.path})`
        );
      }
      const targetOccurrences = targets.targets.get(coverage.target);
      if (targetOccurrences === undefined) {
        throw new Error(
          `Conditional coverage target does not exist: ${coverage.file}#${coverage.target} (${entry.path})`
        );
      }
      if (targetOccurrences.length !== 1) {
        throw new Error(
          `Conditional coverage target title is duplicated: ${coverage.file}#${coverage.target} (${entry.path})`
        );
      }
      const [target] = targetOccurrences;
      if (!target) throw new Error('Runtime-test target inventory unexpectedly became empty');
      if (coverage.kind === 'runtime' && target.runner === 'describe') {
        throw new Error(
          `Conditional coverage runtime target is a suite, not a concrete test: ${coverage.file}#${coverage.target} (${entry.path})`
        );
      }
      if (coverage.kind === 'runtime') {
        const unsupportedModifiers = [...target.modifiers]
          .filter((modifier) => !SUPPORTED_RUNTIME_TEST_MODIFIERS.has(modifier))
          .sort(compareCodeUnits);
        if (unsupportedModifiers.length > 0) {
          throw new Error(
            `Conditional coverage runtime target uses unsupported Jest modifier(s) ${unsupportedModifiers.join(', ')}: ${coverage.file}#${coverage.target} (${entry.path})`
          );
        }
      }
      if (coverage.kind === 'runtime' && target.status !== 'active') {
        throw new Error(
          `Conditional coverage runtime target is ${target.status}: ${coverage.file}#${coverage.target} (${entry.path})`
        );
      }
      if (coverage.kind === 'runtime') validateLiteralWitnessBinding(coverage, entry.path, target);
    }
  }
}

export function validateSemanticRefinements(
  repoRoot: string,
  schemaRoot: string,
  registry: readonly ConditionalCoverageRegistration[],
  refinements: readonly SemanticRefinement[]
): void {
  const ids = new Set<string>();
  for (const refinement of refinements) {
    if (ids.has(refinement.id)) throw new Error(`Duplicate semantic refinement: ${refinement.id}`);
    ids.add(refinement.id);
    if (refinement.schemaPaths.length === 0)
      throw new Error(`Semantic refinement has no schema paths: ${refinement.id}`);
    for (const schemaPath of refinement.schemaPaths) {
      if (!fs.existsSync(path.join(schemaRoot, schemaPath.replace(/^schema\//, '')))) {
        throw new Error(`Semantic refinement schema path is stale: ${refinement.id} -> ${schemaPath}`);
      }
    }
  }

  const referencedIds = new Set(registry.flatMap((entry) => (entry.refinement ? [entry.refinement] : [])));
  for (const referencedId of referencedIds) {
    if (!ids.has(referencedId)) throw new Error(`Unknown semantic refinement in conditional registry: ${referencedId}`);
  }
  for (const id of ids) {
    if (!referencedIds.has(id)) throw new Error(`Semantic refinement is not attached to a conditional: ${id}`);
  }

  validateCoverageReferences(
    repoRoot,
    refinements.map((refinement) => ({
      coverage: refinement.coverage,
      path: `semantic-refinement:${refinement.id}`,
    }))
  );
}

function loadTsConfig(repoRoot: string): ts.ParsedCommandLine {
  const configPath = path.join(repoRoot, 'tsconfig.tests.json');
  const configResult = ts.readConfigFile(configPath, (fileName) => ts.sys.readFile(fileName));
  if (configResult.error) {
    throw new Error(ts.flattenDiagnosticMessageText(configResult.error.messageText, '\n'));
  }
  const parsed = ts.parseJsonConfigFileContent(configResult.config, ts.sys, repoRoot, undefined, configPath);
  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'));
  }
  return parsed;
}

interface TypeScriptContext {
  checker: ts.TypeChecker;
  program: ts.Program;
}

const typeScriptContextCache = new Map<string, TypeScriptContext>();

function loadTypeScriptContext(
  repoRoot: string,
  exactOptionalPropertyTypes = false,
  additionalRootNames: readonly string[] = []
): TypeScriptContext {
  const normalizedAdditionalRoots = [...additionalRootNames].map((root) => path.resolve(root)).sort(compareCodeUnits);
  const cacheKey = `${repoRoot}\0exactOptionalPropertyTypes=${exactOptionalPropertyTypes}\0${normalizedAdditionalRoots.join('\0')}`;
  const cached = typeScriptContextCache.get(cacheKey);
  if (cached) return cached;
  const parsedConfig = loadTsConfig(repoRoot);
  const compilerOptions = exactOptionalPropertyTypes
    ? { ...parsedConfig.options, exactOptionalPropertyTypes: true }
    : parsedConfig.options;
  const program = ts.createProgram(
    [...new Set([...parsedConfig.fileNames, ...normalizedAdditionalRoots])],
    compilerOptions
  );
  const context = { checker: program.getTypeChecker(), program };
  typeScriptContextCache.set(cacheKey, context);
  return context;
}

function literalStrings(type: ts.Type): string[] {
  const members = type.isUnion() ? type.types : [type];
  return members.flatMap((member) => (member.isStringLiteral() ? [member.value] : []));
}

const FALLBACK_TYPE_FORMAT_FLAGS = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.InTypeAlias;

function isReadonlyProperty(property: ts.Symbol): boolean {
  // Mapped types such as Readonly<T> carry readonly in an internal check flag
  // rather than on the source declaration. TypeScript is pinned, so using this
  // stable compiler flag is preferable to silently flattening the public API.
  const mappedReadonly =
    ((
      ts as typeof ts & {
        getCheckFlags(symbol: ts.Symbol): number;
      }
    ).getCheckFlags(property) &
      8) !==
    0;
  return (
    mappedReadonly ||
    (property.declarations?.some((declaration) => {
      if (!ts.canHaveModifiers(declaration)) return false;
      return ts.getModifiers(declaration)?.some((modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword) ?? false;
    }) ??
      false)
  );
}

function structuralSignatureSignature(
  checker: ts.TypeChecker,
  signature: ts.Signature,
  sourceFile: ts.SourceFile,
  activeTypes: readonly ts.Type[]
): string {
  const printed = checker.signatureToString(signature, sourceFile, FALLBACK_TYPE_FORMAT_FLAGS);
  const typeParameters = signature.typeParameters?.map((typeParameter) =>
    structuralTypeSignature(checker, typeParameter, sourceFile, activeTypes)
  );
  const { thisParameter } = signature;
  const parameters = signature.parameters.map((parameter) => {
    const declaration = parameter.valueDeclaration ?? parameter.declarations?.[0];
    const rest = declaration && ts.isParameter(declaration) && declaration.dotDotDotToken ? '...' : '';
    const optional = (parameter.flags & ts.SymbolFlags.Optional) !== 0 ? '?' : '';
    return `${rest}${JSON.stringify(parameter.name)}${optional}:${structuralTypeSignature(
      checker,
      checker.getTypeOfSymbolAtLocation(parameter, declaration ?? sourceFile),
      sourceFile,
      activeTypes
    )}`;
  });
  const thisSignature = thisParameter
    ? `this:${structuralTypeSignature(
        checker,
        checker.getTypeOfSymbolAtLocation(thisParameter, thisParameter.valueDeclaration ?? sourceFile),
        sourceFile,
        activeTypes
      )};`
    : '';
  return `${printed}=>generic(${typeParameters?.join(',') ?? ''});${thisSignature}params(${parameters.join(',')});returns(${structuralTypeSignature(
    checker,
    checker.getReturnTypeOfSignature(signature),
    sourceFile,
    activeTypes
  )})`;
}

function structuralTypeSignature(
  checker: ts.TypeChecker,
  type: ts.Type,
  sourceFile: ts.SourceFile,
  activeTypes: readonly ts.Type[] = []
): string {
  if (type.isUnion()) {
    return `union(${type.types
      .map((member) => structuralTypeSignature(checker, member, sourceFile, activeTypes))
      .sort(compareCodeUnits)
      .join('|')})`;
  }
  if (type.isIntersection()) {
    return `intersection(${type.types
      .map((member) => structuralTypeSignature(checker, member, sourceFile, activeTypes))
      .sort(compareCodeUnits)
      .join('&')})`;
  }
  if (type.isStringLiteral()) return `string:${JSON.stringify(type.value)}`;
  if (type.isNumberLiteral()) return `number:${String(type.value)}`;

  const { flags } = type;
  if ((flags & ts.TypeFlags.String) !== 0) return 'string';
  if ((flags & ts.TypeFlags.Number) !== 0) return 'number';
  if ((flags & ts.TypeFlags.Boolean) !== 0) return 'boolean';
  if ((flags & ts.TypeFlags.BooleanLiteral) !== 0) return checker.typeToString(type, sourceFile);
  if ((flags & ts.TypeFlags.BigInt) !== 0) return 'bigint';
  if ((flags & ts.TypeFlags.BigIntLiteral) !== 0) return `bigint:${checker.typeToString(type, sourceFile)}`;
  if ((flags & ts.TypeFlags.Null) !== 0) return 'null';
  if ((flags & ts.TypeFlags.Undefined) !== 0) return 'undefined';
  if ((flags & ts.TypeFlags.Void) !== 0) return 'void';
  if ((flags & ts.TypeFlags.Never) !== 0) return 'never';
  if ((flags & ts.TypeFlags.Unknown) !== 0) return 'unknown';
  if ((flags & ts.TypeFlags.Any) !== 0) return 'any';
  if ((flags & ts.TypeFlags.ESSymbolLike) !== 0) return checker.typeToString(type, sourceFile);

  if ((flags & ts.TypeFlags.TypeParameter) !== 0) {
    const constraint = checker.getBaseConstraintOfType(type);
    return constraint
      ? `type-parameter(${structuralTypeSignature(checker, constraint, sourceFile, activeTypes)})`
      : 'type-parameter(unknown)';
  }

  if ((flags & ts.TypeFlags.Object) !== 0) {
    const cycleIndex = activeTypes.indexOf(type);
    if (cycleIndex !== -1) return `cycle:${activeTypes.length - cycleIndex}`;
    const nestedActiveTypes = [...activeTypes, type];

    if (checker.isTupleType(type)) {
      const reference = type as ts.TypeReference;
      const tupleTarget = reference.target as ts.TupleType;
      const elementTypes = checker.getTypeArguments(reference);
      const { elementFlags } = tupleTarget;
      const elements = elementTypes.map((elementType, index) => {
        const elementFlag = elementFlags[index] ?? ts.ElementFlags.Required;
        const declaration = tupleTarget.labeledElementDeclarations?.[index];
        const label = declaration?.name ? `${declaration.name.getText()}:` : '';
        const prefix =
          (elementFlag & ts.ElementFlags.Rest) !== 0
            ? '...'
            : (elementFlag & ts.ElementFlags.Optional) !== 0
              ? '?'
              : '';
        return `${prefix}${label}${structuralTypeSignature(checker, elementType, sourceFile, nestedActiveTypes)}`;
      });
      return `${tupleTarget.readonly ? 'readonly-' : ''}tuple(${elements.join(',')})`;
    }

    if (checker.isArrayType(type)) {
      const reference = type as ts.TypeReference;
      const [elementType] = checker.getTypeArguments(reference);
      const readonly = reference.target.symbol.name === 'ReadonlyArray';
      return `${readonly ? 'readonly-' : ''}array(${
        elementType ? structuralTypeSignature(checker, elementType, sourceFile, nestedActiveTypes) : 'unknown'
      })`;
    }

    const properties = checker
      .getPropertiesOfType(type)
      .sort((left, right) => compareCodeUnits(left.name, right.name))
      .map((property) => {
        const propertyType = checker.getTypeOfSymbolAtLocation(property, sourceFile);
        const optional = (property.flags & ts.SymbolFlags.Optional) !== 0 ? '?' : '';
        const readonly = isReadonlyProperty(property) ? 'readonly ' : '';
        return `${readonly}${JSON.stringify(property.name)}${optional}:${structuralTypeSignature(
          checker,
          propertyType,
          sourceFile,
          nestedActiveTypes
        )}`;
      });
    const indexes = checker
      .getIndexInfosOfType(type)
      .map(
        (indexInfo) =>
          `${indexInfo.isReadonly ? 'readonly-' : ''}index(${structuralTypeSignature(
            checker,
            indexInfo.keyType,
            sourceFile,
            nestedActiveTypes
          )}:${structuralTypeSignature(checker, indexInfo.type, sourceFile, nestedActiveTypes)})`
      )
      .sort(compareCodeUnits);
    const calls = checker
      .getSignaturesOfType(type, ts.SignatureKind.Call)
      .map((signature) => structuralSignatureSignature(checker, signature, sourceFile, nestedActiveTypes))
      .sort(compareCodeUnits);
    const constructs = checker
      .getSignaturesOfType(type, ts.SignatureKind.Construct)
      .map((signature) => structuralSignatureSignature(checker, signature, sourceFile, nestedActiveTypes))
      .sort(compareCodeUnits);
    return `object(${[...properties, ...indexes, ...calls.map((call) => `call:${call}`), ...constructs.map((construct) => `new:${construct}`)].join(';')})`;
  }

  return `opaque(${checker.typeToString(type, sourceFile, FALLBACK_TYPE_FORMAT_FLAGS)})`;
}

export type PublicTypeBoundary = 'built' | 'source';

function publicTypePath(repoRoot: string, boundary: PublicTypeBoundary, fileName: 'native' | 'output'): string {
  return path.join(
    repoRoot,
    boundary === 'source' ? 'src' : 'dist',
    'types',
    `${fileName}.${boundary === 'source' ? 'ts' : 'd.ts'}`
  );
}

/** Inventory the public canonical OcfObject union through the TypeScript type checker. */
export function inventoryCanonicalOcfObjects(
  repoRoot: string,
  boundary: PublicTypeBoundary = 'source'
): CanonicalOcfObjectInventoryEntry[] {
  const outputPath = publicTypePath(repoRoot, boundary, 'output');
  const { checker, program } = loadTypeScriptContext(repoRoot, true, [outputPath]);
  const sourceFile = program.getSourceFile(outputPath);
  if (!sourceFile) throw new Error(`TypeScript program did not load ${outputPath}`);
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) throw new Error('Could not resolve the output.ts module symbol');
  const ocfObjectSymbol = checker.getExportsOfModule(moduleSymbol).find((symbol) => symbol.name === 'OcfObject');
  if (!ocfObjectSymbol) throw new Error('Could not resolve exported OcfObject type');
  const ocfObjectType = checker.getDeclaredTypeOfSymbol(ocfObjectSymbol);
  const variants = ocfObjectType.isUnion() ? ocfObjectType.types : [ocfObjectType];

  const inventory: CanonicalOcfObjectInventoryEntry[] = [];
  for (const variant of variants) {
    const objectType = checker.getPropertyOfType(variant, 'object_type');
    if (!objectType) throw new Error(`OcfObject variant has no object_type: ${checker.typeToString(variant)}`);
    const objectTypeValue = checker.getTypeOfSymbolAtLocation(objectType, sourceFile);
    const discriminators = literalStrings(objectTypeValue);
    if (discriminators.length !== 1) {
      throw new Error(
        `OcfObject variant must have one literal object_type, got ${checker.typeToString(objectTypeValue)} in ${checker.typeToString(variant)}`
      );
    }
    const [discriminator] = discriminators;
    if (!discriminator) throw new Error('TypeScript returned an empty object_type discriminator');
    inventory.push({ discriminator, signature: structuralTypeSignature(checker, variant, sourceFile) });
  }

  return inventory.sort(
    (left, right) =>
      compareCodeUnits(left.discriminator, right.discriminator) || compareCodeUnits(left.signature, right.signature)
  );
}

const SCHEMA_INGESTION_ALIAS_NAMES = [
  'OcfPlanSecurityAcceptance',
  'OcfPlanSecurityCancellation',
  'OcfPlanSecurityExercise',
  'OcfPlanSecurityIssuance',
  'OcfPlanSecurityRelease',
  'OcfPlanSecurityRetraction',
  'OcfPlanSecurityTransfer',
] as const;
const SCHEMA_INGESTION_OUTPUT_ALIAS_NAMES = SCHEMA_INGESTION_ALIAS_NAMES.map((name) => `${name}Output` as const);

/** Inventory public schema-ingestion aliases intentionally outside OcfObject. */
export function inventorySchemaIngestionAliases(
  repoRoot: string,
  boundary: PublicTypeBoundary = 'source'
): Record<string, string> {
  const nativePath = publicTypePath(repoRoot, boundary, 'native');
  const outputPath = publicTypePath(repoRoot, boundary, 'output');
  const { checker, program } = loadTypeScriptContext(repoRoot, true, [nativePath, outputPath]);

  function inventoryAliases(modulePath: string, names: readonly string[]): Array<readonly [string, string]> {
    const sourceFile = program.getSourceFile(modulePath);
    if (!sourceFile) throw new Error(`TypeScript program did not load ${modulePath}`);
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) throw new Error(`Could not resolve the ${path.basename(modulePath)} module symbol`);
    const exportsByName = new Map(checker.getExportsOfModule(moduleSymbol).map((symbol) => [symbol.name, symbol]));
    return names.map((name) => {
      const symbol = exportsByName.get(name);
      if (!symbol) throw new Error(`Could not resolve exported schema-ingestion alias ${name}`);
      return [name, structuralTypeSignature(checker, checker.getDeclaredTypeOfSymbol(symbol), sourceFile)] as const;
    });
  }

  return Object.fromEntries(
    [
      ...inventoryAliases(nativePath, SCHEMA_INGESTION_ALIAS_NAMES),
      ...inventoryAliases(outputPath, SCHEMA_INGESTION_OUTPUT_ALIAS_NAMES),
    ].sort(([left], [right]) => compareCodeUnits(left, right))
  );
}

/** Fingerprint every canonical object and legacy schema-ingestion alias shape. */
export function inventoryCanonicalOcfPublicTypes(
  repoRoot: string,
  boundary: PublicTypeBoundary = 'source'
): CanonicalOcfPublicTypeInventory {
  const objects = inventoryCanonicalOcfObjects(repoRoot, boundary);
  const schemaIngestionAliases = inventorySchemaIngestionAliases(repoRoot, boundary);
  const canonicalJson = JSON.stringify({ objects, schemaIngestionAliases });
  return {
    fingerprint: createHash('sha256').update(canonicalJson).digest('hex'),
    objects,
    schemaIngestionAliases,
  };
}

function groupCanonicalObjectSignatures(inventory: CanonicalOcfPublicTypeInventory): Map<string, readonly string[]> {
  const signaturesByDiscriminator = new Map<string, string[]>();
  for (const entry of inventory.objects) {
    const signatures = signaturesByDiscriminator.get(entry.discriminator) ?? [];
    signatures.push(entry.signature);
    signaturesByDiscriminator.set(entry.discriminator, signatures);
  }
  for (const signatures of signaturesByDiscriminator.values()) signatures.sort(compareCodeUnits);
  return signaturesByDiscriminator;
}

function signatureFingerprint(signature: string): string {
  return createHash('sha256').update(signature).digest('hex');
}

/** Identify the first canonical discriminator or alias that differs across declaration boundaries. */
export function describeCanonicalOcfPublicTypeDrift(
  source: CanonicalOcfPublicTypeInventory,
  built: CanonicalOcfPublicTypeInventory
): string | undefined {
  const sourceObjects = groupCanonicalObjectSignatures(source);
  const builtObjects = groupCanonicalObjectSignatures(built);
  const discriminators = [...new Set([...sourceObjects.keys(), ...builtObjects.keys()])].sort(compareCodeUnits);

  for (const discriminator of discriminators) {
    const sourceSignatures = sourceObjects.get(discriminator);
    const builtSignatures = builtObjects.get(discriminator);
    if (!sourceSignatures) return `unexpected built OcfObject discriminator ${JSON.stringify(discriminator)}`;
    if (!builtSignatures) return `missing built OcfObject discriminator ${JSON.stringify(discriminator)}`;
    const variantCount = Math.max(sourceSignatures.length, builtSignatures.length);
    for (let index = 0; index < variantCount; index += 1) {
      const sourceSignature = sourceSignatures[index];
      const builtSignature = builtSignatures[index];
      if (sourceSignature === undefined) {
        return `unexpected built OcfObject variant ${index + 1} for discriminator ${JSON.stringify(discriminator)}`;
      }
      if (builtSignature === undefined) {
        return `missing built OcfObject variant ${index + 1} for discriminator ${JSON.stringify(discriminator)}`;
      }
      if (sourceSignature !== builtSignature) {
        return (
          `OcfObject discriminator ${JSON.stringify(discriminator)} variant ${index + 1} differs: ` +
          `source sha256 ${signatureFingerprint(sourceSignature)}, built sha256 ${signatureFingerprint(builtSignature)}`
        );
      }
    }
  }

  const aliasNames = [
    ...new Set([...Object.keys(source.schemaIngestionAliases), ...Object.keys(built.schemaIngestionAliases)]),
  ].sort(compareCodeUnits);
  for (const aliasName of aliasNames) {
    const sourceSignature = source.schemaIngestionAliases[aliasName];
    const builtSignature = built.schemaIngestionAliases[aliasName];
    if (sourceSignature === undefined) return `unexpected built schema-ingestion alias ${JSON.stringify(aliasName)}`;
    if (builtSignature === undefined) return `missing built schema-ingestion alias ${JSON.stringify(aliasName)}`;
    if (sourceSignature !== builtSignature) {
      return (
        `schema-ingestion alias ${JSON.stringify(aliasName)} differs: ` +
        `source sha256 ${signatureFingerprint(sourceSignature)}, built sha256 ${signatureFingerprint(builtSignature)}`
      );
    }
  }

  if (source.fingerprint !== built.fingerprint) {
    return `aggregate public-type fingerprint differs: source ${source.fingerprint}, built ${built.fingerprint}`;
  }
  return undefined;
}

export function getNamedTypeProperty(
  repoRoot: string,
  exportedTypeName: string,
  propertyName: string
): { optional: boolean; type: string } {
  const { checker, program } = loadTypeScriptContext(repoRoot);
  const nativePath = path.join(repoRoot, 'src', 'types', 'native.ts');
  const sourceFile = program.getSourceFile(nativePath);
  if (!sourceFile) throw new Error(`TypeScript program did not load ${nativePath}`);
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) throw new Error('Could not resolve the native.ts module symbol');
  const typeSymbol = checker.getExportsOfModule(moduleSymbol).find((symbol) => symbol.name === exportedTypeName);
  if (!typeSymbol) throw new Error(`Could not resolve exported type ${exportedTypeName}`);
  const type = checker.getDeclaredTypeOfSymbol(typeSymbol);
  const property = checker.getPropertyOfType(type, propertyName);
  if (!property) throw new Error(`${exportedTypeName} has no ${propertyName} property`);
  return {
    optional: (property.flags & ts.SymbolFlags.Optional) !== 0,
    type: checker.typeToString(checker.getTypeOfSymbolAtLocation(property, sourceFile)),
  };
}
