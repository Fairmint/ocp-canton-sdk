import fs from 'fs';
import os from 'os';
import path from 'path';
import { validateCoverageReferences, type ConditionalCoverageRegistration } from './schemaConformanceHarness';

const CONDITIONAL_PATH = 'schema/objects/Synthetic.schema.json#/properties/choice/oneOf';
const COVERAGE_FILE = 'test/syntheticCoverage.test.ts';

let repoRoot: string;

function registrationFor(target: string): ConditionalCoverageRegistration[] {
  return [
    {
      coverage: [{ file: COVERAGE_FILE, kind: 'runtime', target }],
      path: CONDITIONAL_PATH,
    },
  ];
}

beforeAll(() => {
  repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ocp-coverage-reference-'));
  fs.mkdirSync(path.join(repoRoot, 'test'), { recursive: true });
  fs.writeFileSync(
    path.join(repoRoot, COVERAGE_FILE),
    `
describe('active suite', () => {
  it('active case', () => undefined);
});
it.skip('skipped case', () => undefined);
test.todo('todo case');
describe.skip('skipped suite', () => {
  it('nested skipped case', () => undefined);
});
describe.skip.each\`
  value
  one
\`('tagged skipped suite', () => {
  it('nested tagged skipped case', () => undefined);
});
xit('xit case', () => undefined);
`
  );
});

afterAll(() => {
  fs.rmSync(repoRoot, { force: true, recursive: true });
});

describe('conditional coverage reference validation', () => {
  it.each(['active suite', 'active case'])('accepts active runtime target %s', (target) => {
    expect(() => validateCoverageReferences(repoRoot, registrationFor(target))).not.toThrow();
  });

  it.each([
    { status: 'skipped', target: 'skipped case' },
    { status: 'todo', target: 'todo case' },
    { status: 'skipped', target: 'skipped suite' },
    { status: 'skipped', target: 'nested skipped case' },
    { status: 'skipped', target: 'tagged skipped suite' },
    { status: 'skipped', target: 'nested tagged skipped case' },
    { status: 'skipped', target: 'xit case' },
  ])('rejects $status runtime target $target', ({ status, target }) => {
    expect(() => validateCoverageReferences(repoRoot, registrationFor(target))).toThrow(
      `Conditional coverage runtime target is ${status}: ${COVERAGE_FILE}#${target} (${CONDITIONAL_PATH})`
    );
  });

  it('rejects an empty coverage registration', () => {
    expect(() => validateCoverageReferences(repoRoot, [{ coverage: [], path: CONDITIONAL_PATH }])).toThrow(
      `Conditional coverage registration has no tests: ${CONDITIONAL_PATH}`
    );
  });

  it('rejects a missing coverage file', () => {
    const registry: ConditionalCoverageRegistration[] = [
      {
        coverage: [{ file: 'test/missing.test.ts', kind: 'runtime', target: 'missing case' }],
        path: CONDITIONAL_PATH,
      },
    ];
    expect(() => validateCoverageReferences(repoRoot, registry)).toThrow(
      `Conditional coverage file does not exist: test/missing.test.ts (${CONDITIONAL_PATH})`
    );
  });

  it('rejects a missing coverage target', () => {
    expect(() => validateCoverageReferences(repoRoot, registrationFor('missing case'))).toThrow(
      `Conditional coverage target does not exist: ${COVERAGE_FILE}#missing case (${CONDITIONAL_PATH})`
    );
  });
});
