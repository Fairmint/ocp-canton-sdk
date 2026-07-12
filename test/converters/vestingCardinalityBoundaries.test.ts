import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { equityCompensationIssuanceDataToDaml } from '../../src/functions/OpenCapTable/equityCompensationIssuance/createEquityCompensationIssuance';
import { stockIssuanceDataToDaml } from '../../src/functions/OpenCapTable/stockIssuance/createStockIssuance';
import { warrantIssuanceDataToDaml } from '../../src/functions/OpenCapTable/warrantIssuance/createWarrantIssuance';
import { parseOcfObject } from '../../src/utils/ocfZodSchemas';

interface EncodedIssuance {
  readonly vestings: ReadonlyArray<{ readonly amount: string; readonly date: string }>;
}

interface VestingWriterCase {
  readonly base: Readonly<Record<string, unknown>>;
  readonly label: string;
  readonly path: string;
  readonly write: (input: Record<string, unknown>) => EncodedIssuance;
}

function captureValidationError(action: () => unknown): OcpValidationError {
  try {
    action();
  } catch (error) {
    if (error instanceof OcpValidationError) return error;
    throw error;
  }
  throw new Error('Expected vesting cardinality validation to fail');
}

const cases: readonly VestingWriterCase[] = [
  {
    label: 'StockIssuance',
    path: 'stockIssuance.vestings',
    base: {
      object_type: 'TX_STOCK_ISSUANCE',
      id: 'stock-issuance-1',
      date: '2026-01-01',
      security_id: 'stock-security-1',
      custom_id: 'CS-1',
      stakeholder_id: 'stakeholder-1',
      stock_class_id: 'stock-class-1',
      share_price: { amount: '1', currency: 'USD' },
      quantity: '100',
      security_law_exemptions: [],
      stock_legend_ids: [],
    },
    write: (input) => stockIssuanceDataToDaml(input as never),
  },
  {
    label: 'EquityCompensationIssuance',
    path: 'equityCompensationIssuance.vestings',
    base: {
      object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
      id: 'equity-issuance-1',
      date: '2026-01-01',
      security_id: 'equity-security-1',
      custom_id: 'EQ-1',
      stakeholder_id: 'stakeholder-1',
      compensation_type: 'RSU',
      quantity: '100',
      expiration_date: null,
      termination_exercise_windows: [],
      security_law_exemptions: [],
    },
    write: (input) => equityCompensationIssuanceDataToDaml(input as never) as unknown as EncodedIssuance,
  },
  {
    label: 'WarrantIssuance',
    path: 'warrantIssuance.vestings',
    base: {
      object_type: 'TX_WARRANT_ISSUANCE',
      id: 'warrant-issuance-1',
      date: '2026-01-01',
      security_id: 'warrant-security-1',
      custom_id: 'W-1',
      stakeholder_id: 'stakeholder-1',
      purchase_price: { amount: '1', currency: 'USD' },
      exercise_triggers: [],
      security_law_exemptions: [],
    },
    write: (input) => warrantIssuanceDataToDaml(input as never),
  },
];

describe('optional schema-non-empty vesting boundaries', () => {
  it.each(cases)(
    '$label rejects explicitly present [] in both schema and writer runtime boundaries',
    ({ base, path, write }) => {
      expect(parseOcfObject(base)).toBeDefined();
      expect(() => parseOcfObject({ ...base, vestings: [] })).toThrow('must NOT have fewer than 1 items');

      expect(captureValidationError(() => write({ ...base, vestings: [] }))).toMatchObject({
        code: OcpErrorCodes.OUT_OF_RANGE,
        fieldPath: path,
        receivedValue: [],
      });
    }
  );

  it.each(cases)('$label maps OCF omission to the DAML [] representation', ({ base, write }) => {
    expect(write({ ...base }).vestings).toEqual([]);
  });

  it.each(cases)('$label preserves a schema-valid zero-amount vesting row', ({ base, write }) => {
    const input = { ...base, vestings: [{ date: '2026-02-01', amount: '0' }] };
    expect(parseOcfObject(input)).toMatchObject({ vestings: [{ date: '2026-02-01', amount: '0' }] });
    expect(write(input).vestings).toEqual([{ date: '2026-02-01T00:00:00.000Z', amount: '0' }]);
  });
});
