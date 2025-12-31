/**
 * Shared test configuration utilities for integration tests.
 *
 * These utilities help configure the SDK client for both:
 *
 * - LocalNet (cn-quickstart) environment - Set OCP_TEST_USE_CN_QUICKSTART_DEFAULTS=true
 * - Remote Canton environments - Set individual environment variables
 *
 * @example
 *   LocalNet usage
 *   ```bash
 *   OCP_TEST_USE_CN_QUICKSTART_DEFAULTS=true npm run test:integration
 *   ```
 *
 * @example
 *   Remote environment usage
 *   ```bash
 *   OCP_TEST_LEDGER_JSON_API_URI=https://... \
 *   OCP_TEST_AUTH_URL=https://... \
 *   OCP_TEST_CLIENT_ID=my-client \
 *   OCP_TEST_CLIENT_SECRET=secret \
 *   npm run test:integration
 *   ```
 */

import type { ClientConfig } from '@fairmint/canton-node-sdk';

/**
 * Get an environment variable value, returning undefined if empty or not set.
 *
 * @param name - Environment variable name
 * @returns The value or undefined if not set/empty
 */
export function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

/**
 * Get a required environment variable, throwing if not set.
 *
 * @param name - Environment variable name
 * @returns The value
 * @throws Error if the variable is not set or empty
 */
export function getRequiredEnv(name: string): string {
  const value = getEnv(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/**
 * Check if an environment variable is set to a truthy value.
 *
 * @param name - Environment variable name
 * @returns True if set to '1' or 'true' (case-insensitive)
 */
export function isTruthyEnv(name: string): boolean {
  const value = process.env[name];
  if (!value) return false;
  return value === '1' || value.toLowerCase() === 'true';
}

/**
 * Check if the integration test environment is configured. Returns true if either LocalNet defaults are enabled or
 * remote environment variables are set.
 *
 * @returns True if integration tests can run
 */
export function isIntegrationTestConfigured(): boolean {
  if (isTruthyEnv('OCP_TEST_USE_CN_QUICKSTART_DEFAULTS')) return true;
  return Boolean(getEnv('OCP_TEST_LEDGER_JSON_API_URI') && getEnv('OCP_TEST_AUTH_URL') && getEnv('OCP_TEST_CLIENT_ID'));
}

/**
 * Build a ClientConfig for integration tests.
 *
 * If OCP_TEST_USE_CN_QUICKSTART_DEFAULTS is set, returns LocalNet config. If OCP_TEST_AUTH_MODE=shared-secret, uses
 * JWT-based auth. Otherwise, builds config from individual environment variables.
 *
 * @returns ClientConfig for use with OcpClient
 * @throws Error if required environment variables are missing
 */
export function buildIntegrationTestClientConfig(): ClientConfig {
  if (isTruthyEnv('OCP_TEST_USE_CN_QUICKSTART_DEFAULTS')) {
    // Check if we should use shared-secret mode
    const authMode = getEnv('OCP_TEST_AUTH_MODE');
    if (authMode === 'shared-secret') {
      return {
        network: 'localnet',
        apis: {
          LEDGER_JSON_API: {
            apiUrl: 'http://localhost:3975',
            auth: {
              grantType: 'none',
              tokenGenerator: generateSharedSecretJwt,
            },
          },
          VALIDATOR_API: {
            apiUrl: 'http://localhost:3903',
            auth: {
              grantType: 'none',
              tokenGenerator: generateSharedSecretJwt,
            },
          },
          SCAN_API: {
            apiUrl: 'http://localhost:4000',
            auth: {
              grantType: 'none',
            },
          },
        },
      };
    }
    // Default: OAuth2 mode
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

/**
 * Generate a JWT for shared-secret authentication in LocalNet.
 *
 * This creates a JWT signed with the 'unsafe' secret, which is the default for cn-quickstart shared-secret mode.
 */
async function generateSharedSecretJwt(): Promise<string> {
  // Use jsonwebtoken (CommonJS) instead of jose (ESM) for Jest compatibility
  const jwt = await import('jsonwebtoken');
  const secret = 'unsafe';
  return jwt.default.sign(
    {
      sub: 'ledger-api-user',
      aud: 'https://canton.network.global',
    },
    secret,
    { algorithm: 'HS256', expiresIn: '2h' }
  );
}

/**
 * Sleep for a specified number of milliseconds.
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the delay
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function until it succeeds or times out.
 *
 * @param fn - Async function to retry
 * @param options - Retry options
 * @returns The result of the function
 * @throws The last error if all retries fail
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    timeoutMs?: number;
    pollIntervalMs?: number;
    description?: string;
  } = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const pollIntervalMs = options.pollIntervalMs ?? 1_000;
  const description = options.description ?? 'operation';

  const deadline = Date.now() + timeoutMs;
  let lastError: Error | undefined;

  while (Date.now() < deadline) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      await sleep(pollIntervalMs);
    }
  }

  throw new Error(`Timed out waiting for ${description}${lastError ? `: ${lastError.message}` : ''}`);
}
