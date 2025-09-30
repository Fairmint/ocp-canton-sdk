/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  testMatch: ['**/test/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/setupTests.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { diagnostics: false }]
  },
  moduleNameMapper: {
    '^@fairmint/canton-node-sdk$': '<rootDir>/test/mocks/fairmint-canton-node-sdk.ts',
    '^@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations$': '<rootDir>/test/mocks/canton-deep.ts',
    '^@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands$': '<rootDir>/test/mocks/canton-deep.ts',
    '^@fairmint/open-captable-protocol-daml-js(?:/lib)?$': '<rootDir>/test/mocks/open-captable-protocol-daml-js.ts'
  }
};


