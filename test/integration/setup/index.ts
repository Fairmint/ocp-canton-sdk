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

export { deployOcpPackages, type DeploymentResult } from './contractDeployment';
