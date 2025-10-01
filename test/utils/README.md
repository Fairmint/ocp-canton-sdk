# Test Utilities

## OCF Schema Validation

The `ocfSchemaValidator.ts` utility provides JSON schema validation for Open Cap Format (OCF) objects against the official OCF schemas.

### Overview

This validator ensures that all OCF data structures conform to the [Open Cap Format JSON schemas](https://github.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF) maintained by the Open Cap Table Coalition.

### Usage

```typescript
import { validateOcfObject } from '../utils/ocfSchemaValidator';

// Validate an OCF object
await validateOcfObject({
  object_type: 'ISSUER',
  id: '66ff16f7-5f65-4a78-9011-fac4a8596efc',
  legal_name: 'Example Inc.',
  formation_date: '2019-04-23',
  country_of_formation: 'US',
  // ... other fields
});

// Throws an error if validation fails
```

### Supported Object Types

The validator supports all OCF object types including:

- **Core Objects**: `ISSUER`, `STAKEHOLDER`, `STOCK_CLASS`, `STOCK_LEGEND_TEMPLATE`, `VESTING_TERMS`, `STOCK_PLAN`, `DOCUMENT`
- **Transactions**: `TX_STOCK_ISSUANCE`, `TX_STOCK_CANCELLATION`, `TX_EQUITY_COMPENSATION_ISSUANCE`, `TX_EQUITY_COMPENSATION_EXERCISE`, and all adjustment transactions

### How It Works

1. **Schema Loading**: The validator automatically loads the appropriate JSON schema file based on the `object_type` field
2. **Reference Resolution**: All schema `$ref` references are automatically resolved from the OCF schema directory
3. **Format Validation**: Date formats and other OCF-specific formats are validated using `ajv-formats`
4. **Error Reporting**: Clear error messages are provided when validation fails, including the field path and validation constraint

### Schema Location

The OCF schemas are available as a git submodule at:
```
/Users/nickcuso/Documents/code/Fairmint/workspace/Open-Cap-Format-OCF/schema/
```

To update the schemas to the latest version:
```bash
cd /Users/nickcuso/Documents/code/Fairmint/workspace
git submodule update --remote Open-Cap-Format-OCF
```

### Testing

The validator is integrated into the dynamic test suite (`test/createOcf/dynamic.test.ts`) and validates:

1. **Input fixtures** (`fixture.db`) - The OCF data being sent to the Canton blockchain
2. **Output results** (`fixture.onchain_ocf`) - The OCF data returned from `get*AsOcf` methods

All 78 test fixtures pass validation for both input and output data.

### Implementation Details

- **Validator**: Ajv (Another JSON Schema Validator) with draft-07 support
- **Caching**: Compiled schemas are cached for performance
- **Async Loading**: Schema references are loaded asynchronously to handle nested references
- **Singleton Pattern**: A single validator instance is reused across all tests

