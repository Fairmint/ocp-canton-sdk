/**
 * Differential tests against the pinned OCF JSON schemas (6d8c932). Every input is first validated by `getOcfSchema`,
 * the SDK's thin wrapper that compiles the pinned schema files with AJV (with formats) and adds no rule of its own, and
 * with no SDK normalization in front of it. The SDK must then accept the input on the generic write path and, where the
 * ledger can hold it, read back OCF that compares equal to the raw input. Each case is an OCF edge the SDK used to
 * refuse or rewrite.
 */

import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import fs from 'fs';
import path from 'path';
import { convertToOcf } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import type { OcfEditableEntityType } from '../../src/functions/OpenCapTable/capTable/entityTypes';
import { convertToDaml, convertToDamlData } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { damlDocumentDataToNative } from '../../src/functions/OpenCapTable/document/getDocumentAsOcf';
import { decodeGeneratedDaml } from '../../src/utils/generatedDamlValidation';
import { ocfCompare, ocfDeepEqual } from '../../src/utils/ocfComparison';
import { getOcfSchema } from '../../src/utils/ocfZodSchemas';
import { normalizeOcfData } from '../../src/utils/planSecurityAliases';
import { replicationComparison } from '../../src/utils/replicationHelpers';
import { monetaryToDaml, normalizeNumericString } from '../../src/utils/typeConversions';
import { ZERO_UUID } from '../../src/utils/zeroUuidNormalization';

const SAMPLES_DIR = path.join(__dirname, '../../libs/Open-Cap-Format-OCF/samples');

function sample(file: string, id: string): Record<string, unknown> {
  const { items } = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, file), 'utf8')) as {
    items: Array<Record<string, unknown>>;
  };
  const item = items.find((candidate) => candidate.id === id);
  if (item === undefined) throw new Error(`OCF sample ${file} has no item ${id}`);
  return item;
}

/** The SAFE sample's first trigger mechanism, to edit in place. */
function firstSafeMechanism(safe: Record<string, unknown>): Record<string, unknown> {
  const [trigger] = safe.conversion_triggers as Array<{
    conversion_right: { conversion_mechanism: Record<string, unknown> };
  }>;
  if (trigger === undefined) throw new Error('sample has a trigger');
  return trigger.conversion_right.conversion_mechanism;
}

/** The pinned OCF schema alone (see the file header), with no SDK normalization in front of it. */
function expectOcfValid(value: Record<string, unknown>): void {
  const result = getOcfSchema(String(value.object_type)).safeParse(value);
  expect(result.success ? [] : result.error.issues.map((issue) => issue.message)).toEqual([]);
}

const recordDataCodec = {
  decode: (value: unknown) => Fairmint.OpenCapTable.OcfRecords.OcfRecordData.decoder.runWithException(value),
  encode: (value: Fairmint.OpenCapTable.OcfRecords.OcfRecordData) =>
    Fairmint.OpenCapTable.OcfRecords.OcfRecordData.encode(value),
};

/** Write through the generic path, decode with the generated codec, and read back. */
function roundTrip(entityType: OcfEditableEntityType, ocf: Record<string, unknown>): Record<string, unknown> {
  const record = convertToDaml(entityType, ocf as never);
  const decoded = decodeGeneratedDaml(record, recordDataCodec, `${entityType}.record`);
  return convertToOcf(entityType, decoded.value as never) as unknown as Record<string, unknown>;
}

/**
 * Round-trip `ocf` and compare the raw input, exactly as the OCF schema accepted it, with what comes back, the way
 * replication compares a source record with the ledger's (both through `normalizeOcfData`, then
 * `replicationComparison`). No expected value is prepared: an optional const the readers emit (a conversion right's
 * `type`) must compare equal to its absence, or replication would re-edit the record on every run.
 */
function expectLossless(entityType: OcfEditableEntityType, ocf: Record<string, unknown>): Record<string, unknown> {
  expectOcfValid(ocf);
  const raw = JSON.parse(JSON.stringify(ocf)) as Record<string, unknown>;
  const back = roundTrip(entityType, ocf);
  expect(ocfCompare(normalizeOcfData(raw), normalizeOcfData(back), replicationComparison(entityType))).toEqual({
    equal: true,
    differences: [],
  });
  return back;
}

const stakeholder = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  object_type: 'STAKEHOLDER',
  id: 'sh-1',
  name: { legal_name: 'Alice Doe' },
  stakeholder_type: 'INDIVIDUAL',
  ...overrides,
});

