/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  testMatch: ['**/test/integration/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/setupTests.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { diagnostics: false }],
  },
  // Transform jose ESM module to CommonJS for Jest compatibility
  transformIgnorePatterns: ['/node_modules/(?!(jose)/)'],
};
