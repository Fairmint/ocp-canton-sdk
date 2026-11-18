import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST_SCHEMA_DIR = path.join(REPO_ROOT, 'dist', 'ocf-schema');
const DIST_OBJECTS_DIR = path.join(DIST_SCHEMA_DIR, 'objects');
const SOURCE_EXTENSION_SCHEMA_DIR = path.join(REPO_ROOT, 'schemas', 'ocf-extension');
const DIST_EXTENSION_SCHEMA_DIR = path.join(REPO_ROOT, 'dist', 'ocf-extension-schema');
const DIST_EXTENSION_OBJECTS_DIR = path.join(DIST_EXTENSION_SCHEMA_DIR, 'objects');

function assertReadableDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Required directory not found: ${dirPath}`);
  }
  if (!fs.statSync(dirPath).isDirectory()) {
    throw new Error(`Expected directory, found non-directory path: ${dirPath}`);
  }
}

function resolveSourceSchemaDir(): string {
  const candidates = [
    path.join(REPO_ROOT, 'libs', 'Open-Cap-Format-OCF', 'schema'),
    path.join(REPO_ROOT, 'Open-Cap-Format-OCF', 'schema'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'objects'))) {
      return candidate;
    }
  }

  throw new Error(`Required directory not found: ${candidates.join(' or ')}`);
}

function main(): void {
  const sourceSchemaDir = resolveSourceSchemaDir();
  const sourceObjectsDir = path.join(sourceSchemaDir, 'objects');

  assertReadableDirectory(sourceSchemaDir);
  assertReadableDirectory(sourceObjectsDir);

  fs.rmSync(DIST_SCHEMA_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_SCHEMA_DIR, { recursive: true });
  fs.cpSync(sourceSchemaDir, DIST_SCHEMA_DIR, { recursive: true });

  assertReadableDirectory(DIST_OBJECTS_DIR);
  console.log(`Copied OCF schemas to ${DIST_SCHEMA_DIR}`);

  // The Fairmint OCF extension (the hold pair) is vendored in this repository; only its schemas ship.
  assertReadableDirectory(SOURCE_EXTENSION_SCHEMA_DIR);
  assertReadableDirectory(path.join(SOURCE_EXTENSION_SCHEMA_DIR, 'objects'));

  fs.rmSync(DIST_EXTENSION_SCHEMA_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_EXTENSION_SCHEMA_DIR, { recursive: true });
  fs.cpSync(SOURCE_EXTENSION_SCHEMA_DIR, DIST_EXTENSION_SCHEMA_DIR, {
    recursive: true,
    filter: (source) => fs.statSync(source).isDirectory() || source.endsWith('.schema.json'),
  });

  assertReadableDirectory(DIST_EXTENSION_OBJECTS_DIR);
  console.log(`Copied OCF extension schemas to ${DIST_EXTENSION_SCHEMA_DIR}`);
}

main();