describe('OCF-valid edge cases the SDK accepts and keeps', () => {
  describe('Numeric and Percentage lexical forms', () => {
    test("an explicit '+' sign on a Numeric or Monetary amount is accepted and dropped", () => {
      const issuance = {
        ...sample('Transactions.ocf.json', 'test-stock-issuance-minimal'),
        quantity: '+1000',
        share_price: { amount: '+1.00', currency: 'USD' },
      };
      expectOcfValid(issuance);

      const back = expectLossless('stockIssuance', issuance);
      expect(back).toMatchObject({ quantity: '1000', share_price: { amount: '1', currency: 'USD' } });
      expect(normalizeNumericString('+1')).toBe('1');
      expect(monetaryToDaml({ amount: '+1.00', currency: 'USD' }).amount).toBe('1');
    });

    test("an equity-compensation exercise quantity '+100' is written as 100", () => {
      const exercise = {
        object_type: 'TX_EQUITY_COMPENSATION_EXERCISE',
        id: 'ece-1',
        date: '2024-01-01',
        security_id: 'sec-1',
        quantity: '+100',
        resulting_security_ids: ['sec-2'],
      };
      expectOcfValid(exercise);

      expect(convertToDamlData('equityCompensationExercise', exercise as never).quantity).toBe('100');
    });

    test("a Percentage without its optional leading 0 ('.2') is accepted", () => {
      const safe = sample('Transactions.ocf.json', 'test-safe-issuance-all-fields');
      firstSafeMechanism(safe).conversion_discount = '.2';
      expectOcfValid(safe);

      const back = expectLossless('convertibleIssuance', safe);
      expect(back).toMatchObject({
        conversion_triggers: [{ conversion_right: { conversion_mechanism: { conversion_discount: '0.2' } } }],
      });
    });

    test('an empty Percentage, which OCF admits but a DAML Decimal cannot hold, is refused as an encoding limit', () => {
      const safe = sample('Transactions.ocf.json', 'test-safe-issuance-all-fields');
      firstSafeMechanism(safe).conversion_discount = '';
      expectOcfValid(safe);

      expect(() => convertToDaml('convertibleIssuance', safe as never)).toThrow(/no DAML Decimal encoding/);
    });
  });

  describe('free-text strings are kept exactly', () => {
    test('decimal-looking ids, names and comments are not rewritten', () => {
      const input = stakeholder({
        id: '10.10',
        name: { legal_name: '3.50' },
        issuer_assigned_id: '007.0',
        comments: ['1.20'],
      });

      expect(expectLossless('stakeholder', input)).toMatchObject({
        id: '10.10',
        name: { legal_name: '3.50' },
        issuer_assigned_id: '007.0',
        comments: ['1.20'],
      });
    });

    test('the all-zero UUID is a valid id and comment', () => {
      expect(expectLossless('stakeholder', stakeholder({ id: ZERO_UUID, comments: [ZERO_UUID] }))).toMatchObject({
        id: ZERO_UUID,
        comments: [ZERO_UUID],
      });
    });

    test('a whitespace-only comment is kept; only the empty string the register refuses is dropped', () => {
      const input = stakeholder({ comments: ['', ' ', 'a'] });
      expectOcfValid(input);

      expect(convertToDamlData('stakeholder', input as never).comments).toEqual([' ', 'a']);
    });

    test('an optional property set to undefined is treated as absent, as JSON does', () => {
      const input = stakeholder({ comments: undefined });
      expectOcfValid(JSON.parse(JSON.stringify(input)) as Record<string, unknown>);

      expect(convertToDamlData('stakeholder', input as never).comments).toEqual([]);
    });

    test('stakeholder relationships keep their order and repeats (OCF sets no uniqueItems)', () => {
      const input = stakeholder({ current_relationships: ['INVESTOR', 'EMPLOYEE', 'INVESTOR'] });

      expect(expectLossless('stakeholder', input).current_relationships).toEqual(['INVESTOR', 'EMPLOYEE', 'INVESTOR']);
    });
  });

  describe('deprecated and optional OCF forms', () => {
    test.each([
      ['RSU', 'NSO', 'RSU'],
      ['OPTION_NSO', 'INTL', 'OPTION_NSO'],
      ['OPTION', 'ISO', 'OPTION'],
    ])('compensation_type %s with option_grant_type %s is written as %s', (compensationType, grant, written) => {
      const issuance = {
        ...sample('Transactions.ocf.json', 'test-plan-security-issuance-minimal'),
        compensation_type: compensationType,
        option_grant_type: grant,
      };
      expectOcfValid(issuance);

      expect(roundTrip('equityCompensationIssuance', issuance).compensation_type).toBe(written);
    });

    test('a stock plan naming its class by the deprecated stock_class_id reads back as a one-item list', () => {
      const plan = {
        object_type: 'STOCK_PLAN',
        id: 'plan-1',
        plan_name: 'Plan',
        initial_shares_reserved: '1000',
        stock_class_id: 'sc-1',
      };
      expectOcfValid(plan);

      expect(roundTrip('stockPlan', plan).stock_class_ids).toEqual(['sc-1']);
    });

    test('the TX_PLAN_SECURITY_* alias the target schema lists is accepted by the typed path', () => {
      const exercise = {
        object_type: 'TX_PLAN_SECURITY_EXERCISE',
        id: 'pse-1',
        date: '2024-01-01',
        security_id: 'sec-1',
        quantity: '5',
        resulting_security_ids: ['sec-2'],
      };
      expectOcfValid(exercise);

      expect(convertToDamlData('equityCompensationExercise', exercise as never).quantity).toBe('5');
    });

    test("OCF's own sample stock class, whose conversion right omits the optional type, round-trips", () => {
      const stockClass = sample('StockClasses.ocf.json', 'cc775778-7d6e-4f8a-93cf-4df2242d7d6d');
      const rights = stockClass.conversion_rights as Array<Record<string, unknown>>;
      expect(rights[0]).not.toHaveProperty('type');

      expectLossless('stockClass', stockClass);
    });

    test('a convertible conversion right without its optional type is accepted', () => {
      const safe = sample('Transactions.ocf.json', 'test-safe-issuance-all-fields');
      for (const trigger of safe.conversion_triggers as Array<{ conversion_right: Record<string, unknown> }>) {
        delete trigger.conversion_right.type;
      }

      expectLossless('convertibleIssuance', safe);
    });

    test('a warrant conversion right without its type is read from its mechanism', () => {
      const warrant = sample('Transactions.ocf.json', 'test-valuation-based-warrant-issuance-full-fields');
      for (const trigger of warrant.exercise_triggers as Array<{ conversion_right: Record<string, unknown> }>) {
        delete trigger.conversion_right.type;
      }

      expectLossless('warrantIssuance', warrant);
    });

    test('a warrant exercise trigger may carry a convertible conversion right, and it reads back', () => {
      const warrant = sample('Transactions.ocf.json', 'test-warrant-issuance-minimal');
      const [trigger] = warrant.exercise_triggers as Array<Record<string, unknown>>;
      if (trigger === undefined) throw new Error('sample has a trigger');
      trigger.conversion_right = {
        type: 'CONVERTIBLE_CONVERSION_RIGHT',
        conversion_mechanism: { type: 'SAFE_CONVERSION', conversion_mfn: false },
        converts_to_future_round: true,
      };

      expect(expectLossless('warrantIssuance', warrant)).toMatchObject({
        exercise_triggers: [{ conversion_right: { type: 'CONVERTIBLE_CONVERSION_RIGHT' } }],
      });
    });

    test('a relative vesting trigger may name a condition outside its next_condition_ids ancestry', () => {
      const terms = {
        object_type: 'VESTING_TERMS',
        id: 'vt-1',
        name: 'Sibling relative',
        description: 'B waits on A, which does not lead to B',
        allocation_type: 'CUMULATIVE_ROUNDING',
        vesting_conditions: [
          { id: 'start', quantity: '1', trigger: { type: 'VESTING_START_DATE' }, next_condition_ids: ['a', 'b'] },
          { id: 'a', quantity: '1', trigger: { type: 'VESTING_EVENT' }, next_condition_ids: [] },
          {
            id: 'b',
            quantity: '1',
            trigger: {
              type: 'VESTING_SCHEDULE_RELATIVE',
              relative_to_condition_id: 'a',
              period: {
                type: 'MONTHS',
                length: 1,
                occurrences: 1,
                day_of_month: 'VESTING_START_DAY_OR_LAST_DAY_OF_MONTH',
              },
            },
            next_condition_ids: [],
          },
        ],
      };

      expectLossless('vestingTerms', terms);
    });
  });

  describe('reads of data the register holds', () => {
    test('a document related to a stock hold, the register’s own OCF extension, is read', () => {
      const document = damlDocumentDataToNative({
        id: 'doc-1',
        md5: 'd41d8cd98f00b204e9800998ecf8427e',
        path: './hold.pdf',
        uri: null,
        comments: [],
        related_objects: [{ object_id: 'hold-1', object_type: 'OcfObjectTypeTxStockHold' }],
      } as never);

      expect(document.related_objects).toEqual([{ object_id: 'hold-1', object_type: 'TX_STOCK_HOLD' }]);
    });
  });

  describe('replication comparison is exact', () => {
    test.each([
      ['12345678901234567890', '12345678901234567891'],
      ['9007199254740993', '9007199254740992'],
      ['0.00000000001', '0'],
      ['0x10', '16'],
      ['1e3', '1000'],
      ['a ', 'a'],
    ])('%p and %p differ', (left, right) => {
      expect(ocfDeepEqual({ value: left }, { value: right })).toBe(false);
    });

    test.each([
      ['100', '100.0000000000'],
      ['+5', '5'],
      ['.2', '0.2000000000'],
      ['22500', 22500],
    ] as const)('%p and %p are the same Numeric', (left, right) => {
      expect(ocfDeepEqual({ value: left }, { value: right })).toBe(true);
    });
  });
});
