/**
 * Utility script to wait for the Ledger JSON API to be ready.
 *
 * This script is used by CI to ensure LocalNet is fully started before running tests. Defaults to LocalNet
 * configuration with shared-secret auth (matches `npm run localnet*`).
 *
 * Run with: npx ts-node scripts/quickstart/waitForReady.ts
 */

import { buildIntegrationTestClientConfig, retry } from '@fairmint/canton-dev-tools/testing';
import { createLedgerJsonApiClient } from '../../test/utils/cantonNodeSdkCompat';

/** Ensure Dev Tools helpers use shared-secret auth (OCP LocalNet CI profile). */
function ensureSharedSecretTestEnv(): void {
  process.env.FAIRMINT_TEST_SHARED_SECRET ??=
    process.env.OCP_TEST_SHARED_SECRET && process.env.OCP_TEST_SHARED_SECRET.length > 0
      ? process.env.OCP_TEST_SHARED_SECRET
      : 'unsafe';
}

ensureSharedSecretTestEnv();

/**
 * Re-export buildIntegrationTestClientConfig as buildQuickstartClientConfig for backwards compatibility. This is used
 * by deployContracts.ts and other scripts.
 */
export { buildIntegrationTestClientConfig as buildQuickstartClientConfig } from '@fairmint/canton-dev-tools/testing';

/**
 * Wait for the Ledger JSON API to be ready and reachable.
 *
 * @param params - Optional timeout and poll interval parameters
 */
export async function waitForLedgerJsonApiReady(params?: {
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<void> {
  ensureSharedSecretTestEnv();
  const timeoutMs = params?.timeoutMs ?? 120_000;
  const pollIntervalMs = params?.pollIntervalMs ?? 2_000;

  const client = createLedgerJsonApiClient(buildIntegrationTestClientConfig());

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
