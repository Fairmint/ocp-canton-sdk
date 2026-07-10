import fs from 'fs';
import path from 'path';
import { OcpValidationError } from '../../src/errors';
import { parseOcfObject } from '../../src/utils/ocfZodSchemas';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function loadFixture(relativePath: string, nestedDb = true): Record<string, unknown> {
  const parsed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', relativePath), 'utf8')) as unknown;
  if (!isRecord(parsed)) throw new Error(`Fixture is not an object: ${relativePath}`);
  const fixture = nestedDb ? parsed.db : parsed;
  if (!isRecord(fixture)) throw new Error(`Fixture has no object payload: ${relativePath}`);
  return Object.fromEntries(Object.entries(fixture).filter(([property]) => property !== '_source'));
}

const nonEmptyArrayCases: Array<{
  input: Record<string, unknown>;
  label: string;
  property: string;
}> = [
  {
    input: loadFixture('createOcf/STOCK_PLAN-8cac3fcd-7fdf-41d2-9583-4bdf912629e0.json'),
    label: 'StockPlan.stock_class_ids',
    property: 'stock_class_ids',
  },
  {
    input: loadFixture('createOcf/VESTING_TERMS-54ea76f8-38c1-4552-bb8b-ee19625ab1d4.json'),
    label: 'VestingTerms.vesting_conditions',
    property: 'vesting_conditions',
  },
  {
    input: {
      object_type: 'FINANCING',
      id: 'financing-1',
      name: 'Series A',
      issuance_ids: ['issuance-1'],
      date: '2026-01-01',
    },
    label: 'Financing.issuance_ids',
    property: 'issuance_ids',
  },
  {
    input: loadFixture('createOcf/TX_CONVERTIBLE_ISSUANCE-1d5b1aa2-2f4d-4022-83ec-c351e0d75189.json'),
    label: 'ConvertibleIssuance.conversion_triggers',
    property: 'conversion_triggers',
  },
  {
    input: loadFixture('createOcf/TX_STOCK_ISSUANCE-b4f7e9b5-81df-4559-b4d0-74d0c97ad1e0.json'),
    label: 'StockIssuance.vestings',
    property: 'vestings',
  },
  {
    input: loadFixture('createOcf/TX_EQUITY_COMPENSATION_ISSUANCE-4f728ee6-6fd0-4a8c-917b-6ba47877ce71.json'),
    label: 'EquityCompensationIssuance.vestings',
    property: 'vestings',
  },
  {
    input: loadFixture('createOcf/TX_WARRANT_ISSUANCE-22b896cb-92df-4fd8-9e52-d0d4112b3f98.json'),
    label: 'WarrantIssuance.vestings',
    property: 'vestings',
  },
  {
    input: loadFixture('createOcf/TX_STOCK_TRANSFER-e0d8df57-96b6-4368-9ab9-fdd9d6dbe1db.json'),
    label: 'StockTransfer.resulting_security_ids',
    property: 'resulting_security_ids',
  },
  {
    input: loadFixture('synthetic/warrantTransfer.json', false),
    label: 'WarrantTransfer.resulting_security_ids',
    property: 'resulting_security_ids',
  },
  {
    input: loadFixture('createOcf/TX_CONVERTIBLE_TRANSFER-c1d2e3f4-5a6b-7c8d-9e0f-a1b2c3d4e5f6.json'),
    label: 'ConvertibleTransfer.resulting_security_ids',
    property: 'resulting_security_ids',
  },
  {
    input: loadFixture('synthetic/equityCompensationTransfer.json', false),
    label: 'EquityCompensationTransfer.resulting_security_ids',
    property: 'resulting_security_ids',
  },
  {
    input: loadFixture('synthetic/stockConsolidation.json', false),
    label: 'StockConsolidation.security_ids',
    property: 'security_ids',
  },
];

describe('pinned non-empty top-level OCF arrays', () => {
  it.each(nonEmptyArrayCases)('rejects an empty $label array', ({ input, property }) => {
    expect(parseOcfObject(input)).toBeDefined();
    expect(() => parseOcfObject({ ...input, [property]: [] })).toThrow(OcpValidationError);
    expect(() => parseOcfObject({ ...input, [property]: [] })).toThrow('must NOT have fewer than 1 items');
  });
});
