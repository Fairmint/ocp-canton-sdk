import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

export const OCF_GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/';

const CONDITIONAL_KEYWORDS = ['anyOf', 'oneOf', 'not'] as const;
const SCHEMA_SUFFIX = '.schema.json';

type ConditionalKeyword = (typeof CONDITIONAL_KEYWORDS)[number];
type JsonObject = Record<string, unknown>;

export interface SchemaConditional {
  keyword: ConditionalKeyword;
  path: string;
}

export interface ReachableSchemaInventory {
  conditionals: SchemaConditional[];
  fingerprint: string;
  objectSchemaCount: number;
  reachableSchemaCount: number;
  reachableSchemaPaths: string[];
}

export interface CanonicalOcfObjectInventoryEntry {
  discriminator: string;
  optionalProperties: string[];
  requiredProperties: string[];
}

export interface PinnedOcfObjectPropertyInventoryEntry {
  discriminator: string;
  properties: string[];
  schemaPath: string;
}

export interface CanonicalPropertyParityExclusion {
  discriminator: string;
  kind: 'schema-only' | 'sdk-only';
  property: string;
  rationale: string;
}

export interface CanonicalPropertyParityProblem {
  discriminator: string;
  kind: 'duplicate-exclusion' | 'duplicate-schema' | 'missing-schema' | 'schema-only' | 'sdk-only' | 'stale-exclusion';
  property?: string;
  schemaPath?: string;
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

function decodeJsonPointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function normalizeSlashes(value: string): string {
  return value.split(path.sep).join('/');
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
  return files.sort((left, right) => left.localeCompare(right));
}

function readSchemaFile(schemaPath: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as unknown;
  assertJsonObject(parsed, schemaPath);
  return parsed;
}

export function resolveJsonPointer(document: unknown, fragment: string, source: string): unknown {
  if (fragment === '') return document;
  if (!fragment.startsWith('/')) {
    throw new Error(`Only JSON Pointer fragments are supported in ${source}: #${fragment}`);
  }

  let current = document;
  for (const encodedSegment of fragment.slice(1).split('/')) {
    const segment = decodeJsonPointerSegment(encodedSegment);
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
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

function assertInsideSchemaRoot(schemaPath: string, schemaRoot: string): void {
  const relativePath = path.relative(schemaRoot, schemaPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Schema reference escapes the pinned schema root: ${schemaPath}`);
  }
}

function resolveRefPath(ref: string, sourcePath: string, schemaRoot: string): { fragment: string; schemaPath: string } {
  const hashIndex = ref.indexOf('#');
  const refPath = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? '' : ref.slice(hashIndex + 1);
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
  return { fragment, schemaPath };
}

/** Discover conditional keywords in one JSON value without following references. */
export function discoverConditionalPathsInValue(value: unknown, sourcePath: string): SchemaConditional[] {
  const discovered: SchemaConditional[] = [];

  function visit(current: unknown, pointer: string): void {
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${pointer}/${index}`));
      return;
    }
    if (!isJsonObject(current)) return;

    for (const keyword of CONDITIONAL_KEYWORDS) {
      if (Object.prototype.hasOwnProperty.call(current, keyword)) {
        discovered.push({ keyword, path: `${sourcePath}#${pointer}/${keyword}` });
      }
    }

    for (const [key, child] of Object.entries(current)) {
      visit(child, `${pointer}/${escapeJsonPointerSegment(key)}`);
    }
  }

