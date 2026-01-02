# Comprehensive SDK Integration Tests

**Date:** 2025-12-30 **Status:** In Progress **Parent Task:**
[2025.12.17-milestone-2-ocp-sdk-implementation.md](../2025.12.17-milestone-2-ocp-sdk-implementation.md)

---

## Summary

Expand integration test coverage to include all SDK functions with a proper test framework that:

1. Deploys DAML contracts to LocalNet (no placeholders)
2. Creates the OcpFactory contract dynamically
3. Runs through as much of the real workflow as possible

---

## Problem

The integration test framework was established with 4 entity types as examples:

- `issuer`
- `stakeholder`
- `stockClass`
- `stockClassAuthorizedSharesAdjustment`

However, the SDK exposes **17 OpenCapTable entity types** plus **3 additional domains** (Reports,
Payments, Streams). Without comprehensive integration tests, we cannot verify:

- DAML command structures are correct
- Type conversions work at runtime
- Contract workflows function end-to-end
- OCF schema compliance for all entity types

Additionally:

- Tests relied on pre-generated factory contract IDs for devnet/mainnet
- LocalNet testing required manual setup and couldn't create factories dynamically

---

## Solution - Integration Test Framework

### Contract Deployment System (NEW)

Created `test/integration/setup/contractDeployment.ts` with:

```typescript
// Deploy DAML contracts and create OcpFactory
export async function deployAndCreateFactory(
  client: LedgerJsonApiClient,
  systemOperatorParty: string,
  featuredAppRightContractId: string
): Promise<DeploymentResult>;

// Authorize issuers using the dynamically created factory
export async function authorizeIssuerWithFactory(
  client: LedgerJsonApiClient,
  ocpFactoryContractId: string,
  systemOperatorParty: string,
  issuerParty: string
): Promise<AuthorizeIssuerResult>;
```

### Enhanced Test Context

The `IntegrationTestContext` now includes:

- `ocp`: OcpClient instance
- `issuerParty`: Party for issuer operations
- `systemOperatorParty`: Party owning the OcpFactory
- `featuredAppRight`: DisclosedContract for FeaturedAppRight
- `ocpFactoryContractId`: Dynamically created factory contract
- `deployment`: Full deployment info (package IDs, etc.)

### Test Setup Flow

```
1. Start cn-quickstart LocalNet
2. Integration harness initializes:
   a. Connects to Ledger JSON API
   b. Gets FeaturedAppRight from Validator API
   c. Uploads OCP DAML DAR (if not already deployed)
   d. Creates OcpFactory contract (if not exists)
   e. Discovers parties (issuer, system operator)
3. Tests use factory to authorize issuers and run workflows
```

---

## Test Structure

```
test/integration/
├── entities/                    # OpenCapTable entity tests (all updated)
│   ├── issuer.integration.test.ts                              ✅
│   ├── stakeholder.integration.test.ts                         ✅
│   ├── stockClass.integration.test.ts                          ✅
│   ├── stockClassAuthorizedSharesAdjustment.integration.test.ts ✅
│   ├── stockLegendTemplate.integration.test.ts                 ✅
│   ├── vestingTerms.integration.test.ts                        ✅
│   ├── stockPlan.integration.test.ts                           ✅
│   ├── stockIssuance.integration.test.ts                       ✅
│   ├── stockTransfer.integration.test.ts                       ✅
│   ├── stockCancellation.integration.test.ts                   ✅
│   ├── equityCompensationIssuance.integration.test.ts          ✅
│   ├── equityCompensationExercise.integration.test.ts          ✅
│   ├── warrantIssuance.integration.test.ts                     ✅
│   ├── convertibleIssuance.integration.test.ts                 ✅
│   ├── document.integration.test.ts                            ✅
│   ├── issuerAuthorizedSharesAdjustment.integration.test.ts    ✅
│   └── stockPlanPoolAdjustment.integration.test.ts             ✅
├── reports/                     # OpenCapTableReports tests
│   └── companyValuationReport.integration.test.ts              ✅ (simplified)
├── payments/                    # CantonPayments tests
│   ├── airdrop.integration.test.ts                             ✅ (simplified)
│   └── simpleAirdrop.integration.test.ts                       ✅ (simplified)
├── streams/                     # PaymentStreams tests
│   ├── paymentStreamFactory.integration.test.ts                ✅ (simplified)
│   ├── proposedPaymentStream.integration.test.ts               ✅ (simplified)
│   ├── activePaymentStream.integration.test.ts                 ✅ (simplified)
│   ├── paymentStreamChangeProposal.integration.test.ts         ✅ (simplified)
│   └── partyMigrationProposal.integration.test.ts              ✅ (simplified)
├── workflows/                   # Multi-entity workflow tests
│   └── capTableWorkflow.integration.test.ts                    ✅
├── setup/                       # Test infrastructure
│   ├── index.ts
│   ├── integrationTestHarness.ts                               ✅ (enhanced)
│   ├── entityTestFactory.ts
│   └── contractDeployment.ts                                   ✅ (NEW)
└── utils/                       # Test data factories
    ├── index.ts
    ├── setupTestData.ts                                        ✅ (enhanced)
    ├── transactionHelpers.ts                                   ✅ (NEW)
    └── validatorAvailability.ts
```

