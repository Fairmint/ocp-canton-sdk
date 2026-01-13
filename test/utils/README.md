# Test Utilities

## OCF Schema Validation

The `ocfSchemaValidator.ts` utility provides JSON schema validation for Open Cap Format (OCF)
objects against the official OCF schemas.

### Overview

This validator ensures that all OCF data structures conform to the
[Open Cap Format JSON schemas](https://github.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF)
maintained by the Open Cap Table Coalition.

### Prerequisites

The OCF schemas are available as a git submodule. To enable validation, initialize the submodule:

```bash
git submodule update --init --recursive libs/Open-Cap-Format-OCF
```

**Note:** The CI workflow automatically initializes the submodule. For local development, you can
skip validation by setting `OCP_SKIP_OCF_VALIDATION=true` in your environment.

### Usage

```typescript
import { validateOcfObject, isOcfValidationAvailable } from '../utils/ocfSchemaValidator';

// Check if validation is available (optional)
if (!isOcfValidationAvailable()) {
  console.warn('OCF validation unavailable - submodule not initialized');
}

// Validate an OCF object
await validateOcfObject({
  object_type: 'ISSUER',
  id: '66ff16f7-5f65-4a78-9011-fac4a8596efc',
  legal_name: 'Example Inc.',
  formation_date: '2019-04-23',
  country_of_formation: 'US',
  // ... other fields
});

// Throws an error if validation fails or submodule is not initialized
```

### Supported Object Types

The validator supports all OCF object types including:

- **Core Objects**: `ISSUER`, `STAKEHOLDER`, `STOCK_CLASS`, `STOCK_LEGEND_TEMPLATE`,
  `VESTING_TERMS`, `STOCK_PLAN`, `DOCUMENT`
- **Transactions**: `TX_STOCK_ISSUANCE`, `TX_STOCK_CANCELLATION`, `TX_EQUITY_COMPENSATION_ISSUANCE`,
  `TX_EQUITY_COMPENSATION_EXERCISE`, and all adjustment transactions

### How It Works

1. **Schema Loading**: The validator automatically loads the appropriate JSON schema file based on
   the `object_type` field
2. **Reference Resolution**: All schema `$ref` references are automatically resolved from the OCF
   schema directory
3. **Format Validation**: Date formats and other OCF-specific formats are validated using
   `ajv-formats`
4. **Error Reporting**: Clear error messages are provided when validation fails, including the field
   path and validation constraint

### Schema Location

The OCF schemas are available as a git submodule at:

```
libs/Open-Cap-Format-OCF/schema/
```

To update the schemas to the latest version:

```bash
git submodule update --remote libs/Open-Cap-Format-OCF
```

### Environment Variables

| Variable                  | Description                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `OCP_SKIP_OCF_VALIDATION` | Set to `true` to skip OCF validation when schemas are unavailable. Only use for local development; CI always requires schemas. |

### Testing

The validator is integrated into the dynamic test suite (`test/createOcf/dynamic.test.ts`) and
validates:

1. **Input fixtures** (`fixture.db`) - The OCF data being sent to the Canton blockchain
2. **Output results** (`fixture.onchain_ocf`) - The OCF data returned from `get*AsOcf` methods

All 78 test fixtures pass validation for both input and output data.

### Implementation Details

- **Validator**: Ajv (Another JSON Schema Validator) with draft-07 support
- **Caching**: Compiled schemas are cached for performance
- **Async Loading**: Schema references are loaded asynchronously to handle nested references
- **Singleton Pattern**: A single validator instance is reused across all tests
