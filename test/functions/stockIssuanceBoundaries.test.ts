import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { convertToOcf, getEntityAsOcf } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { convertOperationToDaml, convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { stockIssuanceDataToDaml } from '../../src/functions/OpenCapTable/stockIssuance/createStockIssuance';
import {
  damlStockIssuanceDataToNative,
  getStockIssuanceAsOcf,
} from '../../src/functions/OpenCapTable/stockIssuance/getStockIssuanceAsOcf';
import { OcpClient } from '../../src/OcpClient';
import type { OcfStockIssuance } from '../../src/types/native';

const STOCK_ISSUANCE: OcfStockIssuance = {
  object_type: 'TX_STOCK_ISSUANCE',
  id: 'stock-issuance-1',
  date: '2026-07-10',
  security_id: 'security-1',
  custom_id: 'CS-1',
  stakeholder_id: 'stakeholder-1',
  board_approval_date: '2026-07-09',
  stockholder_approval_date: '2026-07-08',
  consideration_text: '',
  security_law_exemptions: [{ description: '', jurisdiction: '' }],
  stock_class_id: 'stock-class-1',
  stock_plan_id: '',
  share_numbers_issued: [{ starting_share_number: '+0001.0000000000', ending_share_number: '2.0' }],
  share_price: { amount: '-0.0000000000', currency: 'USD' },
  quantity: '+0010.5000000000',
  vesting_terms_id: '',
  vestings: [{ date: '2027-07-10', amount: '10.5000000000' }],
  cost_basis: { amount: '0.0000000000', currency: 'USD' },
  stock_legend_ids: [''],
  issuance_type: 'RSA',
  comments: ['', ''],
};

function ledgerFor(data: ReturnType<typeof stockIssuanceDataToDaml>): LedgerJsonApiClient {
  return {
    getNetwork: () => 'localnet',
    getActiveContracts: jest.fn(),
    getEventsByContractId: jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          contractId: 'stock-issuance-cid',
          templateId: '#OpenCapTable-v34:Fairmint.OpenCapTable.OCF.StockIssuance:StockIssuance',
          createArgument: {
            context: { issuer: 'issuer::1220', system_operator: 'operator::1220' },
            issuance_data: data,
          },
        },
      },
    }),
    submitAndWaitForTransactionTree: jest.fn(),
  } as unknown as LedgerJsonApiClient;
}

