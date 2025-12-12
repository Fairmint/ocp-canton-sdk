import type { ClientConfig } from '@fairmint/canton-node-sdk';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api';

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function getRequiredEnv(name: string): string {
  const value = getEnv(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildQuickstartClientConfig(): ClientConfig {
  const defaultsFlag = process.env.OCP_TEST_USE_CN_QUICKSTART_DEFAULTS;
  if (defaultsFlag === '1' || defaultsFlag?.toLowerCase() === 'true') {
    return { network: 'localnet' };
  }

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

  const deadlineMs = Date.now() + timeoutMs;
  const client = new LedgerJsonApiClient(buildQuickstartClientConfig());
  let lastErrorMessage: string | undefined;

  // Wait until /v2/version is reachable (and auth works).
  while (Date.now() < deadlineMs) {
    try {
      await client.getVersion();
      return;
    } catch (err) {
      lastErrorMessage = err instanceof Error ? err.message : String(err);
      await sleep(pollIntervalMs);
    }
  }

  throw new Error(`Timed out waiting for Ledger JSON API readiness${lastErrorMessage ? `: ${lastErrorMessage}` : ''}`);
}

async function main(): Promise<void> {
  await waitForLedgerJsonApiReady();

  console.log('Ledger JSON API is ready');
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}
