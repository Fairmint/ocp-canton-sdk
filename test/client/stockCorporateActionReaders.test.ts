import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpClient } from '../../src/OcpClient';
import { OcpValidationError } from '../../src/errors';
import {
  ENTITY_DATA_FIELD_MAP,
  ENTITY_TEMPLATE_ID_MAP,
  type OcfEntityType,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { stockClassConversionRatioAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/stockClassConversionRatioAdjustment/stockClassConversionRatioAdjustmentDataToDaml';
import { stockClassSplitDataToDaml } from '../../src/functions/OpenCapTable/stockClassSplit/stockClassSplitDataToDaml';
import { stockConsolidationDataToDaml } from '../../src/functions/OpenCapTable/stockConsolidation/stockConsolidationDataToDaml';
import { stockReissuanceDataToDaml } from '../../src/functions/OpenCapTable/stockReissuance/stockReissuanceDataToDaml';
import { stockRepurchaseDataToDaml } from '../../src/functions/OpenCapTable/stockRepurchase/stockRepurchaseDataToDaml';
import { createLedgerJsonApiClient } from '../utils/cantonNodeSdkCompat';

type CorporateActionType = Extract<
  OcfEntityType,
  | 'stockClassConversionRatioAdjustment'
  | 'stockClassSplit'
  | 'stockConsolidation'
  | 'stockReissuance'
  | 'stockRepurchase'
>;

interface ClientReaderCase {
  readonly entityType: CorporateActionType;
  readonly objectType:
    | 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT'
    | 'TX_STOCK_CLASS_SPLIT'
    | 'TX_STOCK_CONSOLIDATION'
    | 'TX_STOCK_REISSUANCE'
    | 'TX_STOCK_REPURCHASE';
  readonly contractId: string;
  readonly data: Record<string, unknown>;
  readonly expected: Readonly<Record<string, unknown>>;
}

const clientReaderCases = [
  {
    entityType: 'stockClassConversionRatioAdjustment',
    objectType: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
    contractId: 'client-ratio-adjustment',
    data: stockClassConversionRatioAdjustmentDataToDaml({
      object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
      id: 'ratio-adjustment-1',
      date: '2026-07-10',
      stock_class_id: 'preferred-1',
      new_ratio_conversion_mechanism: {
        type: 'RATIO_CONVERSION',
        conversion_price: { amount: '1.2500000000', currency: 'USD' },
        ratio: { numerator: '2.0000000000', denominator: '1.0000000000' },
        rounding_type: 'CEILING',
      },
      comments: ['repriced'],
    }),
    expected: {
      object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
      id: 'ratio-adjustment-1',
      stock_class_id: 'preferred-1',
      new_ratio_conversion_mechanism: {
        conversion_price: { amount: '1.25', currency: 'USD' },
        ratio: { numerator: '2', denominator: '1' },
        rounding_type: 'CEILING',
      },
      comments: ['repriced'],
    },
  },
  {
    entityType: 'stockClassSplit',
    objectType: 'TX_STOCK_CLASS_SPLIT',
    contractId: 'client-stock-class-split',
    data: stockClassSplitDataToDaml({
      object_type: 'TX_STOCK_CLASS_SPLIT',
      id: 'split-1',
      date: '2026-07-10',
      stock_class_id: 'common-1',
      split_ratio: { numerator: '4.0000000000', denominator: '1.0000000000' },
      comments: ['split'],
    }),
    expected: {
      object_type: 'TX_STOCK_CLASS_SPLIT',
      id: 'split-1',
      stock_class_id: 'common-1',
      split_ratio: { numerator: '4', denominator: '1' },
      comments: ['split'],
    },
  },
  {
    entityType: 'stockConsolidation',
    objectType: 'TX_STOCK_CONSOLIDATION',
    contractId: 'client-stock-consolidation',
    data: stockConsolidationDataToDaml({
      object_type: 'TX_STOCK_CONSOLIDATION',
      id: 'consolidation-1',
      date: '2026-07-10',
      security_ids: ['security-old-1'],
      resulting_security_id: 'security-new-1',
      reason_text: 'cleanup',
      comments: ['consolidated'],
    }),
    expected: {
      object_type: 'TX_STOCK_CONSOLIDATION',
      id: 'consolidation-1',
      security_ids: ['security-old-1'],
      resulting_security_id: 'security-new-1',
      reason_text: 'cleanup',
      comments: ['consolidated'],
    },
  },
  {
    entityType: 'stockReissuance',
    objectType: 'TX_STOCK_REISSUANCE',
    contractId: 'client-stock-reissuance',
    data: stockReissuanceDataToDaml({
      object_type: 'TX_STOCK_REISSUANCE',
      id: 'reissuance-1',
      date: '2026-07-10',
      security_id: 'security-old-1',
      resulting_security_ids: ['security-new-1', 'security-new-2'],
      reason_text: 'replacement',
      split_transaction_id: 'split-1',
      comments: ['reissued'],
    }),
    expected: {
      object_type: 'TX_STOCK_REISSUANCE',
      id: 'reissuance-1',
      security_id: 'security-old-1',
      resulting_security_ids: ['security-new-1', 'security-new-2'],
      reason_text: 'replacement',
      split_transaction_id: 'split-1',
      comments: ['reissued'],
    },
  },
  {
    entityType: 'stockRepurchase',
    objectType: 'TX_STOCK_REPURCHASE',
    contractId: 'client-stock-repurchase',
    data: stockRepurchaseDataToDaml({
      object_type: 'TX_STOCK_REPURCHASE',
      id: 'repurchase-1',
      date: '2026-07-10',
      security_id: 'security-1',
      quantity: '12.5000000000',
      price: { amount: '1.2500000000', currency: 'USD' },
      balance_security_id: 'security-balance-1',
      consideration_text: 'cash',
      comments: ['repurchased'],
    }),
    expected: {
      object_type: 'TX_STOCK_REPURCHASE',
      id: 'repurchase-1',
      security_id: 'security-1',
      quantity: '12.5',
      price: { amount: '1.25', currency: 'USD' },
      balance_security_id: 'security-balance-1',
      consideration_text: 'cash',
      comments: ['repurchased'],
    },
  },
] as const satisfies readonly ClientReaderCase[];

function ledgerFor(testCase: ClientReaderCase, data: unknown = testCase.data): LedgerJsonApiClient {
  const ledger = createLedgerJsonApiClient({ network: 'devnet' });
  Object.defineProperty(ledger, 'getEventsByContractId', {
    value: jest.fn(async ({ contractId }: { contractId: string }) => {
      await Promise.resolve();
      return {
        created: {
          createdEvent: {
            contractId,
            templateId: ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
            createArgument: {
              context: { issuer: 'issuer::party', system_operator: 'system-operator::party' },
              [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: data,
            },
          },
        },
      };
    }),
    configurable: true,
    enumerable: true,
    writable: true,
  });
  return ledger;
}

async function namespaceRead(ocp: OcpClient, testCase: ClientReaderCase): Promise<Record<string, unknown>> {
  const namespace = ocp.OpenCapTable[testCase.entityType] as unknown as {
    get(params: { contractId: string }): Promise<{ data: Record<string, unknown> }>;
  };
  return (await namespace.get({ contractId: testCase.contractId })).data;
}

function clonePlain(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clonePlain);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clonePlain(item)]));
  }
  return value;
}

