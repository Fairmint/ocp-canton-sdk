/**
 * Shared test harness for integration tests.
 *
 * This module provides a comprehensive setup for all integration tests, including:
 *
 * - DAML contract deployment (uploads DAR files to LocalNet)
 * - OcpFactory contract creation (the entry point for all OCP operations)
 * - Party discovery
 * - FeaturedAppRight contract detection
 * - Issuer authorization
 *
 * The harness ensures tests run against a fully configured environment with all necessary contracts deployed and
 * factory created.
 *
 * @example
 *   ```typescript
 *   import { createIntegrationTestSuite, IntegrationTestContext } from '../setup';
 *
 *   createIntegrationTestSuite('Issuer operations', (getContext) => {
 *     test('creates issuer', async () => {
 *       const ctx = getContext();
 *       const issuerSetup = await setupTestIssuer(ctx.ocp, {
 *         issuerParty: ctx.issuerParty,
 *         featuredAppRightContractDetails: ctx.featuredAppRight,
 *       });
 *       // ...
 *     });
 *   });
 *   ```;
 */

import { ValidatorApiClient } from '@fairmint/canton-node-sdk';
import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { OcpClient } from '../../../src/OcpClient';
import { buildIntegrationTestClientConfig, isIntegrationTestConfigured } from '../../utils/testConfig';
import {
  createFeaturedAppRight,
  deployAndCreateFactory,
  lookupFeaturedAppRightViaScanApi,
  type DeploymentResult,
} from './contractDeployment';

/** Shared context available to all integration tests. */
export interface IntegrationTestContext {
  /** The OCP client instance for interacting with Canton. */
  ocp: OcpClient;
  /** The party ID to use as the issuer in tests. */
  issuerParty: string;
  /** The system operator party (owns the OcpFactory). */
  systemOperatorParty: string;
  /** The FeaturedAppRight disclosed contract, required for most operations. */
  featuredAppRight: DisclosedContract;
  /** The OcpFactory contract ID. */
  ocpFactoryContractId: string;
  /** Deployment result with package IDs and factory info. */
  deployment: DeploymentResult;
}

/** Internal state managed by the harness. */
interface HarnessState {
  ocp: OcpClient | null;
  issuerParty: string | null;
  systemOperatorParty: string | null;
  featuredAppRight: DisclosedContract | null;
  ocpFactoryContractId: string | null;
  validatorApiAvailable: boolean;
  deployment: DeploymentResult | null;
  initialized: boolean;
  initError: Error | null;
}

const state: HarnessState = {
  ocp: null,
  issuerParty: null,
  systemOperatorParty: null,
  featuredAppRight: null,
  ocpFactoryContractId: null,
  validatorApiAvailable: false,
  deployment: null,
  initialized: false,
  initError: null,
};

/**
 * Initialize the test harness. Called once before all tests.
 *
 * This performs the full setup:
 *
 * 1. Creates OCP client
 * 2. Discovers parties
 * 3. Gets DSO party ID from Validator API
 * 4. Creates FeaturedAppRight for the system operator (self-grant on DevNet)
 * 5. Deploys DAML contracts (if needed)
 * 6. Creates OcpFactory contract (if needed)
 */
