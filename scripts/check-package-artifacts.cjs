#!/usr/bin/env node

/**
 * Repeatable npm package boundary check for @open-captable-protocol/canton.
 *
 * Production surface: dist/** (compiled SDK + intentional dist/ocf-schema JSON)
 * plus npm's auto-included package metadata. Aligns with package.json#files: ["dist"].
 * LocalNet tooling and libs/** submodules are CI-only and must not publish.
 */

const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const DEFAULT_MAX_UNPACKED_BYTES = 10 * 1024 * 1024;

/** Root metadata npm includes regardless of package.json#files. */
const ALLOWED_NPM_METADATA_FILES = new Set([
  'package.json',
  'LICENSE',
  'LICENCE',
  'LICENSE.md',
  'LICENCE.md',
  'LICENSE.txt',
  'LICENCE.txt',
  'README',
  'README.md',
  'README.txt',
]);

const REQUIRED_RUNTIME_ENTRIES = ['dist/index.js', 'dist/index.d.ts', 'dist/replication.js', 'dist/replication.d.ts'];

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function isAllowedPackagePath(packagePath) {
  if (ALLOWED_NPM_METADATA_FILES.has(packagePath)) return true;
  if (packagePath === 'dist' || packagePath.startsWith('dist/')) return true;
  return false;
}

function disallowedPackagePathReason(packagePath) {
  if (isAllowedPackagePath(packagePath)) return null;
  return 'outside allowlist (only dist/** and npm package metadata are permitted)';
}

/**
 * Validate npm pack metadata against the published SDK boundary.
 *
 * @param {{ name?: string, version?: string, unpackedSize?: number, files?: Array<{ path: string }> }} packResult
 * @param {{ maxUnpackedBytes?: number }} [options]
 * @returns {string[]} validation error messages (empty when valid)
 */
function validatePackageArtifacts(packResult, options = {}) {
  const maxUnpackedBytes = options.maxUnpackedBytes ?? DEFAULT_MAX_UNPACKED_BYTES;
  const errors = [];

  if (!packResult || typeof packResult !== 'object') {
    return ['npm pack returned no package metadata'];
  }

  if (!Number.isInteger(maxUnpackedBytes) || maxUnpackedBytes <= 0) {
    return ['MAX_PACKAGE_UNPACKED_BYTES must be a positive integer in bytes'];
  }

  const unpackedSize = packResult.unpackedSize;
  if (typeof unpackedSize === 'number' && unpackedSize > maxUnpackedBytes) {
    errors.push(`package unpacked size ${formatBytes(unpackedSize)} exceeds limit ${formatBytes(maxUnpackedBytes)}`);
  }

  const files = Array.isArray(packResult.files) ? packResult.files : [];
  const packagePaths = new Set(files.map((file) => file.path));

  for (const requiredPath of REQUIRED_RUNTIME_ENTRIES) {
    if (!packagePaths.has(requiredPath)) {
      errors.push(`package is missing required runtime entry ${requiredPath}`);
    }
  }

  const hasOcfSchema = [...packagePaths].some(
    (packagePath) => packagePath === 'dist/ocf-schema' || packagePath.startsWith('dist/ocf-schema/')
  );
  if (!hasOcfSchema) {
    errors.push('package is missing required runtime schemas under dist/ocf-schema');
  } else {
    const hasOcfSchemaObjects = [...packagePaths].some((packagePath) =>
      packagePath.startsWith('dist/ocf-schema/objects/')
    );
    if (!hasOcfSchemaObjects) {
      errors.push('package is missing required runtime schemas under dist/ocf-schema/objects');
    }
  }

  for (const file of files) {
    const reason = disallowedPackagePathReason(file.path);
    if (reason) {
      errors.push(`${file.path}: ${reason}`);
    }
  }

  return errors;
}

function throwIfFailed(label, result) {
  if (result.status === 0 && !result.signal && !result.error) return;
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.stdout) process.stderr.write(result.stdout);
  throw new Error(`${label} failed (status ${result.status ?? 'unknown'})`);
}

function main() {
  const maxUnpackedBytes = Number(process.env.MAX_PACKAGE_UNPACKED_BYTES || DEFAULT_MAX_UNPACKED_BYTES);
  if (!Number.isInteger(maxUnpackedBytes) || maxUnpackedBytes <= 0) {
    throw new Error('MAX_PACKAGE_UNPACKED_BYTES must be a positive integer in bytes');
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
  const errors = validatePackageArtifacts(result, { maxUnpackedBytes });

  if (errors.length > 0) {
    const name = result?.name ?? 'package';
    const version = result?.version ?? 'unknown';
    console.error(`\n${name}@${version} package artifact check failed:\n`);
    for (const error of errors) {
      console.error(`  ✗ ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `✓ ${result.name}@${result.version} package artifact is ${formatBytes(result.unpackedSize)} unpacked across ${result.files.length} files`
  );
}

module.exports = {
  ALLOWED_NPM_METADATA_FILES,
  DEFAULT_MAX_UNPACKED_BYTES,
  REQUIRED_RUNTIME_ENTRIES,
  disallowedPackagePathReason,
  formatBytes,
  isAllowedPackagePath,
  validatePackageArtifacts,
};

if (require.main === module) {
  main();
}
