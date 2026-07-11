/**
 * Tests for extractCantonOcfManifest — specifically the issuer fetch behavior
 * when getCapTableState returns a stale issuerContractId that is not in contractIds.
 *
 * Regression test for: https://linear.app/fairmint — Cipher Security replication failure
 * where a stale issuer contract reference caused extraction to hard-fail even though
 * getCapTableState had already detected the stale reference and excluded it from contractIds.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes } from '../../src/errors';
import type { OcfEntityType } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { getEntityAsOcf } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import type { CapTableState } from '../../src/functions/OpenCapTable/capTable/getCapTableState';
import { getIssuerAsOcf } from '../../src/functions/OpenCapTable/issuer';
import { extractCantonOcfManifest } from '../../src/utils/cantonOcfExtractor';
import {
  createTestDocumentData,
  createTestIssuerData,
  createTestStakeholderData,
  createTestStockClassData,
  createTestStockIssuanceData,
  createTestStockLegendTemplateData,
  createTestStockPlanData,
  createTestStockTransferData,
  createTestValuationData,
  createTestVestingTermsData,
} from '../integration/utils/setupTestData';

// Issuer has a distinct cap-table lifecycle; every child uses the correlated dispatcher.
jest.mock('../../src/functions/OpenCapTable/issuer', () => ({
  getIssuerAsOcf: jest.fn(),
}));
jest.mock('../../src/functions/OpenCapTable/capTable/damlToOcf', () => ({
  getEntityAsOcf: jest.fn(),
}));

const mockGetIssuerAsOcf = jest.mocked(getIssuerAsOcf);
const mockGetEntityAsOcf = jest.mocked(getEntityAsOcf);

const mockClient = {} as LedgerJsonApiClient;

function buildCapTableState(overrides: Partial<CapTableState> = {}): CapTableState {
  return {
    capTableContractId: 'cap-table-cid',
    issuerContractId: '',
    entities: new Map(),
    contractIds: new Map(),
    securityIds: new Map(),
    ...overrides,
  };
}

describe('extractCantonOcfManifest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('stale issuer contract reference', () => {
    it('should not attempt fetch when issuerContractId is stale (not in contractIds)', async () => {
      const state = buildCapTableState({
        issuerContractId: 'stale-issuer-contract-00ffded09f',
        // contractIds is empty — getCapTableState excluded the stale issuer
      });

      const logs: string[] = [];
      const manifest = await extractCantonOcfManifest(mockClient, state, {
        logger: (msg: string) => logs.push(msg),
      });

      expect(getIssuerAsOcf).not.toHaveBeenCalled();
      expect(manifest.issuer).toBeNull();
      expect(logs.some((l) => l.includes('not in contractIds'))).toBe(true);
    });

    it('should not throw when issuerContractId is stale', async () => {
      const state = buildCapTableState({
        issuerContractId: 'stale-issuer-contract-00ffded09f',
      });

      await expect(extractCantonOcfManifest(mockClient, state)).resolves.toBeDefined();
    });
  });

  describe('valid issuer contract reference', () => {
    it('should pass readAs to issuer, child getter, and generic transaction reads', async () => {
      const readAs = ['issuer::party-123'];
      const state = buildCapTableState({
        issuerContractId: 'issuer-cid-123',
        contractIds: new Map([
          ['issuer', new Map([['iss_test', 'issuer-cid-123']])],
          ['stakeholder', new Map([['stakeholder-1', 'stakeholder-cid-1']])],
          ['stockTransfer', new Map([['tx-1', 'stock-transfer-cid-1']])],
        ]),
        entities: new Map([
          ['issuer', new Set(['iss_test'])],
          ['stakeholder', new Set(['stakeholder-1'])],
          ['stockTransfer', new Set(['tx-1'])],
        ]),
      });

      const issuer = createTestIssuerData({ id: 'iss_test', legal_name: 'Test Corp' });
      const stockTransfer = createTestStockTransferData({
        id: 'tx-1',
        date: '2025-01-01T00:00:00Z',
        security_id: 'sec-1',
      });
      mockGetIssuerAsOcf.mockResolvedValue({ data: issuer, contractId: 'issuer-cid-123' });
      mockGetEntityAsOcf.mockImplementation(async (_client: unknown, entityType: string) => {
        await Promise.resolve();
        if (entityType === 'stakeholder') {
          return {
            data: createTestStakeholderData({ id: 'stakeholder-1' }),
            contractId: 'stakeholder-cid-1',
          };
        }
        return { data: stockTransfer, contractId: 'stock-transfer-cid-1' };
      });

      const manifest = await extractCantonOcfManifest(mockClient, state, { readAs });

      expect(getIssuerAsOcf).toHaveBeenCalledWith(mockClient, {
        contractId: 'issuer-cid-123',
        readAs,
      });
      expect(getEntityAsOcf).toHaveBeenCalledWith(mockClient, 'stakeholder', 'stakeholder-cid-1', { readAs });
      expect(getEntityAsOcf).toHaveBeenCalledWith(mockClient, 'stockTransfer', 'stock-transfer-cid-1', {
        readAs,
      });
      expect(manifest.issuer).toEqual(issuer);
      expect(manifest.stakeholders).toEqual([
        expect.objectContaining({ id: 'stakeholder-1', object_type: 'STAKEHOLDER' }),
      ]);
      expect(manifest.transactions).toEqual([
        expect.objectContaining({
          id: 'tx-1',
          object_type: 'TX_STOCK_TRANSFER',
        }),
      ]);
    });

    it('routes every exact child category and all transactions through the generic reader', async () => {
      const stakeholder = createTestStakeholderData({ id: 'stakeholder-1' });
      const stockClass = createTestStockClassData({ id: 'stock-class-1' });
      const stockPlan = createTestStockPlanData({ id: 'stock-plan-1', stock_class_ids: [stockClass.id] });
      const vestingTerms = createTestVestingTermsData({ id: 'vesting-terms-1' });
      const valuation = createTestValuationData({ id: 'valuation-1', stock_class_id: stockClass.id });
      const document = createTestDocumentData({ id: 'document-1' });
      const stockLegendTemplate = createTestStockLegendTemplateData({ id: 'legend-1' });
      const transaction = createTestStockIssuanceData({
        id: 'transaction-1',
        stakeholder_id: stakeholder.id,
        stock_class_id: stockClass.id,
      });
      const children = [
        ['stakeholder', stakeholder],
        ['stockClass', stockClass],
        ['stockPlan', stockPlan],
        ['vestingTerms', vestingTerms],
        ['valuation', valuation],
        ['document', document],
        ['stockLegendTemplate', stockLegendTemplate],
        ['stockIssuance', transaction],
      ] as const;
      const state = buildCapTableState({
        contractIds: new Map(
          children.map(([entityType, data]) => [entityType, new Map([[data.id, `${entityType}-cid`]])])
        ),
      });
      mockGetEntityAsOcf.mockImplementation(async (_client: unknown, entityType: OcfEntityType) => {
        await Promise.resolve();
        const child = children.find(([candidateType]) => candidateType === entityType);
        if (child === undefined) {
          throw new Error(`Unexpected entity type: ${entityType}`);
        }
        return { data: child[1], contractId: `${entityType}-cid` };
      });

      const manifest = await extractCantonOcfManifest(mockClient, state);

      expect(manifest).toEqual({
        issuer: null,
        stakeholders: [stakeholder],
        stockClasses: [stockClass],
        stockPlans: [stockPlan],
        vestingTerms: [vestingTerms],
        valuations: [valuation],
        documents: [document],
        stockLegendTemplates: [stockLegendTemplate],
        transactions: [transaction],
      });
      expect(getEntityAsOcf).toHaveBeenCalledTimes(children.length);
    });

    it('should fetch issuer when present in contractIds', async () => {
      const state = buildCapTableState({
        issuerContractId: 'issuer-cid-123',
        contractIds: new Map([['issuer', new Map([['iss_test', 'issuer-cid-123']])]]),
        entities: new Map([['issuer', new Set(['iss_test'])]]),
      });

      const issuer = createTestIssuerData({ id: 'iss_test', legal_name: 'Test Corp' });
      mockGetIssuerAsOcf.mockResolvedValue({ data: issuer, contractId: 'issuer-cid-123' });

      const manifest = await extractCantonOcfManifest(mockClient, state);

      expect(getIssuerAsOcf).toHaveBeenCalledWith(mockClient, { contractId: 'issuer-cid-123' });
      expect(manifest.issuer).toEqual(issuer);
    });

    it('should retry transient issuer reads before succeeding', async () => {
      const state = buildCapTableState({
        issuerContractId: 'issuer-cid-retry',
        contractIds: new Map([['issuer', new Map([['iss_retry', 'issuer-cid-retry']])]]),
        entities: new Map([['issuer', new Set(['iss_retry'])]]),
      });

      const issuer = createTestIssuerData({ id: 'iss_retry', legal_name: 'Retry Corp' });
      mockGetIssuerAsOcf
        .mockRejectedValueOnce(new Error('HTTP 503: upstream unavailable'))
        .mockResolvedValueOnce({ data: issuer, contractId: 'issuer-cid-retry' });

      const manifest = await extractCantonOcfManifest(mockClient, state);

      expect(getIssuerAsOcf).toHaveBeenCalledTimes(2);
      expect(manifest.issuer).toEqual(issuer);
    });

    it('should keep issuer 404 graceful and should not retry it', async () => {
      const state = buildCapTableState({
        issuerContractId: 'issuer-cid-456',
        contractIds: new Map([['issuer', new Map([['iss_fail', 'issuer-cid-456']])]]),
        entities: new Map([['issuer', new Set(['iss_fail'])]]),
      });

      mockGetIssuerAsOcf.mockRejectedValue(
        new Error('HTTP 404: CONTRACT_EVENTS_NOT_FOUND (cause: Contract events not found)')
      );

      const logs: string[] = [];
      const manifest = await extractCantonOcfManifest(mockClient, state, {
        logger: (msg: string) => logs.push(msg),
      });

      expect(getIssuerAsOcf).toHaveBeenCalledTimes(1);
      expect(manifest.issuer).toBeNull();
      expect(logs.some((l) => l.includes('Failed to fetch issuer/iss_fail [not_found]'))).toBe(true);
    });

    it.each([
      [
        'visibility',
        new Error('Contract not visible for requesting party; supply readAs'),
        OcpErrorCodes.AUTHORIZATION_FAILED,
      ],
      ['auth', new Error('HTTP 403: permission denied'), OcpErrorCodes.AUTHORIZATION_FAILED],
      ['schema', new Error('Schema mismatch in issuer create argument'), OcpErrorCodes.SCHEMA_MISMATCH],
      ['network', new Error('connect ECONNREFUSED 127.0.0.1:3975'), OcpErrorCodes.CONNECTION_FAILED],
    ])('should fail loud when issuer fetch hits %s errors', async (_case, issuerReadError, expectedCode) => {
      const state = buildCapTableState({
        issuerContractId: 'issuer-cid-loud',
        contractIds: new Map([['issuer', new Map([['iss_loud', 'issuer-cid-loud']])]]),
        entities: new Map([['issuer', new Set(['iss_loud'])]]),
      });

      mockGetIssuerAsOcf.mockRejectedValue(issuerReadError);

      const expectedAttempts = _case === 'network' ? 2 : 1;
      await expect(extractCantonOcfManifest(mockClient, state)).rejects.toMatchObject({
        code: expectedCode,
        contractId: 'issuer-cid-loud',
        message: `Failed to fetch issuer/iss_loud (${_case})`,
        diagnostics: {
          classification: _case,
          operation: 'extractCantonOcfManifest',
          entityType: 'issuer',
          objectId: 'iss_loud',
          contractId: 'issuer-cid-loud',
          attempts: expectedAttempts,
        },
      });
      expect(getIssuerAsOcf).toHaveBeenCalledTimes(expectedAttempts);
    });

    it('should return partial manifest when failOnReadErrors=false and issuer fetch is non-benign', async () => {
      const state = buildCapTableState({
        issuerContractId: 'issuer-cid-partial',
        contractIds: new Map([['issuer', new Map([['iss_partial', 'issuer-cid-partial']])]]),
        entities: new Map([['issuer', new Set(['iss_partial'])]]),
      });

      mockGetIssuerAsOcf.mockRejectedValue(new Error('HTTP 403: permission denied'));

      const logs: string[] = [];
      const manifest = await extractCantonOcfManifest(mockClient, state, {
        failOnReadErrors: false,
        logger: (msg: string) => logs.push(msg),
      });

      expect(manifest).toMatchObject({ issuer: null });
      expect(logs.some((l) => l.includes('Failed to fetch issuer/iss_partial [auth]'))).toBe(true);
      expect(logs.some((l) => l.includes('Continuing with partial manifest because failOnReadErrors=false'))).toBe(
        true
      );
    });

    it('should keep issuer not-found graceful', async () => {
      const state = buildCapTableState({
        issuerContractId: 'issuer-cid-789',
        contractIds: new Map([['issuer', new Map([['iss_dead', 'issuer-cid-789']])]]),
        entities: new Map([['issuer', new Set(['iss_dead'])]]),
      });

      mockGetIssuerAsOcf.mockRejectedValue(new Error('HTTP 404: CONTRACT_EVENTS_NOT_FOUND'));

      await expect(extractCantonOcfManifest(mockClient, state)).resolves.toMatchObject({
        issuer: null,
      });
    });
  });

  describe('child contract failures', () => {
    it.each([
      [
        'visibility',
        new Error('Contract not visible for requesting party; supply readAs'),
        OcpErrorCodes.AUTHORIZATION_FAILED,
      ],
      ['auth', new Error('HTTP 403: permission denied'), OcpErrorCodes.AUTHORIZATION_FAILED],
      ['schema', new Error('Schema mismatch in stakeholder create argument'), OcpErrorCodes.SCHEMA_MISMATCH],
      ['network', new Error('connect ECONNREFUSED 127.0.0.1:3975'), OcpErrorCodes.CONNECTION_FAILED],
    ])('should fail loud when child fetch hits %s errors', async (_case, childReadError, expectedCode) => {
      const state = buildCapTableState({
        contractIds: new Map([['stakeholder', new Map([['stakeholder-1', 'stakeholder-cid-1']])]]),
        entities: new Map([['stakeholder', new Set(['stakeholder-1'])]]),
      });

      mockGetEntityAsOcf.mockRejectedValue(childReadError);

      const expectedAttempts = _case === 'network' ? 2 : 1;
      await expect(extractCantonOcfManifest(mockClient, state)).rejects.toMatchObject({
        code: expectedCode,
        contractId: 'stakeholder-cid-1',
        message: `Failed to fetch stakeholder/stakeholder-1 (${_case})`,
        diagnostics: {
          classification: _case,
          operation: 'extractCantonOcfManifest',
          entityType: 'stakeholder',
          objectId: 'stakeholder-1',
          contractId: 'stakeholder-cid-1',
          attempts: expectedAttempts,
        },
      });
      expect(getEntityAsOcf).toHaveBeenCalledTimes(expectedAttempts);
    });

    it('bounds identifiers, read scope, and underlying messages in public diagnostics', async () => {
      const longObjectId = `stakeholder-${'o'.repeat(20_000)}`;
      const longContractId = `contract-${'c'.repeat(20_000)}`;
      const longParty = `party-${'p'.repeat(20_000)}`;
      const state = buildCapTableState({
        contractIds: new Map([['stakeholder', new Map([[longObjectId, longContractId]])]]),
      });
      mockGetEntityAsOcf.mockRejectedValue(new Error(`Schema mismatch: ${'x'.repeat(20_000)}`));
      const logs: string[] = [];

      let caught: unknown;
      try {
        await extractCantonOcfManifest(mockClient, state, {
          logger: (message) => logs.push(message),
          readAs: Array.from({ length: 20 }, (_, index) => `${longParty}-${index}`),
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(Error);
      const diagnosed = caught as Error & {
        cause: Error;
        contractId: string;
        diagnostics: { objectId: string; contractId: string; readAs: string[] };
      };
      expect(diagnosed.message.length).toBeLessThanOrEqual(512);
      expect(diagnosed.contractId.length).toBeLessThanOrEqual(128);
      expect(diagnosed.cause.message.length).toBeLessThanOrEqual(256);
      expect(diagnosed.diagnostics.objectId.length).toBeLessThanOrEqual(128);
      expect(diagnosed.diagnostics.contractId.length).toBeLessThanOrEqual(128);
      expect(diagnosed.diagnostics.readAs).toHaveLength(12);
      expect(diagnosed.diagnostics.readAs.every((party) => party.length <= 128)).toBe(true);
      expect(logs.every((message) => message.length < 700)).toBe(true);
    });

    it('does not invoke proxy traps when a ledger read rejects with a hostile value', async () => {
      let trapCalls = 0;
      const hostileRejection = new Proxy(Object.create(null) as object, {
        get() {
          trapCalls += 1;
          throw new Error('proxy get trap must not run');
        },
        getPrototypeOf() {
          trapCalls += 1;
          throw new Error('proxy getPrototypeOf trap must not run');
        },
        ownKeys() {
          trapCalls += 1;
          throw new Error('proxy ownKeys trap must not run');
        },
      });
      const state = buildCapTableState({
        contractIds: new Map([['stakeholder', new Map([['stakeholder-hostile', 'stakeholder-cid-hostile']])]]),
      });
      mockGetEntityAsOcf.mockRejectedValue(hostileRejection);

      await expect(extractCantonOcfManifest(mockClient, state)).rejects.toMatchObject({
        code: OcpErrorCodes.CHOICE_FAILED,
        classification: 'unknown',
        contractId: 'stakeholder-cid-hostile',
        cause: expect.objectContaining({ message: '{"containerType":"proxy"}' }),
      });
      expect(getEntityAsOcf).toHaveBeenCalledTimes(1);
      expect(trapCalls).toBe(0);
    });

    it('should return partial manifest when failOnReadErrors=false and child fetch is non-benign', async () => {
      const state = buildCapTableState({
        contractIds: new Map([['stakeholder', new Map([['stakeholder-1', 'stakeholder-cid-1']])]]),
        entities: new Map([['stakeholder', new Set(['stakeholder-1'])]]),
      });

      mockGetEntityAsOcf.mockRejectedValue(new Error('Schema mismatch in stakeholder create argument'));

      const logs: string[] = [];
      const manifest = await extractCantonOcfManifest(mockClient, state, {
        failOnReadErrors: false,
        logger: (msg: string) => logs.push(msg),
      });

      expect(manifest.stakeholders).toEqual([]);
      expect(logs.some((l) => l.includes('Failed to fetch stakeholder/stakeholder-1 [schema]'))).toBe(true);
      expect(logs.some((l) => l.includes('Continuing with partial manifest because failOnReadErrors=false'))).toBe(
        true
      );
    });

    it('should fail loud with contract diagnostics when a transaction has a malformed date', async () => {
      const state = buildCapTableState({
        contractIds: new Map([['stockTransfer', new Map([['tx-invalid', 'stock-transfer-invalid-cid']])]]),
        entities: new Map([['stockTransfer', new Set(['tx-invalid'])]]),
      });

      mockGetEntityAsOcf.mockResolvedValue({
        data: createTestStockTransferData({
          id: 'tx-invalid',
          date: '2024-02-30',
          security_id: 'security-invalid',
        }),
        contractId: 'stock-transfer-invalid-cid',
      });

      await expect(extractCantonOcfManifest(mockClient, state)).rejects.toMatchObject({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        contractId: 'stock-transfer-invalid-cid',
        message: 'Failed to fetch stockTransfer/tx-invalid (schema)',
        diagnostics: {
          classification: 'schema',
          operation: 'extractCantonOcfManifest',
          entityType: 'stockTransfer',
          objectId: 'tx-invalid',
          contractId: 'stock-transfer-invalid-cid',
          attempts: 1,
        },
      });
      expect(getEntityAsOcf).toHaveBeenCalledTimes(1);
    });

    it('should skip malformed transaction dates in partial mode and sort the valid transactions', async () => {
      const state = buildCapTableState({
        contractIds: new Map([
          [
            'stockTransfer',
            new Map([
              ['tx-later', 'stock-transfer-later-cid'],
              ['tx-invalid', 'stock-transfer-invalid-cid'],
              ['tx-earlier', 'stock-transfer-earlier-cid'],
            ]),
          ],
        ]),
        entities: new Map([['stockTransfer', new Set(['tx-later', 'tx-invalid', 'tx-earlier'])]]),
      });

      mockGetEntityAsOcf.mockImplementation(async (_client: unknown, _entityType: string, contractId: string) => {
        await Promise.resolve();
        const transactionsByContractId = {
          'stock-transfer-later-cid': createTestStockTransferData({
            id: 'tx-later',
            date: '2025-01-03',
            security_id: 'security-1',
          }),
          'stock-transfer-invalid-cid': createTestStockTransferData({
            id: 'tx-invalid',
            date: 'not-a-date',
            security_id: 'security-1',
          }),
          'stock-transfer-earlier-cid': createTestStockTransferData({
            id: 'tx-earlier',
            date: '2025-01-01',
            security_id: 'security-1',
          }),
        };
        const data = transactionsByContractId[contractId as keyof typeof transactionsByContractId];
        if (data === undefined) {
          throw new Error(`Unexpected stock transfer contract: ${contractId}`);
        }
        return { data, contractId };
      });

      const logs: string[] = [];
      const manifest = await extractCantonOcfManifest(mockClient, state, {
        failOnReadErrors: false,
        logger: (msg: string) => logs.push(msg),
      });

      expect(manifest.transactions.map((transaction) => transaction.id)).toEqual(['tx-earlier', 'tx-later']);
      expect(logs.some((l) => l.includes('Failed to fetch stockTransfer/tx-invalid [schema]'))).toBe(true);
      expect(logs.some((l) => l.includes('Continuing with partial manifest because failOnReadErrors=false'))).toBe(
        true
      );
      expect(getEntityAsOcf).toHaveBeenCalledTimes(3);
    });
  });

  describe('empty state', () => {
    it('should return empty manifest when no issuerContractId and no contractIds', async () => {
      const state = buildCapTableState();

      const manifest = await extractCantonOcfManifest(mockClient, state);

      expect(getIssuerAsOcf).not.toHaveBeenCalled();
      expect(manifest.issuer).toBeNull();
      expect(manifest.stakeholders).toEqual([]);
      expect(manifest.transactions).toEqual([]);
    });
  });
});
