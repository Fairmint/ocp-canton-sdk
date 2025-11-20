import { testClients } from '../setup';

describe('LocalNet Smoke Tests', () => {
  it('should connect to Ledger JSON API and get version', async () => {
    const response = await testClients.ledgerJsonApi.getVersion();

    expect(response).toBeDefined();
    expect(response.version).toBeDefined();
    expect(typeof response.version).toBe('string');
  });

  it('should connect to Validator API and get user status', async () => {
    try {
      const response = await testClients.validatorApi.getUserStatus();

      expect(response).toBeDefined();
      // User status response structure varies, just verify we got a response
    } catch (error: any) {
      // Some validator API endpoints may require authentication
      // We just want to verify connectivity, so 401/403 is acceptable
      if (error.code !== 401 && error.code !== 403) {
        throw error;
      }
    }
  });
});