describe('OcpClient stock corporate-action readers', () => {
  it.each(clientReaderCases)(
    '$entityType preserves canonical data through namespace and object-type reads',
    async (testCase) => {
      const ocp = new OcpClient({ ledger: ledgerFor(testCase) });
      const namespaceData = await namespaceRead(ocp, testCase);
      const objectTypeData = (
        await ocp.OpenCapTable.getByObjectType({
          objectType: testCase.objectType,
          contractId: testCase.contractId,
        })
      ).data;

      for (const data of [namespaceData, objectTypeData]) {
        expect(data).toMatchObject(testCase.expected);
        expect(Object.isFrozen(data)).toBe(true);
      }
    }
  );

  it('enforces consolidation and reissuance cardinality at both public reader surfaces', async () => {
    const consolidation = clientReaderCases[2];
    const consolidationClient = new OcpClient({
      ledger: ledgerFor(consolidation, { ...consolidation.data, security_ids: [] }),
    });
    await expect(namespaceRead(consolidationClient, consolidation)).rejects.toBeInstanceOf(OcpValidationError);

    const reissuance = clientReaderCases[3];
    const reissuanceClient = new OcpClient({
      ledger: ledgerFor(reissuance, { ...reissuance.data, resulting_security_ids: [] }),
    });
    await expect(namespaceRead(reissuanceClient, reissuance)).rejects.toBeInstanceOf(OcpValidationError);
    await expect(
      reissuanceClient.OpenCapTable.getByObjectType({
        objectType: reissuance.objectType,
        contractId: reissuance.contractId,
      })
    ).rejects.toBeInstanceOf(OcpValidationError);
  });

  it.each([
    [clientReaderCases[0], ['new_ratio_conversion_mechanism', 'ratio', 'numerator']],
    [clientReaderCases[1], ['split_ratio', 'numerator']],
    [clientReaderCases[4], ['quantity']],
  ] as const)(
    '$0.entityType accepts and canonicalizes generated Numeric exponents at the public client boundary',
    async (testCase, path) => {
      const data = clonePlain(testCase.data) as Record<string, unknown>;
      let target = data;
      for (const key of path.slice(0, -1)) target = target[key] as Record<string, unknown>;
      const finalKey = path[path.length - 1];
      if (finalKey === undefined) throw new Error('Numeric path must not be empty');
      target[finalKey] = '1e3';
      const ocp = new OcpClient({ ledger: ledgerFor(testCase, data) });

      let result: unknown = await namespaceRead(ocp, testCase);
      for (const key of path) result = (result as Record<string, unknown>)[key];
      expect(result).toBe('1000');
    }
  );

  it.each(clientReaderCases)('$entityType freezes the public ContractResult wrapper', async (testCase) => {
    const ocp = new OcpClient({ ledger: ledgerFor(testCase) });
    const namespace = ocp.OpenCapTable[testCase.entityType] as unknown as {
      get(params: { contractId: string }): Promise<{ data: Record<string, unknown> }>;
    };

    const result = await namespace.get({ contractId: testCase.contractId });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.data)).toBe(true);
  });
});
