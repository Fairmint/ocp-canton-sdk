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
it.each([])('empty parameter table', () => undefined);
it.each([1])('nonempty parameter table', () => undefined);
it('missing callback');
if (false) {
  it('conditional dead case', () => undefined);
}
function neverCalled() {
  it('function dead case', () => undefined);
}
void neverCalled;
`
  );
});

afterAll(() => {
  fs.rmSync(repoRoot, { force: true, recursive: true });
});

describe('conditional coverage reference validation', () => {
  it('accepts an active concrete runtime test target', () => {
    expect(() => validateCoverageReferences(repoRoot, registrationFor('active case'))).not.toThrow();
  });

  it('rejects a suite target even when the suite contains an active test', () => {
    expect(() => validateCoverageReferences(repoRoot, registrationFor('active suite'))).toThrow(
      `Conditional coverage runtime target is a suite, not a concrete test: ${COVERAGE_FILE}#active suite (${CONDITIONAL_PATH})`
    );
  });

  it.each([
    { status: 'skipped', target: 'skipped case' },
    { status: 'todo', target: 'todo case' },
    { status: 'skipped', target: 'nested skipped case' },
    { status: 'skipped', target: 'nested tagged skipped case' },
    { status: 'skipped', target: 'xit case' },
  ])('rejects $status runtime target $target', ({ status, target }) => {
    expect(() => validateCoverageReferences(repoRoot, registrationFor(target))).toThrow(
      `Conditional coverage runtime target is ${status}: ${COVERAGE_FILE}#${target} (${CONDITIONAL_PATH})`
    );
  });

  it.each(['skipped suite', 'tagged skipped suite'])('rejects suite runtime target %s', (target) => {
    expect(() => validateCoverageReferences(repoRoot, registrationFor(target))).toThrow(
      `Conditional coverage runtime target is a suite, not a concrete test: ${COVERAGE_FILE}#${target} (${CONDITIONAL_PATH})`
    );
  });

  it.each(['empty parameter table', 'nonempty parameter table'])(
    'rejects parameterized runtime target %s',
    (target) => {
      expect(() => validateCoverageReferences(repoRoot, registrationFor(target))).toThrow(
        `Conditional coverage runtime target is parameterized: ${COVERAGE_FILE}#${target} (${CONDITIONAL_PATH})`
      );
    }
  );

  it('rejects an active test registration without an inline callback', () => {
    expect(() => validateCoverageReferences(repoRoot, registrationFor('missing callback'))).toThrow(
      `Conditional coverage runtime target is incomplete: ${COVERAGE_FILE}#missing callback (${CONDITIONAL_PATH})`
    );
  });

  it.each(['conditional dead case', 'function dead case'])(
    'rejects runtime target in dead registration scope %s',
    (target) => {
      expect(() => validateCoverageReferences(repoRoot, registrationFor(target))).toThrow(
        `Conditional coverage target does not exist: ${COVERAGE_FILE}#${target} (${CONDITIONAL_PATH})`
      );
    }
  );

  it('rejects reuse of one target for two conditional paths', () => {
    const secondPath = 'schema/objects/Synthetic.schema.json#/properties/other/oneOf/0';
    expect(() =>
      validateCoverageReferences(repoRoot, [
        ...registrationFor('active case'),
        { ...registrationFor('active case')[0]!, path: secondPath },
      ])
    ).toThrow(
      `Conditional coverage target is reused: ${COVERAGE_FILE}#active case (${CONDITIONAL_PATH}, ${secondPath})`
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
