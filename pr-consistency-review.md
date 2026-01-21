# PR Consistency Review - OCF Type Implementations

**Date**: 2026-01-21
**Reviewer**: Cursor Agent (automated consistency review)

This document reviews all open PRs implementing OCF types for consistency in design, best practices, and testing patterns.

---

## Summary of Key Inconsistencies Found

| Aspect | #183 Transfer | #184 Acceptance | #185 Exercise/Conv | #186 Stock Adj | #187 Valuation | #188 Remaining |
|--------|---------------|-----------------|--------------------|--------------------|----------------|----------------|
| **OcpClient Methods** | ✅ Added | ❌ None | ❌ None | ✅ Added | ❌ None | ❌ None |
| **Batch API Support** | ❌ None | ✅ Full | ✅ Partial | ✅ Partial | ✅ Full | ✅ Full |
| **Integration Tests** | ❌ None | ✅ Yes | ❌ None | ✅ Yes (some skip) | ✅ Yes | ❌ None |
| **Unit Test Location** | `fixtures/` | `converters/` | `utils/` | `ocfToDaml/` | `converters/` | `batch/` |
| **Bidirectional Convert** | ❌ DAML→OCF only | ✅ Both | ✅ Both | ✅ Both | ✅ Both | ⚠️ OCF→DAML only |
| **Test Data Factories** | ❌ None | ✅ Added | ❌ None | ❌ None | ✅ Added | ❌ None |

**Recommendations for consistency:**
1. All PRs should add integration tests
2. Unit tests should go in `test/converters/` directory
3. All PRs should support batch API (add to `batchTypes.ts` and `ocfToDaml.ts`)
4. Add test data factories to `setupTestData.ts`
5. Bidirectional converters should be in `capTable/damlToOcf.ts` for reads

---

## PR #183 - Transfer Types

**Comment to post:**

```markdown
@cursor **Consistency Review - Transfer Types (#183)**

## Issues

- **[Missing Integration Tests]** This PR does not include integration tests, unlike PRs #184, #186, and #187 which all have integration tests. Add integration tests to `test/integration/entities/transferTypes.integration.test.ts` to verify DAML contract behavior.

- **[Test Location Inconsistency]** Tests use fixture files in `test/fixtures/createOcf/` while newer PRs like #184 and #187 use dedicated converter test files in `test/converters/`. Consider adding unit tests in `test/converters/transferConverters.test.ts` for consistency.

- **[API Pattern Alignment]** This PR adds standalone `get*AsOcf` methods to `OcpClient`, but does NOT add OCF→DAML converters to `ocfToDaml.ts`. PRs #184, #187, and #188 add bidirectional converters. Consider adding `convertibleTransferDataToDaml`, `equityCompensationTransferDataToDaml`, `warrantTransferDataToDaml` to `ocfToDaml.ts` so transfers can be created via batch API.

- **[No Batch API Support]** Transfer types cannot be created via the batch API. The batch API pattern from PRs #184, #187, and #188 should be followed - add entries to `batchTypes.ts` (`ENTITY_TAG_MAP`, `OcfEntityDataMap`, `OcfEntityType`) and converters to `ocfToDaml.ts`.

---

<details>
<summary>Full Analysis</summary>

### What This PR Does Well
- Clean DAML→OCF converter implementation following existing patterns
- Proper type exports and OcpClient integration
- Correct date handling (stripping time component)
- Handles DAML Numeric as string | number
- Uses `normalizeNumericString` for quantity/amount normalization

### Recommended Changes to Match Best Practices

1. **Add integration tests** following the pattern in `test/integration/entities/acceptanceTypes.integration.test.ts`

2. **Add unit tests** in `test/converters/transferConverters.test.ts` with both OCF→DAML and DAML→OCF coverage.

3. **Add batch API support** by:
   - Adding entries to `batchTypes.ts`
   - Adding `*DataToDaml` functions to `ocfToDaml.ts`
   - Exporting converters from `capTable/index.ts`

4. **Add test data factories** in `setupTestData.ts`:
```typescript
export function createTestConvertibleTransferData(
  overrides: Partial<OcfConvertibleTransfer>
): OcfConvertibleTransfer { ... }
```

</details>
```