async function initializeHarness(): Promise<void> {
  if (state.initialized) {
    if (state.initError) throw state.initError;
    return;
  }

  try {
    console.log('\n🔧 Initializing integration test harness...\n');

    const config = buildIntegrationTestClientConfig();
    state.ocp = new OcpClient(config);

    // Discover the party we're authenticated as from the ledger
    // In cn-quickstart LocalNet with OAuth2, we're authenticated as the app_provider party
    console.log('👥 Discovering authenticated party...');

    // Use listParties to find which parties we have access to
    // The first party returned should be the one we're authenticated as
    const partiesResponse = await state.ocp.client.listParties({});
    const partyDetails = partiesResponse.partyDetails ?? [];

    if (partyDetails.length === 0) {
      throw new Error('No parties found. Make sure cn-quickstart is running and parties are allocated.');
    }

    // Find the app_provider party (what we're authenticated as in cn-quickstart)
    const appProviderParty = partyDetails.find(
      (p) => p.party.toLowerCase().includes('app_provider') || p.party.toLowerCase().includes('provider')
    );
    const authenticatedParty = appProviderParty?.party ?? partyDetails[0].party;

    console.log(`   Available parties: ${partyDetails.map((p) => p.party.split('::')[0]).join(', ')}`);
    console.log(`   Using party: ${authenticatedParty}`);

    // In LocalNet, we use the same party for both issuer and system operator
    // because we can only act as the party we're authenticated as
    state.issuerParty = authenticatedParty;
    state.systemOperatorParty = authenticatedParty;

    // Get DSO party ID and synchronizer ID from Validator API
    console.log('🔍 Getting DSO party ID and synchronizer ID...');
    const validatorClient = new ValidatorApiClient({ network: 'localnet' });
    const dsoResponse = await validatorClient.getDsoPartyId();
    const dsoPartyId = dsoResponse.dso_party_id;
    const amuletRules = await validatorClient.getAmuletRules();
    const synchronizerId = amuletRules.amulet_rules.domain_id;
    console.log(`   DSO party: ${dsoPartyId}`);
    console.log(`   Synchronizer: ${synchronizerId}`);

    // Try to look up existing FeaturedAppRight via the scan API
    console.log(`📋 Looking up FeaturedAppRight for ${state.issuerParty}...`);
    let featuredAppRightResult = await lookupFeaturedAppRightViaScanApi(state.issuerParty, synchronizerId);
    if (featuredAppRightResult) {
      console.log(`   Found existing FeaturedAppRight: ${featuredAppRightResult.contractId}`);
    }

    // If no existing FeaturedAppRight, try to create one
    if (!featuredAppRightResult) {
      console.log('   Attempting to create FeaturedAppRight via AmuletRules_DevNet_FeatureApp...');
      try {
        featuredAppRightResult = await createFeaturedAppRight(state.ocp.client, state.issuerParty, dsoPartyId);
        console.log(`   Created FeaturedAppRight: ${featuredAppRightResult.contractId}`);
      } catch (createErr) {
        // FeaturedAppRight creation failed - this is common in LocalNet OAuth2 setup
        // where the app_provider doesn't have permission to exercise AmuletRules choices
        const errorMessage = createErr instanceof Error ? createErr.message : String(createErr);
        throw new Error(
          `FeaturedAppRight not available and creation failed.\n\n` +
            `Details: ${errorMessage}\n\n` +
            `The cn-quickstart LocalNet OAuth2 setup may not grant sufficient permissions ` +
            `to create FeaturedAppRight contracts via AmuletRules_DevNet_FeatureApp.\n\n` +
            `Possible solutions:\n` +
            `1. Use shared-secret auth mode instead of OAuth2 in cn-quickstart\n` +
            `2. Manually create a FeaturedAppRight for the app_provider party\n` +
            `3. Run tests against DevNet where FeaturedAppRight is pre-configured`
        );
      }
    }

    state.featuredAppRight = {
      templateId: featuredAppRightResult.templateId,
      contractId: featuredAppRightResult.contractId,
      createdEventBlob: featuredAppRightResult.createdEventBlob,
      synchronizerId: featuredAppRightResult.synchronizerId,
    };
    state.validatorApiAvailable = true;
    console.log(`   FeaturedAppRight contract: ${featuredAppRightResult.contractId}`);

    // Deploy contracts and create factory
    console.log('📦 Deploying contracts and creating OcpFactory...');
    state.deployment = await deployAndCreateFactory(
      state.ocp.client,
      state.issuerParty,
      state.featuredAppRight.contractId
    );
    state.ocpFactoryContractId = state.deployment.ocpFactoryContractId;
    console.log(`   OcpFactory contract: ${state.ocpFactoryContractId}`);
    console.log(`   Packages deployed: ${state.deployment.packageIds.length}`);

    console.log('\n✅ Integration test harness initialized successfully!\n');
    state.initialized = true;
  } catch (error) {
    state.initError = error instanceof Error ? error : new Error(String(error));
    state.initialized = true;
    console.error('\n❌ Integration test harness initialization failed:', state.initError.message, '\n');
    throw state.initError;
  }
}

/**
 * Discover parties to use for tests.
 *
 * Can be overridden via environment variables:
 *
 * - OCP_TEST_ISSUER_PARTY
 * - OCP_TEST_SYSTEM_OPERATOR_PARTY
 *
 * @deprecated Currently unused - party discovery is done inline in initializeHarness. Kept for potential future use
 *   with multi-party test scenarios.
 */