---

## Implementation Progress

### ✅ Phase 1: Test Framework Enhancement

1. **Contract Deployment** - `contractDeployment.ts`
   - `deployAndCreateFactory()` - Uploads DAR, creates OcpFactory
   - `authorizeIssuerWithFactory()` - Authorizes issuers using factory
   - `findExistingFactory()` - Checks for existing factory contracts
   - Idempotent - doesn't re-deploy if already present

2. **Enhanced Test Harness** - `integrationTestHarness.ts`
   - Automatic DAML deployment on first test run
   - Factory creation during `beforeAll`
   - Extended context with `systemOperatorParty` and `ocpFactoryContractId`

3. **Updated Setup Functions** - `setupTestData.ts`
   - `setupTestIssuer()` now supports both LocalNet (factory) and devnet/mainnet (SDK)
   - Optional `systemOperatorParty` and `ocpFactoryContractId` params
   - Backwards compatible with existing tests

4. **Transaction Helpers** - `transactionHelpers.ts` (NEW)
   - `extractContractIdOrThrow()` - Type-safe contract ID extraction
   - `extractContractIdByTemplatePattern()` - Find contracts by template
   - Uses type guards instead of `any` casts

5. **All Entity Tests Updated**
   - All 17 OpenCapTable entity tests pass factory context
   - Full workflow tests from factory → issuer → entities

### 🔄 Phase 2: Reports, Payments, Streams (Simplified)

Due to complex Canton Network requirements (Amulet, Wallet, Payment infrastructure), these tests are
simplified to verify SDK function existence:

- **Reports**: Basic structure verified, full tests need Validator setup
- **Payments**: Require Canton Coin/Amulet infrastructure
- **Streams**: Require full payment stream factory deployment

These can be expanded once full cn-quickstart payment infrastructure is available.

---

## Running Tests

### Prerequisites

1. Start cn-quickstart LocalNet:

```bash
cd libs/cn-quickstart/quickstart
make start
```

2. Wait for LocalNet to be ready:

```bash
npm run wait:localnet
```

### Run Tests

```bash
# Run all integration tests
OCP_TEST_USE_CN_QUICKSTART_DEFAULTS=true npm run test:integration

# Run specific entity tests
OCP_TEST_USE_CN_QUICKSTART_DEFAULTS=true npx jest test/integration/entities/issuer --runInBand

# With debug output
DEBUG=true OCP_TEST_USE_CN_QUICKSTART_DEFAULTS=true npm run test:integration
```

### Environment Variables

| Variable                                   | Description                       |
| ------------------------------------------ | --------------------------------- |
| `OCP_TEST_USE_CN_QUICKSTART_DEFAULTS=true` | Enable LocalNet testing           |
| `OCP_TEST_ISSUER_PARTY`                    | Override issuer party ID          |
| `OCP_TEST_SYSTEM_OPERATOR_PARTY`           | Override system operator party ID |
| `OCP_TEST_DAR_FILE_PATH`                   | Custom DAR file path              |

---

## Validation

Before opening PRs:

```bash
cd ocp-canton-sdk
npm run fix        # ESLint + Prettier
npm run typecheck  # TypeScript type checking (REQUIRED)
npm test           # Unit tests
```

---

## Acceptance Criteria

### ✅ Complete

- [x] Test framework deploys DAML contracts dynamically
- [x] OcpFactory created without placeholders
- [x] All 17 OpenCapTable entity tests use factory context
- [x] Tests run end-to-end against LocalNet
- [x] TypeScript type safety maintained (no `any` types)
- [x] Documentation updated
- [x] Type-safe transaction helpers created

### 🔄 In Progress

- [ ] Full payment/stream tests (requires payment infrastructure)
- [ ] CI integration with cn-quickstart

---

## Changelog

| Date       | Change                                                 | PRs                                     |
| ---------- | ------------------------------------------------------ | --------------------------------------- |
| 2025-01-02 | Moved from canton to ocp-canton-sdk                    | -                                       |
| 2025-12-30 | Created comprehensive integration tests sub-task       | -                                       |
| 2025-12-30 | Added contract deployment and factory creation         | feature/comprehensive-integration-tests |
| 2025-12-30 | Updated all entity tests to use factory context        | feature/comprehensive-integration-tests |
| 2025-12-30 | Added type-safe transaction helpers, fixed party usage | feature/comprehensive-integration-tests |
