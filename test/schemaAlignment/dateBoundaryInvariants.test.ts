import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const SRC_ROOT = path.resolve(__dirname, '../../src');
const OPEN_CAP_TABLE_SEGMENT = `${path.sep}functions${path.sep}OpenCapTable${path.sep}`;

const DATE_CONVERTERS = new Set([
  'dateStringToDAMLTime',
  'damlTimeToDateString',
  'optionalDateStringToDAMLTime',
  'nullableDateStringToDAMLTime',
  'optionalDamlTimeToDateString',
  'nullableDamlTimeToDateString',
]);

const REQUIRED_DATE_CONVERTERS = new Set(['dateStringToDAMLTime', 'damlTimeToDateString']);
const TRIGGER_FIELD_CONVERTERS = new Set(['triggerFieldsToDaml', 'triggerFieldsFromDaml']);
const DISCRIMINATED_TRIGGER_DATE_FIELDS = new Set(['trigger_date', 'start_date', 'end_date']);
const TRIGGER_FIELDS_HELPER = `${path.sep}shared${path.sep}triggerFields.ts`;
const VESTING_HELPER_FILE = path.join(SRC_ROOT, 'functions', 'OpenCapTable', 'shared', 'vesting.ts');
const VESTING_WRITER_FILES = [
  'equityCompensationIssuance/createEquityCompensationIssuance.ts',
  'planSecurityIssuance/planSecurityIssuanceDataToDaml.ts',
  'stockIssuance/createStockIssuance.ts',
  'warrantIssuance/createWarrantIssuance.ts',
] as const;
const OPTIONAL_DATE_FIELDS = new Set([
  'accrual_end_date',
  'board_approval_date',
  'expires_at',
  'stockholder_approval_date',
  'warrant_expiration_date',
]);

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolutePath);
    return entry.isFile() && entry.name.endsWith('.ts') ? [absolutePath] : [];
  });
}

function location(sourceFile: ts.SourceFile, node: ts.Node): string {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `${path.relative(process.cwd(), sourceFile.fileName)}:${line + 1}`;
}

function rawDateProperties(node: ts.Node): string[] {
  const properties = new Set<string>();

  function visit(current: ts.Node): void {
    if (ts.isPropertyAccessExpression(current)) {
      const name = current.name.text;
      if (name === 'date' || name.endsWith('_date') || name === 'expires_at') {
        properties.add(current.getText());
      }
    }
    ts.forEachChild(current, visit);
  }

  visit(node);
  return [...properties];
}

