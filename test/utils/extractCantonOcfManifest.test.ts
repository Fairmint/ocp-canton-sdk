/**
 * Tests for extractCantonOcfManifest — specifically the issuer fetch behavior
 * when getCapTableState returns a stale issuerContractId that is not in contractIds.
 *
 * Regression test for: https://linear.app/fairmint — Cipher Security replication failure
 * where a stale issuer contract reference caused extraction to hard-fail even though
 * getCapTableState had already detected the stale reference and excluded it from contractIds.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { CapTableState } from '../../src/functions/OpenCapTable/capTable/getCapTableState';
import { extractCantonOcfManifest } from '../../src/utils/cantonOcfExtractor';

// Mock all entity-specific getAsOcf functions used by extractCantonOcfManifest
jest.mock('../../src/functions/OpenCapTable/issuer', () => ({
  getIssuerAsOcf: jest.fn(),
}));
jest.mock('../../src/functions/OpenCapTable/stakeholder', () => ({
  getStakeholderAsOcf: jest.fn(),
}));
jest.mock('../../src/functions/OpenCapTable/stockClass', () => ({
  getStockClassAsOcf: jest.fn(),
}));
jest.mock('../../src/functions/OpenCapTable/stockPlan', () => ({
  getStockPlanAsOcf: jest.fn(),
}));
jest.mock('../../src/functions/OpenCapTable/vestingTerms', () => ({
  getVestingTermsAsOcf: jest.fn(),
}));
jest.mock('../../src/functions/OpenCapTable/stockIssuance', () => ({
  getStockIssuanceAsOcf: jest.fn(),
}));
jest.mock('../../src/functions/OpenCapTable/convertibleIssuance', () => ({
  getConvertibleIssuanceAsOcf: jest.fn(),
}));
jest.mock('../../src/functions/OpenCapTable/warrantIssuance', () => ({
  getWarrantIssuanceAsOcf: jest.fn(),
}));
jest.mock('../../src/functions/OpenCapTable/equityCompensationIssuance', () => ({
  getEquityCompensationIssuanceAsOcf: jest.fn(),
}));
jest.mock('../../src/functions/OpenCapTable/equityCompensationExercise', () => ({
  getEquityCompensationExerciseAsOcf: jest.fn(),
}));
jest.mock('../../src/functions/OpenCapTable/stockClassAuthorizedSharesAdjustment', () => ({
  getStockClassAuthorizedSharesAdjustmentAsOcf: jest.fn(),
}));
jest.mock('../../src/functions/OpenCapTable/issuerAuthorizedSharesAdjustment', () => ({
  getIssuerAuthorizedSharesAdjustmentAsOcf: jest.fn(),
}));
jest.mock('../../src/functions/OpenCapTable/stockPlanPoolAdjustment', () => ({
  getStockPlanPoolAdjustmentAsOcf: jest.fn(),
}));
jest.mock('../../src/functions/OpenCapTable/valuation', () => ({
  getValuationAsOcf: jest.fn(),
}));
jest.mock('../../src/functions/OpenCapTable/document', () => ({
  getDocumentAsOcf: jest.fn(),
}));
jest.mock('../../src/functions/OpenCapTable/stockLegendTemplate', () => ({
  getStockLegendTemplateAsOcf: jest.fn(),
}));
jest.mock('../../src/functions/OpenCapTable/capTable/damlToOcf', () => ({
  getEntityAsOcf: jest.fn(),
  SUPPORTED_READ_TYPES: new Set(['stockTransfer']),
}));

// Import after mocks are set up
const { getIssuerAsOcf } = jest.requireMock('../../src/functions/OpenCapTable/issuer');
const { getStakeholderAsOcf } = jest.requireMock('../../src/functions/OpenCapTable/stakeholder');
const { getEntityAsOcf } = jest.requireMock('../../src/functions/OpenCapTable/capTable/damlToOcf');

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

    it('should not throw when issuerContractId is stale and failOnReadErrors is true', async () => {
      const state = buildCapTableState({
        issuerContractId: 'stale-issuer-contract-00ffded09f',
      });

      await expect(extractCantonOcfManifest(mockClient, state, { failOnReadErrors: true })).resolves.toBeDefined();
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

      getIssuerAsOcf.mockResolvedValue({
        data: { id: 'iss_test', object_type: 'ISSUER', legal_name: 'Test Corp' },
      });
      getStakeholderAsOcf.mockResolvedValue({
        stakeholder: { id: 'stakeholder-1', object_type: 'STAKEHOLDER', name: { legal_name: 'Holder 1' } },
        contractId: 'stakeholder-cid-1',
      });
      getEntityAsOcf.mockResolvedValue({
        data: {
          id: 'tx-1',
          object_type: 'TX_STOCK_TRANSFER',
          date: '2025-01-01T00:00:00Z',
          security_id: 'sec-1',
        },
        contractId: 'stock-transfer-cid-1',
      });

      const manifest = await extractCantonOcfManifest(mockClient, state, { readAs });

      expect(getIssuerAsOcf).toHaveBeenCalledWith(mockClient, {
        contractId: 'issuer-cid-123',
        readAs,
      });
      expect(getStakeholderAsOcf).toHaveBeenCalledWith(mockClient, {
        contractId: 'stakeholder-cid-1',
        readAs,
      });
      expect(getEntityAsOcf).toHaveBeenCalledWith(mockClient, 'stockTransfer', 'stock-transfer-cid-1', {
        readAs,
      });
      expect(manifest.issuer).toEqual({
        id: 'iss_test',
        object_type: 'ISSUER',
        legal_name: 'Test Corp',
      });
      expect(manifest.stakeholders).toEqual([
        { id: 'stakeholder-1', object_type: 'STAKEHOLDER', name: { legal_name: 'Holder 1' } },
      ]);
      expect(manifest.transactions).toEqual([
        expect.objectContaining({
          id: 'tx-1',
          object_type: 'TX_STOCK_TRANSFER',
        }),
      ]);
    });

    it('should fetch issuer when present in contractIds', async () => {
      const state = buildCapTableState({
        issuerContractId: 'issuer-cid-123',
        contractIds: new Map([['issuer', new Map([['iss_test', 'issuer-cid-123']])]]),
        entities: new Map([['issuer', new Set(['iss_test'])]]),
      });

      getIssuerAsOcf.mockResolvedValue({
        data: { id: 'iss_test', object_type: 'ISSUER', legal_name: 'Test Corp' },
      });

      const manifest = await extractCantonOcfManifest(mockClient, state);

      expect(getIssuerAsOcf).toHaveBeenCalledWith(mockClient, { contractId: 'issuer-cid-123' });
      expect(manifest.issuer).toEqual({
        id: 'iss_test',
        object_type: 'ISSUER',
        legal_name: 'Test Corp',
      });
    });

    it('should record failure when issuer fetch throws and failOnReadErrors is false', async () => {
      const state = buildCapTableState({
        issuerContractId: 'issuer-cid-456',
        contractIds: new Map([['issuer', new Map([['iss_fail', 'issuer-cid-456']])]]),
        entities: new Map([['issuer', new Set(['iss_fail'])]]),
      });

      getIssuerAsOcf.mockRejectedValue(
        new Error('HTTP 404: CONTRACT_EVENTS_NOT_FOUND (cause: Contract events not found)')
      );

      const logs: string[] = [];
      const manifest = await extractCantonOcfManifest(mockClient, state, {
        failOnReadErrors: false,
        logger: (msg: string) => logs.push(msg),
      });

      expect(manifest.issuer).toBeNull();
      expect(logs.some((l) => l.includes('Failed to fetch issuer'))).toBe(true);
    });

    it('should throw when issuer fetch fails and failOnReadErrors is true', async () => {
      const state = buildCapTableState({
        issuerContractId: 'issuer-cid-789',
        contractIds: new Map([['issuer', new Map([['iss_dead', 'issuer-cid-789']])]]),
        entities: new Map([['issuer', new Set(['iss_dead'])]]),
      });

      getIssuerAsOcf.mockRejectedValue(new Error('HTTP 404: CONTRACT_EVENTS_NOT_FOUND'));

      await expect(extractCantonOcfManifest(mockClient, state, { failOnReadErrors: true })).rejects.toThrow(
        'Failed to extract 1 Canton object(s)'
      );
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
