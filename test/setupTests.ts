// Common jest setup: restore mocks between tests
afterEach(() => {
  jest.clearAllMocks();
  // Don't reset modules as it clears fixture state
  // jest.resetModules();
});


