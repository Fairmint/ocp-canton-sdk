import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { inventoryCanonicalOcfPublicTypes } from '../test/schemaAlignment/schemaConformanceHarness';

const projectRoot = process.cwd();
const configPath = path.join(projectRoot, 'tsconfig.json');
const packageJsonPath = path.join(projectRoot, 'package.json');
const declarationEntryPoint = path.join(projectRoot, 'dist', 'index.d.ts');
const strictConsumerEntryPoint = path.join(projectRoot, 'test', 'declarations', 'publicApi.types.ts');
const declarationRoot = `${path.dirname(declarationEntryPoint)}${path.sep}`;
const generatedDamlPackage = '@fairmint/open-captable-protocol-daml-js';
const cantonTransactionTreeOperationsModule = '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
const commonTypesDeclaration = path.join(declarationRoot, 'types', 'common.d.ts');
const diagnosticHost: ts.FormatDiagnosticsHost = {
  getCanonicalFileName: (fileName) => fileName,
  getCurrentDirectory: () => projectRoot,
  getNewLine: () => ts.sys.newLine,
};

function asRecord(value: unknown, description: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${description} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, property: string, description: string): string {
  const value = record[property];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${description}.${property} must be a non-empty string`);
  }
  return value;
}

function normalizedPackageTarget(target: string): string {
  return target.startsWith('./') ? target.slice(2) : target;
}

function verifyPackageTarget(label: string, target: string, expectedExtension: '.d.ts' | '.js'): string {
  const normalizedTarget = normalizedPackageTarget(target);
  if (!normalizedTarget.startsWith(`dist${path.sep}`) && !normalizedTarget.startsWith('dist/')) {
    throw new Error(`${label} must reference a generated dist artifact, received: ${target}`);
  }
  if (!normalizedTarget.endsWith(expectedExtension)) {
    throw new Error(`${label} must end in ${expectedExtension}, received: ${target}`);
  }

  const absoluteTarget = path.resolve(projectRoot, normalizedTarget);
  const distRoot = path.resolve(projectRoot, 'dist');
  if (absoluteTarget !== distRoot && !absoluteTarget.startsWith(`${distRoot}${path.sep}`)) {
    throw new Error(`${label} escapes the generated dist directory: ${target}`);
  }
  if (!fs.existsSync(absoluteTarget)) {
    throw new Error(`${label} references a missing package artifact: ${target}`);
  }
  return absoluteTarget;
}

function verifyPackageEntryPoints(): void {
  const packageJsonValue: unknown = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const packageJson = asRecord(packageJsonValue, 'package.json');
  const exportsMap = asRecord(packageJson.exports, 'package.json exports');
  const rootExport = asRecord(exportsMap['.'], 'package.json exports["."]');

  const rootTypes = verifyPackageTarget(
    'package.json exports["."].types',
    requireString(rootExport, 'types', 'package.json exports["."]'),
    '.d.ts'
  );
  const topLevelTypes = verifyPackageTarget(
    'package.json types',
    requireString(packageJson, 'types', 'package.json'),
    '.d.ts'
  );
  if (rootTypes !== topLevelTypes || rootTypes !== declarationEntryPoint) {
    throw new Error('package.json types and exports["."].types must both reference dist/index.d.ts');
  }

  const rootImport = verifyPackageTarget(
    'package.json exports["."].import',
    requireString(rootExport, 'import', 'package.json exports["."]'),
    '.js'
  );
  const rootRequire = verifyPackageTarget(
    'package.json exports["."].require',
    requireString(rootExport, 'require', 'package.json exports["."]'),
    '.js'
  );
  const rootDefault = verifyPackageTarget(
    'package.json exports["."].default',
    requireString(rootExport, 'default', 'package.json exports["."]'),
    '.js'
  );
  const topLevelMain = verifyPackageTarget(
    'package.json main',
    requireString(packageJson, 'main', 'package.json'),
    '.js'
  );
  if (rootImport !== rootRequire || rootImport !== rootDefault || rootImport !== topLevelMain) {
    throw new Error('package.json main and exports["."] runtime targets must reference the same built entry point');
  }
}

if (!fs.existsSync(declarationEntryPoint)) {
  throw new Error(`Declaration entry point not found: ${declarationEntryPoint}. Run npm run build first.`);
}

verifyPackageEntryPoints();
const sourcePublicTypes = inventoryCanonicalOcfPublicTypes(projectRoot, 'source');
const builtPublicTypes = inventoryCanonicalOcfPublicTypes(projectRoot, 'built');
if (JSON.stringify(builtPublicTypes) !== JSON.stringify(sourcePublicTypes)) {
  throw new Error(
    `Emitted public OCF types drift from source: source ${sourcePublicTypes.fingerprint}, built ${builtPublicTypes.fingerprint}`
  );
}

const configFile = ts.readConfigFile(configPath, (fileName) => ts.sys.readFile(fileName));
if (configFile.error) {
  throw new Error(ts.formatDiagnostic(configFile.error, diagnosticHost));
}

const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, projectRoot, {
  noEmit: true,
  skipLibCheck: false,
});
if (parsedConfig.errors.length > 0) {
  throw new Error(ts.formatDiagnosticsWithColorAndContext(parsedConfig.errors, diagnosticHost));
}

const program = ts.createProgram({
  rootNames: [declarationEntryPoint, strictConsumerEntryPoint],
  options: { ...parsedConfig.options, rootDir: projectRoot },
});

const diagnostics = ts.getPreEmitDiagnostics(program);

if (diagnostics.length > 0) {
  throw new Error(
    `Strict consumer declaration validation failed:\n${ts.formatDiagnosticsWithColorAndContext(diagnostics, diagnosticHost)}`
  );
}

const generatedDamlLeaks = program
  .getSourceFiles()
  .filter((sourceFile) => sourceFile.fileName.startsWith(declarationRoot))
  .filter((sourceFile) => sourceFile.text.includes(generatedDamlPackage))
  .map((sourceFile) => path.relative(projectRoot, sourceFile.fileName));

if (generatedDamlLeaks.length > 0) {
  throw new Error(
    `Public declaration graph references ${generatedDamlPackage}:\n${generatedDamlLeaks.map((file) => `- ${file}`).join('\n')}`
  );
}

const validationErrorDeclaration = program.getSourceFile(
  path.join(declarationRoot, 'errors', 'OcpValidationError.d.ts')
);
if (validationErrorDeclaration === undefined) {
  throw new Error('Could not locate errors/OcpValidationError.d.ts in declaration output');
}
const validationErrorClass = validationErrorDeclaration.statements.find(
  (statement): statement is ts.ClassDeclaration =>
    ts.isClassDeclaration(statement) && statement.name?.text === 'OcpValidationError'
);
if (validationErrorClass === undefined) {
  throw new Error('OcpValidationError class not found in its declaration file');
}
const receivedValueProperty = validationErrorClass.members.find(
  (member): member is ts.PropertyDeclaration =>
    ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === 'receivedValue'
);
if (receivedValueProperty === undefined) {
  throw new Error('OcpValidationError.receivedValue property not found in declarations');
}
const receivedValueType = receivedValueProperty.type;
const hasExplicitUnknownAndUndefined =
  receivedValueType !== undefined &&
  ts.isUnionTypeNode(receivedValueType) &&
  receivedValueType.types.some((type) => type.kind === ts.SyntaxKind.UnknownKeyword) &&
  receivedValueType.types.some((type) => type.kind === ts.SyntaxKind.UndefinedKeyword);

if (!hasExplicitUnknownAndUndefined) {
  throw new Error(
    'OcpValidationError.receivedValue must explicitly declare unknown | undefined in public declarations'
  );
}

const duplicatedTransactionTreeResponseImports = program
  .getSourceFiles()
  .filter((sourceFile) => sourceFile.fileName.startsWith(declarationRoot))
  .filter((sourceFile) => sourceFile.fileName !== commonTypesDeclaration)
  .filter((sourceFile) => sourceFile.text.includes(cantonTransactionTreeOperationsModule))
  .map((sourceFile) => path.relative(projectRoot, sourceFile.fileName));

if (duplicatedTransactionTreeResponseImports.length > 0) {
  throw new Error(
    `Public declarations must import transaction-tree response types through src/types/common:\n${duplicatedTransactionTreeResponseImports
      .map((file) => `- ${file}`)
      .join('\n')}`
  );
}
