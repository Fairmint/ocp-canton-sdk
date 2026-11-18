/**
 * The Fairmint OCF extension (the hold pair) is vendored verbatim in `schemas/ocf-extension` and loaded beside OCF's
 * own schemas. The extension references OCF by its pinned commit URL while the OCF submodule's `$id`s use `main`, so
 * the loader registers each OCF schema under both.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import {
  OCF_EXTENSION_OBJECT_SCHEMA_PATHS,
  getOcfSchema,
  parseOcfObject,
  resetOcfSchemaRegistryForTests,
  resolveOcfExtensionSchemaDir,
} from '../../src/utils/ocfZodSchemas';

const VENDORED_DIR = path.join(__dirname, '../../schemas/ocf-extension');
const OCF_SCHEMA_DIR = path.join(__dirname, '../../libs/Open-Cap-Format-OCF/schema');
const OCF_PINNED_PREFIX =
  'https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/6d8c93227de64fc014fe0a215af208f4a5432542/schema/';
const EXTENSION_ID_PREFIX =
  'https://raw.githubusercontent.com/Fairmint/open-captable-protocol-daml/main/ocf-extension/schema/';

function schemaFilesUnder(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return schemaFilesUnder(full);
    return entry.name.endsWith('.schema.json') ? [full] : [];
  });
}

function stringsIn(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(stringsIn);
  return [];
}

describe('vendored Fairmint OCF extension schemas', () => {
  const files = schemaFilesUnder(VENDORED_DIR);

  test('vendors the eight extension schemas and a README naming the source commit', () => {
    expect(files.map((file) => path.relative(VENDORED_DIR, file)).sort()).toEqual([
      'enums/HoldType.schema.json',
      'enums/ObjectType.schema.json',
      'files/TransactionsFile.schema.json',
      'objects/transactions/hold/StockHold.schema.json',
      'objects/transactions/hold/StockHoldCancellation.schema.json',
      'primitives/objects/Object.schema.json',
      'primitives/objects/transactions/hold/Hold.schema.json',
      'primitives/objects/transactions/hold/HoldCancellation.schema.json',
    ]);
    const readme = fs.readFileSync(path.join(VENDORED_DIR, 'README.md'), 'utf8');
    expect(readme).toContain('93ea933');
    expect(readme).toContain('6d8c93227de64fc014fe0a215af208f4a5432542');
  });

  test.each(files.map((file) => [path.relative(VENDORED_DIR, file), file] as const))(
    '%s keeps the extension $id',
    (_relative, file) => {
      const schema = JSON.parse(fs.readFileSync(file, 'utf8')) as { $id: string };

      expect(schema.$id.startsWith(EXTENSION_ID_PREFIX)).toBe(true);
      expect(schema.$id).toBe(`${EXTENSION_ID_PREFIX}${path.relative(VENDORED_DIR, file)}`);
    }
  );

  test('every OCF schema the extension references by its pinned URL exists in the OCF submodule', () => {
    const pinnedReferences = new Set(
      files.flatMap((file) =>
        stringsIn(JSON.parse(fs.readFileSync(file, 'utf8'))).filter((value) => value.startsWith(OCF_PINNED_PREFIX))
      )
    );

    expect(pinnedReferences.size).toBeGreaterThan(0);
    for (const reference of pinnedReferences) {
      expect(fs.existsSync(path.join(OCF_SCHEMA_DIR, reference.slice(OCF_PINNED_PREFIX.length)))).toBe(true);
    }
  });

  test('maps both hold object types to their object schemas', () => {
    for (const relative of Object.values(OCF_EXTENSION_OBJECT_SCHEMA_PATHS)) {
      expect(fs.existsSync(path.join(VENDORED_DIR, 'objects', relative))).toBe(true);
    }
  });
});

describe('extension schema loading', () => {
  const originalEnv = process.env.OCP_OCF_EXTENSION_SCHEMA_DIR;
  const tempDirs: string[] = [];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.OCP_OCF_EXTENSION_SCHEMA_DIR;
    } else {
      process.env.OCP_OCF_EXTENSION_SCHEMA_DIR = originalEnv;
    }
    resetOcfSchemaRegistryForTests();
    jest.restoreAllMocks();
    for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  test('resolves the vendored directory of a source checkout', () => {
    delete process.env.OCP_OCF_EXTENSION_SCHEMA_DIR;

    expect(fs.existsSync(path.join(resolveOcfExtensionSchemaDir(), 'objects'))).toBe(true);
  });

  test('prefers OCP_OCF_EXTENSION_SCHEMA_DIR when it holds an objects directory', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocf-extension-env-'));
    tempDirs.push(dir);
    fs.mkdirSync(path.join(dir, 'objects'));
    process.env.OCP_OCF_EXTENSION_SCHEMA_DIR = dir;

    expect(resolveOcfExtensionSchemaDir()).toBe(dir);
  });

  test('falls back to the local directories when the override is invalid', () => {
    process.env.OCP_OCF_EXTENSION_SCHEMA_DIR = path.join(os.tmpdir(), 'ocf-extension-does-not-exist');

    expect(fs.existsSync(path.join(resolveOcfExtensionSchemaDir(), 'objects'))).toBe(true);
  });

  test('reports a missing extension schema directory', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    expect(() => resolveOcfExtensionSchemaDir()).toThrow(OcpValidationError);
  });

  test('registers OCF schemas under their pinned URL so the extension schemas resolve', () => {
    const schema = getOcfSchema('TX_STOCK_HOLD');

    expect(
      schema.safeParse({
        object_type: 'TX_STOCK_HOLD',
        id: 'hold-1',
        date: '2026-01-01',
        security_id: 'security-1',
        hold_type: 'REGISTER_SETTLEMENT',
        reference: 'settlement-1',
        reason_text: 'trade',
        quantity: '10',
      }).success
    ).toBe(true);
  });

  test('validates the extension dates and quantities with OCF types', () => {
    const hold = {
      object_type: 'TX_STOCK_HOLD',
      id: 'hold-1',
      security_id: 'security-1',
      hold_type: 'REGISTER_SETTLEMENT',
      reference: 'settlement-1',
      reason_text: 'trade',
    };

    expect(() => parseOcfObject({ ...hold, date: '2026-13-01', quantity: '10' })).toThrow(OcpValidationError);
    expect(() => parseOcfObject({ ...hold, date: '2026-01-01', quantity: 'ten' })).toThrow(OcpValidationError);
    expect(parseOcfObject({ ...hold, date: '2026-01-01', quantity: '10' })).toMatchObject({ quantity: '10' });
  });

  test('keeps rejecting an unknown object type', () => {
    expect(() => getOcfSchema('TX_STOCK_PLEDGE')).toThrow(
      expect.objectContaining({ code: OcpErrorCodes.UNKNOWN_ENUM_VALUE, receivedValue: 'TX_STOCK_PLEDGE' })
    );
  });
});
