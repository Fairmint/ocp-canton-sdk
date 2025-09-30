# Create OCP Function Test Fixtures

This directory contains merged test fixtures for OCP Client create functions. Each fixture file combines database input, expected request, and expected response in a single JSON file.

## Fixture Format

Each fixture file follows this structure:

```json
{
  "functionName": "createDocument",
  "dbInput": {
    "id": "...",
    "object_type": "DOCUMENT",
    ...
  },
  "testContext": {
    "issuerContractId": "...",
    "issuerParty": "..."
  },
  "expectedRequest": {
    "commands": [...],
    "actAs": [...],
    "disclosedContracts": [...]
  },
  "expectedResponse": {
    "transactionTree": {...}
  }
}
```

## File Naming Convention

Fixtures are named using the pattern: `<functionName>-<metadata>.json`

Examples:
- `createDocument-minimal.json` - Basic document creation test
- `createStockClass-preferred.json` - Stock class with preferred shares
- `createStockClass-common.json` - Stock class with common shares

This naming allows multiple test cases per function.

## Dynamic Test File

The `test/createOcf/dynamic.test.ts` file automatically discovers and runs all fixtures in this directory. It:

1. Scans this directory for `*.json` files
2. For each fixture:
   - Sets up the mock transaction tree response
   - Calls the corresponding OCP Client function with the `dbInput` data
   - Validates the network request matches `expectedRequest`
   - Verifies the response structure

## Adding New Test Cases

To add a new test case:

1. Create a new JSON file following the fixture format above
2. Name it `<functionName>-<description>.json`
3. Run tests - it will be automatically discovered

## Generating Fixtures

The script `test/scripts/generate-merged-fixtures.ts` can generate new fixtures from existing legacy fixtures:

```bash
npx ts-node test/scripts/generate-merged-fixtures.ts
```

This merges:
- `test/fixtures/ocpClient/<functionName>.json` (request/response)
- `test/fixtures/ocpClient/rawItems/<item>.json` (database input)

Into a single merged fixture file.

## Supported Functions

Current fixtures cover these functions:
- `createDocument`
- `createStockClass`
- `createStakeholder`
- `createStockLegendTemplate`
- `createVestingTerms`
- `createStockPlan`
- `createConvertibleIssuance`
- `createWarrantIssuance`
- `createStockIssuance`
- `createStockCancellation`
- `createIssuerAuthorizedSharesAdjustment`
- `createStockClassAuthorizedSharesAdjustment`
- `createStockPlanPoolAdjustment`
- `createEquityCompensationExercise`

## Note on Data Type Conversions

Some fixtures may require data type adjustments to match the function's expected parameter types. The SDK performs various conversions (e.g., string to DAML Time, numeric to decimal string) which should be reflected in the `dbInput`.
