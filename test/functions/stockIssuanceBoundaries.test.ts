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
import type { OcfIssuer, OcfStockIssuance } from '../../src/types/native';

const STOCK_ISSUANCE: OcfStockIssuance = {
  object_type: 'TX_STOCK_ISSUANCE',
  id: 'stock-issuance-1',
  date: '2026-07-10',
  security_id: 'security-1',
  custom_id: 'CS-1',
  stakeholder_id: 'stakeholder-1',
  board_approval_date: '2026-07-09',
  stockholder_approval_date: '2026-07-08',
  consideration_text: 'Cash consideration',
  security_law_exemptions: [{ description: 'Reg D', jurisdiction: 'US' }],
  stock_class_id: 'stock-class-1',
  stock_plan_id: 'stock-plan-1',
  share_numbers_issued: [{ starting_share_number: '+0001.0000000000', ending_share_number: '2.0' }],
  share_price: { amount: '-0.0000000000', currency: 'USD' },
  quantity: '+0010.5000000000',
  vesting_terms_id: 'vesting-terms-1',
  vestings: [{ date: '2027-07-10', amount: '10.5000000000' }],
  cost_basis: { amount: '0.0000000000', currency: 'USD' },
  stock_legend_ids: ['legend-1'],
  issuance_type: 'RSA',
  comments: ['Issued for cash', 'Board approved'],
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
  test('round-trips exact Numeric(10) and validated text on every public surface', async () => {
    const direct = stockIssuanceDataToDaml(STOCK_ISSUANCE);
    const dispatched = convertToDaml('stockIssuance', STOCK_ISSUANCE);
    const operation = convertOperationToDaml({ type: 'stockIssuance', data: STOCK_ISSUANCE });

    expect(dispatched).toEqual(direct);
    expect(operation).toEqual(direct);
    expect(direct).toMatchObject({
      consideration_text: 'Cash consideration',
      stock_plan_id: 'stock-plan-1',
      vesting_terms_id: 'vesting-terms-1',
      comments: ['Issued for cash', 'Board approved'],
      security_law_exemptions: [{ description: 'Reg D', jurisdiction: 'US' }],
      stock_legend_ids: ['legend-1'],
      quantity: '10.5',
      share_price: { amount: '0', currency: 'USD' },
      share_numbers_issued: [{ starting_share_number: '1', ending_share_number: '2' }],
    });

    const native = damlStockIssuanceDataToNative(direct);
    expect(convertToOcf('stockIssuance', direct)).toEqual(native);
    expect(native).toMatchObject({
      consideration_text: 'Cash consideration',
      stock_plan_id: 'stock-plan-1',
      vesting_terms_id: 'vesting-terms-1',
      comments: ['Issued for cash', 'Board approved'],
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

  test('generic writers recursively freeze exact generated output without freezing caller input', () => {
    const dispatched = convertToDaml('stockIssuance', STOCK_ISSUANCE);
    const operation = convertOperationToDaml({ type: 'stockIssuance', data: STOCK_ISSUANCE });

    for (const output of [dispatched, operation]) {
      expect(Object.isFrozen(output)).toBe(true);
      expect(Object.isFrozen(output.share_price)).toBe(true);
      expect(Object.isFrozen(output.comments)).toBe(true);
      expect(Object.isFrozen(output.vestings)).toBe(true);
      expect(Object.isFrozen(output.vestings[0])).toBe(true);
      expect(Reflect.set(output, 'id', 'replacement')).toBe(false);
      expect(Reflect.set(output.comments, '0', 'replacement')).toBe(false);
    }

    expect(Object.isFrozen(STOCK_ISSUANCE)).toBe(false);
    expect(Object.isFrozen(STOCK_ISSUANCE.vestings)).toBe(false);

    const taxIds = [{ country: 'US', tax_id: '12-3456789' }];
    const issuer: OcfIssuer = {
      object_type: 'ISSUER',
      id: 'issuer-1',
      legal_name: 'Issuer One',
      formation_date: '2026-07-10',
      country_of_formation: 'US',
      tax_ids: taxIds,
    };
    const issuerOutput = convertToDaml('issuer', issuer);
    expect(Object.isFrozen(issuerOutput.tax_ids)).toBe(true);
    expect(Object.isFrozen(issuerOutput.tax_ids[0])).toBe(true);
    expect(issuerOutput.tax_ids).not.toBe(issuer.tax_ids);
    expect(Object.isFrozen(taxIds)).toBe(false);
    expect(Object.isFrozen(taxIds[0])).toBe(false);
  });

  test('named ledger reader returns the canonical {event, contractId} shape', async () => {
    const data = stockIssuanceDataToDaml(STOCK_ISSUANCE);
    await expect(getStockIssuanceAsOcf(ledgerFor(data), { contractId: 'stock-issuance-cid' })).resolves.toEqual({
      event: damlStockIssuanceDataToNative(data),
      contractId: 'stock-issuance-cid',
    });
  });

  test('accepts the documented empty stock legend list', () => {
    const input = { ...STOCK_ISSUANCE, stock_legend_ids: [] };
    const daml = stockIssuanceDataToDaml(input);
    expect(daml.stock_legend_ids).toEqual([]);
    expect(damlStockIssuanceDataToNative(daml).stock_legend_ids).toEqual([]);
  });

  test.each(['id', 'security_id', 'custom_id', 'stakeholder_id', 'stock_class_id'] as const)(
    'rejects a present empty required Text in %s on direct, dispatcher, and operation surfaces',
    (field) => {
      const input = { ...STOCK_ISSUANCE, [field]: '' };
      const expected = expect.objectContaining({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: `stockIssuance.${field}`,
      });
      expect(() => stockIssuanceDataToDaml(input)).toThrow(expected);
      expect(() => convertToDaml('stockIssuance', input)).toThrow(expected);
      expect(() => convertOperationToDaml({ type: 'stockIssuance', data: input })).toThrow(expected);
    }
  );

  test.each([
    {
      name: 'consideration_text',
      fieldPath: 'stockIssuance.consideration_text',
      mutate: (value: Record<string, unknown>) => {
        value.consideration_text = '';
      },
    },
    {
      name: 'stock_plan_id',
      fieldPath: 'stockIssuance.stock_plan_id',
      mutate: (value: Record<string, unknown>) => {
        value.stock_plan_id = '';
      },
    },
    {
      name: 'vesting_terms_id',
      fieldPath: 'stockIssuance.vesting_terms_id',
      mutate: (value: Record<string, unknown>) => {
        value.vesting_terms_id = '';
      },
    },
    {
      name: 'comments item',
      fieldPath: 'stockIssuance.comments[0]',
      mutate: (value: Record<string, unknown>) => {
        value.comments = [''];
      },
    },
    {
      name: 'exemption description',
      fieldPath: 'stockIssuance.security_law_exemptions[0].description',
      mutate: (value: Record<string, unknown>) => {
        value.security_law_exemptions = [{ description: '', jurisdiction: 'US' }];
      },
    },
    {
      name: 'exemption jurisdiction',
      fieldPath: 'stockIssuance.security_law_exemptions[0].jurisdiction',
      mutate: (value: Record<string, unknown>) => {
        value.security_law_exemptions = [{ description: 'Reg D', jurisdiction: '' }];
      },
    },
    {
      name: 'stock legend id',
      fieldPath: 'stockIssuance.stock_legend_ids[0]',
      mutate: (value: Record<string, unknown>) => {
        value.stock_legend_ids = [''];
      },
    },
  ])('rejects an empty $name symmetrically', ({ fieldPath, mutate }) => {
    const input = { ...STOCK_ISSUANCE } as unknown as Record<string, unknown>;
    mutate(input);
    const expected = expect.objectContaining({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath,
      receivedValue: '',
    });
    expect(() => stockIssuanceDataToDaml(input as unknown as OcfStockIssuance)).toThrow(expected);
    expect(() => convertToDaml('stockIssuance', input as unknown as OcfStockIssuance)).toThrow(expected);

    const daml = { ...stockIssuanceDataToDaml(STOCK_ISSUANCE) } as unknown as Record<string, unknown>;
    mutate(daml);
    expect(() => damlStockIssuanceDataToNative(daml as ReturnType<typeof stockIssuanceDataToDaml>)).toThrow(expected);
  });

  test.each([
    ['9999999999999999999999999999.1234567890', '9999999999999999999999999999.123456789'],
    ['1.2500000000', '1.25'],
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

  test.each(['0', '-1', '-0.0000000000'] as const)(
    'rejects non-positive stock quantity %s symmetrically',
    (quantity) => {
      const input = { ...STOCK_ISSUANCE, quantity };
      const expected = expect.objectContaining({
        code: OcpErrorCodes.OUT_OF_RANGE,
        fieldPath: 'stockIssuance.quantity',
      });
      expect(() => stockIssuanceDataToDaml(input)).toThrow(expected);
      expect(() => damlStockIssuanceDataToNative({ ...stockIssuanceDataToDaml(STOCK_ISSUANCE), quantity })).toThrow(
        expected
      );
    }
  );

  test.each(['0', '-1'] as const)('rejects non-positive stock vesting amount %s symmetrically', (amount) => {
    const vestings = [{ date: '2027-07-10', amount }];
    const expected = expect.objectContaining({
      code: OcpErrorCodes.OUT_OF_RANGE,
      fieldPath: 'stockIssuance.vestings[0].amount',
    });
    expect(() => stockIssuanceDataToDaml({ ...STOCK_ISSUANCE, vestings } as OcfStockIssuance)).toThrow(expected);
    expect(() => damlStockIssuanceDataToNative({ ...stockIssuanceDataToDaml(STOCK_ISSUANCE), vestings })).toThrow(
      expected
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

  test('accepts exponent-form generated Numeric while writers reject it', () => {
    expect(
      damlStockIssuanceDataToNative({ ...stockIssuanceDataToDaml(STOCK_ISSUANCE), quantity: '1e3' }).quantity
    ).toBe('1000');
    expect(() => stockIssuanceDataToDaml({ ...STOCK_ISSUANCE, quantity: '1e3' })).toThrow(
      expect.objectContaining({ code: OcpErrorCodes.INVALID_FORMAT, fieldPath: 'stockIssuance.quantity' })
    );
  });
});
