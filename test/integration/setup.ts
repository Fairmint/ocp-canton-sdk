import type { ClientConfig } from '@fairmint/canton-node-sdk';
import { LedgerJsonApiClient, ValidatorApiClient } from '@fairmint/canton-node-sdk';

/**
 * Integration test setup for localnet tests
 *
 * Prerequisites:
 *
 * - LocalNet must be running (set up by CI or manually via cn-quickstart)
 * - DAR files must be deployed to localnet
 * - Environment variables configured (see .env.localnet)
 *
 * These clients are configured to connect to LocalNet and are used by integration tests to validate SDK connectivity
 * and OCP operations against a running Canton network.
 *
 * Note: We use 'devnet' as the network type with custom API configurations for localnet
 */

const config: ClientConfig = {
  network: 'devnet',
  provider: 'app-provider',
};

export const testClients = {
  ledgerJsonApi: new LedgerJsonApiClient(config),
  validatorApi: new ValidatorApiClient(config),
  config,
};