---

## PR #184 - Acceptance Types

**Comment to post:**

```markdown
@cursor **Consistency Review - Acceptance Types (#184)**

## Issues

- **[Missing OcpClient Methods]** Unlike PRs #183 and #186 which add `get*AsOcf` methods to `OcpClient`, this PR only adds batch API converters. Consider adding standalone read methods like `getStockAcceptanceAsOcf()` to `OcpClient` for consistency with other entity types.

---

<details>
<summary>Full Analysis</summary>

### What This PR Does Well - EXEMPLARY PATTERN
This PR represents the **best pattern** among the PRs reviewed:

1. **Centralized converters** in `capTable/damlToOcf.ts` with proper exports
2. **Comprehensive unit tests** in `test/converters/acceptanceConverters.test.ts`
3. **Full integration tests** in `test/integration/entities/acceptanceTypes.integration.test.ts`
4. **Uses batch API pattern** correctly
5. **Test data factories** via inline helper functions in tests
6. **Generic dispatcher** `convertAcceptanceFromDaml()` with type-safe generics

### Pattern to Replicate in Other PRs

```typescript
// Centralized converter dispatcher pattern
export function convertAcceptanceFromDaml<T extends AcceptanceEntityType>(
  type: T,
  damlData: DamlAcceptanceData
): AcceptanceOcfTypeMap[T] { ... }
```

### Only Missing Item

Add `OcpClient` methods for reading acceptance contracts:
```typescript
stockAcceptance: {
  getStockAcceptanceAsOcf: async (params) => getStockAcceptanceAsOcf(client, params),
},
```

</details>
```

---

## PR #185 - Exercise/Conversion Types

**Comment to post:**

```markdown
@cursor **Consistency Review - Exercise/Conversion Types (#185)**

## Issues

- **[Missing Integration Tests]** This PR does not include integration tests. PRs #184, #186, and #187 all have integration tests. Add `test/integration/entities/exerciseConversionTypes.integration.test.ts`.

- **[Test Location Inconsistency]** Unit tests are in `test/utils/exerciseConversionConverters.test.ts` but should be in `test/converters/` to match PRs #184 and #187.

- **[Missing OcpClient Methods]** Unlike PR #183 which adds `OcpClient` methods, this PR does NOT add methods to `OcpClient`. The `get*EventAsOcf` functions are exported but not wired to the client. Add these to `OcpClient.ts`.

- **[Missing Test Data Factories]** No test data factories added to `setupTestData.ts`. PRs #184 and #187 add factories like `createTestVestingStartData()`.

---

<details>
<summary>Full Analysis</summary>

### What This PR Does Well
- Good OCF→DAML converters with validation
- Proper DAML→OCF read functions
- Comprehensive unit test coverage
- Validates `resulting_security_ids` array is not empty
- Handles quantity normalization

### Missing Items

1. **Add to OcpClient**:
```typescript
warrantExercise: {
  getWarrantExerciseEventAsOcf: async (params) => getWarrantExerciseEventAsOcf(client, params),
},
convertibleConversion: {
  getConvertibleConversionEventAsOcf: async (params) => getConvertibleConversionEventAsOcf(client, params),
},
stockConversion: {
  getStockConversionEventAsOcf: async (params) => getStockConversionEventAsOcf(client, params),
},
```

2. **Move tests** from `test/utils/` to `test/converters/exerciseConversionConverters.test.ts`

3. **Add integration tests** following PR #184 pattern

4. **Add test data factories** to `setupTestData.ts`

</details>
```

---

## PR #186 - Stock Class Adjustments

**Comment to post:**

