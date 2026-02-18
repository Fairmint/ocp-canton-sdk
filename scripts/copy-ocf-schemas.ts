import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..');
const SOURCE_SCHEMA_DIR = path.join(REPO_ROOT, 'Open-Cap-Format-OCF', 'schema');
const SOURCE_OBJECTS_DIR = path.join(SOURCE_SCHEMA_DIR, 'objects');
const DIST_SCHEMA_DIR = path.join(REPO_ROOT, 'dist', 'ocf-schema');
const DIST_OBJECTS_DIR = path.join(DIST_SCHEMA_DIR, 'objects');

function assertReadableDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Required directory not found: ${dirPath}`);
  }
  if (!fs.statSync(dirPath).isDirectory()) {
    throw new Error(`Expected directory, found non-directory path: ${dirPath}`);
  }
}

function main(): void {
  assertReadableDirectory(SOURCE_SCHEMA_DIR);
  assertReadableDirectory(SOURCE_OBJECTS_DIR);

  fs.rmSync(DIST_SCHEMA_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_SCHEMA_DIR, { recursive: true });
  fs.cpSync(SOURCE_SCHEMA_DIR, DIST_SCHEMA_DIR, { recursive: true });

  assertReadableDirectory(DIST_OBJECTS_DIR);
  console.log(`Copied OCF schemas to ${DIST_SCHEMA_DIR}`);
}

main();