  visit(value, '');
  return discovered.sort((left, right) => left.path.localeCompare(right.path));
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
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, sourcePath, `${sourcePointer}/${index}`));
      return;
    }
    if (!isJsonObject(current)) return;

    for (const keyword of CONDITIONAL_KEYWORDS) {
      if (Object.prototype.hasOwnProperty.call(current, keyword)) {
        const relativeSource = normalizeSlashes(path.relative(schemaRoot, sourcePath));
        const conditional = {
          keyword,
          path: `schema/${relativeSource}#${sourcePointer}/${keyword}`,
        } as const;
        conditionalByPath.set(conditional.path, conditional);
      }
    }

    const ref = current.$ref;
    if (typeof ref === 'string') {
      const target = resolveRefPath(ref, sourcePath, schemaRoot);
      visitLocation(target.schemaPath, target.fragment);
    }

    for (const [key, child] of Object.entries(current)) {
      if (key !== '$ref') {
        visit(child, sourcePath, `${sourcePointer}/${escapeJsonPointerSegment(key)}`);
      }
    }
  }

  function visitLocation(schemaPath: string, fragment: string): void {
    const locationKey = `${schemaPath}#${fragment}`;
    if (visitedLocations.has(locationKey)) return;
    visitedLocations.add(locationKey);
    reachableSchemaPaths.add(schemaPath);

    const document = readSchemaFile(schemaPath);
    const pointedValue = resolveJsonPointer(document, fragment, schemaPath);
    visit(pointedValue, schemaPath, fragment);
  }

  objectSchemaPaths.forEach((schemaPath) => visitLocation(schemaPath, ''));

  const sortedReachablePaths = [...reachableSchemaPaths]
    .map((schemaPath) => normalizeSlashes(path.relative(schemaRoot, schemaPath)))
    .sort((left, right) => left.localeCompare(right));
  const fingerprintHash = createHash('sha256');
  for (const relativePath of sortedReachablePaths) {
    fingerprintHash.update(relativePath);
    fingerprintHash.update('\0');
    fingerprintHash.update(fs.readFileSync(path.join(schemaRoot, relativePath)));
    fingerprintHash.update('\0');
  }

  return {
    conditionals: [...conditionalByPath.values()].sort((left, right) => left.path.localeCompare(right.path)),
    fingerprint: fingerprintHash.digest('hex'),
    objectSchemaCount: objectSchemaPaths.length,
    reachableSchemaCount: sortedReachablePaths.length,
    reachableSchemaPaths: sortedReachablePaths.map((relativePath) => `schema/${relativePath}`),
  };
}

function dereferenceValue(
  value: unknown,
  sourcePath: string,
  schemaRoot: string,
  activeLocations: ReadonlySet<string>
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => dereferenceValue(item, sourcePath, schemaRoot, activeLocations));
  }
  if (!isJsonObject(value)) return value;

  if (typeof value.$ref === 'string') {
    const target = resolveRefPath(value.$ref, sourcePath, schemaRoot);
    const locationKey = `${target.schemaPath}#${target.fragment}`;
    if (activeLocations.has(locationKey)) {
      throw new Error(`Circular OCF schema reference cannot be fully dereferenced: ${locationKey}`);
    }
    const document = readSchemaFile(target.schemaPath);
    const pointedValue = resolveJsonPointer(document, target.fragment, target.schemaPath);
    return dereferenceValue(pointedValue, target.schemaPath, schemaRoot, new Set([...activeLocations, locationKey]));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, dereferenceValue(child, sourcePath, schemaRoot, activeLocations)])
  );
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

function collectComposedObjectProperties(schema: unknown, properties: Set<string>): void {
  if (!isJsonObject(schema)) return;

  if (isJsonObject(schema.properties)) {
    Object.keys(schema.properties).forEach((property) => properties.add(property));
  }

  for (const keyword of ['allOf', 'anyOf', 'oneOf'] as const) {
    const branches = schema[keyword];
    if (Array.isArray(branches)) {
      branches.forEach((branch) => collectComposedObjectProperties(branch, properties));
    }
  }
}

function getObjectSchemaDiscriminators(schema: JsonObject, source: string): string[] {
  const { properties } = schema;
  if (!isJsonObject(properties)) throw new Error(`Object schema has no properties object: ${source}`);
  const objectType = properties.object_type;
  if (!isJsonObject(objectType)) {
    throw new Error(`Object schema has no literal object_type discriminator: ${source}`);
  }
  if (typeof objectType.const === 'string' && objectType.const.length > 0) return [objectType.const];
  if (
    Array.isArray(objectType.enum) &&
    objectType.enum.length > 0 &&
    objectType.enum.every((value): value is string => typeof value === 'string' && value.length > 0)
  ) {
    return objectType.enum;
  }
  throw new Error(`Object schema has no literal object_type discriminator: ${source}`);
}

/** Inventory fully composed top-level properties for every pinned OCF object schema. */
export function inventoryPinnedOcfObjectProperties(schemaRoot: string): PinnedOcfObjectPropertyInventoryEntry[] {
  const objectRoot = path.join(schemaRoot, 'objects');
  return listSchemaFiles(objectRoot)
    .flatMap((schemaPath) => {
      const dereferenced = dereferenceValue(
        readSchemaFile(schemaPath),
        schemaPath,
        schemaRoot,
        new Set([`${schemaPath}#`])
      );
      assertJsonObject(dereferenced, `dereferenced ${schemaPath}`);
      const properties = new Set<string>();
      collectComposedObjectProperties(dereferenced, properties);
      const propertyNames = [...properties].sort((left, right) => left.localeCompare(right));
      const relativeSchemaPath = `schema/objects/${normalizeSlashes(path.relative(objectRoot, schemaPath))}`;
      return getObjectSchemaDiscriminators(dereferenced, schemaPath).map((discriminator) => ({
        discriminator,
        properties: propertyNames,
        schemaPath: relativeSchemaPath,
      }));
    })
    .sort((left, right) => left.discriminator.localeCompare(right.discriminator));
}

