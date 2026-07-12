import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpClient } from '../../src/OcpClient';
import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import {
  ENTITY_DATA_FIELD_MAP,
  ENTITY_TEMPLATE_ID_MAP,
  type OcfEntityType,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { convertibleConversionDataToDaml } from '../../src/functions/OpenCapTable/convertibleConversion/convertibleConversionDataToDaml';
import { equityCompensationExerciseDataToDaml } from '../../src/functions/OpenCapTable/equityCompensationExercise/createEquityCompensationExercise';
import { stockConversionDataToDaml } from '../../src/functions/OpenCapTable/stockConversion/stockConversionDataToDaml';
import { warrantExerciseDataToDaml } from '../../src/functions/OpenCapTable/warrantExercise/warrantExerciseDataToDaml';
import { createLedgerJsonApiClient } from '../utils/cantonNodeSdkCompat';

type ConversionExerciseType = Extract<
  OcfEntityType,
  'convertibleConversion' | 'stockConversion' | 'equityCompensationExercise' | 'warrantExercise'
>;

interface ClientReaderCase {
  readonly entityType: ConversionExerciseType;
  readonly objectType:
    | 'TX_CONVERTIBLE_CONVERSION'
    | 'TX_STOCK_CONVERSION'
    | 'TX_EQUITY_COMPENSATION_EXERCISE'
    | 'TX_WARRANT_EXERCISE';
  readonly contractId: string;
  readonly data: Record<string, unknown>;
  readonly expectedNumeric?: Readonly<Record<string, string>>;
}

const clientReaderCases = [
  {
    entityType: 'convertibleConversion',
    objectType: 'TX_CONVERTIBLE_CONVERSION',
    contractId: 'client-convertible-conversion',
    data: convertibleConversionDataToDaml({
      object_type: 'TX_CONVERTIBLE_CONVERSION',
      id: '',
      date: '2026-07-10',
      reason_text: '',
      security_id: '',
      trigger_id: '',
      resulting_security_ids: ['', 'duplicate', 'duplicate'],
      balance_security_id: '',
      quantity_converted: '+000.5000000000',
      comments: [''],
    }),
    expectedNumeric: { quantity_converted: '0.5' },
  },
  {
    entityType: 'stockConversion',
    objectType: 'TX_STOCK_CONVERSION',
    contractId: 'client-stock-conversion',
    data: stockConversionDataToDaml({
      object_type: 'TX_STOCK_CONVERSION',
      id: '',
      date: '2026-07-10',
      security_id: '',
      quantity_converted: '-0',
      resulting_security_ids: ['', 'duplicate', 'duplicate'],
      balance_security_id: '',
      comments: [''],
    }),
    expectedNumeric: { quantity_converted: '0' },
  },
  {
    entityType: 'equityCompensationExercise',
    objectType: 'TX_EQUITY_COMPENSATION_EXERCISE',
    contractId: 'client-equity-compensation-exercise',
    data: equityCompensationExerciseDataToDaml({
      object_type: 'TX_EQUITY_COMPENSATION_EXERCISE',
      id: '',
      date: '2026-07-10',
      security_id: '',
      quantity: '0.0000000001',
      consideration_text: '',
      resulting_security_ids: ['', 'duplicate', 'duplicate'],
      comments: [''],
    }),
    expectedNumeric: { quantity: '0.0000000001' },
  },
  {
    entityType: 'warrantExercise',
    objectType: 'TX_WARRANT_EXERCISE',
    contractId: 'client-warrant-exercise',
    data: warrantExerciseDataToDaml({
      object_type: 'TX_WARRANT_EXERCISE',
      id: '',
      date: '2026-07-10',
      security_id: '',
      trigger_id: '',
      resulting_security_ids: ['', 'duplicate', 'duplicate'],
      consideration_text: '',
      comments: [''],
    }),
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
    enumerable: true,
    configurable: true,
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

describe('OcpClient conversion and exercise readers', () => {
  it.each(clientReaderCases)(
    '$entityType preserves empty Text, duplicates, and list cardinality through namespace and object-type reads',
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
        expect(data).toMatchObject({
          object_type: testCase.objectType,
          id: '',
          security_id: '',
          resulting_security_ids: ['', 'duplicate', 'duplicate'],
          comments: [''],
          ...('expectedNumeric' in testCase ? testCase.expectedNumeric : {}),
        });
      }
    }
  );

  it.each(clientReaderCases)(
    '$entityType accepts empty resulting_security_ids through both public reader APIs',
    async (testCase) => {
      const ocp = new OcpClient({
        ledger: ledgerFor(testCase, { ...testCase.data, resulting_security_ids: [] }),
      });
      await expect(namespaceRead(ocp, testCase)).resolves.toMatchObject({ resulting_security_ids: [] });
      await expect(
        ocp.OpenCapTable.getByObjectType({ objectType: testCase.objectType, contractId: testCase.contractId })
      ).resolves.toMatchObject({ data: { resulting_security_ids: [] } });
    }
  );

  it.each([
    [clientReaderCases[0], 'quantity_converted', 'convertibleConversion.quantity_converted'],
    [clientReaderCases[1], 'quantity_converted', 'stockConversion.quantity_converted'],
    [clientReaderCases[2], 'quantity', 'equityCompensationExercise.quantity'],
    [clientReaderCases[3], 'quantity', 'warrantExercise.quantity'],
  ] as const)(
    '$0.entityType reports exact Numeric diagnostics at the public client boundary',
    async (testCase, field, fieldPath) => {
      const ocp = new OcpClient({ ledger: ledgerFor(testCase, { ...testCase.data, [field]: '1e3' }) });

      await expect(namespaceRead(ocp, testCase)).rejects.toBeInstanceOf(OcpValidationError);
      try {
        await ocp.OpenCapTable.getByObjectType({ objectType: testCase.objectType, contractId: testCase.contractId });
        throw new Error('Expected getByObjectType to reject malformed Numeric data');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpValidationError);
        expect(error).toMatchObject({ code: OcpErrorCodes.INVALID_FORMAT, fieldPath });
      }
    }
  );
});
