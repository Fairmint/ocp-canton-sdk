# OCP Canton SDK (`@open-captable-protocol/canton`)

> High-level TypeScript SDK for Open Cap Table Protocol contracts on Canton.

## Shared Conventions

See
[canton/AGENTS.md](https://github.com/fairmint/canton/blob/main/AGENTS.md#shared-conventions-all-fairmint-repos)
for PR workflow, git workflow, dependencies, non-negotiables, and Linear integration.

## Linear API Access

Use `LINEAR_API_KEY` for programmatic Linear access. See `linear-api` skill for curl examples.

## Quick Commands

```bash
npm run fix                                     # ESLint + Prettier auto-fix (REQUIRED before push)
npm run lint && npx tsc --noEmit && npm test   # Full validation
npm run test:integration                        # LocalNet integration tests
npm run docs                                    # Generate TypeDoc
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
│   ├── CantonPayments/     # Airdrop, payment streams
│   └── OpenCapTableReports/
├── types/
│   ├── native.ts           # OCF-native input types (OcfIssuer, OcfStakeholder, etc.)
│   ├── output.ts           # OCF output types with object_type discriminant (OcfIssuerOutput, etc.)
│   ├── common.ts           # Shared types (GetByContractIdParams, ContractResult<T>, re-exports)
│   ├── branded.ts          # Branded types (ContractId, PartyId) - optional strict typing
│   └── daml.ts             # Re-exported DAML package types
├── utils/
│   ├── typeConversions.ts  # DAML ↔ OCF conversions
│   └── TransactionBatch.ts # Multi-command helper
└── OcpClient.ts            # Facade wiring to LedgerJsonApiClient

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

The `OcpClient` is the primary API surface. Methods are organized by entity type:

```typescript
// All get() methods return ContractResult<T> with { data, contractId }
const { data: issuer } = await ocp.OpenCapTable.issuer.get({ contractId: '...' });
console.log(issuer.object_type); // 'ISSUER' - discriminated union
console.log(issuer.legal_name);

// Batch operations
const batch = ocp.OpenCapTable.capTable.update({
  capTableContractId: '...',
  actAs: ['issuerParty'],
});
batch.create('stakeholder', stakeholderData);
await batch.execute();
```

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

1. **Validate before converting** - Check for null/undefined before calling conversion functions
2. **Use `.toString()` not `String()`** - When you've validated a value is not null/undefined, use
   `.toString()`
3. **Let validation functions throw** - Functions like `normalizeNumericString()` throw on invalid
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

1. **Strict TypeScript** - No `any`/`unknown`, no broad assertions
   - Use type guards instead of `as any` casts
   - Prefer `unknown` + type narrowing over `any` when type is truly unknown
   - Extract proper types from external libraries when possible
2. **Fail fast** - Validate early, throw with actionable messages
3. **Never silently ignore errors** - Prefer failing over hiding problems
   - No empty catch blocks that swallow errors
   - No early returns that make tests "pass" when they didn't run
   - If something fails, it should fail visibly with a clear error message
   - Tests must actually test - if infrastructure is missing, tests should fail, not skip
4. **No unsafe type coercion** - ALWAYS validate before converting types
   - **NEVER** use `String(value)` on potentially undefined/null values (creates `"undefined"` or
     `"null"` strings)
   - **NEVER** use `Number(value)` on potentially invalid strings (creates `NaN`)
   - **ALWAYS** validate the type first, then convert with explicit error handling
   - Example: ❌ `String(amount)` → ✅ `if (!amount) throw new Error('...'); amount.toString()`
   - Use `.toString()` instead of `String()` when you've validated the value is not null/undefined
5. **Explicit fields** - List all fields, never use spread (`...d`)
6. **No defensive checks** - Trust DAML types, don't check `Array.isArray()`
7. **Use `null`** for DAML optional fields (not `undefined`)
8. **Use `??`** instead of `||` for nullish coalescing
9. **Pinned dependencies** - ALWAYS use exact versions without `^` or `~` for dependencies and
   devDependencies
   - ✅ Correct: `"jsonwebtoken": "9.0.3"`
   - ❌ Wrong: `"jsonwebtoken": "^9.0.3"` or `"~9.0.3"`
   - This applies to `dependencies` and `devDependencies` (NOT `peerDependencies`)
   - **peerDependencies should use ranges** to allow consuming packages flexibility
   - Example peerDependency ranges: `">=0.0.183 <0.1.0"` or `">=0.2.133 <0.3.0"`
   - When adding packages: `npm install --save-exact <package>` or manually remove `^`/`~` after
     install
10. **DRY code** - Extract duplicated logic into reusable helpers (especially in tests)

## Improvement Backlog Pattern

When you discover areas for improvement that are **unrelated to the current task**:

1. **Don't fix inline** - Keep PRs focused on the task at hand
2. **Document as backlog** - Create or update an improvement ideas file in the task directory
3. **Reference from main task** - Ensure the parent task links to improvement subtasks
4. **Address before marking complete** - Main tasks should not be closed until improvement items are
   resolved

**Location:** `canton/tasks/YYYY/MM/{task-name}/sdk-improvement-ideas.md`

**Example items:**

- Dead code (functions referencing non-existent DAML choices)
- Type inconsistencies across similar functions
- Missing test coverage
- Configuration issues (ESLint, tsconfig)
- Duplicated utility functions

This ensures improvements aren't lost while keeping PRs focused and reviewable.

## Testing Strategy

### Test Types

| Test Type         | Command                    | Purpose                                      |
| ----------------- | -------------------------- | -------------------------------------------- |
| Unit tests        | `npm test`                 | Mock-based tests for conversions, validation |
| Integration tests | `npm run test:integration` | LocalNet tests validating DAML contracts     |
| Type checking     | `npm run typecheck`        | TypeScript compilation checks                |

### Unit Tests (Mock-based)

Unit tests use mocked Canton responses for fast, deterministic testing:

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

**Running integration tests:**

```bash
# Start LocalNet (cn-quickstart) first
npm run test:integration
```

**Integration test structure:**

Tests are organized by entity type with shared infrastructure:

- `setup/` - Harness for client init, party discovery, validator API detection
- `entities/` - One test file per OCF entity type
- `workflows/` - Multi-entity workflow tests
- `utils/` - Data factories and helpers:
  - `setupTestData.ts` - Entity setup functions (`setupTestIssuer`, `createTestStockClassData`)
  - `transactionHelpers.ts` - Type-safe transaction tree utilities (`extractContractIdOrThrow`)

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

**Note:** Tests fail fast if LocalNet is not running. There is no silent skipping - if
infrastructure is missing, tests fail with a clear error message. This ensures CI catches missing
infrastructure rather than falsely reporting success.

**Adding tests for a new entity type:**

1. Create `test/integration/entities/{entity}.integration.test.ts`
2. Use `createIntegrationTestSuite()` for automatic harness setup
3. Add data factory in `test/integration/utils/setupTestData.ts` if needed
4. Reference `stockClass.integration.test.ts` as the complete example

**Benefits of integration tests:**

- Validates end-to-end OCF compliance
- Tests actual DAML contract behavior
- Catches runtime issues before merge
- Builds confidence in contract implementations

### OCF Schema Validation

Tests validate against official OCF JSON schemas:

```bash
git submodule update --init --recursive  # Get schemas
npm test                                  # Validates fixtures
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

Git submodule for local Canton Network development and testing.

```bash
# Quick start
cd libs/cn-quickstart/quickstart
make setup && make start

# Wait for healthy, then run tests
docker ps --format "table {{.Names}}\t{{.Status}}"
npm run test:integration
```

**Pre-push checklist:**

1. `npm run fix` - Format and lint
2. `npm run test:ci` - Unit tests
3. `npm run test:integration` - Integration tests (requires LocalNet)

For detailed setup, ports, OAuth2 credentials, and troubleshooting, use the `localnet` skill.

### DAML Upgrade Testing

When upgrading `@fairmint/open-captable-protocol-daml-js`:

1. Check release notes for breaking changes in field types
2. Run `npm run test:integration` (not just unit tests)
3. Verify OCF-to-DAML converters encode union types correctly

## NPM Publishing

The package `@open-captable-protocol/canton` is automatically published to NPM when changes are
merged to `main`.

### How It Works

1. **Create a PR** with your changes
2. **Get it reviewed** and approved
3. **Merge to main** - CI automatically:
   - Builds the package and runs tests
   - Runs integration smoke tests
   - Increments the patch version in `package.json`
   - Generates a changelog from commits since last release
   - Publishes to NPM
   - Creates and pushes a git tag (e.g., `v0.2.79`)
   - Deploys documentation to GitHub Pages

### Version Bumping

- **Patch bumps** (0.2.78 → 0.2.79): Automatic on every merge to main
- **Minor/Major bumps**: Manually update `package.json` version before merging

### Manual Release (Local)

```bash
npm run prepare-release   # Bumps version, generates changelog
npm publish               # Publishes to NPM (requires NPM_TOKEN)
```

### CI Requirements

The publish workflow requires:

- `NPM_TOKEN` secret configured in GitHub repository settings

---

## Living Document

**Keep this file up-to-date.** Update it when:

- A best practice or pattern is established
- An architectural or coding decision is made
- New features, endpoints, or patterns are added
- Before creating a PR: review for generalizable learnings

---

## Communication Style

Be concise in all communications:

- **PR reviews**: Lead with issues, collapse detailed analysis in `<details>`
- **Commits**: One-line summary, optional bullet points for details
- **PR descriptions**: Brief summary, link to task file for context
- **Comments**: Direct and actionable, skip pleasantries

Include all necessary information, but keep it brief and scannable.

---

## Git Hooks

Before committing or pushing, run these checks:

| Step  | Command         | Purpose                |
| ----- | --------------- | ---------------------- |
| Lint  | `npm run fix`   | Fix linting/formatting |
| Test  | `npm test`      | Ensure tests pass      |
| Build | `npm run build` | Verify compilation     |

**Note**: Husky hooks should enforce this automatically. If hooks aren't set up, run these manually.

---

## Related Repos

| Repo                          | Purpose                                       | Docs                                                                      |
| ----------------------------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| `canton`                      | Trading infrastructure, ADRs                  | `AGENTS.md`                                                               |
| `canton-explorer`             | Next.js explorer UI                           | `AGENTS.md`, [cantonops.fairmint.com](https://cantonops.fairmint.com/)    |
| `canton-fairmint-sdk`         | Shared TypeScript utilities                   | `AGENTS.md`                                                               |
| `canton-node-sdk`             | Low-level Canton client                       | `AGENTS.md`, [sdk.canton.fairmint.com](https://sdk.canton.fairmint.com/)  |
| `ocp-digital-certificate`     | Soulbound digital certificate smart contracts | `AGENTS.md`                                                               |
| `open-captable-protocol-daml` | DAML contracts (OCF impl)                     | `AGENTS.md`                                                               |
| `open-cap-format-ocf`         | OCF JSON schemas (submodule)                  | [GitHub](https://github.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF) |

## Architecture Decision Records (ADRs)

ADRs document significant architectural decisions. They live in the `adr/` directory.

**ADR Index:** See [adr/README.md](adr/README.md) for the current ADR index.

**When creating a new ADR:**

1. Create the ADR file: `adr/NNN-short-title.md` (NNN = next sequential number)
2. **ALWAYS update `adr/README.md`** to add the new ADR to the index table
3. Link the ADR from any related task files

**ADR Status Values:** Proposed → Accepted → (Superseded/Rejected)

## Tasks

Tasks are tracked in [Linear](https://linear.app/fairmint) under the **Eng** team. Filter by
`[ocp-canton-sdk]` in the title to find SDK-specific issues.

See [canton/AGENTS.md](https://github.com/fairmint/canton/blob/main/AGENTS.md#linear-integration)
for the full Linear workflow documentation.

## Docs

- End-user docs: [ocp.canton.fairmint.com](https://ocp.canton.fairmint.com/)
- TypeDoc: `npm run docs` → `docs/`
- Implementation guide: `README.md`
- Code style: `CONTRIBUTING.md`
- Lint config: `LINTING.md`