describe('date boundary source invariants', () => {
  test('validates shared vesting rows before filtering and routes every writer through that boundary', () => {
    const helperSource = ts.createSourceFile(
      VESTING_HELPER_FILE,
      fs.readFileSync(VESTING_HELPER_FILE, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    let dateValidationPosition: number | undefined;
    let amountValidationPosition: number | undefined;
    let filterPosition: number | undefined;

    function visitHelper(node: ts.Node): void {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        if (node.expression.text === 'dateStringToDAMLTime') dateValidationPosition = node.getStart(helperSource);
        if (node.expression.text === 'normalizeNumericString') amountValidationPosition = node.getStart(helperSource);
      }
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'filter'
      ) {
        filterPosition = node.expression.name.getStart(helperSource);
      }
      ts.forEachChild(node, visitHelper);
    }
    visitHelper(helperSource);

    expect(dateValidationPosition).toBeDefined();
    expect(amountValidationPosition).toBeDefined();
    expect(filterPosition).toBeDefined();
    expect(dateValidationPosition).toBeLessThan(filterPosition as number);
    expect(amountValidationPosition).toBeLessThan(filterPosition as number);

    for (const relativeFile of VESTING_WRITER_FILES) {
      const file = path.join(SRC_ROOT, 'functions', 'OpenCapTable', relativeFile);
      const sourceFile = ts.createSourceFile(
        file,
        fs.readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
      );
      let delegatesVestings = false;

      function visitWriter(node: ts.Node): void {
        if (
          ts.isPropertyAssignment(node) &&
          node.name.getText(sourceFile) === 'vestings' &&
          ts.isCallExpression(node.initializer) &&
          ts.isIdentifier(node.initializer.expression) &&
          node.initializer.expression.text === 'filterAndMapVestingsToDaml'
        ) {
          delegatesVestings = true;
        }
        ts.forEachChild(node, visitWriter);
      }
      visitWriter(sourceFile);

      expect({ file: relativeFile, delegatesVestings }).toEqual({ file: relativeFile, delegatesVestings: true });
    }
  });

  test('requires contextual paths and forbids raw date presence guards', () => {
    const violations: string[] = [];

    for (const file of sourceFiles(SRC_ROOT)) {
      const sourceFile = ts.createSourceFile(
        file,
        fs.readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
      );

      function visit(node: ts.Node): void {
        if (ts.isStringLiteralLike(node) && node.text.includes('.') && node.text.includes('[]')) {
          violations.push(`${location(sourceFile, node)} array diagnostic path must include its index`);
        }

        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          DATE_CONVERTERS.has(node.expression.text)
        ) {
          if (node.arguments.length !== 2) {
            violations.push(`${location(sourceFile, node)} ${node.expression.text} must receive value and fieldPath`);
          } else {
            const fieldPath = node.arguments[1];
            const literalPath = ts.isStringLiteralLike(fieldPath) ? fieldPath.text : undefined;
            const templatePath = ts.isTemplateExpression(fieldPath) && fieldPath.getText(sourceFile).includes('.');
            const forwardedPath = ts.isIdentifier(fieldPath) && ['fieldPath', 'dateFieldPath'].includes(fieldPath.text);
            const constructedPath =
              ts.isCallExpression(fieldPath) &&
              ts.isIdentifier(fieldPath.expression) &&
              fieldPath.expression.text === 'fieldPath';

            if (fieldPath.getText(sourceFile).includes('[]')) {
              violations.push(`${location(sourceFile, fieldPath)} array date fieldPath must include its index`);
            } else if (literalPath !== undefined && (!literalPath.includes('.') || literalPath === 'date')) {
              violations.push(`${location(sourceFile, fieldPath)} date fieldPath must be entity-specific`);
            } else if (literalPath === undefined && !templatePath && !forwardedPath && !constructedPath) {
              violations.push(
                `${location(sourceFile, fieldPath)} date fieldPath must be literal or explicitly forwarded`
              );
            }
          }

          const value = node.arguments[0];
          if (ts.isPropertyAccessExpression(value)) {
            const field = value.name.text;
            if (DISCRIMINATED_TRIGGER_DATE_FIELDS.has(field) && !file.endsWith(TRIGGER_FIELDS_HELPER)) {
              violations.push(
                `${location(sourceFile, node)} discriminated ${field} must use the shared trigger-fields boundary`
              );
            }
            if (OPTIONAL_DATE_FIELDS.has(field) && REQUIRED_DATE_CONVERTERS.has(node.expression.text)) {
              violations.push(`${location(sourceFile, node)} optional ${field} must use an optional date converter`);
            }
            if (
              field === 'expiration_date' &&
              !['nullableDateStringToDAMLTime', 'nullableDamlTimeToDateString'].includes(node.expression.text)
            ) {
              violations.push(
                `${location(sourceFile, node)} required-nullable expiration_date must use a nullable date converter`
              );
            }
          }
        }

        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          TRIGGER_FIELD_CONVERTERS.has(node.expression.text)
        ) {
          const expectedArgumentCount = node.expression.text === 'triggerFieldsToDaml' ? 2 : 3;
          if (node.arguments.length !== expectedArgumentCount) {
            violations.push(
              `${location(sourceFile, node)} ${node.expression.text} must use its discriminator-correlated signature`
            );
          } else {
            const fieldPath = node.arguments[expectedArgumentCount - 1];
            if (fieldPath.getText(sourceFile).includes('[]')) {
              violations.push(`${location(sourceFile, fieldPath)} trigger array fieldPath must include its index`);
            }
          }
        }

        if (file.includes(OPEN_CAP_TABLE_SEGMENT)) {
          let condition: ts.Expression | undefined;
          if (ts.isIfStatement(node)) {
            condition = node.expression;
          } else if (ts.isConditionalExpression(node)) {
            const { condition: conditionalCondition } = node;
            condition = conditionalCondition;
          } else if (
            ts.isBinaryExpression(node) &&
            [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken].includes(node.operatorToken.kind)
          ) {
            condition = node.left;
          }

          if (condition !== undefined) {
            for (const property of rawDateProperties(condition)) {
              violations.push(
                `${location(sourceFile, condition)} raw date guard ${property}; use a required/optional date converter`
              );
            }
          }
        }

        ts.forEachChild(node, visit);
      }

      visit(sourceFile);
    }

    expect([...new Set(violations)]).toEqual([]);
  });
});
