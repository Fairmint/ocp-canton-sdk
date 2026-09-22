import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const projectRoot = process.cwd();
const configPath = path.join(projectRoot, 'tsconfig.json');
const declarationEntryPoint = path.join(projectRoot, 'dist', 'index.d.ts');
const strictConsumerEntryPoint = path.join(projectRoot, 'test', 'declarations', 'publicApi.types.ts');
// Replication subpath declaration entry and its consumer smoke test.
const replicationDeclarationEntryPoint = path.join(projectRoot, 'dist', 'replication.d.ts');
const replicationConsumerEntryPoint = path.join(projectRoot, 'test', 'declarations', 'replication.types.ts');
const declarationRoot = `${path.dirname(declarationEntryPoint)}${path.sep}`;
const generatedDamlPackage = '@fairmint/open-captable-protocol-daml-js';
const cantonTransactionTreeOperationsModule = '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
const commonTypesDeclaration = path.join(declarationRoot, 'types', 'common.d.ts');
const diagnosticHost: ts.FormatDiagnosticsHost = {
  getCanonicalFileName: (fileName) => fileName,
  getCurrentDirectory: () => projectRoot,
  getNewLine: () => ts.sys.newLine,
};

if (!fs.existsSync(declarationEntryPoint)) {
  throw new Error(`Declaration entry point not found: ${declarationEntryPoint}. Run npm run build first.`);
}
if (!fs.existsSync(replicationDeclarationEntryPoint)) {
  throw new Error(
    `Replication declaration entry point not found: ${replicationDeclarationEntryPoint}. Run npm run build first.`
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

// ── Root surface validation ─────────────────────────────────────────────────
//
// The root declaration graph (`dist/index.d.ts`) must not reference generated
// DAML packages or duplicate the transaction-tree response type.

const rootProgram = ts.createProgram({
  rootNames: [declarationEntryPoint, strictConsumerEntryPoint],
  options: { ...parsedConfig.options, rootDir: projectRoot },
});

const rootDiagnostics = ts.getPreEmitDiagnostics(rootProgram);
if (rootDiagnostics.length > 0) {
  throw new Error(
    `Strict consumer declaration validation failed:\n${ts.formatDiagnosticsWithColorAndContext(rootDiagnostics, diagnosticHost)}`
  );
}

const generatedDamlLeaks = rootProgram
  .getSourceFiles()
  .filter((sourceFile) => sourceFile.fileName.startsWith(declarationRoot))
  .filter((sourceFile) => sourceFile.text.includes(generatedDamlPackage))
  .map((sourceFile) => path.relative(projectRoot, sourceFile.fileName));

if (generatedDamlLeaks.length > 0) {
  throw new Error(
    `Public declaration graph references ${generatedDamlPackage}:\n${generatedDamlLeaks.map((file) => `- ${file}`).join('\n')}`
  );
}

const duplicatedTransactionTreeResponseImports = rootProgram
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

// ── Replication subpath validation ──────────────────────────────────────────
//
// `dist/replication.d.ts` is an advanced API surface that intentionally
// references DAML-registry-derived constants (FIELD_TO_ENTITY_TYPE,
// SECURITY_ID_FIELD_TO_ENTITY_TYPE, ENTITY_OBJECT_TYPE_MAP) whose compiled
// declarations pull in batchTypes.d.ts which imports the DAML package.
// That leakage is EXPECTED and ACCEPTED for this subpath because:
//
//   1. Consumers of the replication subpath are already DAML-aware peers
//      (they list @fairmint/open-captable-protocol-daml-js as a dependency).
//   2. The replication surface is an explicit opt-in at a separate subpath;
//      it does NOT contaminate the root surface checked above.
//
// We still validate compilation (no tsc errors) and run the consumer smoke
// test to ensure every expected symbol is importable.

// The replication subpath intentionally pulls in batchTypes.d.ts → daml-js declarations.
// Those node_modules declarations contain internal TS errors in Splice/* modules that are
// unrelated to the SDK surface; skipLibCheck suppresses them (same as the tsconfig default).
const replicationProgram = ts.createProgram({
  rootNames: [replicationDeclarationEntryPoint, replicationConsumerEntryPoint],
  options: { ...parsedConfig.options, rootDir: projectRoot, skipLibCheck: true },
});

const replicationDiagnostics = ts.getPreEmitDiagnostics(replicationProgram);
if (replicationDiagnostics.length > 0) {
  throw new Error(
    `Replication subpath declaration validation failed:\n${ts.formatDiagnosticsWithColorAndContext(replicationDiagnostics, diagnosticHost)}`
  );
}
