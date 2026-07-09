import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const projectRoot = process.cwd();
const configPath = path.join(projectRoot, 'tsconfig.json');
const declarationEntryPoint = path.join(projectRoot, 'dist', 'index.d.ts');
const declarationRoot = `${path.dirname(declarationEntryPoint)}${path.sep}`;
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
  rootNames: [declarationEntryPoint],
  options: parsedConfig.options,
});

const sdkDiagnostics = ts
  .getPreEmitDiagnostics(program)
  .filter((diagnostic) => diagnostic.file?.fileName.startsWith(declarationRoot));

if (sdkDiagnostics.length > 0) {
  throw new Error(
    `SDK declaration validation failed:\n${ts.formatDiagnosticsWithColorAndContext(sdkDiagnostics, diagnosticHost)}`
  );
}
