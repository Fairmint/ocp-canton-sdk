/** Runtime validation contracts for generated-decoder-backed ledger readers. */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import { ENTITY_REGISTRY, type OcfEntityType } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { documentDataToDaml } from '../../src/functions/OpenCapTable/document/createDocument';
import { getDocumentAsOcf } from '../../src/functions/OpenCapTable/document/getDocumentAsOcf';
import { issuerDataToDaml } from '../../src/functions/OpenCapTable/issuer/createIssuer';
import { getIssuerAsOcf } from '../../src/functions/OpenCapTable/issuer/getIssuerAsOcf';
import { getStakeholderAsOcf } from '../../src/functions/OpenCapTable/stakeholder/getStakeholderAsOcf';
import { stakeholderDataToDaml } from '../../src/functions/OpenCapTable/stakeholder/stakeholderDataToDaml';
import { getStockClassAsOcf } from '../../src/functions/OpenCapTable/stockClass/getStockClassAsOcf';
import { stockClassDataToDaml } from '../../src/functions/OpenCapTable/stockClass/stockClassDataToDaml';
import { stockIssuanceDataToDaml } from '../../src/functions/OpenCapTable/stockIssuance/createStockIssuance';
import { getStockIssuanceAsOcf } from '../../src/functions/OpenCapTable/stockIssuance/getStockIssuanceAsOcf';
import { stockLegendTemplateDataToDaml } from '../../src/functions/OpenCapTable/stockLegendTemplate/createStockLegendTemplate';
import { getStockLegendTemplateAsOcf } from '../../src/functions/OpenCapTable/stockLegendTemplate/getStockLegendTemplateAsOcf';
import { stockPlanDataToDaml } from '../../src/functions/OpenCapTable/stockPlan/createStockPlan';
import { getStockPlanAsOcf } from '../../src/functions/OpenCapTable/stockPlan/getStockPlanAsOcf';
import { getValuationAsOcf } from '../../src/functions/OpenCapTable/valuation/getValuationAsOcf';
import { valuationDataToDaml } from '../../src/functions/OpenCapTable/valuation/valuationDataToDaml';
import { vestingTermsDataToDaml } from '../../src/functions/OpenCapTable/vestingTerms/createVestingTerms';
import { getVestingTermsAsOcf } from '../../src/functions/OpenCapTable/vestingTerms/getVestingTermsAsOcf';
import {
  createTestDocumentData,
  createTestIssuerData,
  createTestStakeholderData,
  createTestStockClassData,
  createTestStockIssuanceData,
  createTestStockLegendTemplateData,
  createTestStockPlanData,
  createTestValuationData,
  createTestVestingTermsData,
} from '../integration/utils/setupTestData';

type ReaderEntityType = Extract<
  OcfEntityType,
  | 'document'
  | 'issuer'
  | 'stakeholder'
  | 'stockClass'
  | 'stockIssuance'
  | 'stockLegendTemplate'
  | 'stockPlan'
  | 'valuation'
  | 'vestingTerms'
>;

interface MalformedReaderCase {
  readonly entityType: ReaderEntityType;
  readonly contractId: string;
  readonly field: string;
  readonly invoke: (client: LedgerJsonApiClient) => Promise<unknown>;
  readonly validData: () => object;
  readonly expectedError:
    | { readonly kind: 'decoder' }
    | { readonly kind: 'parse'; readonly source: string }
    | { readonly kind: 'validation'; readonly fieldPath: string };
}

function createMockClient(
  testCase: MalformedReaderCase,
  templateId = ENTITY_REGISTRY[testCase.entityType].templateId,
  malformed = true,
  createdEventContractId = testCase.contractId
): LedgerJsonApiClient {
  const { dataField } = ENTITY_REGISTRY[testCase.entityType];
  const data = malformed ? { ...testCase.validData(), [testCase.field]: 17 } : testCase.validData();
  return {
    getEventsByContractId: jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          contractId: createdEventContractId,
          templateId,
          createArgument: {
            context: { issuer: 'issuer::party', system_operator: 'system-operator::party' },
            [dataField]: data,
          },
        },
      },
    }),
  } as unknown as LedgerJsonApiClient;
}

