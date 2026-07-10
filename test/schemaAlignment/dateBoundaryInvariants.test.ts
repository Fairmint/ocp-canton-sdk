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
const OPTIONAL_DATE_FIELDS = new Set([
  'accrual_end_date',
  'board_approval_date',
  'end_date',
  'expires_at',
  'start_date',
  'stockholder_approval_date',
  'trigger_date',
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
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          DATE_CONVERTERS.has(node.expression.text)
        ) {
          const [value, fieldPath] = node.arguments;
          if (node.arguments.length !== 2 || value === undefined || fieldPath === undefined) {
            violations.push(`${location(sourceFile, node)} ${node.expression.text} must receive value and fieldPath`);
          } else {
            const literalPath = ts.isStringLiteralLike(fieldPath) ? fieldPath.text : undefined;
            const templatePath = ts.isTemplateExpression(fieldPath) && fieldPath.getText(sourceFile).includes('.');
            const forwardedPath = ts.isIdentifier(fieldPath) && ['fieldPath', 'dateFieldPath'].includes(fieldPath.text);

            if (literalPath !== undefined && (!literalPath.includes('.') || literalPath === 'date')) {
              violations.push(`${location(sourceFile, fieldPath)} date fieldPath must be entity-specific`);
            } else if (literalPath === undefined && !templatePath && !forwardedPath) {
              violations.push(
                `${location(sourceFile, fieldPath)} date fieldPath must be literal or explicitly forwarded`
              );
            }
          }

          if (value !== undefined && ts.isPropertyAccessExpression(value)) {
            const field = value.name.text;
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