```markdown
@cursor **Consistency Review - Stock Class Adjustments (#186)**

## Issues

- **[Test Location Inconsistency]** Unit tests are in `test/ocfToDaml/stockClassAdjustments.test.ts` but should be in `test/converters/` to match PRs #184 and #187 for DAML→OCF tests.

- **[Missing DAML→OCF Converters Export]** The `get*EventAsOcf` functions exist but the corresponding `daml*ToNative` converters are not exported from `capTable/damlToOcf.ts` like they are in PR #187 for valuation/vesting types.

- **[llms.txt Update]** Good documentation of the DAML JSON API v2 numeric encoding limitation - this is a best practice other PRs should follow when they encounter DAML limitations.

---

<details>
<summary>Full Analysis</summary>

### What This PR Does Well
- **Documents known limitations** in `llms.txt` about DAML JSON API v2 nested Numeric encoding issues
- **Skips affected tests** appropriately with clear explanations
- **Integration tests** included (some skipped due to known issues)
- **Handles schema differences** between OCF (array) and DAML (singular) for `resulting_security_id`
- **Updates ocfToDaml.ts** with correct nested object structure for DAML

### Recommended Changes

1. **Move unit tests** to `test/converters/stockClassAdjustmentConverters.test.ts`

2. **Add DAML→OCF converters** to `capTable/damlToOcf.ts`:
```typescript
export function damlStockClassSplitToNative(d: DamlStockClassSplitData): OcfStockClassSplit { ... }
export function damlStockConsolidationToNative(d: DamlStockConsolidationData): OcfStockConsolidation { ... }
```

3. **Export converters** from `capTable/index.ts` for reuse

</details>
```

---

## PR #187 - Valuation & Vesting Types

**Comment to post:**

```markdown
@cursor **Consistency Review - Valuation & Vesting Types (#187)**

## Issues

- **[Missing OcpClient Methods]** Unlike PRs #183 and #186 which add `get*AsOcf` methods to `OcpClient`, this PR only adds batch API converters and DAML→OCF helpers. Consider adding standalone read methods to `OcpClient` for consistency.

---

<details>
<summary>Full Analysis</summary>

### What This PR Does Well - EXEMPLARY PATTERN
This PR, along with #184, represents the **best pattern** among the PRs reviewed:

1. **Centralized converters** in `capTable/damlToOcf.ts` with proper exports
2. **Comprehensive unit tests** in `test/converters/valuationVestingConverters.test.ts`
3. **Full integration tests** in `test/integration/entities/valuationVesting.integration.test.ts`
4. **Uses batch API pattern** correctly
5. **Test data factories** added to `setupTestData.ts`:
   - `createTestVestingStartData()`
   - `createTestVestingEventData()`
   - `createTestVestingAccelerationData()`
6. **Documents skipped tests** with clear explanations about stock class numeric encoding issues

### Pattern to Replicate

```typescript
// Test data factory pattern
export function createTestVestingStartData(
  overrides: Partial<OcfVestingStart> & { security_id: string; vesting_condition_id: string }
): OcfVestingStart {
  const id = overrides.id ?? generateTestId('vesting-start');
  const { security_id, vesting_condition_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    vesting_condition_id,
    ...rest,
  };
}
```

### Only Missing Item

Add `OcpClient` methods for reading vesting/valuation contracts.

</details>
```

---

## PR #188 - Remaining Types

**Comment to post:**

```markdown
@cursor **Consistency Review - Remaining Types (#188)**

## Issues

- **[Missing Integration Tests]** This PR does not include integration tests. Add `test/integration/entities/remainingTypes.integration.test.ts` following the pattern from PRs #184 and #187.

- **[Missing DAML→OCF Converters]** This PR only adds OCF→DAML converters. For stakeholder change events and other types, add corresponding `daml*ToNative` converters in `capTable/damlToOcf.ts` for reading these entities back from the ledger.

- **[Test Location]** Tests are in `test/batch/remainingOcfTypes.test.ts` which is appropriate for batch API tests, but should also have converter tests in `test/converters/`.

---

<details>
<summary>Full Analysis</summary>

### What This PR Does Well
- **Native types** properly defined in `native.ts` for stakeholder events
- **Enum conversions** with exhaustive switch statements
- **Batch API support** with proper entries in `batchTypes.ts`
- **Comprehensive unit tests** covering all status and relationship type conversions
- **Mixed batch test** demonstrating atomic operations

### Missing Items

1. **Add DAML→OCF converters** to `capTable/damlToOcf.ts`:
```typescript
export function damlStakeholderStatusToNative(damlStatus: string): StakeholderStatus { ... }
export function damlStakeholderRelationshipToNative(damlRel: string): StakeholderRelationshipType { ... }
```

2. **Add integration tests** in `test/integration/entities/remainingTypes.integration.test.ts`

3. **Add test data factories** to `setupTestData.ts`:
```typescript
export function createTestStakeholderStatusChangeData(
  overrides: Partial<OcfStakeholderStatusChangeEvent>
): OcfStakeholderStatusChangeEvent { ... }
```

</details>
```

