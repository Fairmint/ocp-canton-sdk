/** @type {import('jest').Config} */
const localnetQuickstartIntegration = process.env.OCP_LOCALNET_QUICKSTART_INTEGRATION === '1';

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  testMatch: ['**/test/integration/**/*.test.ts'],
  // Second-issuer AuthorizeIssuer via OcpFactory fails PACKAGE_SELECTION_FAILED on
  // minimal cn-quickstart (app-user exists but is not onboarded for OCP package topology).
  // Run full `npm run test:integration` (without this env) to execute this suite.
  testPathIgnorePatterns: localnetQuickstartIntegration
    ? ['<rootDir>/test/integration/entities/readAsMultiParty\\.integration\\.test\\.ts$']
    : [],
  setupFilesAfterEnv: ['<rootDir>/test/setupTests.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { diagnostics: false }],
  },
  // Transform jose ESM module to CommonJS for Jest compatibility
  transformIgnorePatterns: ['/node_modules/(?!(jose)/)'],
  // Run integration tests serially to avoid DAR upload collisions
  maxWorkers: 1,
};
