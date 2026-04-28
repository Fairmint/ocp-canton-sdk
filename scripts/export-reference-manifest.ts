/**
 * Emits a JSON manifest of public SDK surfaces for documentation generators.
 *
 * Usage:
 *   npx ts-node --project tsconfig.tests.json scripts/export-reference-manifest.ts
 *   npx ts-node --project tsconfig.tests.json scripts/export-reference-manifest.ts --out reference-manifest.json
 */

import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const SCHEMA_VERSION = 2 as const;
const GITHUB_BLOB_BASE = 'https://github.com/Fairmint/ocp-canton-sdk/blob/main';

export interface ReferenceParam {
  name: string;
  type: string;
  optional?: boolean;
  rest?: boolean;
  description?: string;
}

export interface ReferenceFunction {
  id: string;
  name: string;
  kind: 'function' | 'method' | 'constructor' | 'namespace-function';
  parent?: string;
  receiver?: string;
  path?: string;
  importPath: string;
  category: string;
  summary?: string;
  signature: string;
  params: ReferenceParam[];
  returnType: string;
  sourceFile: string;
  sourceLine: number;
  sourceUrl: string;
  requirements?: string[];
  examples?: string[];
}

export interface ReferenceManifest {
  schemaVersion: typeof SCHEMA_VERSION;
  generatedAt: string;
  package: {
    name: string;
    version: string;
    description?: string;
    repository?: unknown;
  };
  dependencyMatrix: DependencyMatrix;
  matrices: Record<string, unknown>;
  entryExports: BarrelExports;
  ocpClient: OcpClientManifest;
  categories: CategorySection[];
  functions: ReferenceFunction[];
  functionGroups: Array<{ id: string; label: string; functions: ReferenceFunction[] }>;
  capTableBatch: ClassSurface;
  examplesScripts: ScriptEntry[];
}

export interface DependencyMatrix {
  ocpClientConstructor: {
    ledger: ClientDepSlot;
    validator: ClientDepSlot;
  };
  createBatch: {
    usesLedgerJsonApiClient: true;
    notes: string;
  };
  peerDependencies: Record<string, string>;
  npmDependencies: Record<string, string>;
  /** Typical imports from daml-js / canton-node-sdk referenced by SDK sources */
  relatedImports: {
    '@fairmint/canton-node-sdk': string[];
    '@fairmint/open-captable-protocol-daml-js': string[];
  };
}

interface ClientDepSlot {
  typescriptType: string;
  required: boolean;
  npmPackage: '@fairmint/canton-node-sdk';
}

interface BarrelExports {
  /** Top-level export lines from src/index.ts */
  barrels: string[];
}

interface OcpClientManifest {
  className: 'OcpClient';
  dependenciesInterface: 'OcpClientDependencies';
  instanceMembers: string[];
  methods: Array<{ name: string; signatureSummary?: string }>;
  contextManager: {
    className: 'OcpContextManager';
    methods: string[];
    getters: string[];
  };
  namespaces: {
    OpenCapTable: TsInterfaceShape;
    OpenCapTableReports: TsInterfaceShape;
    CouponMinter: TsInterfaceShape;
    CantonPayments: TsInterfaceShape;
    PaymentStreams: TsInterfaceShape;
  };
}

interface TsInterfaceShape {
  interfaceName: string;
  sourceFile: string;
  /** Top-level properties mapped to shapes */
  members: Record<string, TsMemberShape>;
}

export type TsMemberShape =
  | { kind: 'leaf'; typescript?: string }
  | { kind: 'nested'; members: Record<string, TsMemberShape> };

interface CategorySection {
  id: string;
  label: string;
  paths: string[];
  exports?: ParsedExports;
}

interface ParsedExports {
  modules: Array<{ modulePath: string; exports: ExportEntry[] }>;
}

interface ExportEntry {
  name: string;
  kind: 'type' | 'value' | 'mixed';
}

interface ClassSurface {
  name: string;
  sourceFile: string;
  publicMethods: string[];
  publicAsyncMethods: string[];
}

