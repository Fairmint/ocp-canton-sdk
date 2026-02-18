import fs from 'fs';
import os from 'os';
import path from 'path';
import { resetOcfSchemaRegistryForTests, resolveOcfSchemaDir } from '../../src/utils/ocfZodSchemas';

function createSchemaDir(rootDir: string): void {
  fs.mkdirSync(path.join(rootDir, 'objects'), { recursive: true });
}

describe('resolveOcfSchemaDir', () => {
  const originalSchemaEnv = process.env.OCP_OCF_SCHEMA_DIR;
  let tempDirsToDelete: string[] = [];

  afterEach(() => {
    if (originalSchemaEnv === undefined) {
      delete process.env.OCP_OCF_SCHEMA_DIR;
    } else {
      process.env.OCP_OCF_SCHEMA_DIR = originalSchemaEnv;
    }
    resetOcfSchemaRegistryForTests();

    for (const tempDir of tempDirsToDelete) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDirsToDelete = [];
  });

  it('prefers OCP_OCF_SCHEMA_DIR when it points to a valid schema directory', () => {
    const tempSchemaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocf-schema-env-'));
    tempDirsToDelete.push(tempSchemaDir);
    createSchemaDir(tempSchemaDir);

    process.env.OCP_OCF_SCHEMA_DIR = tempSchemaDir;

    expect(resolveOcfSchemaDir()).toBe(tempSchemaDir);
  });

  it('falls back to local schema directories when OCP_OCF_SCHEMA_DIR is invalid', () => {
    process.env.OCP_OCF_SCHEMA_DIR = path.join(os.tmpdir(), 'ocf-schema-does-not-exist');
    const resolvedPath = resolveOcfSchemaDir();
    expect(fs.existsSync(path.join(resolvedPath, 'objects'))).toBe(true);
  });
});
