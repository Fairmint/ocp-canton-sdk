# Integration Tests

This directory contains integration tests for the OCP Canton SDK. These tests run against a real
Canton network (LocalNet) to validate SDK functionality end-to-end.

## Structure

```
test/integration/
├── setup.ts              # Shared test client configuration
├── localnet/             # LocalNet-specific integration tests
│   ├── smoke.test.ts     # Basic connectivity tests
│   └── ocp-basic.test.ts # Basic OCP operations
└── README.md             # This file
```

## Running Integration Tests

### Prerequisites

1. **LocalNet must be running** - The integration tests require a local Canton network
2. **DAR files deployed** - OCP DAR files must be deployed to LocalNet
3. **Environment configured** - See `.env.localnet` for required environment variables

### Running Tests Locally

```bash
# Install dependencies
npm install

# Build the SDK
npm run build

# Run integration tests (requires LocalNet to be running)
npm run test:integration

# Run integration tests in CI mode (sequential execution)
npm run test:integration:ci
```

### GitHub Actions

Integration tests are automatically run on:

- Every push to `main` or `master` branches
- Every pull request to `main` or `master` branches
- Nightly at 2 AM UTC
- Manual workflow dispatch

See `.github/workflows/test-integration.yml` for the complete CI configuration.

## Test Categories

### Smoke Tests (`smoke.test.ts`)

Basic connectivity tests to verify:

- Connection to Ledger JSON API
- Connection to Validator API
- Basic API functionality

### OCP Basic Tests (`ocp-basic.test.ts`)

Basic OCP operations:

- Getting featured app right contract details
- Creating issuers (to be implemented)
- Managing stakeholders (to be implemented)
- Stock operations (to be implemented)

## Adding New Tests

1. Create a new test file in `test/integration/localnet/`
2. Import test clients from `../setup`
3. Write tests using Jest syntax
4. Tests should be idempotent and not depend on execution order
5. Clean up any created resources after tests

Example:

```typescript
import { testClients } from '../setup';
import { OcpClient } from '../../../src';

describe('My Integration Tests', () => {
  it('should do something', async () => {
    const ocpClient = new OcpClient(testClients.config);
    // Your test logic here
  });
});
```

## Configuration

Integration tests use a separate Jest configuration (`jest.integration.config.js`) that:

- Only runs tests in `test/integration/`
- Uses real `@fairmint/canton-node-sdk` (not mocks)
- Has longer test timeouts (30 seconds)

**Note:** Integration tests require real network connectivity to LocalNet services. You may
encounter timeouts or connection errors if:

- LocalNet is not running
- Network ports are blocked (check firewall settings)
- Services are still starting up (wait for health checks to pass)
- Network configuration is incorrect (verify .env.localnet)

## Differences from Unit Tests

| Aspect      | Unit Tests           | Integration Tests            |
| ----------- | -------------------- | ---------------------------- |
| Location    | `test/` (root level) | `test/integration/`          |
| Jest Config | `jest.config.js`     | `jest.integration.config.js` |
| SDK Mocking | Uses mocks           | Real SDK                     |
| Network     | No network required  | Requires LocalNet            |
| Speed       | Fast                 | Slower                       |
| Isolation   | Highly isolated      | Tests real interactions      |

## Future Enhancements

As this test framework matures, we plan to:

1. Add comprehensive DAR deployment scripts
2. Implement LocalNet lifecycle management
3. Add more OCP operation tests (issuers, stock, transfers, etc.)
4. Add test data generators for complex scenarios
5. Implement parallel test execution where safe
6. Add performance benchmarks

## Troubleshooting

### Tests fail with connection errors

- Verify LocalNet is running: Check if services are accessible at configured ports
- Check environment variables: Ensure `.env.localnet` is properly configured
- Review LocalNet logs: Look for startup errors or service failures

### Tests timeout

- Increase test timeout in `jest.integration.config.js`
- Check if LocalNet services are healthy
- Verify network connectivity to LocalNet

### DAR deployment failures

- Ensure DAR files are built and available
- Check LocalNet user permissions
- Verify synchronizer is active and accepting contracts

## Reference

- [canton-node-sdk Integration Tests](https://github.com/Fairmint/canton-node-sdk/tree/main/test/integration)
- [Canton Documentation](https://docs.daml.com/canton/index.html)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
