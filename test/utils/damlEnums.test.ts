/**
 * Pins the v35 enum rule: every constructor of a generated Daml enum is `<TypeName><PascalCase(OCF value)>`, in the
 * order of OCF's enum schema, so the SDK can derive a constructor from an OCF value and back.
 */

import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import fs from 'fs';
import path from 'path';
import { OcpErrorCodes, OcpParseError } from '../../src/errors';
import {
  DAML_ENUM_TYPE_NAMES,
  OCF_ENUM_VALUES,
  damlEnumConstructor,
  damlEnumConstructorFromInput,
  damlEnumConstructors,
  isDamlEnumConstructor,
  isOcfEnumValue,
  ocfEnumValue,
  pascalCaseOcfValue,
  type DamlEnumTypeName,
} from '../../src/utils/damlEnums';

const ENUM_SCHEMA_DIR = path.join(__dirname, '../../libs/Open-Cap-Format-OCF/schema/enums');
const EXTENSION_ENUM_SCHEMA_DIR = path.join(__dirname, '../../schemas/ocf-extension/enums');

/** Enums the Fairmint OCF extension defines or amends; their schemas live in `schemas/ocf-extension`. */
const EXTENSION_ENUMS = new Set(['OcfHoldType', 'OcfObjectType']);

/** Generated enums that exist for the register itself or for records the converters do not write (yet). */
const ENUMS_WITHOUT_OCF_COUNTERPART = new Set(['CapTableStatus', 'DerivedRole', 'IdNamespace']);

/**
 * The one enum whose constructors are not the whole OCF schema: `OcfObjectType` omits the seven `TX_PLAN_SECURITY_*`
 * aliases (writers normalize them to `TX_EQUITY_COMPENSATION_*`) and ends with the two Fairmint hold types, as its Daml
 * source documents. The extension's amended `ObjectType` schema carries OCF's values and then the two hold types.
 */
const OBJECT_TYPE_HOLD_VALUES = ['TX_STOCK_HOLD', 'TX_STOCK_HOLD_CANCELLATION'];

function enumSchemaFile(typeName: string): string {
  const dir = EXTENSION_ENUMS.has(typeName) ? EXTENSION_ENUM_SCHEMA_DIR : ENUM_SCHEMA_DIR;
  return path.join(dir, `${typeName.replace(/^Ocf/, '')}.schema.json`);
}

function schemaEnumValues(typeName: string): string[] {
  const schema = JSON.parse(fs.readFileSync(enumSchemaFile(typeName), 'utf8')) as { enum: string[] };
  return schema.enum;
}

function expectedOcfValues(typeName: string): string[] {
  const values = schemaEnumValues(typeName);
  if (typeName !== 'OcfObjectType') return values;
  return values.filter((value) => !value.startsWith('TX_PLAN_SECURITY_'));
}

/** Every generated enum, found by walking the generated `Fairmint` namespace. */
function generatedEnums(): Map<string, readonly string[]> {
  const found = new Map<string, readonly string[]>();
  const seen = new Set<unknown>();
  const walk = (node: unknown, name: string): void => {
    if (node === null || (typeof node !== 'object' && typeof node !== 'function') || seen.has(node)) return;
    seen.add(node);
    const candidate = node as { keys?: unknown; decoder?: unknown };
    if (
      Array.isArray(candidate.keys) &&
      candidate.keys.every((key) => typeof key === 'string') &&
      typeof candidate.decoder === 'object'
    ) {
      found.set(name, candidate.keys);
      return;
    }
    for (const [key, child] of Object.entries(node)) walk(child, key);
  };
  walk(Fairmint, 'Fairmint');
  return found;
}