---

## PR #190 - Protocol Design

**Comment to post:**

```markdown
@cursor **Consistency Review - Protocol Design (#190)**

## Issues

None - this is a documentation-only PR.

---

<details>
<summary>Full Analysis</summary>

### What This PR Does Well
This is an excellent architecture review document that:

1. **Identifies the same inconsistencies** found in this cross-PR review
2. **Proposes concrete improvement tasks** with clear prioritization
3. **Documents architectural decisions** and their trade-offs
4. **Provides code examples** for recommended patterns

### Recommendations

1. **Reference this review in other PRs** - the issues identified here align with the consistency issues found across PRs #183-188.

2. **Consider creating follow-up tasks** from this review:
   - Centralize converter location (`src/converters/`)
   - Standardize test file locations (`test/converters/`)
   - Add missing integration tests
   - Create unified test data factory module

3. **Update task index** to track the improvement items as separate tasks.

</details>
```

---

## Recommendations for Raising the Bar

### 1. Standardize Test Location
All converter unit tests should go in `test/converters/<entityType>Converters.test.ts`:
```
test/converters/
  acceptanceConverters.test.ts      # PR #184 ✅
  valuationVestingConverters.test.ts # PR #187 ✅
  transferConverters.test.ts         # PR #183 (needs move)
  exerciseConversionConverters.test.ts # PR #185 (needs move)
  stockClassAdjustmentConverters.test.ts # PR #186 (needs move)
  remainingTypesConverters.test.ts   # PR #188 (needs add)
```

### 2. Always Include Integration Tests
Every entity type PR should include `test/integration/entities/<entityType>.integration.test.ts`.

### 3. Bidirectional Converters
All PRs should add both:
- OCF→DAML in `ocfToDaml.ts` (for batch API writes)
- DAML→OCF in `damlToOcf.ts` (for ledger reads)

### 4. Test Data Factories
Add factories to `setupTestData.ts` for every new entity type.

### 5. OcpClient Consistency
Decide on ONE pattern:
- **Option A**: All entity types get standalone `get*AsOcf` methods in `OcpClient`
- **Option B**: Only batch API converters, no standalone methods for new types

Currently mixed: #183, #186 add methods; #184, #185, #187, #188 do not.

### 6. Document DAML Limitations
When encountering DAML limitations (like JSON API v2 numeric encoding), document them in `llms.txt` (as #186 does well).

---

## How to Post These Comments

Since automated posting is not available, manually post each comment section above to its respective PR:

1. Go to https://github.com/Fairmint/ocp-canton-sdk/pull/183 → Add comment
2. Go to https://github.com/Fairmint/ocp-canton-sdk/pull/184 → Add comment
3. Go to https://github.com/Fairmint/ocp-canton-sdk/pull/185 → Add comment
4. Go to https://github.com/Fairmint/ocp-canton-sdk/pull/186 → Add comment
5. Go to https://github.com/Fairmint/ocp-canton-sdk/pull/187 → Add comment
6. Go to https://github.com/Fairmint/ocp-canton-sdk/pull/188 → Add comment
7. Go to https://github.com/Fairmint/ocp-canton-sdk/pull/190 → Add comment
