import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const projectRoot = process.cwd();
const configPath = path.join(projectRoot, 'tsconfig.json');
const declarationEntryPoint = path.join(projectRoot, 'dist', 'index.d.ts');
const strictConsumerEntryPoint = path.join(projectRoot, 'test', 'declarations', 'publicApi.types.ts');
const declarationRoot = `${path.dirname(declarationEntryPoint)}${path.sep}`;
const generatedDamlPackage = '@fairmint/open-captable-protocol-daml-js';
const diagnosticHost: ts.FormatDiagnosticsHost = {
  getCanonicalFileName: (fileName) => fileName,
  getCurrentDirectory: () => projectRoot,
  getNewLine: () => ts.sys.newLine,
};

if (!fs.existsSync(declarationEntryPoint)) {
  throw new Error(`Declaration entry point not found: ${declarationEntryPoint}. Run npm run build first.`);
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
const validationErrorClass = validationErrorDeclaration?.statements.find(
  (statement): statement is ts.ClassDeclaration =>
    ts.isClassDeclaration(statement) && statement.name?.text === 'OcpValidationError'
);
const receivedValueProperty = validationErrorClass?.members.find(
  (member): member is ts.PropertyDeclaration =>
    ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === 'receivedValue'
);
const receivedValueType = receivedValueProperty?.type;
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