describe('damlEnums', () => {
  describe('the v35 enum rule', () => {
    test.each(DAML_ENUM_TYPE_NAMES)('%s: generated keys equal the rule applied to the OCF values, in order', (name) => {
      const expected = expectedOcfValues(name).map((value) => `${name}${pascalCaseOcfValue(value)}`);

      expect([...damlEnumConstructors(name)]).toEqual(expected);
      expect([...generatedEnums().get(name)!]).toEqual(expected);
    });

    test.each(DAML_ENUM_TYPE_NAMES)('%s: the SDK carries exactly the OCF values, in order', (name) => {
      expect([...OCF_ENUM_VALUES[name]]).toEqual(expectedOcfValues(name));
    });

    test('covers every generated enum that has an OCF counterpart', () => {
      const covered = new Set<string>(DAML_ENUM_TYPE_NAMES);
      const uncovered = [...generatedEnums().keys()].filter(
        (name) => !covered.has(name) && !ENUMS_WITHOUT_OCF_COUNTERPART.has(name)
      );

      expect(uncovered).toEqual([]);
    });

    test('lists no enum the generated package does not have', () => {
      const generated = generatedEnums();

      expect(DAML_ENUM_TYPE_NAMES.filter((name) => !generated.has(name))).toEqual([]);
    });

    test('documents the object type exception: no plan-security aliases, hold types appended', () => {
      const constructors = damlEnumConstructors('OcfObjectType');

      expect(constructors).not.toContain('OcfObjectTypeTxPlanSecurityIssuance');
      expect(constructors.slice(-2)).toEqual(['OcfObjectTypeTxStockHold', 'OcfObjectTypeTxStockHoldCancellation']);
      expect(constructors).toHaveLength(schemaEnumValues('OcfObjectType').length - 7);
    });

    test("the extension's ObjectType is OCF's ObjectType followed by the two hold types", () => {
      const ocfValues = (
        JSON.parse(fs.readFileSync(path.join(ENUM_SCHEMA_DIR, 'ObjectType.schema.json'), 'utf8')) as {
          enum: string[];
        }
      ).enum;

      expect(schemaEnumValues('OcfObjectType')).toEqual([...ocfValues, ...OBJECT_TYPE_HOLD_VALUES]);
    });

    test('the hold type enum is the extension HoldType schema', () => {
      expect(schemaEnumValues('OcfHoldType')).toEqual(['REGISTER_SETTLEMENT', 'STOP_TRANSFER']);
      expect([...damlEnumConstructors('OcfHoldType')]).toEqual([
        'OcfHoldTypeRegisterSettlement',
        'OcfHoldTypeStopTransfer',
      ]);
    });
  });

  describe('pascalCaseOcfValue', () => {
    test.each([
      ['FOUNDERS_STOCK', 'FoundersStock'],
      ['30_360', '30360'],
      ['409A', '409a'],
      ['ACTUAL_365', 'Actual365'],
      ['NOT APPLICABLE', 'NotApplicable'],
      ['TX_STOCK_ISSUANCE', 'TxStockIssuance'],
      ['OPTION_NSO', 'OptionNso'],
      ['29_OR_LAST_DAY_OF_MONTH', '29OrLastDayOfMonth'],
      ['VESTING_START_DAY_OR_LAST_DAY_OF_MONTH', 'VestingStartDayOrLastDayOfMonth'],
      ['01', '01'],
    ])('%s -> %s', (value, expected) => {
      expect(pascalCaseOcfValue(value)).toBe(expected);
    });
  });

  describe('damlEnumConstructor and ocfEnumValue', () => {
    test.each([
      ['OcfStockIssuanceType', 'FOUNDERS_STOCK', 'OcfStockIssuanceTypeFoundersStock'],
      ['OcfStockIssuanceType', 'RSA', 'OcfStockIssuanceTypeRsa'],
      ['OcfDayCountType', '30_360', 'OcfDayCountType30360'],
      ['OcfValuationType', '409A', 'OcfValuationType409a'],
      ['OcfObjectType', 'TX_STOCK_ISSUANCE', 'OcfObjectTypeTxStockIssuance'],
      ['OcfAuthorizedShares', 'NOT APPLICABLE', 'OcfAuthorizedSharesNotApplicable'],
      ['OcfEmailType', 'PERSONAL', 'OcfEmailTypePersonal'],
      ['OcfStakeholderRelationshipType', 'NON_US_EMPLOYEE', 'OcfStakeholderRelationshipTypeNonUsEmployee'],
      [
        'OcfVestingDayOfMonth',
        'VESTING_START_DAY_OR_LAST_DAY_OF_MONTH',
        'OcfVestingDayOfMonthVestingStartDayOrLastDayOfMonth',
      ],
    ] as const)('%s: %s <-> %s', (typeName, ocfValue, constructor) => {
      expect(damlEnumConstructor(typeName, ocfValue)).toBe(constructor);
      expect(ocfEnumValue(typeName, constructor)).toBe(ocfValue);
    });

    test.each(DAML_ENUM_TYPE_NAMES)('%s: every OCF value round-trips through its constructor', (name) => {
      for (const value of OCF_ENUM_VALUES[name]) {
        const constructor = damlEnumConstructor(name, value);
        expect(isDamlEnumConstructor(name, constructor)).toBe(true);
        expect(ocfEnumValue(name, constructor)).toBe(value);
      }
    });

    test('rejects an OCF value the generated enum has no constructor for', () => {
      // The register has no constructor for the plan-security aliases: writers normalize them first.
      const plan = 'TX_PLAN_SECURITY_ISSUANCE' as never;

      expect(() => damlEnumConstructor('OcfObjectType', plan, 'doc.related_objects[0].object_type')).toThrow(
        expect.objectContaining({
          name: 'OcpParseError',
          code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
          source: 'doc.related_objects[0].object_type',
        })
      );
    });

    test.each([undefined, null, 42, {}, 'constructor', 'toString', '__proto__', 'founders_stock', ''])(
      'rejects the non-value %p instead of guessing a constructor',
      (value) => {
        expect(() => damlEnumConstructor('OcfStockIssuanceType', value as never)).toThrow(OcpParseError);
        expect(() => damlEnumConstructorFromInput('OcfStockIssuanceType', value)).toThrow(OcpParseError);
        expect(() => ocfEnumValue('OcfStockIssuanceType', value as never)).toThrow(OcpParseError);
      }
    );

    test('rejects a constructor of another enum and a v34 constructor', () => {
      expect(() => ocfEnumValue('OcfStockIssuanceType', 'OcfDayCountType30360')).toThrow(
        expect.objectContaining({ code: OcpErrorCodes.UNKNOWN_ENUM_VALUE })
      );
      expect(() => ocfEnumValue('OcfStockIssuanceType', 'OcfStockIssuanceRSA')).toThrow(OcpParseError);
      expect(() => ocfEnumValue('OcfDayCountType', 'OcfDayCount30_360')).toThrow(OcpParseError);
    });

    test('reads the source into the error for both directions', () => {
      expect(() => ocfEnumValue('OcfPeriodType', 'OcfPeriodDays', 'issuance.period_type')).toThrow(
        expect.objectContaining({ source: 'issuance.period_type' })
      );
      expect(() => damlEnumConstructorFromInput('OcfPeriodType', 'WEEKS', 'issuance.period_type')).toThrow(
        expect.objectContaining({ source: 'issuance.period_type' })
      );
    });

    test('defaults the error source to the enum type name', () => {
      expect(() => ocfEnumValue('OcfPeriodType', 'nope')).toThrow(expect.objectContaining({ source: 'OcfPeriodType' }));
    });
  });

  describe('type guards', () => {
    test('isOcfEnumValue and isDamlEnumConstructor accept exactly the values of one enum', () => {
      const name: DamlEnumTypeName = 'OcfRoundingType';

      expect(isOcfEnumValue(name, 'CEILING')).toBe(true);
      expect(isOcfEnumValue(name, 'OcfRoundingTypeCeiling')).toBe(false);
      expect(isDamlEnumConstructor(name, 'OcfRoundingTypeCeiling')).toBe(true);
      expect(isDamlEnumConstructor(name, 'CEILING')).toBe(false);
      expect(isDamlEnumConstructor(name, 'OcfRoundingCeiling')).toBe(false);
      expect(isOcfEnumValue(name, 42)).toBe(false);
      expect(isDamlEnumConstructor(name, undefined)).toBe(false);
    });
  });
});