describe('stock issuance exact boundaries', () => {
  test('round-trips exact Numeric(10), empty text, and empty comments on every public surface', async () => {
    const direct = stockIssuanceDataToDaml(STOCK_ISSUANCE);
    const dispatched = convertToDaml('stockIssuance', STOCK_ISSUANCE);
    const operation = convertOperationToDaml({ type: 'stockIssuance', data: STOCK_ISSUANCE });

    expect(dispatched).toEqual(direct);
    expect(operation).toEqual(direct);
    expect(direct).toMatchObject({
      consideration_text: '',
      stock_plan_id: '',
      vesting_terms_id: '',
      comments: ['', ''],
      security_law_exemptions: [{ description: '', jurisdiction: '' }],
      stock_legend_ids: [''],
      quantity: '10.5',
      share_price: { amount: '0', currency: 'USD' },
      share_numbers_issued: [{ starting_share_number: '1', ending_share_number: '2' }],
    });

    const native = damlStockIssuanceDataToNative(direct);
    expect(convertToOcf('stockIssuance', direct)).toEqual(native);
    expect(native).toMatchObject({
      consideration_text: '',
      stock_plan_id: '',
      vesting_terms_id: '',
      comments: ['', ''],
      quantity: '10.5',
      share_price: { amount: '0', currency: 'USD' },
    });

    await expect(getEntityAsOcf(ledgerFor(direct), 'stockIssuance', 'stock-issuance-cid')).resolves.toEqual({
      data: native,
      contractId: 'stock-issuance-cid',
    });
    const namespaceOcp = new OcpClient({ ledger: ledgerFor(direct) });
    await expect(namespaceOcp.OpenCapTable.stockIssuance.get({ contractId: 'stock-issuance-cid' })).resolves.toEqual({
      data: native,
      contractId: 'stock-issuance-cid',
    });
    const literalOcp = new OcpClient({ ledger: ledgerFor(direct) });
    await expect(
      literalOcp.OpenCapTable.getByObjectType({
        objectType: 'TX_STOCK_ISSUANCE',
        contractId: 'stock-issuance-cid',
      })
    ).resolves.toEqual({ data: native, contractId: 'stock-issuance-cid' });
  });

  test.each([
    ['direct', (value: OcfStockIssuance) => stockIssuanceDataToDaml(value)],
    ['dispatcher', (value: OcfStockIssuance) => convertToDaml('stockIssuance', value)],
  ] as const)('%s writer requires the exact canonical object_type', (_surface, write) => {
    for (const value of [
      { ...STOCK_ISSUANCE, object_type: undefined },
      { ...STOCK_ISSUANCE, object_type: 'TX_WARRANT_ISSUANCE' },
    ]) {
      expect(() => write(value as unknown as OcfStockIssuance)).toThrow(
        expect.objectContaining({
          fieldPath: 'stockIssuance.object_type',
          code: value.object_type === undefined ? OcpErrorCodes.REQUIRED_FIELD_MISSING : OcpErrorCodes.INVALID_FORMAT,
        })
      );
    }
  });

  test('writer rejects accessor-backed input without invoking the accessor', () => {
    let getterCalls = 0;
    const input = { ...STOCK_ISSUANCE } as Record<string, unknown>;
    Object.defineProperty(input, 'quantity', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return '10';
      },
    });

    expect(() => stockIssuanceDataToDaml(input as unknown as OcfStockIssuance)).toThrow(OcpValidationError);
    expect(getterCalls).toBe(0);
  });

  test('named ledger reader returns the canonical {event, contractId} shape', async () => {
    const data = stockIssuanceDataToDaml(STOCK_ISSUANCE);
    await expect(getStockIssuanceAsOcf(ledgerFor(data), { contractId: 'stock-issuance-cid' })).resolves.toEqual({
      event: damlStockIssuanceDataToNative(data),
      contractId: 'stock-issuance-cid',
    });
  });

  test.each(['id', 'security_id', 'custom_id', 'stakeholder_id', 'stock_class_id'] as const)(
    'preserves a present empty Text in %s on direct, dispatcher, operation, and named-reader surfaces',
    async (field) => {
      const input = { ...STOCK_ISSUANCE, [field]: '' };
      const direct = stockIssuanceDataToDaml(input);
      expect(convertToDaml('stockIssuance', input)).toEqual(direct);
      expect(convertOperationToDaml({ type: 'stockIssuance', data: input })).toEqual(direct);
      expect(damlStockIssuanceDataToNative(direct)[field]).toBe('');
      await expect(
        getStockIssuanceAsOcf(ledgerFor(direct), { contractId: 'stock-issuance-cid' })
      ).resolves.toMatchObject({ event: { [field]: '' } });
    }
  );

  test.each([
    ['9999999999999999999999999999.1234567890', '9999999999999999999999999999.123456789'],
    ['-1.2500000000', '-1.25'],
    ['-0.0000000000', '0'],
  ] as const)('round-trips generic stock quantity boundary %s as %s', async (quantity, expected) => {
    const input = { ...STOCK_ISSUANCE, quantity };
    const direct = stockIssuanceDataToDaml(input);
    expect(convertToDaml('stockIssuance', input)).toEqual(direct);
    expect(direct.quantity).toBe(expected);
    expect(damlStockIssuanceDataToNative(direct).quantity).toBe(expected);
    await expect(getStockIssuanceAsOcf(ledgerFor(direct), { contractId: 'stock-issuance-cid' })).resolves.toMatchObject(
      { event: { quantity: expected } }
    );
  });

  test.each([
    ['starting_share_number', '0'],
    ['starting_share_number', '-1'],
    ['ending_share_number', '0'],
    ['ending_share_number', '-1'],
  ] as const)('rejects non-positive share range %s=%s symmetrically', (field, value) => {
    const share_numbers_issued = [{ starting_share_number: '1', ending_share_number: '2', [field]: value }];
    const input = { ...STOCK_ISSUANCE, share_numbers_issued };
    expect(() => stockIssuanceDataToDaml(input)).toThrow(
      expect.objectContaining({
        code: OcpErrorCodes.OUT_OF_RANGE,
        fieldPath: `stockIssuance.share_numbers_issued[0].${field}`,
      })
    );

    const daml = { ...stockIssuanceDataToDaml(STOCK_ISSUANCE), share_numbers_issued };
    expect(() => damlStockIssuanceDataToNative(daml)).toThrow(
      expect.objectContaining({
        code: OcpErrorCodes.OUT_OF_RANGE,
        fieldPath: `stockIssuance.share_numbers_issued[0].${field}`,
      })
    );
  });

  test('rejects a reversed share-number range symmetrically', () => {
    const share_numbers_issued = [{ starting_share_number: '2', ending_share_number: '1' }];
    const input = { ...STOCK_ISSUANCE, share_numbers_issued };
    expect(() => stockIssuanceDataToDaml(input)).toThrow(
      expect.objectContaining({
        code: OcpErrorCodes.OUT_OF_RANGE,
        fieldPath: 'stockIssuance.share_numbers_issued[0].ending_share_number',
      })
    );
    const daml = { ...stockIssuanceDataToDaml(STOCK_ISSUANCE), share_numbers_issued };
    expect(() => damlStockIssuanceDataToNative(daml)).toThrow(
      expect.objectContaining({
        code: OcpErrorCodes.OUT_OF_RANGE,
        fieldPath: 'stockIssuance.share_numbers_issued[0].ending_share_number',
      })
    );
  });

  test.each(['share_price', 'cost_basis'] as const)(
    'enforces nonnegative exact Monetary for %s on both boundaries',
    (field) => {
      const input = { ...STOCK_ISSUANCE, [field]: { amount: '-1', currency: 'USD' } };
      expect(() => stockIssuanceDataToDaml(input)).toThrow(
        expect.objectContaining({ code: OcpErrorCodes.OUT_OF_RANGE, fieldPath: `stockIssuance.${field}.amount` })
      );
      const daml = {
        ...stockIssuanceDataToDaml(STOCK_ISSUANCE),
        [field]: { amount: '-1', currency: 'USD' },
      };
      expect(() => damlStockIssuanceDataToNative(daml)).toThrow(
        expect.objectContaining({ code: OcpErrorCodes.OUT_OF_RANGE, fieldPath: `stockIssuance.${field}.amount` })
      );
    }
  );

  test('public stock readers reject a negative Monetary amount consistently', async () => {
    const data = {
      ...stockIssuanceDataToDaml(STOCK_ISSUANCE),
      share_price: { amount: '-1', currency: 'USD' },
    };
    const expected = {
      code: OcpErrorCodes.OUT_OF_RANGE,
      fieldPath: 'stockIssuance.share_price.amount',
    };

    await expect(getStockIssuanceAsOcf(ledgerFor(data), { contractId: 'stock-issuance-cid' })).rejects.toMatchObject(
      expected
    );
    await expect(getEntityAsOcf(ledgerFor(data), 'stockIssuance', 'stock-issuance-cid')).rejects.toMatchObject(
      expected
    );
    const namespaceOcp = new OcpClient({ ledger: ledgerFor(data) });
    await expect(
      namespaceOcp.OpenCapTable.stockIssuance.get({ contractId: 'stock-issuance-cid' })
    ).rejects.toMatchObject(expected);
    const literalOcp = new OcpClient({ ledger: ledgerFor(data) });
    await expect(
      literalOcp.OpenCapTable.getByObjectType({
        objectType: 'TX_STOCK_ISSUANCE',
        contractId: 'stock-issuance-cid',
      })
    ).rejects.toMatchObject(expected);
  });

  test('rejects an overlong all-zero Numeric instead of normalizing unbounded input', () => {
    const value = '0'.repeat(257);
    expect(() => stockIssuanceDataToDaml({ ...STOCK_ISSUANCE, quantity: value })).toThrow(
      expect.objectContaining({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'stockIssuance.quantity',
      })
    );
    expect(() =>
      damlStockIssuanceDataToNative({ ...stockIssuanceDataToDaml(STOCK_ISSUANCE), quantity: value })
    ).toThrow(
      expect.objectContaining({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'stockIssuance.quantity',
      })
    );
  });

  test('accepts the exponent syntax supported by the generated Numeric(10) codec', () => {
    expect(
      damlStockIssuanceDataToNative({ ...stockIssuanceDataToDaml(STOCK_ISSUANCE), quantity: '1e3' }).quantity
    ).toBe('1000');
  });

  test('rejects malformed generated Numeric(10) beyond its scale', () => {
    const data = {
      ...stockIssuanceDataToDaml(STOCK_ISSUANCE),
      share_price: { amount: '0.00000000001', currency: 'USD' },
    };
    expect(() => damlStockIssuanceDataToNative(data)).toThrow(
      expect.objectContaining({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'stockIssuance.share_price.amount',
      })
    );
  });
});
