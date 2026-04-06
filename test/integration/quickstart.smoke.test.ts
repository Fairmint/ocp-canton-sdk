/**
 * Smoke tests for LocalNet/quickstart integration.
 *
 * These tests verify basic connectivity and SDK functionality against a running Canton LocalNet (cn-quickstart)
 * environment. Run with: npm run test:integration
 */

import { LedgerJsonApiClient, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { OcpClient } from '../../src/OcpClient';
import { buildIntegrationTestClientConfig } from '../utils/testConfig';

describe('quickstart smoke', () => {
  jest.setTimeout(120_000);

  test('connects and returns /v2/version', async () => {
    const config = buildIntegrationTestClientConfig();
    const ocp = new OcpClient({
      ledger: new LedgerJsonApiClient(config),
      validator: new ValidatorApiClient(config),
    });

    const version = await ocp.ledger.getVersion();

    expect(typeof version.version).toBe('string');
    expect(version.version.length).toBeGreaterThan(0);
  });
});