interface ScriptEntry {
  relativePath: string;
  note?: string;
}


let cachedProgram: ts.Program | undefined;
let cachedChecker: ts.TypeChecker | undefined;

function createReferenceProgram(root = repoRoot()): ts.Program {
  if (cachedProgram) return cachedProgram;
  const configPath = path.join(root, 'tsconfig.tests.json');
  const parsedConfig = ts.getParsedCommandLineOfConfigFile(configPath, {}, ts.sys as unknown as ts.ParseConfigFileHost);
  if (!parsedConfig) throw new Error('Unable to parse tsconfig.tests.json');
  cachedProgram = ts.createProgram({ rootNames: parsedConfig.fileNames, options: parsedConfig.options });
  cachedChecker = cachedProgram.getTypeChecker();
  return cachedProgram;
}

function checker(root = repoRoot()): ts.TypeChecker {
  if (!cachedChecker) cachedChecker = createReferenceProgram(root).getTypeChecker();
  return cachedChecker;
}

function rel(root: string, filePath: string): string {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function sourceInfo(root: string, node: ts.Node): { sourceFile: string; sourceLine: number; sourceUrl: string } {
  const sf = node.getSourceFile();
  const sourceFile = rel(root, sf.fileName);
  const sourceLine = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  return { sourceFile, sourceLine, sourceUrl: `${GITHUB_BLOB_BASE}/${sourceFile}#L${sourceLine}` };
}

function typeText(root: string, type: ts.Type, node: ts.Node): string {
  return checker(root).typeToString(
    type,
    node,
    ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope
  );
}

function docsFromSymbol(root: string, symbol: ts.Symbol | undefined): string | undefined {
  if (!symbol) return undefined;
  const text = ts.displayPartsToString(symbol.getDocumentationComment(checker(root))).trim();
  return text === '' ? undefined : text;
}

function paramDocs(sig: ts.Signature): Map<string, string> {
  const out = new Map<string, string>();
  for (const tag of sig.getJsDocTags()) {
    if (tag.name !== 'param' || !tag.text?.length) continue;
    const [first, ...rest] = tag.text.map((p) => p.text).join('').split(/\s+/);
    if (first) out.set(first, rest.join(' ').trim());
  }
  return out;
}

function signatureParams(root: string, sig: ts.Signature, node: ts.Node): ReferenceParam[] {
  const docs = paramDocs(sig);
  return sig.parameters.map((sym) => {
    const decl = sym.valueDeclaration;
    const optional = Boolean(decl && ts.isParameter(decl) && decl.questionToken !== undefined);
    const rest = Boolean(decl && ts.isParameter(decl) && decl.dotDotDotToken !== undefined);
    const param: ReferenceParam = {
      name: sym.getName(),
      type: typeText(root, checker(root).getTypeOfSymbolAtLocation(sym, decl ?? node), decl ?? node),
    };
    if (optional) param.optional = true;
    if (rest) param.rest = true;
    const desc = docs.get(sym.getName()) ?? docsFromSymbol(root, sym);
    if (desc) param.description = desc;
    return param;
  });
}

function categoryForSource(sourceFile: string): { id: string; label: string } {
  if (sourceFile.endsWith('src/OcpClient.ts')) return { id: 'ocp-client', label: 'OcpClient' };
  if (sourceFile.includes('/functions/OpenCapTable/')) return { id: 'open-cap-table', label: 'OpenCapTable' };
  if (sourceFile.includes('/functions/OpenCapTableReports/')) return { id: 'reports-coupons', label: 'Reports & coupons' };
  if (sourceFile.includes('/functions/CouponMinter/')) return { id: 'reports-coupons', label: 'Reports & coupons' };
  if (sourceFile.includes('/functions/PaymentStreams/') || sourceFile.includes('/extensions/PaymentStreams')) return { id: 'payments-streams', label: 'Payments & streams' };
  if (sourceFile.includes('/extensions/CantonPayments')) return { id: 'payments-streams', label: 'Payments & streams' };
  if (sourceFile.includes('/errors/')) return { id: 'types-errors-utils', label: 'Types, errors & utilities' };
  if (sourceFile.includes('/types/') || sourceFile.includes('/utils/')) return { id: 'types-errors-utils', label: 'Types, errors & utilities' };
  return { id: 'types-errors-utils', label: 'Types, errors & utilities' };
}

function callableReference(root: string, input: {
  id: string;
  name: string;
  kind: ReferenceFunction['kind'];
  node: ts.Node;
  signature: ts.Signature;
  category?: string | undefined;
  parent?: string | undefined;
  receiver?: string | undefined;
  path?: string | undefined;
  summary?: string | undefined;
}): ReferenceFunction {
  const info = sourceInfo(root, input.node);
  const group = categoryForSource(info.sourceFile);
  const fn: ReferenceFunction = {
    id: input.id,
    name: input.name,
    kind: input.kind,
    importPath: '@open-captable-protocol/canton',
    category: input.category ?? group.label,
    signature: `${input.path ?? input.name}${checker(root).signatureToString(input.signature, input.node, ts.TypeFormatFlags.NoTruncation)}`,
    params: signatureParams(root, input.signature, input.node),
    returnType: typeText(root, checker(root).getReturnTypeOfSignature(input.signature), input.node),
    ...info,
  };
  if (input.parent) fn.parent = input.parent;
  if (input.receiver) fn.receiver = input.receiver;
  if (input.path) fn.path = input.path;
  if (input.summary) fn.summary = input.summary;
  return fn;
}

function publicMember(node: ts.ClassElement): boolean {
  const mods = ts.getCombinedModifierFlags(node);
  return !(mods & ts.ModifierFlags.Private) && !(mods & ts.ModifierFlags.Protected);
}

function collectInterfaceCallables(root: string, iface: ts.InterfaceDeclaration, namespaceName: string): ReferenceFunction[] {
  const out: ReferenceFunction[] = [];
  const walk = (symbol: ts.Symbol, prefix: string[]): void => {
    const decl = symbol.valueDeclaration ?? symbol.declarations?.[0];
    if (!decl) return;
    const type = checker(root).getTypeOfSymbolAtLocation(symbol, decl);
    const pathParts = [...prefix, symbol.getName()];
    const call = type.getCallSignatures()[0];
    if (call) {
      const pathName = pathParts.join('.');
      out.push(
        callableReference(root, {
          id: `${namespaceName}.${pathName}`,
          name: symbol.getName(),
          kind: 'namespace-function',
          parent: namespaceName,
          receiver: `client.${namespaceName}`,
          path: pathName,
          node: decl,
          signature: call,
          category: namespaceName.includes('Reports') || namespaceName.includes('Coupon') ? 'Reports & coupons' : namespaceName.includes('Payment') || namespaceName.includes('CantonPayments') ? 'Payments & streams' : 'OpenCapTable',
          summary: docsFromSymbol(root, symbol),
        })
      );
      return;
    }
    for (const child of type.getProperties()) {
      walk(child, pathParts);
    }
  };
  for (const member of iface.members) {
    if (ts.isPropertySignature(member) && ts.isIdentifier(member.name)) {
      const symbol = checker(root).getSymbolAtLocation(member.name);
      if (symbol) walk(symbol, []);
    }
  }
  return out;
}

function collectCallableReferences(root: string): ReferenceFunction[] {
  const program = createReferenceProgram(root);
  const out: ReferenceFunction[] = [];
  const srcRoot = path.join(root, 'src');

  for (const sf of program.getSourceFiles()) {
    if (!sf.fileName.startsWith(srcRoot) || sf.fileName.endsWith('.d.ts')) continue;
    const visit = (node: ts.Node): void => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        const mods = ts.getCombinedModifierFlags(node);
        if (mods & ts.ModifierFlags.Export) {
          const sig = checker(root).getSignatureFromDeclaration(node);
          if (sig) {
            out.push(
              callableReference(root, {
                id: node.name.text,
                name: node.name.text,
                kind: 'function',
                node,
                signature: sig,
                summary: docsFromSymbol(root, checker(root).getSymbolAtLocation(node.name)),
              })
            );
          }
        }
      } else if (ts.isClassDeclaration(node) && node.name && (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export)) {
        for (const member of node.members) {
          if (ts.isConstructorDeclaration(member) && publicMember(member)) {
            const sig = checker(root).getSignatureFromDeclaration(member);
            if (sig) {
              out.push(
                callableReference(root, {
                  id: `${node.name.text}.constructor`,
                  name: 'constructor',
                  kind: 'constructor',
                  parent: node.name.text,
                  receiver: `new ${node.name.text}`,
                  node: member,
                  signature: sig,
                })
              );
            }
          } else if (ts.isMethodDeclaration(member) && ts.isIdentifier(member.name) && publicMember(member)) {
            const sig = checker(root).getSignatureFromDeclaration(member);
            if (sig) {
              out.push(
                callableReference(root, {
                  id: `${node.name.text}.${member.name.text}`,
                  name: member.name.text,
                  kind: 'method',
                  parent: node.name.text,
                  receiver: node.name.text === 'OcpClient' ? 'client' : node.name.text,
                  node: member,
                  signature: sig,
                  summary: docsFromSymbol(root, checker(root).getSymbolAtLocation(member.name)),
                })
              );
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }

  const ocpPath = path.join(srcRoot, 'OcpClient.ts');
  const payPath = path.join(srcRoot, 'extensions/PaymentStreamsExtension.ts');
  const cantonPayPath = path.join(srcRoot, 'extensions/CantonPaymentsExtension.ts');
  const ifaceSpecs = [
    [ocpPath, 'OpenCapTableMethods', 'OpenCapTable'],
    [ocpPath, 'OpenCapTableReportsMethods', 'OpenCapTableReports'],
    [ocpPath, 'CouponMinterMethods', 'CouponMinter'],
    [payPath, 'PaymentStreamsMethods', 'PaymentStreams'],
    [cantonPayPath, 'CantonPaymentsMethods', 'CantonPayments'],
  ] as const;
  for (const [file, ifaceName, namespaceName] of ifaceSpecs) {
    const sf = program.getSourceFile(file);
    if (!sf) continue;
    const iface = findInterface(sf, ifaceName);
    if (iface) out.push(...collectInterfaceCallables(root, iface, namespaceName));
  }

  const seen = new Set<string>();
  return out
    .filter((fn) => {
      const key = `${fn.id}|${fn.sourceFile}|${fn.sourceLine}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function groupReferenceFunctions(functions: ReferenceFunction[]): Array<{ id: string; label: string; functions: ReferenceFunction[] }> {
  const groups = new Map<string, { id: string; label: string; functions: ReferenceFunction[] }>();
  for (const fn of functions) {
    const info = categoryForSource(fn.sourceFile);
    const group = groups.get(info.id) ?? { id: info.id, label: info.label, functions: [] };
    group.functions.push(fn);
    groups.set(info.id, group);
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function readUtf8(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function repoRoot(): string {
  return path.resolve(__dirname, '..');
}

function parseArgs(argv: string[]): { outPath?: string } {
  const outIdx = argv.indexOf('--out');
  if (outIdx >= 0 && argv[outIdx + 1]) {
    return { outPath: argv[outIdx + 1] };
  }
  return {};
}

function createAst(filePath: string, content: string): ts.SourceFile {
  return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function findInterface(sf: ts.SourceFile, name: string): ts.InterfaceDeclaration | undefined {
  let found: ts.InterfaceDeclaration | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === name) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

function findClass(sf: ts.SourceFile, name: string): ts.ClassDeclaration | undefined {
  let found: ts.ClassDeclaration | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) && node.name?.text === name) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

function summarizePropertyType(typeNode: ts.TypeNode | undefined, sf: ts.SourceFile): TsMemberShape {
  if (!typeNode) {
    return { kind: 'leaf', typescript: undefined };
  }

  if (ts.isTypeLiteralNode(typeNode)) {
    const members: Record<string, TsMemberShape> = {};
    for (const m of typeNode.members) {
      if (ts.isPropertySignature(m) && ts.isIdentifier(m.name)) {
        members[m.name.text] = summarizePropertyType(m.type, sf);
      }
    }
    return { kind: 'nested', members };
  }

  if (ts.isIntersectionTypeNode(typeNode)) {
    const merged: Record<string, TsMemberShape> = {};
    for (const t of typeNode.types) {
      const inner = summarizePropertyType(t, sf);
      if (inner.kind === 'nested') {
        Object.assign(merged, inner.members);
      }
    }
    if (Object.keys(merged).length > 0) {
      return { kind: 'nested', members: merged };
    }
  }

  if (ts.isTypeReferenceNode(typeNode)) {
    const tn = typeNode.typeName.getText(sf);
    if (tn.startsWith('EntityReader')) {
      return {
        kind: 'nested',
        members: {
          get: { kind: 'leaf', typescript: 'get(params) => Promise<ContractResult<T>>' },
        },
      };
    }
    return { kind: 'leaf', typescript: tn };
  }

  if (ts.isFunctionTypeNode(typeNode)) {
    return { kind: 'leaf', typescript: typeNode.getText(sf).replace(/\s+/g, ' ').slice(0, 200) };
  }

  return { kind: 'leaf', typescript: typeNode.getText(sf).replace(/\s+/g, ' ').slice(0, 200) };
}

function interfaceToShape(iface: ts.InterfaceDeclaration, sf: ts.SourceFile): Record<string, TsMemberShape> {
  const out: Record<string, TsMemberShape> = {};
  for (const member of iface.members) {
    if (!ts.isPropertySignature(member) || !ts.isIdentifier(member.name)) {
      continue;
    }
    const key = member.name.text;
    out[key] = summarizePropertyType(member.type, sf);
  }
  return out;
}

function parseBarrelExports(source: string): ExportEntry[] {
  const entries: ExportEntry[] = [];
  const lines = source.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) {
      continue;
    }

    const star = trimmed.match(/^export\s*\*\s*from\s*['"]([^'"]+)['"]/);
    if (star) {
      entries.push({ name: `*:${star[1]}`, kind: 'value' });
      continue;
    }

    const named = trimmed.match(/^export\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/);
    if (named) {
      const from = named[2];
      const parts = named[1].split(',').map((p) => p.trim());
      for (const p of parts) {
        if (!p || p.startsWith('//')) {
          continue;
        }
        const isType = /^type\s+/.test(p);
        const namePart = isType ? p.replace(/^type\s+/, '').trim() : p;
        const asMatch = namePart.match(/^(\w+)\s+as\s+(\w+)$/);
        const sym = asMatch ? asMatch[2] : namePart.split(/\s+/)[0];
        entries.push({
          name: `${sym}@${from}`,
          kind: isType ? 'type' : 'value',
        });
      }
      continue;
    }

    const exportTypeBlock = trimmed.match(/^export\s+type\s*\{([^}]+)\}/);
    if (exportTypeBlock) {
      const parts = exportTypeBlock[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const p of parts) {
        entries.push({ name: p.split(/\s+/)[0], kind: 'type' });
      }
    }
  }

  return entries;
}

function collectPublicMethods(cls: ts.ClassDeclaration): { sync: string[]; async: string[] } {
  const sync: string[] = [];
  const async: string[] = [];
  for (const member of cls.members) {
    if (!ts.isMethodDeclaration(member) || !ts.isIdentifier(member.name)) {
      continue;
    }
    const mods = ts.getCombinedModifierFlags(member);
    if (mods & ts.ModifierFlags.Private || mods & ts.ModifierFlags.Protected) {
      continue;
    }
    const name = member.name.text;
    if (name.startsWith('_')) {
      continue;
    }
    const isAsync = Boolean(member.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword));
    if (isAsync) {
      async.push(name);
    } else {
      sync.push(name);
    }
  }
  return { sync, async };
}

function openCapTableEntityFolders(openCapTableIndexPath: string): string[] {
  const src = readUtf8(openCapTableIndexPath);
  const folders: string[] = [];
  const re = /export\s*\*\s*from\s*['"]\.\/([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    folders.push(m[1]);
  }
  return folders;
}

function listExampleScripts(scriptsDir: string): ScriptEntry[] {
  const out: ScriptEntry[] = [];
  if (!fs.existsSync(scriptsDir)) {
    return out;
  }
  for (const ent of fs.readdirSync(scriptsDir, { withFileTypes: true })) {
    if (ent.isFile() && ent.name.endsWith('.ts') && !ent.name.endsWith('.d.ts')) {
      out.push({ relativePath: path.join('scripts', ent.name) });
    }
  }
  out.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return out;
}

function grepRelatedImports(srcRoot: string): { cantonNode: Set<string>; damlJs: Set<string> } {
  const cantonNode = new Set<string>();
  const damlJs = new Set<string>();
  const walk = (dir: string): void => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name === 'dist') {
          continue;
        }
        walk(full);
      } else if (ent.name.endsWith('.ts') && !ent.name.endsWith('.d.ts')) {
        const text = readUtf8(full);
        const cn = text.matchAll(/from\s+['"]@fairmint\/canton-node-sdk(?:\/[^'"]*)?['"]/g);
        for (const x of cn) {
          cantonNode.add(x[0].replace(/from\s+['"]/, '').replace(/['"]$/, ''));
        }
        const dj = text.matchAll(/from\s+['"]@fairmint\/open-captable-protocol-daml-js(?:\/[^'"]*)?['"]/g);
        for (const x of dj) {
          damlJs.add(x[0].replace(/from\s+['"]/, '').replace(/['"]$/, ''));
        }
      }
    }
  };
  walk(srcRoot);
  return { cantonNode, damlJs };
}

export function buildReferenceManifest(root = repoRoot()): ReferenceManifest {
  createReferenceProgram(root);
  const pkgPath = path.join(root, 'package.json');
  const pkg = JSON.parse(readUtf8(pkgPath)) as {
    name: string;
    version: string;
    description?: string;
    repository?: unknown;
    peerDependencies?: Record<string, string>;
    dependencies?: Record<string, string>;
  };

  const srcDir = path.join(root, 'src');
  const ocpPath = path.join(srcDir, 'OcpClient.ts');
  const ocpSf = createAst(ocpPath, readUtf8(ocpPath));

  const payExtPath = path.join(srcDir, 'extensions/PaymentStreamsExtension.ts');
  const paySf = createAst(payExtPath, readUtf8(payExtPath));
  const cantonPayPath = path.join(srcDir, 'extensions/CantonPaymentsExtension.ts');
  const cantonPaySf = createAst(cantonPayPath, readUtf8(cantonPayPath));

  const openCapTableIface = findInterface(ocpSf, 'OpenCapTableMethods');
  const reportsIface = findInterface(ocpSf, 'OpenCapTableReportsMethods');
  const couponIface = findInterface(ocpSf, 'CouponMinterMethods');
  const psIface = findInterface(paySf, 'PaymentStreamsMethods');
  const cpIface = findInterface(cantonPaySf, 'CantonPaymentsMethods');

  if (!openCapTableIface || !reportsIface || !couponIface || !psIface || !cpIface) {
    throw new Error('Failed to parse required interfaces from sources');
  }

  const ocpClass = findClass(ocpSf, 'OcpClient');
  const ctxClass = findClass(ocpSf, 'OcpContextManager');
  const batchPath = path.join(srcDir, 'functions/OpenCapTable/capTable/CapTableBatch.ts');
  const batchSf = createAst(batchPath, readUtf8(batchPath));
  const batchClass = findClass(batchSf, 'CapTableBatch');

  const instanceMembers = ocpClass
    ? ocpClass.members
        .filter(ts.isPropertyDeclaration)
        .map((p) => (ts.isIdentifier(p.name) ? p.name.text : ''))
        .filter(Boolean)
    : [];

  const ocpMethods =
    ocpClass?.members.filter(ts.isMethodDeclaration).map((m) => ({
      name: ts.isIdentifier(m.name) ? m.name.text : '?',
      signatureSummary: m.parameters.map((p) => p.name.getText()).join(', '),
    })) ?? [];

  const ctxMethods =
    ctxClass?.members
      .filter(ts.isMethodDeclaration)
      .map((m) => (ts.isIdentifier(m.name) ? m.name.text : ''))
      .filter(Boolean) ?? [];

  const ctxGetters =
    ctxClass?.members
      .filter(ts.isGetAccessorDeclaration)
      .map((g) => (ts.isIdentifier(g.name) ? g.name.text : ''))
      .filter(Boolean) ?? [];

  const related = grepRelatedImports(srcDir);

  const dependencyMatrix: DependencyMatrix = {
    ocpClientConstructor: {
      ledger: {
        typescriptType: 'LedgerJsonApiClient',
        required: true,
        npmPackage: '@fairmint/canton-node-sdk',
      },
      validator: {
        typescriptType: 'ValidatorApiClient',
        required: false,
        npmPackage: '@fairmint/canton-node-sdk',
      },
    },
    createBatch: {
      usesLedgerJsonApiClient: true,
      notes: 'TransactionBatch is constructed with this.ledger (LedgerJsonApiClient)',
    },
    peerDependencies: pkg.peerDependencies ?? {},
    npmDependencies: pkg.dependencies ?? {},
    relatedImports: {
      '@fairmint/canton-node-sdk': [...related.cantonNode].sort(),
      '@fairmint/open-captable-protocol-daml-js': [...related.damlJs].sort(),
    },
  };

  const matrices: Record<string, unknown> = {
    cantonNodeSdk: {
      LedgerJsonApiClient: { requiredForOcpClient: true, usedBy: ['OcpClient.ledger', 'CapTableBatch', 'createBatch'] },
      ValidatorApiClient: {
        requiredForOcpClient: false,
        usedBy: ['OcpClient.validator (optional)', 'PaymentStreams.utils.buildPaymentContext'],
      },
    },
    peerPackages: {
      '@fairmint/canton-node-sdk': pkg.peerDependencies?.['@fairmint/canton-node-sdk'],
      '@fairmint/open-captable-protocol-daml-js': pkg.peerDependencies?.['@fairmint/open-captable-protocol-daml-js'],
    },
    extractorsAndReaders: {
      cantonOcfExtractor: 'src/utils/cantonOcfExtractor.ts',
      contractReadDiagnostics: 'src/utils/contractReadDiagnostics.ts',
      getCapTableState: 'src/functions/OpenCapTable/capTable/getCapTableState.ts',
      archiveCapTable: 'src/functions/OpenCapTable/capTable/archiveCapTable.ts',
      archiveFullCapTable: 'src/functions/OpenCapTable/capTable/archiveFullCapTable.ts',
    },
  };

  const entryIndex = path.join(srcDir, 'index.ts');
  const barrels = readUtf8(entryIndex)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('export '));

  const openCapTableIndex = path.join(srcDir, 'functions/OpenCapTable/index.ts');
  const entityFolders = openCapTableEntityFolders(openCapTableIndex);

  const categories: CategorySection[] = [
    {
      id: 'errors',
      label: 'Errors',
      paths: ['src/errors/index.ts'],
      exports: {
        modules: [
          {
            modulePath: 'src/errors/index.ts',
            exports: parseBarrelExports(readUtf8(path.join(srcDir, 'errors/index.ts'))),
          },
        ],
      },
    },
    {
      id: 'types',
      label: 'Types (branded, common, output)',
      paths: ['src/types/index.ts'],
      exports: {
        modules: [
          {
            modulePath: 'src/types/index.ts',
            exports: parseBarrelExports(readUtf8(path.join(srcDir, 'types/index.ts'))),
          },
        ],
      },
    },
    {
      id: 'utils',
      label: 'Utilities',
      paths: ['src/utils/index.ts'],
      exports: {
        modules: [
          {
            modulePath: 'src/utils/index.ts',
            exports: parseBarrelExports(readUtf8(path.join(srcDir, 'utils/index.ts'))),
          },
        ],
      },
    },
    {
      id: 'openCapTableModules',
      label: 'OpenCapTable modules (entity folders)',
      paths: entityFolders.map((f) => `src/functions/OpenCapTable/${f}/`),
      exports: {
        modules: entityFolders.map((folder) => {
          const idx = path.join(srcDir, `functions/OpenCapTable/${folder}/index.ts`);
          const ex = fs.existsSync(idx) ? parseBarrelExports(readUtf8(idx)) : [];
          return {
            modulePath: `src/functions/OpenCapTable/${folder}/index.ts`,
            exports: ex,
          };
        }),
      },
    },
    {
      id: 'functionsBarrels',
      label: 'functions/* barrels',
      paths: ['src/functions/index.ts'],
      exports: {
        modules: [
          {
            modulePath: 'src/functions/index.ts',
            exports: parseBarrelExports(readUtf8(path.join(srcDir, 'functions/index.ts'))),
          },
        ],
      },
    },
  ];

  const capTableBatchMethods = batchClass ? collectPublicMethods(batchClass) : { sync: [], async: [] };
  const functions = collectCallableReferences(root);
  const functionGroups = groupReferenceFunctions(functions);

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    package: {
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      repository: pkg.repository,
    },
    dependencyMatrix,
    matrices,
    entryExports: { barrels },
    ocpClient: {
      className: 'OcpClient',
      dependenciesInterface: 'OcpClientDependencies',
      instanceMembers,
      methods: ocpMethods,
      contextManager: {
        className: 'OcpContextManager',
        methods: ctxMethods,
        getters: ctxGetters,
      },
      namespaces: {
        OpenCapTable: {
          interfaceName: 'OpenCapTableMethods',
          sourceFile: 'src/OcpClient.ts',
          members: interfaceToShape(openCapTableIface, ocpSf),
        },
        OpenCapTableReports: {
          interfaceName: 'OpenCapTableReportsMethods',
          sourceFile: 'src/OcpClient.ts',
          members: interfaceToShape(reportsIface, ocpSf),
        },
        CouponMinter: {
          interfaceName: 'CouponMinterMethods',
          sourceFile: 'src/OcpClient.ts',
          members: interfaceToShape(couponIface, ocpSf),
        },
        CantonPayments: {
          interfaceName: 'CantonPaymentsMethods',
          sourceFile: 'src/extensions/CantonPaymentsExtension.ts',
          members: interfaceToShape(cpIface, cantonPaySf),
        },
        PaymentStreams: {
          interfaceName: 'PaymentStreamsMethods',
          sourceFile: 'src/extensions/PaymentStreamsExtension.ts',
          members: interfaceToShape(psIface, paySf),
        },
      },
    },
    categories,
    functions,
    functionGroups,
    capTableBatch: {
      name: 'CapTableBatch',
      sourceFile: 'src/functions/OpenCapTable/capTable/CapTableBatch.ts',
      publicMethods: capTableBatchMethods.sync,
      publicAsyncMethods: capTableBatchMethods.async,
    },
    examplesScripts: listExampleScripts(path.join(root, 'scripts')),
  };
}

function main(): void {
  const { outPath } = parseArgs(process.argv.slice(2));
  const manifest = buildReferenceManifest();
  const json = JSON.stringify(manifest, null, 2);

  if (outPath) {
    const abs = path.isAbsolute(outPath) ? outPath : path.join(repoRoot(), outPath);
    fs.writeFileSync(abs, json, 'utf8');
    process.stderr.write(`Wrote ${abs}\n`);
  } else {
    process.stdout.write(json);
  }
}

// ts-node executes this file directly
if (require.main === module) {
  main();
}
