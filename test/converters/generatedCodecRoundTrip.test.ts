/**
 * Every OCF fixture the repository holds must survive the full conversion round trip against the generated
 * OpenCapTable-v35 codecs:
 *
 * 1. `convertToDaml` produces an `OcfRecordData` variant that the generated codec decodes losslessly (no unknown keys,
 *    nothing dropped or rewritten by the decoder),
 * 2. every Daml `Date` in it is a bare `YYYY-MM-DD`,
 * 3. `convertToOcf` returns OCF that equals the input under `ocfDeepEqual`.
 *
 * All 49 writable entity kinds must be covered by at least one fixture.
 */

import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import fs from 'fs';
import path from 'path';
import { ENTITY_REGISTRY } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { convertToOcf } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import {
  OCF_LEDGER_WRITTEN_ENTITY_TYPES,
  OCF_OBJECT_TYPE_TO_ENTITY_TYPE,
  isOcfEditableEntityType,
  mapOcfObjectTypeToEntityType,
  type OcfEditableEntityType,
} from '../../src/functions/OpenCapTable/capTable/entityTypes';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { decodeGeneratedDaml } from '../../src/utils/generatedDamlValidation';
import { DEFAULT_DEPRECATED_FIELDS, ocfCompare } from '../../src/utils/ocfComparison';
import { normalizeZeroUuidSentinels } from '../../src/utils/zeroUuidNormalization';

const FIXTURES_DIR = path.join(__dirname, '../fixtures');
const FIXTURE_ROOTS = ['production', 'synthetic', 'createOcf'] as const;

/** Daml `Date` fields are exactly `YYYY-MM-DD`: no time, no zone. */
const DAML_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface Fixture {
  readonly label: string;
  readonly entityType: OcfEditableEntityType;
  readonly ocf: Record<string, unknown>;
}

function jsonFilesUnder(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return jsonFilesUnder(full);
    return entry.isFile() && entry.name.endsWith('.json') ? [full] : [];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * The OCF record inside a fixture file. Production and synthetic fixtures are the record itself (synthetic ones carry a
 * `_source` marker); createOcf recordings keep the on-chain OCF under `onchain_ocf`.
 */
function ocfRecordOf(fixtureRoot: string, content: unknown): Record<string, unknown> | undefined {
  if (!isRecord(content)) return undefined;
  if (fixtureRoot === 'createOcf') {
    return isRecord(content.onchain_ocf) ? content.onchain_ocf : undefined;
  }
  const { _source: _marker, ...record } = content;
  return record;
}

function loadFixtures(): Fixture[] {
  return FIXTURE_ROOTS.flatMap((root) =>
    jsonFilesUnder(path.join(FIXTURES_DIR, root)).flatMap((file): Fixture[] => {
      const label = path.relative(FIXTURES_DIR, file);
      const content: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
      const ocf = ocfRecordOf(root, content);
      const objectType = ocf?.object_type;
      if (ocf === undefined || typeof objectType !== 'string') return [];
      const entityType = mapOcfObjectTypeToEntityType(objectType);
      if (entityType === null || !isOcfEditableEntityType(entityType)) return [];
      return [{ label, entityType, ocf }];
    })
  );
}

/** Every string under a key that names a Daml `Date` (`date`, `settlement_date`, `accrual_end_date`, ...). */
function dateStrings(value: unknown, trail = '$'): Array<{ at: string; value: unknown }> {
  if (Array.isArray(value)) return value.flatMap((item, index) => dateStrings(item, `${trail}[${index}]`));
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const at = `${trail}.${key}`;
    if (/(^|_)date$/.test(key) && child !== null) return [{ at, value: child }];
    return dateStrings(child, at);
  });
}

const recordDataCodec = {
  decode: (value: unknown) => Fairmint.OpenCapTable.OcfRecords.OcfRecordData.decoder.runWithException(value),
  encode: (value: Fairmint.OpenCapTable.OcfRecords.OcfRecordData) =>
    Fairmint.OpenCapTable.OcfRecords.OcfRecordData.encode(value),
};

const fixtures = loadFixtures();

describe('generated codec round trip', () => {
  test('finds fixtures in all three fixture roots', () => {
    expect(fixtures.length).toBeGreaterThan(0);
    for (const root of FIXTURE_ROOTS) {
      expect(fixtures.some((fixture) => fixture.label.startsWith(`${root}${path.sep}`))).toBe(true);
    }
  });

  test('covers every one of the 49 writable entity kinds', () => {
    const writable = (Object.values(OCF_OBJECT_TYPE_TO_ENTITY_TYPE) as string[]).filter(
      (entityType) => !(OCF_LEDGER_WRITTEN_ENTITY_TYPES as readonly string[]).includes(entityType)
    );
    const covered = new Set<string>(fixtures.map((fixture) => fixture.entityType));

    expect(writable).toHaveLength(49);
    expect(writable.filter((entityType) => !covered.has(entityType))).toEqual([]);
  });

  describe.each(fixtures.map((fixture) => [fixture.label, fixture] as const))('%s', (_label, fixture) => {
    const { entityType, ocf } = fixture;

    test('convertToDaml output decodes losslessly through the generated OcfRecordData codec', () => {
      const record = convertToDaml(entityType, ocf as never);

      expect(record.tag).toBe(ENTITY_REGISTRY[entityType].recordTag);
      expect(() => decodeGeneratedDaml(record, recordDataCodec, `${entityType}.record`)).not.toThrow();
    });

    test('every Daml date is a bare YYYY-MM-DD', () => {
      const { value } = convertToDaml(entityType, ocf as never);

      for (const { at, value: date } of dateStrings(value)) {
        expect({ at, date }).toEqual({ at, date: expect.stringMatching(DAML_DATE) });
      }
    });

    test('convertToOcf returns the input OCF', () => {
      const record = convertToDaml(entityType, ocf as never);
      const decoded = decodeGeneratedDaml(record, recordDataCodec, `${entityType}.record`);
      const back = convertToOcf(entityType, decoded.value as never);

      // createOcf recordings carry all-zero UUID database sentinels, which the SDK reads as absence; deprecated OCF
      // fields (option_grant_type, current_relationship, stock_class_id of a plan) are replaced on the way back.
      const expected = normalizeZeroUuidSentinels(ocf);
      expect(ocfCompare(expected, back, { deprecatedFields: DEFAULT_DEPRECATED_FIELDS })).toEqual({
        equal: true,
        differences: [],
      });
    });
  });
});
