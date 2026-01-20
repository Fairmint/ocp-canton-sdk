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
 *
 *
 *   createIntegrationTestSuite('Issuer operations', (getContext) => {
 *     test('creates issuer', async () => {
 *       const ctx = getContext();
 *       const issuerSetup = await setupTestIssuer(ctx.ocp, { issuerParty: ctx.issuerParty });
 *     });
 *   });
 *   ```;
 */

import { ValidatorApiClient } from '@fairmint/canton-node-sdk';
import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { OcpClient } from '../../../src/OcpClient';
import { buildIntegrationTestClientConfig } from '../../utils/testConfig';
import { createFeaturedAppRight, deployAndCreateFactory, type DeploymentResult } from './contractDeployment';

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

// Use global object to persist state across Jest's module isolation
// This ensures the harness only initializes once even when running multiple test suites
declare global {
  var __integrationTestHarnessState: HarnessState | undefined;
}

const state: HarnessState = global.__integrationTestHarnessState ?? {
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

// Store reference in global for persistence across module reloads
global.__integrationTestHarnessState = state;

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

    // Set the party ID on the client for operations that need it
    // (e.g., getEventsByContractId uses partyId for visibility filtering)
    state.ocp.client.setPartyId(authenticatedParty);

    // In shared-secret mode, we need to ensure the ledger-api-user has CanActAs rights
    // for the app_provider party. This is done automatically in OAuth2 mode but not
    // in shared-secret mode where we use ParticipantAdmin privileges.
    const authMode = process.env.OCP_TEST_AUTH_MODE;
    if (authMode === 'shared-secret') {
      console.log('🔑 Ensuring user rights for shared-secret mode...');
      const userId = 'ledger-api-user';

      // Check current rights
      const rightsResponse = await state.ocp.client.listUserRights({ userId });
      const currentRights = rightsResponse.rights ?? [];
      const hasActAs = currentRights.some(
        (r) => 'CanActAs' in r.kind && r.kind.CanActAs.value.party === authenticatedParty
      );

      if (!hasActAs) {
        console.log(`   Granting CanActAs for ${authenticatedParty.split('::')[0]}...`);
        await state.ocp.client.grantUserRights({
          userId,
          rights: [{ kind: { CanActAs: { value: { party: authenticatedParty } } } }],
        });
        console.log('   Rights granted successfully');
      } else {
        console.log('   User already has CanActAs rights');
      }
    }

    // Get DSO party ID and synchronizer ID from Validator API
    // Pass the same config to ensure auth mode consistency
    console.log('🔍 Getting DSO party ID and synchronizer ID...');
    const validatorClient = new ValidatorApiClient(config);
    const dsoResponse = await validatorClient.getDsoPartyId();
    const dsoPartyId = dsoResponse.dso_party_id;
    const amuletRules = await validatorClient.getAmuletRules();
    const synchronizerId = amuletRules.amulet_rules.domain_id;
    console.log(`   DSO party: ${dsoPartyId}`);
    console.log(`   Synchronizer: ${synchronizerId}`);

    // Always create a fresh FeaturedAppRight to ensure we have the latest package IDs
    // (After DAML recompilations, existing contracts may have stale template IDs)
    console.log(`📋 Creating fresh FeaturedAppRight for ${state.issuerParty}...`);
    let featuredAppRightResult: Awaited<ReturnType<typeof createFeaturedAppRight>>;
    try {
      featuredAppRightResult = await createFeaturedAppRight(state.ocp.client, state.issuerParty, validatorClient);
      console.log(`   Created FeaturedAppRight: ${featuredAppRightResult.contractId}`);
    } catch (createErr) {
      // FeaturedAppRight creation failed
      const errorMessage = createErr instanceof Error ? createErr.message : String(createErr);
      throw new Error(
        `FeaturedAppRight creation failed.\n\n` +
          `Details: ${errorMessage}\n\n` +
          `Make sure cn-quickstart LocalNet is running and healthy.`
      );
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
    state.deployment = await deployAndCreateFactory(state.ocp.client, state.issuerParty);
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
 * @deprecated Currently unused - party discovery is done inline in initializeHarness. Kept for potential future use
 *   with multi-party test scenarios.
 */
async function _discoverParties(ocp: OcpClient): Promise<{ issuerParty: string; systemOperatorParty: string }> {
  // Try to find parties from LocalNet
  const response = await ocp.client.listParties({});
  const partyDetails = response.partyDetails ?? [];

  if (partyDetails.length === 0) {
    throw new Error('No parties found in LocalNet. Make sure cn-quickstart is running and parties are allocated.');
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
  const systemOperatorParty = findParty(['intellect', 'admin', 'operator', 'sv']) ?? partyDetails[0].party;

  // Issuer party (usually "alice" or different from system operator)
  let issuerParty = findParty(['alice', 'issuer', 'company', 'provider']);

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
 *   `createIntegrationTestSuite('Issuer
 *   ops', (getContext) => { test('...', () => { const ctx = getContext(); }); })`;
 *
 * @param name - The name of the test suite
 * @param testFn - A function that defines the tests, receives the test context getter
 */
export function createIntegrationTestSuite(
  name: string,
  testFn: (getContext: () => IntegrationTestContext) => void
): void {
  describe(name, () => {
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
