import type { ClientConfig } from '@fairmint/canton-node-sdk';

import { OcpClient } from '../../src/OcpClient';

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function getRequiredEnv(name: string): string {
  const value = getEnv(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function isQuickstartConfigured(): boolean {
  return Boolean(getEnv('OCP_TEST_LEDGER_JSON_API_URI') && getEnv('OCP_TEST_AUTH_URL') && getEnv('OCP_TEST_CLIENT_ID'));
}

function buildQuickstartClientConfig(): ClientConfig {
  const apiUrl = getRequiredEnv('OCP_TEST_LEDGER_JSON_API_URI');
  const authUrl = getRequiredEnv('OCP_TEST_AUTH_URL');
  const clientId = getRequiredEnv('OCP_TEST_CLIENT_ID');
  const clientSecret = getEnv('OCP_TEST_CLIENT_SECRET');

  return {
    // The SDK requires one of the known network names.
    // For quickstart/local testing, we keep this as a stable placeholder.
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

describe('quickstart smoke', () => {
  jest.setTimeout(120_000);

  const configured = isQuickstartConfigured();

  (configured ? test : test.skip)('connects and returns /v2/version', async () => {
    const config = buildQuickstartClientConfig();
    const ocp = new OcpClient(config);

    const version = await ocp.client.getVersion();

    expect(typeof version.version).toBe('string');
    expect(version.version.length).toBeGreaterThan(0);
  });
});
