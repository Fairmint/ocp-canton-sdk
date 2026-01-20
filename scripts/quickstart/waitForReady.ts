/**
 * Utility script to wait for the Ledger JSON API to be ready.
 *
 * This script is used by CI to ensure LocalNet is fully started before running tests. Defaults to LocalNet
 * configuration. Use OCP_TEST_AUTH_MODE=shared-secret for shared-secret mode.
 *
 * @example
 *   `npx
 *   ts-node scripts/quickstart/waitForReady.ts`;
 */

import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api';
import { buildIntegrationTestClientConfig, retry } from '../../test/utils/testConfig';

/**
 * Re-export buildIntegrationTestClientConfig as buildQuickstartClientConfig for backwards compatibility. This is used
 * by deployContracts.ts and other scripts.
 */
export { buildIntegrationTestClientConfig as buildQuickstartClientConfig } from '../../test/utils/testConfig';

/**
 * Wait for the Ledger JSON API to be ready and reachable.
 *
 * @param params - Optional timeout and poll interval parameters
 */
export async function waitForLedgerJsonApiReady(params?: {
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<void> {
  const timeoutMs = params?.timeoutMs ?? 120_000;
  const pollIntervalMs = params?.pollIntervalMs ?? 2_000;

  const client = new LedgerJsonApiClient(buildIntegrationTestClientConfig());

  await retry(async () => client.getVersion(), {
    timeoutMs,
    pollIntervalMs,
    description: 'Ledger JSON API readiness',
  });
}

async function main(): Promise<void> {
  await waitForLedgerJsonApiReady();
  console.log('Ledger JSON API is ready');
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}