function propertyDifferenceKey(
  kind: CanonicalPropertyParityExclusion['kind'],
  discriminator: string,
  property: string
): string {
  return `${kind}:${discriminator}:${property}`;
}

/** Compare canonical public DTO keys with pinned schema keys, enforcing live narrow exclusions. */
export function compareCanonicalOcfPropertySets(
  canonicalInventory: readonly CanonicalOcfObjectInventoryEntry[],
  schemaInventory: readonly PinnedOcfObjectPropertyInventoryEntry[],
  exclusions: readonly CanonicalPropertyParityExclusion[]
): CanonicalPropertyParityProblem[] {
  const problems: CanonicalPropertyParityProblem[] = [];
  const canonicalDiscriminators = new Set(canonicalInventory.map((entry) => entry.discriminator));
  const schemasByDiscriminator = new Map<string, PinnedOcfObjectPropertyInventoryEntry>();
  for (const schema of schemaInventory) {
    if (!canonicalDiscriminators.has(schema.discriminator)) continue;
    if (schemasByDiscriminator.has(schema.discriminator)) {
      problems.push({
        discriminator: schema.discriminator,
        kind: 'duplicate-schema',
        schemaPath: schema.schemaPath,
      });
    } else {
      schemasByDiscriminator.set(schema.discriminator, schema);
    }
  }

  const exclusionsByKey = new Map<string, CanonicalPropertyParityExclusion>();
  for (const exclusion of exclusions) {
    const key = propertyDifferenceKey(exclusion.kind, exclusion.discriminator, exclusion.property);
    if (exclusionsByKey.has(key)) {
      problems.push({
        discriminator: exclusion.discriminator,
        kind: 'duplicate-exclusion',
        property: exclusion.property,
      });
    } else {
      if (exclusion.rationale.trim().length === 0) {
        throw new Error(`Canonical property exclusion requires a rationale: ${key}`);
      }
      exclusionsByKey.set(key, exclusion);
    }
  }

  const matchedExclusions = new Set<string>();
  for (const canonical of canonicalInventory) {
    const schema = schemasByDiscriminator.get(canonical.discriminator);
    if (!schema) {
      problems.push({ discriminator: canonical.discriminator, kind: 'missing-schema' });
      continue;
    }

    const sdkProperties = new Set([...canonical.requiredProperties, ...canonical.optionalProperties]);
    const schemaProperties = new Set(schema.properties);
    const differences = [
      ...[...schemaProperties]
        .filter((property) => !sdkProperties.has(property))
        .map((property) => ({ kind: 'schema-only' as const, property })),
      ...[...sdkProperties]
        .filter((property) => !schemaProperties.has(property))
        .map((property) => ({ kind: 'sdk-only' as const, property })),
    ];

    for (const difference of differences) {
      const key = propertyDifferenceKey(difference.kind, canonical.discriminator, difference.property);
      if (exclusionsByKey.has(key)) {
        matchedExclusions.add(key);
      } else {
        problems.push({
          discriminator: canonical.discriminator,
          kind: difference.kind,
          property: difference.property,
          schemaPath: schema.schemaPath,
        });
      }
    }
  }

  for (const [key, exclusion] of exclusionsByKey) {
    if (!matchedExclusions.has(key)) {
      problems.push({
        discriminator: exclusion.discriminator,
        kind: 'stale-exclusion',
        property: exclusion.property,
      });
    }
  }

  return problems.sort(
    (left, right) =>
      left.discriminator.localeCompare(right.discriminator) ||
      left.kind.localeCompare(right.kind) ||
      (left.property ?? '').localeCompare(right.property ?? '')
  );
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

  return problems.sort((left, right) => left.path.localeCompare(right.path) || left.kind.localeCompare(right.kind));
}

