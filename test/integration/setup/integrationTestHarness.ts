/**
 * Shared test harness for integration tests.
 *
 * This module provides a comprehensive setup for all integration tests, including:
 *
 * - DAML package deployment (uploads both OpenCapTable DARs to LocalNet, interfaces first)
 * - Allocation of the issuer, system operator and transfer agent parties of a book
 * - Creation of the OcpFactory that gives each cap table its ID
 *
 * The harness ensures tests run against a fully configured environment with the OCP packages deployed and a factory
 * ready for the three-step setup (see `setupTestBook`). Use createIntegrationTestSuite() to wrap your test describe
 * block.
 */

import { buildIntegrationTestClientConfig } from '@fairmint/canton-dev-tools/testing';
import type { OcpClient } from '../../../src/OcpClient';
import type { OcpFactoryIdentity } from '../../../src/types/setup';
import { createLedgerJsonApiClient } from '../../utils/cantonNodeSdkCompat';
import { allocateTestParties, createTestFactory, deployOcpPackages, type DeploymentResult } from './contractDeployment';

/** Shared context available to all integration tests. */
export interface IntegrationTestContext {
  /** The OCP client instance for interacting with Canton, configured with the harness's factory identity. */
  ocp: OcpClient;
  /** The party that owns the cap tables the tests create. */
  issuerParty: string;
  /** The system operator party (signs the factory and the authorizations). */
  systemOperatorParty: string;
  /** The transfer agent party: the only party that writes a book. */
  transferAgentParty: string;
  /** The factory every cap table of the run comes from. */
  factory: OcpFactoryIdentity;
  /** The ledger user the client is authenticated as; it acts as the three parties. */
  userId: string;
  /** Deployment result with the package IDs on the ledger. */
  deployment: DeploymentResult;
}

/** Internal state managed by the harness. */
interface HarnessState {
  context: IntegrationTestContext | null;
  initialized: boolean;
  initError: Error | null;
}

// Use global object to persist state across Jest's module isolation
// This ensures the harness only initializes once even when running multiple test suites
declare global {
  var __integrationTestHarnessState: HarnessState | undefined;
}

const state: HarnessState = global.__integrationTestHarnessState ?? {
  context: null,
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
 * 1. Creates the ledger client
 * 2. Deploys the OCP DAML packages (if needed)
 * 3. Allocates distinct issuer, system operator and transfer agent parties
 * 4. Creates the OcpFactory of the run
 */
async function initializeHarness(): Promise<void> {
  if (state.initialized) {
    if (state.initError) throw state.initError;
    return;
  }

  try {
    console.log('\nInitializing integration test harness...\n');

    // Shared-secret mode authenticates as a ParticipantAdmin user: it uploads DARs and allocates parties
    // (see setupSharedSecretEnv.ts)
    const ledger = createLedgerJsonApiClient(buildIntegrationTestClientConfig());

    console.log('Deploying OCP packages...');
    const deployment = await deployOcpPackages(ledger);

    console.log('Allocating parties...');
    const parties = await allocateTestParties(ledger);
    console.log(`   Issuer: ${parties.issuerParty}`);
    console.log(`   System operator: ${parties.systemOperatorParty}`);
    console.log(`   Transfer agent: ${parties.transferAgentParty}`);

    console.log('Creating OcpFactory...');
    const { ocp, factory, contractId } = await createTestFactory(ledger, parties);
    console.log(`   OcpFactory ${factory.factoryId}: ${contractId}`);

    state.context = {
      ocp,
      issuerParty: parties.issuerParty,
      systemOperatorParty: parties.systemOperatorParty,
      transferAgentParty: parties.transferAgentParty,
      factory,
      userId: parties.userId,
      deployment,
    };

    console.log('\nIntegration test harness initialized successfully!\n');
    state.initialized = true;
  } catch (error) {
    state.initError = error instanceof Error ? error : new Error(String(error));
    state.initialized = true;
    console.error('\nIntegration test harness initialization failed:', state.initError.message, '\n');
    throw state.initError;
  }
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

  if (!state.context) {
    throw new Error('Test harness not fully initialized. Check initialization logs for errors.');
  }

  return state.context;
}

/**
 * Create an integration test suite with shared setup.
 *
 * This is the main entry point for creating integration tests. It handles:
 *
 * - Initializing the test harness before all tests (includes package deployment)
 * - Setting a longer timeout for integration tests
 *
 * Note: If LocalNet is not running, tests will fail (not skip). This is intentional - integration tests should fail
 * clearly when infrastructure is unavailable.
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
  state.context = null;
  state.initialized = false;
  state.initError = null;
}
