/**
 * Integration test setup utilities.
 *
 * @module
 */

export {
  createIntegrationTestSuite,
  getTestContext,
  resetHarnessState,
  type IntegrationTestContext,
} from './integrationTestHarness';

export { defineEntityTests, testEntityVariant, type EntityTestConfig } from './entityTestFactory';

export {
  allocateTestParties,
  createCapTable,
  createTestFactory,
  deployOcpPackages,
  type CreatedCapTable,
  type DeploymentResult,
  type TestFactory,
  type TestParties,
} from './contractDeployment';
