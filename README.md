<!--
Implementation guidance for contributors and AI assistants
- Use strict TypeScript (enable "strict": true)
- Never use `any` or `unknown`; model precise types or augment upstream
- Fail fast on invalid inputs; validate early and throw meaningful errors
- Prefer explicit names and return types in all public APIs
- Keep modules small, pure, and composable; avoid side effects
-->

### Open Cap Table Protocol Canton SDK — Implementation Guidance

This README is for SDK contributors and AI assistants. For end users/consumers, use the public docs: [https://ocp.canton.fairmint.com/](https://ocp.canton.fairmint.com/).

### Principles
- **Strict types**: `"strict": true` across the repo; no unsound assertions
- **No `any`/`unknown`**: prefer unions, discriminated unions, and narrow interfaces
- **Fail fast**: validate inputs, throw early with actionable messages
- **Explicit APIs**: always annotate exported function return types
- **Deterministic**: avoid hidden state; keep functions pure when possible

### Directory conventions
- `src/functions/<domain>/...`: one operation per file; export `Params`/`Result`
- `src/OcpClient.ts`: grouped facade that wires functions to a `LedgerJsonApiClient`
- `src/types/native.ts`: ergonomic OCF-native types for inputs/outputs
- `src/types/contractDetails.ts`: `ContractDetails` for disclosed cross-domain references
- `src/utils/typeConversions.ts`: conversions between DAML types and native OCF types
- `src/utils/TransactionBatch.ts`: typed batch submission helper

### Function design
- Name operations with verbs: `createX`, `getXAsOcf`, `archiveXByIssuer`
- Define `XParams` and `XResult` in the operation file; export them
- Validate all required fields in `XParams` and return precise `XResult`
- Provide `buildXCommand` for batch support when relevant (returns Command + disclosures)

### Disclosed contracts
- Use `ContractDetails` with all fields required: `contractId`, `createdEventBlob`, `synchronizerId`, `templateId`
- Include only the minimum set of disclosed contracts required for the transaction

### Ledger client and config
- Construct with `ClientConfig` from `@fairmint/canton-node-sdk`
- Ensure LEDGER_JSON_API is configured with auth and party/user identifiers

### Data conversion
- Map inputs using native OCF types from `types/native`
- Perform conversions in `utils/typeConversions.ts`; reject invalid shapes immediately

### Batching
- Use `TransactionBatch` for multi-command submissions; prefer `buildXCommand` helpers to ensure types are correct

### Error handling & logging
- Throw `Error` (or domain-specific subclasses) with clear messages; never swallow errors
- Prefer adding context (contract/template ids, party id) to error messages
- Use the shared logger from the node SDK when available

### Testing
- Unit-test conversions and param validation
- Prefer deterministic fixtures and golden samples for OCF objects
- All OCF fixtures are validated against the official OCF JSON schemas (see `test/utils/ocfSchemaValidator.ts`)
- The OCF schemas are maintained as a git submodule at `../Open-Cap-Format-OCF/`

### Documentation
- Contributor guidance lives here
- End-user/API docs: [Open Cap Table Protocol Canton SDK](https://ocp.canton.fairmint.com/)
- Internal API docs can be generated locally with `npm run docs` into `docs/`

### Contribution checklist
- Types are precise; no `any`/`unknown`
- Public APIs annotated; parameters validated
- Errors are actionable; no silent fallbacks
- Functions added to the relevant `index.ts` barrels and `OcpClient`
- Add `buildXCommand` variant where batching is expected

### OCF Schema Validation

This SDK includes automated validation of all OCF data against the official [Open Cap Format JSON schemas](https://github.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF).

**Setup:**
```bash
# Initialize/update the OCF schema submodule
git submodule update --init --recursive
```

**Usage in tests:**
```typescript
import { validateOcfObject } from './test/utils/ocfSchemaValidator';

// Validate any OCF object
await validateOcfObject({
  object_type: 'ISSUER',
  id: '...',
  legal_name: 'Example Inc.',
  // ... other fields
});
```

The validator automatically validates both:
- Input fixtures (`fixture.db`) - Data being sent to Canton
- Output results - Data returned from `get*AsOcf` methods

All 78+ test fixtures pass validation for both input and output data.

### License
MIT


