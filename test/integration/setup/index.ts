/**
 * Integration test setup utilities.
 *
 * @module
 */

export {
  createIntegrationTestSuite,
  getTestContext,
  resetHarnessState,
  shouldSkipTest,
  skipIfValidatorUnavailable,
  type IntegrationTestContext,
} from './integrationTestHarness';

export { defineEntityTests, testEntityVariant, type EntityTestConfig } from './entityTestFactory';

export {
  authorizeIssuerWithFactory,
  deployAndCreateFactory,
  type AuthorizeIssuerResult,
  type DeploymentResult,
} from './contractDeployment';
