# Test Utilities

Shared helpers and utility tests for the OpenCapTable-v35 SDK. Fixtures live beside them in
[`test/fixtures`](../fixtures): [`production`](../fixtures/production/README.md),
[`synthetic`](../fixtures/synthetic/README.md) and [`register`](../fixtures/register/README.md).

## v35 conventions the utilities pin

- **Dates.** OCF dates are lexical `YYYY-MM-DD` strings and a Daml `Date` is written as the first
  ten characters of one, with no `Date` object and no UTC conversion. `dateValidationAssertions.ts`
  has `expectInvalidDate` for the write side (`OcpValidationError`, `INVALID_FORMAT`) and
  `expectInvalidDamlDate` for the read side, where only an exact `YYYY-MM-DD` is accepted
  (`OcpParseError`, `SCHEMA_MISMATCH`).
- **`ocf_data`.** Every register record is `{ context, ocf_data }`. A mocked created event carries
  the `Context` of `registerEvents.ts` (`TEST_REGISTER_CONTEXT`) and its signatories
  (`TEST_REGISTER_SIGNATORIES`): the reader admits a contract only when its signatories are exactly
  the context's issuer, `system_operator` and transfer agent.
- **Enum rule.** v35 names every enum constructor `<TypeName><PascalCase(OCF value)>`, in the order
  of OCF's enum schema. `damlEnums.test.ts` pins the rule against
  `libs/Open-Cap-Format-OCF/schema/enums` and every generated enum, with `OcfObjectType` as the one
  documented exception (no `TX_PLAN_SECURITY_*` aliases, the two hold types appended).
- **Hold pair.** `TX_STOCK_HOLD` and `TX_STOCK_HOLD_CANCELLATION` are the Fairmint OCF extension,
  written by the register and only read by the SDK. Their schemas are vendored in
  [`schemas/ocf-extension`](../../schemas/ocf-extension/README.md) and `ocfExtensionSchemas.test.ts`
  pins how they load beside OCF's own.
- **Vendored vectors.** `test/fixtures/register/v35-test-vectors.json` is a verbatim copy of the
  register's shared vectors (derived IDs, claim hashes, the floor function). A vector that fails
  means the SDK drifted from the ledger; refresh the copy from its source, never edit it.

## OCF Schema Validation

The `ocfSchemaValidator.ts` utility provides JSON schema validation for Open Cap Format (OCF)
objects against the official OCF schemas, and for the hold pair against the Fairmint extension
schemas.

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

The validator supports all OCF object types, plus the two Fairmint extension types:

- **Core Objects**: `ISSUER`, `STAKEHOLDER`, `STOCK_CLASS`, `STOCK_LEGEND_TEMPLATE`,
  `VESTING_TERMS`, `STOCK_PLAN`, `DOCUMENT`, `VALUATION`, `FINANCING`
- **Transactions**: `TX_STOCK_ISSUANCE`, `TX_STOCK_CANCELLATION`, `TX_EQUITY_COMPENSATION_ISSUANCE`,
  `TX_EQUITY_COMPENSATION_EXERCISE`, and all adjustment transactions
- **Fairmint extension**: `TX_STOCK_HOLD` and `TX_STOCK_HOLD_CANCELLATION`

### How It Works

1. **Schema Loading**: The validator automatically loads the appropriate JSON schema file based on
   the `object_type` field. The extension schemas load from `OCP_OCF_EXTENSION_SCHEMA_DIR`, the
   packaged `dist/ocf-extension-schema`, or the vendored `schemas/ocf-extension`
2. **Reference Resolution**: All schema `$ref` references are automatically resolved from the OCF
   schema directory. The extension schemas reference OCF by its pinned commit URL, so each OCF
   schema is registered under that URL and under its own `main` URL
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

The validator is used by the integration suites (`test/integration`), which validate the OCF read
back from the ledger after a record was written through `CapTable_Apply` or `CapTable_Restate`
(`OpenCapTable.<entity>.get`). The unit tests in `test/schemaAlignment` pin the schemas' conditional
shapes through `parseOcfObject`, and `test/converters/generatedCodecRoundTrip.test.ts` round-trips
every fixture through the generated v35 codecs.

### Implementation Details

- **Validator**: Ajv (Another JSON Schema Validator) with draft-07 support
- **Caching**: Compiled schemas are cached for performance
- **Async Loading**: Schema references are loaded asynchronously to handle nested references
- **Singleton Pattern**: A single validator instance is reused across all tests
