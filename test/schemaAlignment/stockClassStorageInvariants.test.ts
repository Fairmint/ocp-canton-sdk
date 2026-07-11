import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const SRC_ROOT = path.resolve(__dirname, '../../src');
const WARRANT_READER = path.join(
  SRC_ROOT,
  'functions',
  'OpenCapTable',
  'warrantIssuance',
  'getWarrantIssuanceAsOcf.ts'
);
const STORAGE_BOUNDARY = path.join(SRC_ROOT, 'functions', 'OpenCapTable', 'shared', 'stockClassRightStorage.ts');

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

describe('stock-class storage source invariants', () => {
  test('keeps nested warrant storage validation behind the shared boundary', () => {
    const reader = parse(WARRANT_READER);
    const duplicateHelpers: string[] = [];
    let sharedBoundaryCalls = 0;

    function visitReader(node: ts.Node): void {
      if (
        ts.isFunctionDeclaration(node) &&
        node.name !== undefined &&
        ['assertNestedStockClassTrigger', 'nestedStockClassTargetFromDaml'].includes(node.name.text)
      ) {
        duplicateHelpers.push(node.name.text);
      }
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'assertStockClassStorageTrigger'
      ) {
        sharedBoundaryCalls += 1;
      }
      ts.forEachChild(node, visitReader);
    }
    visitReader(reader);

    const boundary = parse(STORAGE_BOUNDARY);
    let placeholderValidationCalls = 0;
    function visitBoundary(node: ts.Node): void {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'assertPlaceholderRight'
      ) {
        placeholderValidationCalls += 1;
      }
      ts.forEachChild(node, visitBoundary);
    }
    visitBoundary(boundary);

    expect({ duplicateHelpers, sharedBoundaryCalls, placeholderValidationCalls }).toEqual({
      duplicateHelpers: [],
      sharedBoundaryCalls: 1,
      placeholderValidationCalls: 1,
    });
  });
});
