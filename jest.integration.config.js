/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  testMatch: ['**/test/integration/**/*.test.ts'],
  // Match `npm run localnet*` shared-secret profile for @fairmint/canton-dev-tools/testing.
  setupFiles: ['<rootDir>/test/integration/setupSharedSecretEnv.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/setupTests.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { diagnostics: false }],
  },
  // Transform jose ESM module to CommonJS for Jest compatibility
  transformIgnorePatterns: ['/node_modules/(?!(jose)/)'],
  // Run integration tests serially to avoid DAR upload collisions
  maxWorkers: 1,
};
