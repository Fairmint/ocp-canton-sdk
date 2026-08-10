#!/usr/bin/env node

/**
 * Repeatable npm package boundary check for @open-captable-protocol/canton.
 *
 * Production surface: dist/** (compiled SDK + intentional dist/ocf-schema JSON).
 * LocalNet tooling and libs/** submodules are CI-only and must not publish.
 */

const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const DEFAULT_MAX_UNPACKED_BYTES = 10 * 1024 * 1024;
const maxUnpackedBytes = Number(process.env.MAX_PACKAGE_UNPACKED_BYTES || DEFAULT_MAX_UNPACKED_BYTES);

if (!Number.isInteger(maxUnpackedBytes) || maxUnpackedBytes <= 0) {
  throw new Error('MAX_PACKAGE_UNPACKED_BYTES must be a positive integer in bytes');
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function forbiddenPackagePathReason(packagePath) {
  if (packagePath.endsWith('.dar')) return 'DAML DAR files are not runtime SDK artifacts';
  if (packagePath === 'libs' || packagePath.startsWith('libs/')) {
    return 'submodules under libs/ must not be published';
  }
  if (packagePath === 'fixtures' || packagePath.startsWith('fixtures/')) {
    return 'test fixtures must not be published';
  }
  if (packagePath === 'bin' || packagePath.startsWith('bin/')) {
    return 'LocalNet / CLI binaries must not ship from this package';
  }
  if (packagePath === 'scripts' || packagePath.startsWith('scripts/')) {
    return 'repo scripts must not be published';
  }
  if (packagePath === 'test' || packagePath.startsWith('test/')) {
    return 'tests must not be published';
  }
  if (packagePath === 'node_modules' || packagePath.startsWith('node_modules/')) {
    return 'node_modules must not be published';
  }
  return null;
}

function throwIfFailed(label, result) {
  if (result.status === 0 && !result.signal && !result.error) return;
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.stdout) process.stderr.write(result.stdout);
  throw new Error(`${label} failed (status ${result.status ?? 'unknown'})`);
}

if (!existsSync(path.join(process.cwd(), 'dist', 'index.js'))) {
  const build = spawnSync('npm', ['run', 'build'], { encoding: 'utf8' });
  throwIfFailed('npm run build', build);
}

const pack = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  encoding: 'utf8',
});
throwIfFailed('npm pack --dry-run', pack);

const [result] = JSON.parse(pack.stdout);
if (!result) {
  throw new Error('npm pack returned no package metadata');
}

const errors = [];
if (result.unpackedSize > maxUnpackedBytes) {
  errors.push(
    `package unpacked size ${formatBytes(result.unpackedSize)} exceeds limit ${formatBytes(maxUnpackedBytes)}`
  );
}

const packagePaths = new Set(result.files.map((file) => file.path));
for (const requiredPath of ['dist/index.js', 'dist/index.d.ts', 'dist/replication.js', 'dist/replication.d.ts']) {
  if (!packagePaths.has(requiredPath)) {
    errors.push(`package is missing required runtime entry ${requiredPath}`);
  }
}

for (const file of result.files) {
  const reason = forbiddenPackagePathReason(file.path);
  if (reason) {
    errors.push(`${file.path}: ${reason}`);
  }
}

if (errors.length > 0) {
  console.error(`\n${result.name}@${result.version} package artifact check failed:\n`);
  for (const error of errors) {
    console.error(`  ✗ ${error}`);
  }
  process.exit(1);
}

console.log(
  `✓ ${result.name}@${result.version} package artifact is ${formatBytes(result.unpackedSize)} unpacked across ${result.files.length} files`
);
