const {
  disallowedPackagePathReason,
  isAllowedPackagePath,
  validatePackageArtifacts,
} = require('../../scripts/check-package-artifacts.cjs');

const REQUIRED_DIST_FILES = [
  'dist/index.js',
  'dist/index.d.ts',
  'dist/replication.js',
  'dist/replication.d.ts',
  'dist/ocf-schema/objects/Issuer.schema.json',
];

function packResult(paths: string[], overrides: { unpackedSize?: number } = {}) {
  return {
    name: '@open-captable-protocol/canton',
    version: '0.0.0-test',
    unpackedSize: overrides.unpackedSize ?? 1024,
    files: paths.map((packagePath) => ({ path: packagePath })),
  };
}

describe('isAllowedPackagePath', () => {
  test.each([
    ['package.json', true],
    ['LICENSE', true],
    ['README.md', true],
    ['dist/index.js', true],
    ['dist/ocf-schema/objects/Issuer.schema.json', true],
    ['src/index.ts', false],
    ['docs/internal.md', false],
    ['examples/demo.ts', false],
    ['libs/Open-Cap-Format-OCF/schema/objects/Issuer.schema.json', false],
    ['bin/canton-localnet', false],
    ['scripts/check-package-artifacts.cjs', false],
    ['test/setupTests.ts', false],
    ['fixtures/sample.json', false],
    ['artifact.dar', false],
    ['CHANGELOG.md', false],
  ])('%s → %s', (packagePath, allowed) => {
    expect(isAllowedPackagePath(packagePath)).toBe(allowed);
    expect(disallowedPackagePathReason(packagePath) === null).toBe(allowed);
  });
});

describe('validatePackageArtifacts', () => {
  test('accepts the intended dist + npm metadata surface', () => {
    expect(
      validatePackageArtifacts(packResult(['package.json', 'LICENSE', 'README.md', ...REQUIRED_DIST_FILES]))
    ).toEqual([]);
  });

  test.each([
    {
      name: 'rejects paths outside the allowlist',
      paths: [...REQUIRED_DIST_FILES, 'package.json', 'src/index.ts'],
      expectedSubstring: 'src/index.ts',
    },
    {
      name: 'rejects missing runtime entry',
      paths: [
        'package.json',
        'dist/index.js',
        'dist/index.d.ts',
        'dist/replication.js',
        'dist/ocf-schema/objects/Issuer.schema.json',
      ],
      expectedSubstring: 'dist/replication.d.ts',
    },
    {
      name: 'rejects missing dist/ocf-schema tree',
      paths: ['package.json', 'dist/index.js', 'dist/index.d.ts', 'dist/replication.js', 'dist/replication.d.ts'],
      expectedSubstring: 'dist/ocf-schema',
    },
    {
      name: 'rejects dist/ocf-schema without objects/',
      paths: [
        'package.json',
        'dist/index.js',
        'dist/index.d.ts',
        'dist/replication.js',
        'dist/replication.d.ts',
        'dist/ocf-schema/README.md',
      ],
      expectedSubstring: 'dist/ocf-schema/objects',
    },
  ])('$name', ({ paths, expectedSubstring }) => {
    const errors = validatePackageArtifacts(packResult(paths));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error: string) => error.includes(expectedSubstring))).toBe(true);
  });

  test('rejects oversized packages', () => {
    const errors = validatePackageArtifacts(
      packResult(['package.json', ...REQUIRED_DIST_FILES], { unpackedSize: 100 }),
      { maxUnpackedBytes: 50 }
    );
    expect(errors.some((error: string) => error.includes('exceeds limit'))).toBe(true);
  });
});
