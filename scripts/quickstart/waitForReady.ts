import type { ClientConfig } from '@fairmint/canton-node-sdk';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function getRequiredEnv(name: string): string {
  const value = getEnv(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildQuickstartClientConfig(): ClientConfig {
  const apiUrl = getRequiredEnv('OCP_TEST_LEDGER_JSON_API_URI');
  const authUrl = getRequiredEnv('OCP_TEST_AUTH_URL');
  const clientId = getRequiredEnv('OCP_TEST_CLIENT_ID');
  const clientSecret = getEnv('OCP_TEST_CLIENT_SECRET');

  return {
    network: 'devnet',
    authUrl,
    apis: {
      LEDGER_JSON_API: {
        apiUrl,
        auth: {
          grantType: 'client_credentials',
          clientId,
          clientSecret,
        },
      },
    },
  };
}

export async function waitForLedgerJsonApiReady(params?: {
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<void> {
  const timeoutMs = params?.timeoutMs ?? 120_000;
  const pollIntervalMs = params?.pollIntervalMs ?? 2_000;

  const startedAt = Date.now();
  const client = new LedgerJsonApiClient(buildQuickstartClientConfig());

  // Wait until /v2/version is reachable (and auth works).
  while (true) {
    try {
      await client.getVersion();
      return;
    } catch (err) {
      if (Date.now() - startedAt > timeoutMs) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Timed out waiting for Ledger JSON API readiness: ${message}`);
      }
      await sleep(pollIntervalMs);
    }
  }
}

async function main(): Promise<void> {
  await waitForLedgerJsonApiReady();
  // eslint-disable-next-line no-console
  console.log('Ledger JSON API is ready');
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}
