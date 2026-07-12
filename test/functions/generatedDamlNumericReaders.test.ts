import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { type OcpErrorCode, OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { ENTITY_REGISTRY } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { getEntityAsOcf } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import {
  damlStockIssuanceDataToNative,
  getStockIssuanceAsOcf,
} from '../../src/functions/OpenCapTable/stockIssuance/getStockIssuanceAsOcf';
import { damlValuationToNative } from '../../src/functions/OpenCapTable/valuation/damlToOcf';
import { getValuationAsOcf } from '../../src/functions/OpenCapTable/valuation/getValuationAsOcf';

type DamlStockIssuance = Fairmint.OpenCapTable.OCF.StockIssuance.StockIssuanceOcfData;
type DamlValuation = Fairmint.OpenCapTable.OCF.Valuation.ValuationOcfData;

const GENERATED_CONTEXT = { issuer: 'issuer::party', system_operator: 'system-operator::party' } as const;

function stockIssuanceData(): DamlStockIssuance {
  return {
    id: 'issuance-1',
    custom_id: 'CS-1',
    date: '2026-01-01T00:00:00Z',
    quantity: '100',
    security_id: 'security-1',
    share_price: { amount: '1', currency: 'USD' },
    stakeholder_id: 'stakeholder-1',
    stock_class_id: 'stock-class-1',
    comments: [],
    security_law_exemptions: [],
    share_numbers_issued: [],
    stock_legend_ids: [],
    vestings: [],
    board_approval_date: null,
    consideration_text: null,
    cost_basis: null,
    issuance_type: null,
    stock_plan_id: null,
    stockholder_approval_date: null,
    vesting_terms_id: null,
  };
}

function valuationData(): DamlValuation {
  return {
    id: 'valuation-1',
    effective_date: '2026-01-01T00:00:00Z',
    price_per_share: { amount: '1', currency: 'USD' },
    stock_class_id: 'stock-class-1',
    valuation_type: 'OcfValuationType409A',
    comments: [],
    board_approval_date: null,
    provider: null,
    stockholder_approval_date: null,
  };
}

function invalidStockIssuance(overrides: Record<string, unknown>): DamlStockIssuance {
  return { ...stockIssuanceData(), ...overrides };
}

function invalidValuation(overrides: Record<string, unknown>): DamlValuation {
  return { ...valuationData(), ...overrides };
}

function mockEntityClient(
  entityType: 'stockIssuance' | 'valuation',
  contractId: string,
  data: DamlStockIssuance | DamlValuation
): LedgerJsonApiClient {
  const metadata = ENTITY_REGISTRY[entityType];
  return {
    getEventsByContractId: jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          contractId,
          templateId: metadata.templateId,
          createArgument: { context: GENERATED_CONTEXT, [metadata.dataField]: data },
        },
      },
    }),
  } as unknown as LedgerJsonApiClient;
}

