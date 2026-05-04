# OCP Canton SDK (`@open-captable-protocol/canton`)

> High-level TypeScript SDK for Open Cap Table Protocol contracts on Canton Network.

The repository **README** is contributor-focused (implementation guidance for maintainers and AI
assistants). Use this wiki for consumer-facing links, architecture, and workflows.

**End-user / docs site:** [ocp.canton.fairmint.com](https://ocp.canton.fairmint.com/) (source:
[Fairmint/web](https://github.com/Fairmint/web))

## Clone this wiki locally (AI agents: run first)

```bash
if [ -d wiki/.git ]; then git -C wiki pull; else git clone https://github.com/Fairmint/ocp-canton-sdk.wiki.git wiki; fi
```

---

## Quick Commands

```bash
npm run fix                                     # ESLint + Prettier auto-fix (REQUIRED before push)
npm run lint && npx tsc --noEmit && npm test   # Full validation
npm run test:integration                        # LocalNet integration tests
```

## Architecture

### Layer Stack

```
ocp-canton-sdk          # This SDK - OCP operations
       │
canton-node-sdk         # Low-level Canton client
       │
Canton Network          # DAML contracts
```

### File Structure

```
src/
├── functions/              # One operation per file
│   ├── OpenCapTable/       # OCF object operations
│   │   ├── issuer/
│   │   │   ├── createIssuer.ts
│   │   │   ├── getIssuerAsOcf.ts
│   │   │   └── archiveIssuerByIssuer.ts
│   │   ├── stakeholder/
│   │   ├── stockClass/
│   │   └── ...
│   └── (OpenCapTableReports / company valuation: use `@fairmint/canton-fairmint-sdk` + `@fairmint/daml-js`, not this package)
├── types/
│   ├── native.ts           # OCF-native input types (OcfIssuer, OcfStakeholder, etc.)
│   ├── output.ts           # OCF output types with object_type discriminant (OcfIssuerOutput, etc.)
│   ├── common.ts           # Shared types (GetByContractIdParams, ContractResult<T>, re-exports)
│   ├── branded.ts          # Branded types (ContractId, PartyId) - optional strict typing
│   └── daml.ts             # Re-exported DAML package types
├── utils/
│   ├── typeConversions.ts  # DAML ↔ OCF conversions
│   └── TransactionBatch.ts # Multi-command helper
└── OcpClient.ts            # Facade; consumes injected ledger (and optional validator) clients

test/
├── createOcf/              # Unit tests (mock-based)
├── fixtures/               # Test data fixtures
├── integration/            # LocalNet integration tests
│   ├── setup/              # Test harness and factories
│   │   ├── integrationTestHarness.ts  # Shared context, client init
│   │   ├── entityTestFactory.ts       # Generic test patterns
│   │   └── index.ts
│   ├── entities/           # Per-entity test files
│   │   ├── issuer.integration.test.ts
│   │   ├── stakeholder.integration.test.ts
│   │   ├── stockClass.integration.test.ts        # Complete example
│   │   ├── stockClassAuthorizedSharesAdjustment.integration.test.ts
│   │   └── ...
│   ├── workflows/          # Multi-entity workflow tests
│   │   └── capTableWorkflow.integration.test.ts
│   ├── utils/              # Test data factories
│   │   └── setupTestData.ts
│   └── quickstart.smoke.test.ts
├── mocks/                  # Mock implementations
└── utils/                  # Shared test utilities
    ├── testConfig.ts       # Environment config
    ├── fixtureHelpers.ts   # Fixture management
    └── ocfSchemaValidator.ts
```

## Entity Folder Organization (CRITICAL)

**Each OCF entity type MUST have its own folder** with converter implementations:

```
src/functions/OpenCapTable/{entityType}/
├── {entityType}DataToDaml.ts   # OCF→DAML converter (for batch API)
├── get{EntityType}AsOcf.ts     # DAML→OCF converter (for reads)
├── create{EntityType}.ts       # Optional: standalone create function
└── index.ts                    # Exports all functions
```

### Dispatcher Files (capTable/)

The `capTable/` folder contains **dispatchers only** that import from entity folders:

```typescript
// capTable/ocfToDaml.ts - DISPATCHER ONLY
import { stakeholderDataToDaml } from '../stakeholder/stakeholderDataToDaml';
import { stockTransferDataToDaml } from '../stockTransfer/createStockTransfer';
// ... imports from entity folders

export function convertToDaml(type: OcfEntityType, data: OcfEntityData): unknown {
  switch (type) {
    case 'stakeholder':
      return stakeholderDataToDaml(data);
    // ... routes to imported functions
  }
}
```

**DO NOT** put converter implementations in `capTable/ocfToDaml.ts` or `capTable/damlToOcf.ts`.

### Why This Matters

1. **Discoverability**: All code for an entity is in one folder
2. **Maintainability**: Changes to an entity only affect its folder
3. **Scalability**: Adding new entities doesn't bloat central files
4. **Code Review**: PRs for new entities are self-contained

## Function Pattern

Each operation exports: `Params`, `Result`, function, and optionally `buildXCommand`.

### OcpClient API (consumer-facing)

The `OcpClient` is the primary API surface. Construct it with **`LedgerJsonApiClient`** (required)
and **`ValidatorApiClient`** (optional), typically from `new Canton({ ... })` in
`@fairmint/canton-node-sdk`. The SDK does not build hidden clients; the same instances you pass in
are exposed as `ocp.ledger` and `ocp.validator`.

Methods are grouped under **`OpenCapTable`** and **`context`**. **Company valuation reports**
(OpenCapTableReports DAML) live in **`@fairmint/canton-fairmint-sdk`** (`createFairmintOcpClient`)
with **`@fairmint/daml-js`** — not in this OCP-only package (since v0.5.0). Payment-stream,
coupon-minter, and similar validator-backed helpers are not part of this package (removed in
v0.4.0); pass **`validator`** when your own integration needs it. Use **`createBatch`** for custom
`TransactionBatch` composition; for cap-table updates prefer **`OpenCapTable.capTable.update`**. See
**`OcpClient`** in source and **`dist/index.d.ts`** for the full surface.

```typescript
import { Canton } from '@fairmint/canton-node-sdk';
import { OcpClient } from '@open-captable-protocol/canton';

const canton = new Canton({ network: 'localnet' });
const ocp = new OcpClient({ ledger: canton.ledger, validator: canton.validator });

// All get() methods return ContractResult<T> with { data, contractId }
const { data: issuer } = await ocp.OpenCapTable.issuer.get({ contractId: '...' });
console.log(issuer.object_type); // 'ISSUER' - discriminated union
console.log(issuer.legal_name);

// Batch cap table updates (UpdateCapTable) — params match CapTableUpdateParams
const batch = ocp.OpenCapTable.capTable.update({
  capTableContractId: '...',
  actAs: ['issuerParty'],
  // readAs: ['observerParty'], // optional
  // capTableContractDetails: { templateId: '...' }, // optional; use ledger template id when not the package default
});
batch.create('stakeholder', stakeholderData);
await batch.execute();
```

### Warrant issuance (batch + readback)

- **Batch key:** `warrantIssuance` on `capTable.update().create('warrantIssuance', …)` (same pattern
  as other cap-table creates).
- **Read shape:** `getWarrantIssuanceAsOcf` in
  `src/functions/OpenCapTable/warrantIssuance/getWarrantIssuanceAsOcf.ts` returns OCF with
  `object_type: 'TX_WARRANT_ISSUANCE'`.
- **Optional dates:** When present on the contract, `board_approval_date` and
  `stockholder_approval_date` are included in DAML→OCF conversion
  (`damlWarrantIssuanceDataToNative`) so Canton readback matches stored OCF and replication parity
  checks stay clean.
- **Schema:**
  [WarrantIssuance.schema.json](https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/issuance/WarrantIssuance.schema.json)
  (OCF).

```typescript
// Cap table snapshot (replication): null if none; errors if >1 active CapTable on the supported package line
const state = await ocp.OpenCapTable.capTable.getState(issuerPartyId);
const classification = await ocp.OpenCapTable.capTable.classify(issuerPartyId); // 'current' | 'none'
```

**Read scope (`readAs`):** Single-contract reads use `getEventsByContractId` and accept optional
**`readAs`** on params (e.g. `get*AsOcf`, `extractCantonOcfManifest`). **`getCapTableState`**
applies **`readAs: [issuerPartyId]`** when loading the issuer contract’s create event so
issuer-scoped visibility works even when the Ledger API user is not the issuer party. Pass
**`readAs`** into manifest extraction (and other readers) when your client acts for a different
visibility party—same idea as optional **`readAs`** on **`capTable.update`**.

### Internal function pattern

```typescript
// src/functions/OpenCapTable/stakeholder/createStakeholder.ts
export interface CreateStakeholderParams {
  issuerContractId: string;
  stakeholderData: OcfStakeholder;
  featuredAppRightContractDetails: DisclosedContract;
}

export function buildCreateStakeholderCommand(
  params: CreateStakeholderParams
): CommandWithDisclosedContracts {
  const { stakeholderData: d } = params;

  // Validate (fail fast)
  if (!d.id) throw new Error('stakeholder.id is required');

  // Build command with explicit field mapping (NO spread)
  const choiceArguments = {
    stakeholder_data: {
      id: d.id,
      name: d.name,
      stakeholder_type: d.stakeholder_type,
      // ... all fields explicit
    },
  };

  return { command, disclosedContracts };
}
```

## Type Conversions

Use utilities from `src/utils/typeConversions.ts`:

```typescript
import {
  normalizeNumericString, // Normalize and validate numeric strings (throws on invalid input)
  optionalString, // empty/undefined → null
  cleanComments, // filter comments array
  dateStringToDAMLTime, // ISO date → DAML time
  monetaryToDaml, // monetary object → DAML format
  damlMonetaryToNative, // DAML monetary → native (with validation)
} from '../../utils/typeConversions';
```

**Type conversion best practices:**

1. **Validate before converting** — Check for null/undefined before calling conversion functions
2. **Use `.toString()` not `String()`** — When you've validated a value is not null/undefined
3. **Let validation functions throw** — Functions like `normalizeNumericString()` throw on invalid
   input
4. **Example pattern:**

```typescript
// ❌ Bad - creates "undefined" if amount is undefined
const amount = String(data.amount);

// ✅ Good - validates then converts
if (data.amount === undefined || data.amount === null) {
  throw new Error('amount is required');
}
const amount = typeof data.amount === 'number' ? data.amount.toString() : data.amount;
```

## Non-Negotiables

1. **Strict TypeScript** — No `any`/`unknown`, no broad assertions
   - Use type guards instead of `as any` casts
   - Prefer `unknown` + type narrowing over `any` when type is truly unknown
2. **Fail fast** — Validate early, throw with actionable messages
3. **Never silently ignore errors** — Prefer failing over hiding problems
   - No empty catch blocks that swallow errors
   - No early returns that make tests "pass" when they didn't run
   - Tests must actually test — if infrastructure is missing, tests should fail, not skip
4. **No unsafe type coercion** — ALWAYS validate before converting types
   - **NEVER** use `String(value)` on potentially undefined/null values
   - **NEVER** use `Number(value)` on potentially invalid strings (creates `NaN`)
   - Example: ❌ `String(amount)` → ✅ `if (!amount) throw new Error('...'); amount.toString()`
5. **Explicit fields** — List all fields, never use spread (`...d`)
6. **No defensive checks** — Trust DAML types, don't check `Array.isArray()`
7. **Use `null`** for DAML optional fields (not `undefined`)
8. **Use `??`** instead of `||` for nullish coalescing
9. **Pinned dependencies** — ALWAYS use exact versions without `^` or `~`
   - ✅ Correct: `"jsonwebtoken": "9.0.3"`
   - ❌ Wrong: `"jsonwebtoken": "^9.0.3"` or `"~9.0.3"`
   - peerDependencies should use ranges (e.g. `">=0.2.160 <0.3.0"`, match `package.json`)
10. **DRY code** — Extract duplicated logic into reusable helpers

## Testing Strategy

| Test Type         | Command                    | Purpose                                      |
| ----------------- | -------------------------- | -------------------------------------------- |
| Unit tests        | `npm test`                 | Mock-based tests for conversions, validation |
| Integration tests | `npm run test:integration` | LocalNet tests validating DAML contracts     |
| Type checking     | `npm run typecheck`        | TypeScript compilation checks                |

### Unit Tests (Mock-based)

```typescript
// test/createOcf/dynamic.test.ts
import { setTransactionTreeFixtureData } from '../utils/fixtureHelpers';
import { validateOcfObject } from '../utils/ocfSchemaValidator';

test('creates issuer with valid OCF output', async () => {
  setTransactionTreeFixtureData(fixture);
  const result = await createIssuer(client, params);
  await validateOcfObject(result.issuer);
});
```

### Integration Tests (LocalNet)

Integration tests run against a real Canton LocalNet environment. They catch issues that mocks miss:

- Invalid DAML command structure
- Type conversion errors that only surface at runtime
- Incorrect template IDs or choice names
- Contract workflow validation

```bash
# Start LocalNet (cn-quickstart) first
npm run test:integration
```

**Integration test pattern (using harness):**

```typescript
// test/integration/entities/issuer.integration.test.ts
import { createIntegrationTestSuite } from '../setup';
import { generateTestId, setupTestIssuer } from '../utils';

createIntegrationTestSuite('Issuer operations', (getContext) => {
  test('creates issuer and reads it back as valid OCF', async () => {
    const ctx = getContext(); // Throws if LocalNet not available

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      issuerData: { id: generateTestId('issuer'), legal_name: 'Test Corp' },
    });

    const ocfResult = await ctx.ocp.OpenCapTable.issuer.getIssuerAsOcf({
      contractId: issuerSetup.issuerContractId,
    });

    expect(ocfResult.issuer.object_type).toBe('ISSUER');
    await validateOcfObject(ocfResult.issuer);
  });
});
```

**Adding tests for a new entity type:**

1. Create `test/integration/entities/{entity}.integration.test.ts`
2. Use `createIntegrationTestSuite()` for automatic harness setup
3. Add data factory in `test/integration/utils/setupTestData.ts` if needed
4. Reference `stockClass.integration.test.ts` as the complete example

### OCF Schema Validation

Initialize the OCF schema submodule (schemas live under `libs/Open-Cap-Format-OCF/schema/`):

```bash
git submodule update --init --recursive libs/Open-Cap-Format-OCF
npm test
```

```typescript
import { validateOcfObject } from './test/utils/ocfSchemaValidator';
await validateOcfObject({ object_type: 'ISSUER', ... });
```

## Adding a New OCF Operation

1. Create file: `src/functions/OpenCapTable/{entity}/{operation}.ts`
2. Define `Params`, `Result` interfaces
3. Implement operation function
4. Add `buildXCommand` for batch support
5. Export from `src/functions/OpenCapTable/{entity}/index.ts`
6. Add to `OcpClient.ts`
7. Add test fixture in `test/fixtures/`

## LocalNet (cn-quickstart)

```bash
# Start localnet (uses fast path when artifacts exist)
npm run localnet:start

# Check status at any time
npm run localnet:status

# Run smoke checks
npm run localnet:smoke

# Run integration tests
npm run localnet:test

# Stop localnet when done
npm run localnet:stop

# One-shot: setup + start + smoke + test
npm run localnet:verify
```

Force a full rebuild start:

```bash
CANTON_LOCALNET_FORCE_FULL_START=true npm run localnet:start
```

### OCP DAR file (integration deploy & quickstart)

The Open Cap Table **DAR path** is resolved from the pinned
**`@fairmint/open-captable-protocol-daml-js`** package only (no hardcoded `OpenCapTable-v*` folders
in this repo).

- Import **`resolveOpenCapTableDarPath`** from
  **`@fairmint/open-captable-protocol-daml-js/openCapTableDarPath`**. This module is the single
  source of truth; it resolves the packaged DAR or a build from a sibling
  **`open-captable-protocol-daml`** checkout / env as the package defines.
- This repo wraps it in **`resolveOpenCapTableDarForOcpSdkRepo()`**
  (`scripts/lib/resolveOpenCapTableDarForOcpSdkRepo.ts`), used by
  **`test/integration/setup/contractDeployment.ts`** and
  **`scripts/quickstart/deployContracts.ts`**.
- The package **root** export is browser-safe (no `fs`); DAR path resolution lives on the
  **`openCapTableDarPath`** subpath (`resolveOpenCapTableDarPath`).
- Keep **`@fairmint/open-captable-protocol-daml-js`** at or above the **`peerDependencies`** floor
  in `package.json` (currently **≥ 0.2.160**). If resolution fails, install or upgrade the npm
  package or build the DAR from **`open-captable-protocol-daml`** as the error message describes.

**Pre-push checklist:**

1. `npm run fix` — Format and lint
2. `npm run test:ci` — Unit tests
3. `npm run test:integration` — Integration tests (requires LocalNet)

### DAML Upgrade Testing

When upgrading `@fairmint/open-captable-protocol-daml-js`:

1. Check release notes for breaking changes in field types
2. Run `npm run test:integration` (not just unit tests)
3. Verify OCF-to-DAML converters encode union types correctly
4. **DAR path:** LocalNet deploy and integration setup use `openCapTableDarPath` /
   `resolveOpenCapTableDarPath()` from the package (via `resolveOpenCapTableDarForOcpSdkRepo` here).
   You do not update versioned paths under `node_modules` in this repo.
5. **0.2.147+** — the package no longer applies a postinstall patch; `npm ci` / `npm install` is
   sufficient

## NPM Publishing

Releases run from **`.github/workflows/publish.yml`** on pushes to `main` or
**`workflow_dispatch`**.

### How It Works

1. **PR → merge to `main`** (with review as usual).
2. **Publish workflow:** installs deps, initializes the OCF submodule, **`npm run build`**,
   **`npm run prepare-release`** (patch bump + changelog unless you already set minor/major in
   `package.json`), then **`npm publish`**.
3. **npm Trusted Publishing (OIDC):** the job sets **`id-token: write`**, uses Node **22.14**, and
   upgrades to **npm 11.10.0** (per workflow comments). It does **not** set **`NODE_AUTH_TOKEN`**.
   With [Trusted Publisher](https://docs.npmjs.com/trusted-publishers) configured for this repo on
   npmjs.org, **no long-lived `NPM_TOKEN` secret** is needed for that workflow.
4. **Tag:** creates and pushes **`v<version>`** from `package.json`.

Public documentation is published from the **[Fairmint/web](https://github.com/Fairmint/web)**
monorepo (`apps/ocp-canton-sdk`); this repository's npm publish workflow no longer runs TypeDoc or
deploys GitHub Pages.

PR validation (lint, tests) lives in **`ci.yml`** and related workflows — not in `publish.yml`.

### Version Bumping

- **Patch:** `prepare-release` on each main merge (typical).
- **Minor/Major:** set `version` in `package.json` before merging.

### Manual Release (Local)

Local **`npm publish`** is separate from CI: use **`npm login`** or a token the way npm documents
for your machine — not the OIDC path above.

```bash
npm run prepare-release   # bumps version, changelog
npm publish
```

## Troubleshooting

### `commands.0: Invalid input` (batch parameter validation failure)

**Symptom:** `CapTableBatch.execute()` throws
`Batch execution failed: Parameter validation failed: commands.0: Invalid input`.

**Root cause:** A converter (`*DataToDaml`) emitted `undefined` for an optional field instead of
`null`. The Canton JSON API uses strict Zod schema validation; `undefined` is not valid JSON.

**Triage checklist:**

1. **Identify the failing row** from the batch log (entity type + OCF ID).
2. **Validate the source data against the OCF JSON schema** in `libs/Open-Cap-Format-OCF/schema/`.
   If the data is schema-valid, this is a **converter bug**, not a data issue.
3. **Check the converter** in `src/functions/OpenCapTable/<entity>/` for direct passthrough of
   optional fields (e.g., `fieldName: d.fieldName` without `?? null` or `?? []`).
4. **Check for deprecated OCF fields** — the schema may allow alternative field names via `oneOf`.

**Safety net:** `CapTableBatch.build()` runs `assertJsonSafe()` which recursively detects
`undefined` values and throws with the exact JSON-path.

**Converter rules:**

- **Never** emit `undefined` in output objects — use `null` for DAML optional fields.
- **Always** handle deprecated OCF field alternatives (check schema `oneOf`/`anyOf`).
- **Always** normalize arrays with `?? []` and strings with `optionalString()`.

### Ambiguous legacy stakeholder relationship events (`new_relationships`)

**Rule:** Treat multi-value `new_relationships` as **ambiguous** and fail fast.

- If canonical `relationship_started` / `relationship_ended` are present, use them.
- If only legacy `new_relationships` is present:
  - single value can map to `relationship_started`
  - multiple values must throw a clear validation error

### Stakeholder event wrapper compatibility (`event_data`)

**Fix:** Keep `ENTITY_DATA_FIELD_MAP` canonical and add `ENTITY_DATA_FIELD_FALLBACK_MAP` entries:

- `stakeholderRelationshipChangeEvent` → `event_data`
- `stakeholderStatusChangeEvent` → `event_data`

### Stock class conversion ratio adjustment normalization

For `stockClassConversionRatioAdjustmentDataToDaml`:

- Always convert `conversion_price` via `monetaryToDaml(...)`
- Always normalize ratio numerator/denominator via `normalizeNumericString(...)`

### Stale issuer contract reference (`CONTRACT_EVENTS_NOT_FOUND` during extraction)

**Root cause:** The CapTable stores the issuer as a single `contractId` in `payload.issuer`. If that
contract is archived or missing, issuer rows are omitted from `entities` / `contractIds`, but
`issuerContractId` on the state object still reflects the payload reference.

**Fix:** Extractors should use `cantonState.contractIds.get('issuer')` (populated only when the
issuer contract resolves) instead of re-reading raw payload IDs. Resolution uses contract-events
reads with **`readAs`** scoped to the issuer party where applicable; if you still see visibility
errors, confirm your **`readAs`** on **`extractCantonOcfManifest`** / **`get*AsOcf`** matches the
parties that can see those contracts.

### Cap table template line and state reads

`getCapTableState` / `classifyIssuerCapTables` query active contracts with the symbolic package-name
template id from the pinned `@fairmint/open-captable-protocol-daml-js` package
(`OCP_TEMPLATES.capTable`). Older OpenCapTable package lines on the ledger are ignored for “current”
classification. **More than one** active CapTable on that package line for the same issuer party is
treated as a schema error.

- The ledger may echo `createdEvent.templateId` as `#PackageName:Module:Entity` or as
  `hash:Module:Entity`. The SDK **validates** each row using **`createdEvent.packageName`** (must
  match the pinned package) and the **module + entity** suffix of `templateId` (everything after the
  first `:`), aligned with `OCP_TEMPLATES.capTable`. Missing/empty `packageName` or a mismatched
  line/path throws `OcpContractError` with `OcpErrorCodes.SCHEMA_MISMATCH`. On success, the raw
  ledger `templateId` is returned unchanged for downstream use.
- **`null` state / `none` classification** mean no contract on **that pinned package line** — not
  “the issuer has no CapTable-shaped contract anywhere.” Other package lines are out of scope for
  this status.

### Multi-repo SDK sharing (`archiveFullCapTable`, `getSystemOperatorPartyId`)

- These live in `src/functions/OpenCapTable/capTable/archiveFullCapTable.ts` and take
  `LedgerJsonApiClient` (not `OcpClient`) so explorer/CLI can reuse them.
- Archive resolves **`templateId`** and **`context.system_operator`** from the live CapTable
  (version-aware). Optional `systemOperatorPartyId` skips the read when the caller already has it.
- `archiveFullCapTable` matches the caller’s `capTableContractId` when provided so the correct table
  is archived if multiple were ever visible.
- Consumers need a published SDK release to pick up new exports — coordinate multi-repo changes
  accordingly.

## Architecture Decision Records (ADRs)

See [[ADRs]] for the ADR index and lifecycle. When adding an ADR, create `ADR-NNN-Short-Title`,
update [[ADRs]], and link it from related notes.

## Related Repos

| Repo                                               | Purpose                                      | Docs                                                                      |
| -------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| `canton`                                           | Trading infrastructure, ADRs                 | `AGENTS.md`                                                               |
| `canton-explorer`                                  | Next.js explorer UI                          | `AGENTS.md`, [cantonops.fairmint.com](https://cantonops.fairmint.com/)    |
| `canton-node-sdk`                                  | Low-level Canton client                      | `AGENTS.md`, [sdk.canton.fairmint.com](https://sdk.canton.fairmint.com/)  |
| `ocp-equity-certificate`                           | Soulbound equity certificate smart contracts | `AGENTS.md`                                                               |
| `open-captable-protocol-daml`                      | DAML contracts (OCF impl)                    | `AGENTS.md`                                                               |
| `Open-Cap-Format-OCF` (`libs/Open-Cap-Format-OCF`) | OCF JSON schemas (git submodule)             | [GitHub](https://github.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF) |

## Docs

- End-user docs: [ocp.canton.fairmint.com](https://ocp.canton.fairmint.com/)
- Code style: [[Contributing]]
- ADRs: [[ADRs]]
- Docs site source: [Fairmint/web](https://github.com/Fairmint/web) (`apps/ocp-canton-sdk`)
- Docs site setup: [[Docs-Site]]

_Last reviewed: April 2026_
