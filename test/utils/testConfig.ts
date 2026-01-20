/**
 * Shared test configuration utilities for integration tests.
 *
 * Tests are configured for LocalNet (cn-quickstart) with shared-secret authentication by default.
 *
 * @example
 *   LocalNet
 *
 *
 *   usage (default)
 *   ```bash
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
function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

/**
 * Build a ClientConfig for integration tests.
 *
 * Returns LocalNet configuration with shared-secret authentication.
 *
 * @returns ClientConfig for use with OcpClient
 */
export function buildIntegrationTestClientConfig(): ClientConfig {
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

/**
 * Generate a JWT for shared-secret authentication in LocalNet.
 *
 * This creates a JWT signed with the 'unsafe' secret, which is the default for cn-quickstart shared-secret mode.
 */
async function generateSharedSecretJwt(): Promise<string> {
  // Use jsonwebtoken (CommonJS) instead of jose (ESM) for Jest compatibility
  const jwt = await import('jsonwebtoken');
  const secret = getEnv('OCP_TEST_SHARED_SECRET') ?? 'unsafe';
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
