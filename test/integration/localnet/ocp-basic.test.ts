import { getFeaturedAppRightContractDetails } from '@fairmint/canton-node-sdk';
import { OcpClient } from '../../../src';
import { testClients } from '../setup';

describe('OCP Basic Integration Tests', () => {
  let _ocpClient: OcpClient;

  beforeAll(() => {
    _ocpClient = new OcpClient(testClients.config);
  });

  it('should get featured app right contract details', async () => {
    const featuredAppRight = await getFeaturedAppRightContractDetails(testClients.validatorApi);

    expect(featuredAppRight).toBeDefined();
    expect(featuredAppRight.contractId).toBeDefined();
    expect(typeof featuredAppRight.contractId).toBe('string');
    expect(featuredAppRight.templateId).toBeDefined();
    expect(featuredAppRight.synchronizerId).toBeDefined();
  });

  // Additional integration tests can be added here as the test framework matures
  // For example:
  // - Creating an issuer
  // - Creating stakeholders
  // - Issuing stock
  // - Transferring ownership
});
