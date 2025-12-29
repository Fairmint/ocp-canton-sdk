/**
 * Integration tests for core OCF operations.
 *
 * These tests exercise the full SDK flow against a running Canton LocalNet, validating that:
 *
 * 1. Commands are properly constructed and accepted by DAML contracts
 * 2. Data round-trips correctly (create -> read -> validate)
 * 3. OCF output conforms to official schemas
 *
 * Run these tests with:
 *
 * ```bash
 * OCP_TEST_USE_CN_QUICKSTART_DEFAULTS=true npm run test:integration
 * ```
 *
 * Prerequisites:
 *
 * - LocalNet (cn-quickstart) running with Validator API
 * - Contracts deployed
 * - FeaturedAppRight contract available
 *
 * Note: Basic cn-quickstart LocalNet does NOT include the Validator API. These tests require a full Canton Network
 * setup.
 */

import { getFeaturedAppRightContractDetails, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { OcpClient } from '../../src/OcpClient';
import { validateOcfObject } from '../utils/ocfSchemaValidator';
import { buildIntegrationTestClientConfig, isIntegrationTestConfigured } from '../utils/testConfig';
import {
  createTestIssuerData,
  generateTestId,
  isValidatorApiAvailable,
  setupTestIssuer,
  setupTestStakeholder,
  setupTestStockClass,
} from './utils';

// Skip all tests if integration environment is not configured
const describeIntegration = isIntegrationTestConfigured() ? describe : describe.skip;

describeIntegration('OCF Operations Integration', () => {
  jest.setTimeout(180_000); // 3 minutes for integration tests

  let ocp: OcpClient;
  let validatorApiAvailable = false;
  let featuredAppRight: DisclosedContract | null = null;

  // Get a party to use as the issuer for tests
  // Can be overridden via OCP_TEST_ISSUER_PARTY environment variable
  const getIssuerParty = async (): Promise<string> => {
    // Allow override via environment variable
    const envParty = process.env.OCP_TEST_ISSUER_PARTY;
    if (envParty) {
      return envParty;
    }

    // Try to find a party from LocalNet
    const response = await ocp.client.listParties({});
    const partyDetails = response.partyDetails ?? [];

    if (partyDetails.length === 0) {
      throw new Error(
        'No parties found in LocalNet. Make sure cn-quickstart is running and parties are allocated. ' +
          'Alternatively, set OCP_TEST_ISSUER_PARTY environment variable.'
      );
    }

    // Try to find a party with common names (alice, issuer, etc.)
    const preferredNames = ['alice', 'issuer', 'admin', 'participant'];
    for (const name of preferredNames) {
      const party = partyDetails.find((p) => p.party.toLowerCase().includes(name));
      if (party) {
        return party.party;
      }
    }

    // Fall back to the first available party
    return partyDetails[0].party;
  };

  // Helper to get FeaturedAppRight (cached)
  const getFeaturedAppRightDetails = (): DisclosedContract => {
    if (!featuredAppRight) {
      throw new Error(
        'FeaturedAppRight not available. These tests require a full Canton Network setup with Validator API.'
      );
    }
    return featuredAppRight;
  };

  beforeAll(async () => {
    const config = buildIntegrationTestClientConfig();
    ocp = new OcpClient(config);

    // Check if Validator API is available (for tests requiring FeaturedAppRight)
    validatorApiAvailable = await isValidatorApiAvailable();
    if (validatorApiAvailable) {
      try {
        const validatorClient = new ValidatorApiClient({ network: 'localnet' });
        const details = await getFeaturedAppRightContractDetails(validatorClient);
        featuredAppRight = {
          templateId: details.templateId,
          contractId: details.contractId,
          createdEventBlob: details.createdEventBlob,
          synchronizerId: details.synchronizerId,
        };
      } catch {
        validatorApiAvailable = false;
      }
    }

    if (!validatorApiAvailable) {
      console.warn(
        '\n⚠️  Validator API not available - skipping tests that require FeaturedAppRight.\n' +
          '   These tests require a full Canton Network setup (not just cn-quickstart LocalNet).\n'
      );
    }
  });

  describe('Issuer operations', () => {
    test('creates issuer and reads it back as valid OCF', async () => {
      if (!validatorApiAvailable) {
        console.log('Skipping: Validator API not available');
        return;
      }

      const issuerParty = await getIssuerParty();
      const featuredAppRightContractDetails = getFeaturedAppRightDetails();

      const testSetup = await setupTestIssuer(ocp, {
        issuerParty,
        featuredAppRightContractDetails,
        issuerData: {
          id: generateTestId('issuer-ocf-test'),
          legal_name: 'Integration Test Corp',
        },
      });

      // Read back the issuer as OCF
      const ocfResult = await ocp.OpenCapTable.issuer.getIssuerAsOcf({
        contractId: testSetup.issuerContractId,
      });

      // Validate OCF structure
      expect(ocfResult.issuer.object_type).toBe('ISSUER');
      expect(ocfResult.issuer.legal_name).toBe('Integration Test Corp');

      // Validate against official OCF schema
      await validateOcfObject(ocfResult.issuer as unknown as Record<string, unknown>);
    });

    test('issuer data round-trips correctly', async () => {
      if (!validatorApiAvailable) {
        console.log('Skipping: Validator API not available');
        return;
      }

      const issuerParty = await getIssuerParty();
      const featuredAppRightContractDetails = getFeaturedAppRightDetails();

      const originalData = createTestIssuerData({
        id: generateTestId('issuer-roundtrip'),
        legal_name: 'Roundtrip Test Inc.',
        formation_date: '2023-06-15',
        country_of_formation: 'US',
        country_subdivision_of_formation: 'CA',
        dba: 'Roundtrip DBA',
        tax_ids: [{ country: 'US', tax_id: '98-7654321' }],
        comments: ['Test comment 1', 'Test comment 2'],
      });

      const testSetup = await setupTestIssuer(ocp, {
        issuerParty,
        featuredAppRightContractDetails,
        issuerData: originalData,
      });

      const ocfResult = await ocp.OpenCapTable.issuer.getIssuerAsOcf({
        contractId: testSetup.issuerContractId,
      });

      // Verify data round-trip
      expect(ocfResult.issuer.id).toBe(originalData.id);
      expect(ocfResult.issuer.legal_name).toBe(originalData.legal_name);
      expect(ocfResult.issuer.formation_date).toBe(originalData.formation_date);
      expect(ocfResult.issuer.country_of_formation).toBe(originalData.country_of_formation);
      expect(ocfResult.issuer.country_subdivision_of_formation).toBe(originalData.country_subdivision_of_formation);
      expect(ocfResult.issuer.dba).toBe(originalData.dba);
    });
  });

  describe('Stakeholder operations', () => {
    test('creates stakeholder and reads it back as valid OCF', async () => {
      if (!validatorApiAvailable) {
        console.log('Skipping: Validator API not available');
        return;
      }

      const issuerParty = await getIssuerParty();
      const featuredAppRightContractDetails = getFeaturedAppRightDetails();

      // First create an issuer
      const issuerSetup = await setupTestIssuer(ocp, {
        issuerParty,
        featuredAppRightContractDetails,
      });

      // Then create a stakeholder
      const stakeholderSetup = await setupTestStakeholder(ocp, {
        issuerContractId: issuerSetup.issuerContractId,
        issuerParty,
        featuredAppRightContractDetails,
        stakeholderData: {
          id: generateTestId('stakeholder-ocf-test'),
          name: { legal_name: 'John Doe', first_name: 'John', last_name: 'Doe' },
          stakeholder_type: 'INDIVIDUAL',
        },
      });

      // Read back as OCF
      const ocfResult = await ocp.OpenCapTable.stakeholder.getStakeholderAsOcf({
        contractId: stakeholderSetup.stakeholderContractId,
      });

      // Validate OCF structure
      expect(ocfResult.stakeholder.object_type).toBe('STAKEHOLDER');
      expect(ocfResult.stakeholder.name.legal_name).toBe('John Doe');
      expect(ocfResult.stakeholder.stakeholder_type).toBe('INDIVIDUAL');

      // Validate against official OCF schema
      await validateOcfObject(ocfResult.stakeholder as unknown as Record<string, unknown>);
    });

    test('creates institutional stakeholder', async () => {
      if (!validatorApiAvailable) {
        console.log('Skipping: Validator API not available');
        return;
      }

      const issuerParty = await getIssuerParty();
      const featuredAppRightContractDetails = getFeaturedAppRightDetails();

      const issuerSetup = await setupTestIssuer(ocp, {
        issuerParty,
        featuredAppRightContractDetails,
      });

      const stakeholderSetup = await setupTestStakeholder(ocp, {
        issuerContractId: issuerSetup.issuerContractId,
        issuerParty,
        featuredAppRightContractDetails,
        stakeholderData: {
          id: generateTestId('stakeholder-institution'),
          name: { legal_name: 'Venture Capital Fund LP' },
          stakeholder_type: 'INSTITUTION',
        },
      });

      const ocfResult = await ocp.OpenCapTable.stakeholder.getStakeholderAsOcf({
        contractId: stakeholderSetup.stakeholderContractId,
      });

      expect(ocfResult.stakeholder.stakeholder_type).toBe('INSTITUTION');
      await validateOcfObject(ocfResult.stakeholder as unknown as Record<string, unknown>);
    });
  });

  describe('StockClass operations', () => {
    test('creates stock class and reads it back as valid OCF', async () => {
      if (!validatorApiAvailable) {
        console.log('Skipping: Validator API not available');
        return;
      }

      const issuerParty = await getIssuerParty();
      const featuredAppRightContractDetails = getFeaturedAppRightDetails();

      const issuerSetup = await setupTestIssuer(ocp, {
        issuerParty,
        featuredAppRightContractDetails,
      });

      const stockClassSetup = await setupTestStockClass(ocp, {
        issuerContractId: issuerSetup.issuerContractId,
        issuerParty,
        featuredAppRightContractDetails,
        stockClassData: {
          id: generateTestId('stock-class-common'),
          name: 'Common Stock',
          class_type: 'COMMON',
          default_id_prefix: 'CS-',
          initial_shares_authorized: '10000000',
          votes_per_share: '1',
          seniority: '1',
        },
      });

      const ocfResult = await ocp.OpenCapTable.stockClass.getStockClassAsOcf({
        contractId: stockClassSetup.stockClassContractId,
      });

      expect(ocfResult.stockClass.object_type).toBe('STOCK_CLASS');
      expect(ocfResult.stockClass.name).toBe('Common Stock');
      expect(ocfResult.stockClass.class_type).toBe('COMMON');

      await validateOcfObject(ocfResult.stockClass as unknown as Record<string, unknown>);
    });

    test('creates preferred stock class', async () => {
      if (!validatorApiAvailable) {
        console.log('Skipping: Validator API not available');
        return;
      }

      const issuerParty = await getIssuerParty();
      const featuredAppRightContractDetails = getFeaturedAppRightDetails();

      const issuerSetup = await setupTestIssuer(ocp, {
        issuerParty,
        featuredAppRightContractDetails,
      });

      const stockClassSetup = await setupTestStockClass(ocp, {
        issuerContractId: issuerSetup.issuerContractId,
        issuerParty,
        featuredAppRightContractDetails,
        stockClassData: {
          id: generateTestId('stock-class-preferred'),
          name: 'Series A Preferred',
          class_type: 'PREFERRED',
          default_id_prefix: 'PS-A-',
          initial_shares_authorized: '1000000',
          votes_per_share: '1',
          seniority: '2',
          price_per_share: { amount: '10.00', currency: 'USD' },
          liquidation_preference_multiple: '1',
        },
      });

      const ocfResult = await ocp.OpenCapTable.stockClass.getStockClassAsOcf({
        contractId: stockClassSetup.stockClassContractId,
      });

      expect(ocfResult.stockClass.class_type).toBe('PREFERRED');
      await validateOcfObject(ocfResult.stockClass as unknown as Record<string, unknown>);
    });
  });

  describe('Full cap table workflow', () => {
    test('creates complete cap table with issuer, stakeholders, stock class', async () => {
      if (!validatorApiAvailable) {
        console.log('Skipping: Validator API not available');
        return;
      }

      const issuerParty = await getIssuerParty();
      const featuredAppRightContractDetails = getFeaturedAppRightDetails();

      // 1. Create issuer
      const issuerSetup = await setupTestIssuer(ocp, {
        issuerParty,
        featuredAppRightContractDetails,
        issuerData: {
          id: generateTestId('full-workflow-issuer'),
          legal_name: 'Full Workflow Corp',
        },
      });

      // 2. Create stock class
      const stockClassSetup = await setupTestStockClass(ocp, {
        issuerContractId: issuerSetup.issuerContractId,
        issuerParty,
        featuredAppRightContractDetails,
        stockClassData: {
          id: generateTestId('full-workflow-stock'),
          name: 'Common Stock',
          class_type: 'COMMON',
          default_id_prefix: 'FW-',
          initial_shares_authorized: '50000000',
          votes_per_share: '1',
          seniority: '1',
        },
      });

      // 3. Create stakeholders
      const founderSetup = await setupTestStakeholder(ocp, {
        issuerContractId: issuerSetup.issuerContractId,
        issuerParty,
        featuredAppRightContractDetails,
        stakeholderData: {
          id: generateTestId('founder-1'),
          name: { legal_name: 'Jane Founder', first_name: 'Jane', last_name: 'Founder' },
          stakeholder_type: 'INDIVIDUAL',
          current_relationships: ['FOUNDER', 'EMPLOYEE'],
        },
      });

      const investorSetup = await setupTestStakeholder(ocp, {
        issuerContractId: issuerSetup.issuerContractId,
        issuerParty,
        featuredAppRightContractDetails,
        stakeholderData: {
          id: generateTestId('investor-1'),
          name: { legal_name: 'Angel Investor LLC' },
          stakeholder_type: 'INSTITUTION',
        },
      });

      // Verify all entities were created
      const issuerOcf = await ocp.OpenCapTable.issuer.getIssuerAsOcf({
        contractId: issuerSetup.issuerContractId,
      });
      expect(issuerOcf.issuer.legal_name).toBe('Full Workflow Corp');

      const stockClassOcf = await ocp.OpenCapTable.stockClass.getStockClassAsOcf({
        contractId: stockClassSetup.stockClassContractId,
      });
      expect(stockClassOcf.stockClass.name).toBe('Common Stock');

      const founderOcf = await ocp.OpenCapTable.stakeholder.getStakeholderAsOcf({
        contractId: founderSetup.stakeholderContractId,
      });
      expect(founderOcf.stakeholder.name.legal_name).toBe('Jane Founder');

      const investorOcf = await ocp.OpenCapTable.stakeholder.getStakeholderAsOcf({
        contractId: investorSetup.stakeholderContractId,
      });
      expect(investorOcf.stakeholder.name.legal_name).toBe('Angel Investor LLC');

      // Validate all against OCF schemas
      await validateOcfObject(issuerOcf.issuer as unknown as Record<string, unknown>);
      await validateOcfObject(stockClassOcf.stockClass as unknown as Record<string, unknown>);
      await validateOcfObject(founderOcf.stakeholder as unknown as Record<string, unknown>);
      await validateOcfObject(investorOcf.stakeholder as unknown as Record<string, unknown>);
    });
  });
});
