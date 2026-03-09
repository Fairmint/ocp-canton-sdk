<!--
Implementation guidance for contributors and AI assistants
- Use strict TypeScript (enable "strict": true)
- Never use `any` or `unknown`; model precise types or augment upstream
- Fail fast on invalid inputs; validate early and throw meaningful errors
- Prefer explicit names and return types in all public APIs
- Keep modules small, pure, and composable; avoid side effects
-->

### Open Cap Table Protocol Canton SDK — Implementation Guidance

This README is for SDK contributors and AI assistants. For end users/consumers, use the public docs:
[https://ocp.canton.fairmint.com/](https://ocp.canton.fairmint.com/).

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

- Use `ContractDetails` with all fields required: `contractId`, `createdEventBlob`,
  `synchronizerId`, `templateId`
- Include only the minimum set of disclosed contracts required for the transaction

### Ledger client and config

- Construct with `ClientConfig` from `@fairmint/canton-node-sdk`
- Ensure LEDGER_JSON_API is configured with auth and party/user identifiers

### Data conversion

- Map inputs using native OCF types from `types/native`
- Perform conversions in `utils/typeConversions.ts`; reject invalid shapes immediately
- **Never hide data issues with defensive checks or fallback values**
  - If DAML defines a field as an array, trust it's an array—don't check with `Array.isArray()` and
    provide empty array fallbacks
  - DAML arrays are never null or undefined, so don't check for that either (e.g.,
    `arr && arr.length` → just `arr.length`)
  - If data is malformed, let it throw naturally so issues surface immediately
  - This applies to all conversions: fail fast rather than silently handling unexpected data
  - Example of what NOT to do: `Array.isArray(data) ? data : []` ❌ or `data && data.length` ❌
  - Example of what to do: `data as ExpectedType[]` ✅ and `data.length` ✅

### Batching

- Use `TransactionBatch` for multi-command submissions; prefer `buildXCommand` helpers to ensure
  types are correct

### Error handling & logging

- Throw `Error` (or domain-specific subclasses) with clear messages; never swallow errors
- Prefer adding context (contract/template ids, party id) to error messages
- Use the shared logger from the node SDK when available

### Testing

- Unit-test conversions and param validation
- Prefer deterministic fixtures and golden samples for OCF objects
- All OCF fixtures are validated against the official OCF JSON schemas (see
  `test/utils/ocfSchemaValidator.ts`)
- The OCF schemas are maintained as a git submodule at `libs/Open-Cap-Format-OCF/`

### Documentation

- Contributor guidance lives here
- End-user/API docs: [Open Cap Table Protocol Canton SDK](https://ocp.canton.fairmint.com/)
- Internal API docs can be generated locally with `npm run docs` into `docs/`
- AI context (single source of truth): `CLAUDE.md` (agent entrypoints: `CLAUDE.md`, `AGENTS.md`,
  `GEMINI.md`)

### Contribution checklist

- Types are precise; no `any`/`unknown`
- Public APIs annotated; parameters validated
- Errors are actionable; no silent fallbacks
- Functions added to the relevant `index.ts` barrels and `OcpClient`
- Add `buildXCommand` variant where batching is expected

### LocalNet (cn-quickstart)

Local Canton Network for integration testing:

```bash
npm run localnet:start    # Start (fast path when artifacts exist)
npm run localnet:stop     # Stop services
npm run localnet:status   # Docker + endpoint status
npm run localnet:smoke    # Endpoint smoke checks
npm run localnet:test     # Run integration tests
npm run localnet:verify   # Setup + start + smoke + test
```

Environment toggles: `CANTON_LOCALNET_FAST_START` (default: true),
`CANTON_LOCALNET_FORCE_FULL_START` (default: false).

> **Note:** The orchestrator requires Linux with passwordless `sudo` and `apt-get` (designed for
> CI/cloud environments). For local development on macOS, use the cn-quickstart `Makefile` directly.

### OCF Schema Validation

The SDK enforces schema alignment and validation through dedicated test suites and an auditable
report flow:

- `test/schemaAlignment/*` guards SDK type/interface + enum alignment with OCF schemas, including
  converter coverage for mapped enums.
- `test/validation/*` verifies fail-fast required-field validation and converter output validity.
- `scripts/audit-ocf-schema-alignment.ts` regenerates `audit-field-report.md` from current SDK types
  vs OCF schema definitions.

**Schema-alignment workflow:**

```bash
git submodule update --init --recursive
npx jest test/schemaAlignment --runInBand
npx jest test/validation --runInBand
npx ts-node scripts/audit-ocf-schema-alignment.ts
```

**Validation guarantee:**

- Invalid or incomplete payloads should fail with explicit validation errors.
- OCF-facing outputs are continuously checked against official OCF schemas in test suites.

### LocalNet

```bash
npm run localnet:start    # Start (fast path when artifacts exist)
npm run localnet:stop     # Stop services
npm run localnet:status   # Docker + endpoint status
npm run localnet:smoke    # Endpoint smoke checks
npm run localnet:verify   # Setup + start + smoke + test
```

`localnet:start` uses a fast startup path when quickstart build artifacts already exist. To force a
full rebuild start, run `CANTON_LOCALNET_FORCE_FULL_START=true npm run localnet:start`.

### License

MIT
