/**
 * Shared test harness for integration tests.
 *
 * This module provides a common setup for all integration tests, including:
 *
 * - OCP client initialization
 * - Party discovery
 * - FeaturedAppRight contract detection
 * - Graceful skipping when LocalNet/Validator API is unavailable
 *
 * @example
 *   ```typescript
 *   import { createIntegrationTestSuite, IntegrationTestContext } from '../setup';
 *
 *   createIntegrationTestSuite('Issuer operations', (ctx: IntegrationTestContext) => {
 *     test('creates issuer', async () => {
 *       const issuerSetup = await setupTestIssuer(ctx.ocp, {
 *         issuerParty: ctx.issuerParty,
 *         featuredAppRightContractDetails: ctx.featuredAppRight,
 *       });
 *       // ...
 *     });
 *   });
 *   ```;
 */

import { getFeaturedAppRightContractDetails, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { OcpClient } from '../../../src/OcpClient';
import { buildIntegrationTestClientConfig, isIntegrationTestConfigured } from '../../utils/testConfig';
import { isValidatorApiAvailable } from '../utils';

/** Shared context available to all integration tests. */
export interface IntegrationTestContext {
  /** The OCP client instance for interacting with Canton. */
  ocp: OcpClient;
  /** The party ID to use as the issuer in tests. */
  issuerParty: string;
  /** The FeaturedAppRight disclosed contract, required for most operations. */
  featuredAppRight: DisclosedContract;
  /** Whether the Validator API is available (determines if tests can run). */
  validatorApiAvailable: boolean;
}

/** Internal state managed by the harness. */
interface HarnessState {
  ocp: OcpClient | null;
  issuerParty: string | null;
  featuredAppRight: DisclosedContract | null;
  validatorApiAvailable: boolean;
  initialized: boolean;
}

const state: HarnessState = {
  ocp: null,
  issuerParty: null,
  featuredAppRight: null,
  validatorApiAvailable: false,
  initialized: false,
};

/**
 * Initialize the test harness. Called once before all tests.
 *
 * Sets up the OCP client, discovers parties, and fetches the FeaturedAppRight contract.
 */
async function initializeHarness(): Promise<void> {
  if (state.initialized) {
    return;
  }

  const config = buildIntegrationTestClientConfig();
  state.ocp = new OcpClient(config);

  // Check if Validator API is available
  state.validatorApiAvailable = await isValidatorApiAvailable();

  if (state.validatorApiAvailable) {
    try {
      const validatorClient = new ValidatorApiClient({ network: 'localnet' });
      const details = await getFeaturedAppRightContractDetails(validatorClient);
      state.featuredAppRight = {
        templateId: details.templateId,
        contractId: details.contractId,
        createdEventBlob: details.createdEventBlob,
        synchronizerId: details.synchronizerId,
      };

      // Discover issuer party
      state.issuerParty = await discoverIssuerParty(state.ocp);
    } catch (error) {
      state.validatorApiAvailable = false;
      console.error(
        'Validator API initialization failed in integration test harness; treating Validator API as unavailable.',
        error
      );
    }
  }

  if (!state.validatorApiAvailable) {
    console.warn(
      '\n⚠️  Validator API not available - skipping tests that require FeaturedAppRight.\n' +
        '   These tests require a full Canton Network setup (not just cn-quickstart LocalNet).\n'
    );
  }

  state.initialized = true;
}

/**
 * Discover a party to use as the issuer for tests.
 *
 * Can be overridden via OCP_TEST_ISSUER_PARTY environment variable.
 */
async function discoverIssuerParty(ocp: OcpClient): Promise<string> {
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
}

/**
 * Get the current test context.
 *
 * @throws Error if the harness has not been initialized or Validator API is unavailable.
 */
export function getTestContext(): IntegrationTestContext {
  if (!state.initialized) {
    throw new Error('Test harness not initialized. Call initializeHarness() first.');
  }

  if (!state.ocp || !state.issuerParty || !state.featuredAppRight) {
    throw new Error('Test harness not fully initialized. Validator API may not be available.');
  }

  return {
    ocp: state.ocp,
    issuerParty: state.issuerParty,
    featuredAppRight: state.featuredAppRight,
    validatorApiAvailable: state.validatorApiAvailable,
  };
}

/**
 * Check if tests should be skipped due to missing Validator API.
 *
 * Use this in tests that require FeaturedAppRight to gracefully skip.
 */
export function shouldSkipTest(): boolean {
  return !state.validatorApiAvailable;
}

/**
 * Skip a test with a warning message if Validator API is unavailable.
 *
 * @returns True if the test should be skipped (caller should return early)
 */
export function skipIfValidatorUnavailable(): boolean {
  if (!state.validatorApiAvailable) {
    console.log('Skipping: Validator API not available');
    return true;
  }
  return false;
}

/**
 * Create an integration test suite with shared setup.
 *
 * This is the main entry point for creating integration tests. It handles:
 *
 * - Skipping the entire suite if integration is not configured
 * - Initializing the test harness before all tests
 * - Setting a longer timeout for integration tests
 *
 * @example
 *   ```typescript
 *   createIntegrationTestSuite('Issuer operations', (getContext) => {
 *     test('creates issuer', async () => {
 *       if (skipIfValidatorUnavailable()) return;
 *       const ctx = getContext();
 *       // ... test implementation
 *     });
 *   });
 *   ```;
 *
 * @param name - The name of the test suite
 * @param testFn - A function that defines the tests, receives the test context
 */
export function createIntegrationTestSuite(
  name: string,
  testFn: (getContext: () => IntegrationTestContext) => void
): void {
  // Skip the entire suite if integration is not configured
  const describeImpl = isIntegrationTestConfigured() ? describe : describe.skip;

  describeImpl(name, () => {
    // Set longer timeout for integration tests
    jest.setTimeout(180_000); // 3 minutes

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
  state.featuredAppRight = null;
  state.validatorApiAvailable = false;
  state.initialized = false;
}