const stockClassId = 'stock-class-1';
const stakeholderId = 'stakeholder-1';

const malformedReaderCases: readonly MalformedReaderCase[] = [
  {
    entityType: 'document',
    contractId: 'document-cid',
    field: 'md5',
    invoke: async (client) => {
      const result = await getDocumentAsOcf(client, { contractId: 'document-cid' });
      return result;
    },
    validData: () => documentDataToDaml(createTestDocumentData({ id: 'document-1' })),
    expectedError: { kind: 'parse', source: 'document.md5' },
  },
  {
    entityType: 'issuer',
    contractId: 'issuer-cid',
    field: 'id',
    invoke: async (client) => {
      const result = await getIssuerAsOcf(client, { contractId: 'issuer-cid' });
      return result;
    },
    validData: () => issuerDataToDaml(createTestIssuerData({ id: 'issuer-1' })),
    expectedError: { kind: 'validation', fieldPath: 'issuer.id' },
  },
  {
    entityType: 'stakeholder',
    contractId: 'stakeholder-cid',
    field: 'id',
    invoke: async (client) => {
      const result = await getStakeholderAsOcf(client, { contractId: 'stakeholder-cid' });
      return result;
    },
    validData: () => stakeholderDataToDaml(createTestStakeholderData({ id: stakeholderId })),
    expectedError: { kind: 'decoder' },
  },
  {
    entityType: 'stockClass',
    contractId: 'stock-class-cid',
    field: 'id',
    invoke: async (client) => {
      const result = await getStockClassAsOcf(client, { contractId: 'stock-class-cid' });
      return result;
    },
    validData: () => stockClassDataToDaml(createTestStockClassData({ id: stockClassId })),
    expectedError: { kind: 'validation', fieldPath: 'stockClass.id' },
  },
  {
    entityType: 'stockIssuance',
    contractId: 'stock-issuance-cid',
    field: 'id',
    invoke: async (client) => {
      const result = await getStockIssuanceAsOcf(client, { contractId: 'stock-issuance-cid' });
      return result;
    },
    validData: () =>
      stockIssuanceDataToDaml(
        createTestStockIssuanceData({
          id: 'stock-issuance-1',
          stakeholder_id: stakeholderId,
          stock_class_id: stockClassId,
        })
      ),
    expectedError: { kind: 'decoder' },
  },
  {
    entityType: 'stockLegendTemplate',
    contractId: 'stock-legend-template-cid',
    field: 'id',
    invoke: async (client) => {
      const result = await getStockLegendTemplateAsOcf(client, { contractId: 'stock-legend-template-cid' });
      return result;
    },
    validData: () => stockLegendTemplateDataToDaml(createTestStockLegendTemplateData({ id: 'legend-1' })),
    expectedError: { kind: 'decoder' },
  },
  {
    entityType: 'stockPlan',
    contractId: 'stock-plan-cid',
    field: 'id',
    invoke: async (client) => {
      const result = await getStockPlanAsOcf(client, { contractId: 'stock-plan-cid' });
      return result;
    },
    validData: () =>
      stockPlanDataToDaml(createTestStockPlanData({ id: 'stock-plan-1', stock_class_ids: [stockClassId] })),
    expectedError: { kind: 'parse', source: 'stockPlan.id' },
  },
  {
    entityType: 'valuation',
    contractId: 'valuation-cid',
    field: 'id',
    invoke: async (client) => {
      const result = await getValuationAsOcf(client, { contractId: 'valuation-cid' });
      return result;
    },
    validData: () => valuationDataToDaml(createTestValuationData({ id: 'valuation-1', stock_class_id: stockClassId })),
    expectedError: { kind: 'decoder' },
  },
  {
    entityType: 'vestingTerms',
    contractId: 'vesting-terms-cid',
    field: 'id',
    invoke: async (client) => {
      const result = await getVestingTermsAsOcf(client, { contractId: 'vesting-terms-cid' });
      return result;
    },
    validData: () => vestingTermsDataToDaml(createTestVestingTermsData({ id: 'vesting-terms-1' })),
    expectedError: { kind: 'parse', source: 'vestingTerms.id' },
  },
];