describe('generated DAML Numeric and Monetary reader boundaries', () => {
  it.each([
    ['runtime number', 1, OcpErrorCodes.INVALID_TYPE],
    ['empty string', '', OcpErrorCodes.INVALID_FORMAT],
    ['eleven fractional digits', '1.12345678901', OcpErrorCodes.INVALID_FORMAT],
    ['twenty-nine integral digits', '1'.repeat(29), OcpErrorCodes.INVALID_FORMAT],
    ['zero', '0', OcpErrorCodes.OUT_OF_RANGE],
    ['negative value', '-1', OcpErrorCodes.OUT_OF_RANGE],
  ] as const)('rejects stock issuance quantity with %s', (_name, quantity, code) => {
    expect(() => damlStockIssuanceDataToNative(invalidStockIssuance({ quantity }))).toThrow(
      expect.objectContaining({
        name: OcpValidationError.name,
        code,
        fieldPath: 'stockIssuance.quantity',
        receivedValue: quantity,
      })
    );
  });

  it.each([
    ['share price', 'share_price'],
    ['cost basis', 'cost_basis'],
  ] as const)('rejects schema-invalid %s Monetary fields', (_name, field) => {
    for (const testCase of [
      {
        value: { amount: '1.12345678901', currency: 'USD' },
        path: `${field}.amount`,
        code: OcpErrorCodes.INVALID_FORMAT,
      },
      {
        value: { amount: '-1', currency: 'USD' },
        path: `${field}.amount`,
        code: OcpErrorCodes.OUT_OF_RANGE,
      },
      {
        value: { amount: '1', currency: 'usd' },
        path: `${field}.currency`,
        code: OcpErrorCodes.INVALID_FORMAT,
      },
      {
        value: { amount: '1', currency: 'USDX' },
        path: `${field}.currency`,
        code: OcpErrorCodes.INVALID_FORMAT,
      },
    ] as const) {
      expect(() => damlStockIssuanceDataToNative(invalidStockIssuance({ [field]: testCase.value }))).toThrow(
        expect.objectContaining({
          name: OcpValidationError.name,
          code: testCase.code,
          fieldPath: `stockIssuance.${testCase.path}`,
        })
      );
    }
  });

  it.each([
    {
      name: 'stock issuance share price',
      fieldPath: 'stockIssuance.share_price',
      invoke: (monetary: unknown) => damlStockIssuanceDataToNative(invalidStockIssuance({ share_price: monetary })),
    },
    {
      name: 'valuation price per share',
      fieldPath: 'valuation.price_per_share',
      invoke: (monetary: unknown) => damlValuationToNative(invalidValuation({ price_per_share: monetary })),
    },
  ])('$name rejects missing, null, wrong, and unknown Monetary fields with exact paths', ({ fieldPath, invoke }) => {
    const malformedValues: ReadonlyArray<{
      readonly value: unknown;
      readonly path: string;
      readonly code: OcpErrorCode;
    }> = [
      { value: null, path: fieldPath, code: OcpErrorCodes.REQUIRED_FIELD_MISSING },
      { value: [], path: fieldPath, code: OcpErrorCodes.INVALID_TYPE },
      { value: { currency: 'USD' }, path: `${fieldPath}.amount`, code: OcpErrorCodes.REQUIRED_FIELD_MISSING },
      { value: { amount: 1, currency: 'USD' }, path: `${fieldPath}.amount`, code: OcpErrorCodes.INVALID_TYPE },
      { value: { amount: '1' }, path: `${fieldPath}.currency`, code: OcpErrorCodes.REQUIRED_FIELD_MISSING },
      { value: { amount: '1', currency: 17 }, path: `${fieldPath}.currency`, code: OcpErrorCodes.INVALID_TYPE },
      {
        value: { amount: '1', currency: 'USD', unknown: true },
        path: `${fieldPath}.unknown`,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
      },
    ];

    for (const malformed of malformedValues) {
      expect(() => invoke(malformed.value)).toThrow(
        expect.objectContaining({
          name: OcpValidationError.name,
          code: malformed.code,
          fieldPath: malformed.path,
        })
      );
    }
  });

  it('canonicalizes generated exponent and negative-zero representations exactly', () => {
    const stockIssuance = damlStockIssuanceDataToNative(
      invalidStockIssuance({
        quantity: '1e2',
        share_price: { amount: '-0e20', currency: 'USD' },
        cost_basis: { amount: '12.3400000000e-1', currency: 'EUR' },
        vestings: [{ date: '2026-02-01T00:00:00Z', amount: '1e-10' }],
        share_numbers_issued: [{ starting_share_number: '1e0', ending_share_number: '2e0' }],
      })
    );

    expect(stockIssuance).toMatchObject({
      quantity: '100',
      share_price: { amount: '0', currency: 'USD' },
      cost_basis: { amount: '1.234', currency: 'EUR' },
      vestings: [{ date: '2026-02-01', amount: '0.0000000001' }],
      share_numbers_issued: [{ starting_share_number: '1', ending_share_number: '2' }],
    });
  });

  it.each([
    [{ amount: '1.12345678901', currency: 'USD' }, 'valuation.price_per_share.amount', OcpErrorCodes.INVALID_FORMAT],
    [{ amount: '-1', currency: 'USD' }, 'valuation.price_per_share.amount', OcpErrorCodes.OUT_OF_RANGE],
    [{ amount: '1', currency: 'usd!' }, 'valuation.price_per_share.currency', OcpErrorCodes.INVALID_FORMAT],
  ] as const)('rejects malformed valuation price_per_share %#', (pricePerShare, fieldPath, code) => {
    expect(() => damlValuationToNative(invalidValuation({ price_per_share: pricePerShare }))).toThrow(
      expect.objectContaining({ name: OcpValidationError.name, code, fieldPath })
    );
  });

  it('canonicalizes a valid exponent-form valuation price', () => {
    expect(
      damlValuationToNative(invalidValuation({ price_per_share: { amount: '125e-2', currency: 'USD' } }))
        .price_per_share
    ).toEqual({ amount: '1.25', currency: 'USD' });
  });

  it.each([
    {
      name: 'dedicated stock issuance reader',
      entityType: 'stockIssuance' as const,
      contractId: 'issuance-cid',
      data: invalidStockIssuance({ quantity: '1.12345678901' }),
      invoke: async (client: LedgerJsonApiClient) => getStockIssuanceAsOcf(client, { contractId: 'issuance-cid' }),
      fieldPath: 'stockIssuance.quantity',
    },
    {
      name: 'generic stock issuance reader',
      entityType: 'stockIssuance' as const,
      contractId: 'issuance-cid',
      data: invalidStockIssuance({ share_price: { amount: '1', currency: 'usd' } }),
      invoke: async (client: LedgerJsonApiClient) => getEntityAsOcf(client, 'stockIssuance', 'issuance-cid'),
      fieldPath: 'stockIssuance.share_price.currency',
    },
    {
      name: 'dedicated valuation reader',
      entityType: 'valuation' as const,
      contractId: 'valuation-cid',
      data: invalidValuation({ price_per_share: { amount: '-1', currency: 'USD' } }),
      invoke: async (client: LedgerJsonApiClient) => getValuationAsOcf(client, { contractId: 'valuation-cid' }),
      fieldPath: 'valuation.price_per_share.amount',
    },
    {
      name: 'generic valuation reader',
      entityType: 'valuation' as const,
      contractId: 'valuation-cid',
      data: invalidValuation({ price_per_share: { amount: '1.12345678901', currency: 'USD' } }),
      invoke: async (client: LedgerJsonApiClient) => getEntityAsOcf(client, 'valuation', 'valuation-cid'),
      fieldPath: 'valuation.price_per_share.amount',
    },
  ])('$name rejects schema-invalid generated DAML values', async (testCase) => {
    const client = mockEntityClient(testCase.entityType, testCase.contractId, testCase.data);
    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: OcpValidationError.name,
      fieldPath: testCase.fieldPath,
    });
  });

  it.each([
    {
      name: 'stock issuance',
      fieldPath: 'stockIssuance.share_price.amount',
      invoke: (monetary: unknown) => damlStockIssuanceDataToNative(invalidStockIssuance({ share_price: monetary })),
    },
    {
      name: 'valuation',
      fieldPath: 'valuation.price_per_share.amount',
      invoke: (monetary: unknown) => damlValuationToNative(invalidValuation({ price_per_share: monetary })),
    },
  ])('$name rejects Monetary accessors without invoking them', ({ fieldPath, invoke }) => {
    const getter = jest.fn(() => '1');
    const monetary: Record<string, unknown> = { currency: 'USD' };
    Object.defineProperty(monetary, 'amount', { enumerable: true, get: getter });

    expect(() => invoke(monetary)).toThrow(
      expect.objectContaining({
        name: OcpValidationError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        fieldPath,
      })
    );
    expect(getter).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'stock issuance',
      fieldPath: 'stockIssuance.share_price',
      invoke: (monetary: unknown) => damlStockIssuanceDataToNative(invalidStockIssuance({ share_price: monetary })),
    },
    {
      name: 'valuation',
      fieldPath: 'valuation.price_per_share',
      invoke: (monetary: unknown) => damlValuationToNative(invalidValuation({ price_per_share: monetary })),
    },
  ])('$name rejects Monetary proxies without invoking traps', ({ fieldPath, invoke }) => {
    const get = jest.fn(() => 'trap');
    const monetary = new Proxy({ amount: '1', currency: 'USD' }, { get });

    expect(() => invoke(monetary)).toThrow(
      expect.objectContaining({
        name: OcpValidationError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        fieldPath,
      })
    );
    expect(get).not.toHaveBeenCalled();
  });
});