async function _discoverParties(ocp: OcpClient): Promise<{ issuerParty: string; systemOperatorParty: string }> {
  // Allow override via environment variables
  const envIssuerParty = process.env.OCP_TEST_ISSUER_PARTY;
  const envSystemOperatorParty = process.env.OCP_TEST_SYSTEM_OPERATOR_PARTY;

  // Try to find parties from LocalNet
  const response = await ocp.client.listParties({});
  const partyDetails = response.partyDetails ?? [];

  if (partyDetails.length === 0) {
    throw new Error(
      'No parties found in LocalNet. Make sure cn-quickstart is running and parties are allocated. ' +
        'Alternatively, set OCP_TEST_ISSUER_PARTY and OCP_TEST_SYSTEM_OPERATOR_PARTY environment variables.'
    );
  }

  // Helper to find a party by name hints
  const findParty = (hints: string[]): string | null => {
    for (const hint of hints) {
      const party = partyDetails.find((p) => p.party.toLowerCase().includes(hint.toLowerCase()));
      if (party) return party.party;
    }
    return null;
  };

  // System operator (usually "intellect" or "admin" or first party)
  const systemOperatorParty =
    envSystemOperatorParty ?? findParty(['intellect', 'admin', 'operator', 'sv']) ?? partyDetails[0].party;

  // Issuer party (usually "alice" or different from system operator)
  let issuerParty = envIssuerParty ?? findParty(['alice', 'issuer', 'company', 'provider']);

  // If no specific issuer found, use first party that's not the system operator
  if (!issuerParty) {
    const otherParty = partyDetails.find((p) => p.party !== systemOperatorParty);
    issuerParty = otherParty?.party ?? systemOperatorParty;
  }

  return { issuerParty, systemOperatorParty };
}

/**
 * Get the current test context.
 *
 * @throws Error if the harness has not been initialized or failed to initialize.
 */
export function getTestContext(): IntegrationTestContext {
  if (!state.initialized) {
    throw new Error('Test harness not initialized. Call initializeHarness() first.');
  }

  if (state.initError) {
    throw state.initError;
  }

  if (!state.ocp || !state.issuerParty || !state.systemOperatorParty || !state.featuredAppRight || !state.deployment) {
    throw new Error('Test harness not fully initialized. Check initialization logs for errors.');
  }

  return {
    ocp: state.ocp,
    issuerParty: state.issuerParty,
    systemOperatorParty: state.systemOperatorParty,
    featuredAppRight: state.featuredAppRight,
    ocpFactoryContractId: state.deployment.ocpFactoryContractId,
    deployment: state.deployment,
  };
}

/**
 * Create an integration test suite with shared setup.
 *
 * This is the main entry point for creating integration tests. It handles:
 *
 * - Skipping the entire suite if integration is not configured (env vars not set)
 * - Initializing the test harness before all tests (includes contract deployment)
 * - Setting a longer timeout for integration tests
 *
 * Note: If LocalNet is not running, tests will fail (not skip). This is intentional - integration tests should fail
 * clearly when infrastructure is unavailable.
 *
 * @example
 *   ```typescript
 *   createIntegrationTestSuite('Issuer operations', (getContext) => {
 *     test('creates issuer', async () => {
 *       const ctx = getContext();
 *       // ... test implementation
 *     });
 *   });
 *   ```;
 *
 * @param name - The name of the test suite
 * @param testFn - A function that defines the tests, receives the test context getter
 */
export function createIntegrationTestSuite(
  name: string,
  testFn: (getContext: () => IntegrationTestContext) => void
): void {
  // Skip the entire suite if integration is not configured
  const describeImpl = isIntegrationTestConfigured() ? describe : describe.skip;

  describeImpl(name, () => {
    // Set longer timeout for integration tests (5 minutes for deployment)
    jest.setTimeout(300_000);

    beforeAll(async () => {
      await initializeHarness();
    });

    // Provide a function to get context (deferred to allow beforeAll to run first)
    testFn(() => getTestContext());
  });
}

/**
 * Reset the harness state. Useful for testing the harness itself.
 *
 * @internal
 */
export function resetHarnessState(): void {
  state.ocp = null;
  state.issuerParty = null;
  state.systemOperatorParty = null;
  state.featuredAppRight = null;
  state.ocpFactoryContractId = null;
  state.validatorApiAvailable = false;
  state.deployment = null;
  state.initialized = false;
  state.initError = null;
}