describe('generated DAML reader validation', () => {
  it.each(malformedReaderCases)(
    '$entityType rejects malformed $field with field-path diagnostics',
    async (testCase) => {
      const client = createMockClient(testCase);

      try {
        await testCase.invoke(client);
        throw new Error(`Expected ${testCase.entityType} reader to reject malformed ${testCase.field}`);
      } catch (error) {
        if (testCase.expectedError.kind === 'decoder') {
          expect(error).toBeInstanceOf(OcpParseError);
          expect(error).toMatchObject({
            code: OcpErrorCodes.SCHEMA_MISMATCH,
            context: {
              entityType: testCase.entityType,
              decoderPath: expect.stringContaining(testCase.field),
              decoderMessage: expect.any(String),
            },
          });
        } else if (testCase.expectedError.kind === 'parse') {
          expect(error).toBeInstanceOf(OcpParseError);
          expect(error).toMatchObject({
            code: OcpErrorCodes.SCHEMA_MISMATCH,
            source: testCase.expectedError.source,
          });
        } else {
          expect(error).toBeInstanceOf(OcpValidationError);
          expect(error).toMatchObject({
            code: OcpErrorCodes.INVALID_TYPE,
            fieldPath: testCase.expectedError.fieldPath,
          });
        }
        if (testCase.expectedError.kind !== 'parse') {
          expect((error as Error).message).toContain(testCase.field);
        }
      }
    }
  );

  it.each(malformedReaderCases)(
    '$entityType rejects a valid payload under the wrong generated template',
    async (testCase) => {
      const wrongTemplateId =
        testCase.entityType === 'issuer' ? ENTITY_REGISTRY.document.templateId : ENTITY_REGISTRY.issuer.templateId;
      const client = createMockClient(testCase, wrongTemplateId, false);

      await expect(testCase.invoke(client)).rejects.toMatchObject({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'module_entity_mismatch',
      });
    }
  );

  it.each(malformedReaderCases)('$entityType rejects a created event for a different contract ID', async (testCase) => {
    const client = createMockClient(
      testCase,
      ENTITY_REGISTRY[testCase.entityType].templateId,
      false,
      `${testCase.contractId}-other`
    );

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: OcpParseError.name,
      code: OcpErrorCodes.INVALID_RESPONSE,
      classification: 'created_event_contract_id_mismatch',
      source: `contract ${testCase.contractId}.eventsResponse.created.createdEvent.contractId`,
      context: {
        contractId: testCase.contractId,
        requestedContractId: testCase.contractId,
        actualContractId: `${testCase.contractId}-other`,
      },
    });
  });

  it('preserves the failing array index in generated decoder diagnostics', async () => {
    const testCase = malformedReaderCases.find(({ entityType }) => entityType === 'stockIssuance');
    if (testCase === undefined) throw new Error('Missing stockIssuance reader validation case');
    const { dataField, templateId } = ENTITY_REGISTRY.stockIssuance;
    const stockIssuanceData = {
      ...testCase.validData(),
      vestings: [
        { date: '2025-01-01T00:00:00Z', amount: '1' },
        { date: 17, amount: '2' },
      ],
    };
    const client = {
      getEventsByContractId: jest.fn().mockResolvedValue({
        created: {
          createdEvent: {
            contractId: testCase.contractId,
            templateId,
            createArgument: {
              context: { issuer: 'issuer::party', system_operator: 'system-operator::party' },
              [dataField]: stockIssuanceData,
            },
          },
        },
      }),
    } as unknown as LedgerJsonApiClient;

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: { decoderPath: expect.stringContaining('vestings[1]') },
    });
  });
});
