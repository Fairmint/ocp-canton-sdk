// Suppress console.debug during tests (silences noisy @daml/types template registration logs)
jest.spyOn(console, 'debug').mockImplementation(() => {});

// Common jest setup: restore mocks between tests
afterEach(() => {
  jest.clearAllMocks();
  // Don't reset modules as it clears fixture state
  // jest.resetModules();
});
