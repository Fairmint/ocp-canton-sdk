/**
 * Smoke tests for LocalNet/quickstart integration.
 *
 * These tests verify basic connectivity and SDK functionality against a running Canton LocalNet (cn-quickstart)
 * environment. Run with: npm run test:integration
 */

import { OcpClient } from '../../src/OcpClient';
import { createLedgerAndValidatorClients } from '../utils/cantonNodeSdkCompat';
import { buildIntegrationTestClientConfig } from '../utils/testConfig';

describe('quickstart smoke', () => {
  jest.setTimeout(120_000);

  test('connects and returns /v2/version', async () => {
    const { ledger, validator } = createLedgerAndValidatorClients(buildIntegrationTestClientConfig());
    const ocp = new OcpClient({
      ledger,
      validator,
    });

    const version = await ocp.ledger.getVersion();

    expect(typeof version.version).toBe('string');
    expect(version.version.length).toBeGreaterThan(0);
  });
});