function collectRuntimeTestTargets(sourceFile: ts.SourceFile): Set<string> {
  const targets = new Set<string>();

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const [firstArgument] = node.arguments;
      if (firstArgument && ts.isStringLiteralLike(firstArgument)) {
        let { expression } = node;
        if (ts.isCallExpression(expression)) ({ expression } = expression);
        if (ts.isPropertyAccessExpression(expression)) ({ expression } = expression);
        if (
          ts.isIdentifier(expression) &&
          (expression.text === 'describe' || expression.text === 'it' || expression.text === 'test')
        ) {
          targets.add(firstArgument.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return targets;
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
  const targetCache = new Map<string, Set<string>>();
  for (const entry of registry) {
    if (entry.coverage.length === 0) {
      throw new Error(`Conditional coverage registration has no tests: ${entry.path}`);
    }
    for (const coverage of entry.coverage) {
      const absolutePath = path.join(repoRoot, coverage.file);
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Conditional coverage file does not exist: ${coverage.file} (${entry.path})`);
      }
      const cacheKey = `${coverage.kind}:${absolutePath}`;
      let targets = targetCache.get(cacheKey);
      if (!targets) {
        const sourceFile = ts.createSourceFile(
          absolutePath,
          fs.readFileSync(absolutePath, 'utf8'),
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TS
        );
        targets = coverage.kind === 'runtime' ? collectRuntimeTestTargets(sourceFile) : collectTypeTargets(sourceFile);
        targetCache.set(cacheKey, targets);
      }
      if (!targets.has(coverage.target)) {
        throw new Error(
          `Conditional coverage target does not exist: ${coverage.file}#${coverage.target} (${entry.path})`
        );
      }
    }
  }
}

export function validateSemanticRefinements(
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

function loadTypeScriptContext(repoRoot: string): TypeScriptContext {
  const cached = typeScriptContextCache.get(repoRoot);
  if (cached) return cached;
  const parsedConfig = loadTsConfig(repoRoot);
  const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
  const context = { checker: program.getTypeChecker(), program };
  typeScriptContextCache.set(repoRoot, context);
  return context;
}

function literalStrings(type: ts.Type): string[] {
  const members = type.isUnion() ? type.types : [type];
  return members.flatMap((member) => (member.isStringLiteral() ? [member.value] : []));
}

/** Inventory the public canonical OcfObject union through the TypeScript type checker. */
export function inventoryCanonicalOcfObjects(repoRoot: string): CanonicalOcfObjectInventoryEntry[] {
  const { checker, program } = loadTypeScriptContext(repoRoot);
  const outputPath = path.join(repoRoot, 'src', 'types', 'output.ts');
  const sourceFile = program.getSourceFile(outputPath);
  if (!sourceFile) throw new Error(`TypeScript program did not load ${outputPath}`);
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) throw new Error('Could not resolve the output.ts module symbol');
  const ocfObjectSymbol = checker.getExportsOfModule(moduleSymbol).find((symbol) => symbol.name === 'OcfObject');
  if (!ocfObjectSymbol) throw new Error('Could not resolve exported OcfObject type');
  const ocfObjectType = checker.getDeclaredTypeOfSymbol(ocfObjectSymbol);
  const variants = ocfObjectType.isUnion() ? ocfObjectType.types : [ocfObjectType];

  const variantsByDiscriminator = new Map<string, ts.Type[]>();
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
    const existing = variantsByDiscriminator.get(discriminator) ?? [];
    existing.push(variant);
    variantsByDiscriminator.set(discriminator, existing);
  }

  const inventory: CanonicalOcfObjectInventoryEntry[] = [];
  for (const [discriminator, discriminatorVariants] of variantsByDiscriminator) {
    const propertyNames = new Set<string>();
    discriminatorVariants.forEach((variant) =>
      checker.getPropertiesOfType(variant).forEach((property) => propertyNames.add(property.name))
    );
    const requiredProperties: string[] = [];
    const optionalProperties: string[] = [];
    for (const propertyName of [...propertyNames].sort((left, right) => left.localeCompare(right))) {
      const requiredInEveryVariant = discriminatorVariants.every((variant) => {
        const property = checker.getPropertyOfType(variant, propertyName);
        return property !== undefined && (property.flags & ts.SymbolFlags.Optional) === 0;
      });
      (requiredInEveryVariant ? requiredProperties : optionalProperties).push(propertyName);
    }
    inventory.push({ discriminator, optionalProperties, requiredProperties });
  }

  return inventory.sort((left, right) => left.discriminator.localeCompare(right.discriminator));
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
