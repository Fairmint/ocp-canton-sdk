# ENG-450: OCP Canton SDK - Milestone 2 Next Steps

**Issue**:
[ENG-450 - OCP Canton SDK Milestone 2: OCP SDK Implementation](https://linear.app/fairmint/issue/ENG-450/ocp-canton-sdk-milestone-2-ocp-sdk-implementation)

**Status**: Integration tests added for all 48 OCF entity types

---

## Current State Summary

### Completed

1. **Core SDK Architecture**
   - `OcpClient` facade with full TypeScript SDK
   - Three main modules: `OpenCapTable`, `CantonPayments`, `OpenCapTableReports`
   - Payment Streams support

2. **All 48 OCF Entity Types Implemented**
   - Entity operations organized in `src/functions/OpenCapTable/{entityType}/`
   - OCF→DAML converters (`{entityType}DataToDaml.ts`)
   - DAML→OCF converters (`get{EntityType}AsOcf.ts`)
   - Dispatcher files in `capTable/ocfToDaml.ts` and `capTable/damlToOcf.ts`

3. **Batch API (ADR-001)**
   - Fluent builder pattern via `CapTableBatch.ts`
   - Supports create, edit, delete operations
   - Atomic multi-entity transactions

4. **Comprehensive Integration Test Suite**
   - `test/integration/entities/` - Entity-specific tests
   - `test/integration/workflows/` - Complex workflow tests
   - `test/integration/production/` - Production data round-trip tests (48 types)
   - `test/integration/payments/` - Airdrop tests
   - `test/integration/streams/` - Payment stream tests
   - `test/integration/reports/` - Company valuation report tests

5. **Additional Features**
   - Canton Payments (airdrops, simple airdrops)
   - Payment Streams (factory, proposals, migrations)
   - Company Valuation Reports
   - Issuer Authorization workflow

---

## Known Blockers

### 1. DAML JSON API v2 Nested Numeric Encoding (Critical)

The DAML JSON API v2 has encoding issues with nested objects containing `Numeric` fields. This
blocks the batch API for several entity types:

**Blocked Entity Types:** | Entity Type | Affected Fields | |-------------|-----------------| |
`stockClass` | `price_per_share`, `par_value` | | `stockIssuance` | `share_price`, `cost_basis` | |
`valuation` | `price_per_share` | | `convertibleIssuance` | `investment_amount`,
`conversion_valuation_cap` | | `equityCompensationIssuance` | `exercise_price` | | `warrantIssuance`
| `exercise_price`, `purchase_price` | | `stockClassSplit` | `OcfRatio` (nested
`numerator`/`denominator`) | | `stockClassConversionRatioAdjustment` | `OcfRatioConversionMechanism`
| | `vestingTerms` | `vesting_conditions` with `portions` |

**Impact**: 15+ integration tests are skipped with `test.skip()`

**Workaround**: Types with flat Numeric fields (e.g., `stockClassAuthorizedSharesAdjustment`) work
correctly. For complex types, wait for JSON API v2 fix.

### 2. Fixture Format Issues

Several synthetic fixtures need adjustments to match DAML schema expectations:

| Fixture                                | Issue                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| `convertibleCancellation`              | Format adjustment needed                                                             |
| `convertibleConversion`                | Format adjustment needed                                                             |
| `stockClassAuthorizedSharesAdjustment` | Format adjustment needed                                                             |
| `stockPlanPoolAdjustment`              | Format adjustment needed                                                             |
| `stockConversion`                      | Format adjustment needed                                                             |
| `stockConsolidation`                   | Uses `resulting_security_id` (singular) instead of `resulting_security_ids` (plural) |
| `equityCompensationRelease`            | Format adjustment needed                                                             |
| `equityCompensationRepricing`          | Format adjustment needed                                                             |
| `warrantExercise`                      | Format adjustment needed                                                             |
| `stakeholderRelationshipChangeEvent`   | `new_relationships` needs specific enum values                                       |
| `stakeholderStatusChangeEvent`         | Format adjustment needed                                                             |
| `stockPlanReturnToPool`                | Format adjustment needed                                                             |

---

## Recommended Next Steps

### Immediate (P0 - Current Sprint)

1. **Fix Fixture Format Issues** (Est: 2-4 hours)
   - Update synthetic fixtures in `test/fixtures/synthetic/` to match DAML schema
   - Enable currently skipped tests that only need fixture fixes
   - Files to update:
     - `stockConsolidation.json` - Fix `resulting_security_ids` field
     - `stakeholderRelationshipChangeEvent.json` - Fix enum values
     - Others as listed above

2. **Document API Limitations** (Est: 1 hour)
   - Update user-facing documentation with JSON API v2 limitations
   - Add migration guide for affected entity types

### Short-term (P1 - Next Sprint)

3. **Monitor JSON API v2 Fix** (Canton team dependency)
   - Track upstream fix for nested Numeric encoding
   - Once fixed, enable all skipped tests
   - Affected test files:
     - `test/integration/production/productionDataRoundtrip.integration.test.ts`

4. **Enhance Read-Back Validation**
   - Add `compareOcfData()` assertions to more round-trip tests
   - Currently only `Stakeholder (individual)` has full comparison validation
   - Extend to all passing entity types

5. **Payment Infrastructure Tests** (When available)
   - `test/integration/streams/` tests are stub implementations
   - Full workflow tests require Canton Network with payment stream support
   - Files affected:
     - `paymentStreamFactory.integration.test.ts`
     - `proposedPaymentStream.integration.test.ts`
     - `activePaymentStream.integration.test.ts`
     - `paymentStreamChangeProposal.integration.test.ts`
     - `partyMigrationProposal.integration.test.ts`

### Medium-term (P2 - Backlog)

6. **Company Valuation Reports Full Tests**
   - Requires OCP Factory contract deployment
   - Enable workflow tests in `test/integration/reports/companyValuationReport.integration.test.ts`

7. **Performance Optimization**
   - Benchmark batch operations with large entity counts
   - Optimize disclosed contract handling

8. **Error Handling Improvements**
   - Add retry logic for transient failures
   - Improve error messages for DAML contract validation errors

---

## Test Coverage Summary

### Integration Tests Status

| Test Suite                | Passing | Skipped | Notes                           |
| ------------------------- | ------- | ------- | ------------------------------- |
| Issuer operations         | ✅ All  | 0       |                                 |
| Stakeholder operations    | ✅ All  | 0       |                                 |
| Stock Class Adjustments   | ✅ Most | 2       | JSON API v2 numeric issue       |
| Acceptance Types          | ✅ Most | 2       | JSON API v2 numeric issue       |
| Transfer Types            | ✅ All  | 0       |                                 |
| Exercise/Conversion Types | ✅ Most | 3       | JSON API v2 numeric issue       |
| Valuation/Vesting         | ✅ Most | 2       | JSON API v2 numeric issue       |
| Remaining Types           | ✅ All  | 0       |                                 |
| Cap Table Batch           | ✅ All  | 0       |                                 |
| Production Round-trip     | ✅ 33   | 15      | JSON API v2 + fixture issues    |
| Workflows                 | ✅ Most | 1       | Stock class dependency          |
| Payments/Airdrops         | ✅ All  | 0       |                                 |
| Payment Streams           | ⏭ Stub | -       | Requires payment infrastructure |
| Reports                   | ⏭ Stub | -       | Requires OCP Factory            |

### Entity Implementation Status

All 48 OCF entity types have:

- ✅ TypeScript types
- ✅ OCF→DAML converter
- ✅ DAML→OCF converter
- ✅ Unit test fixtures
- ⚠️ Integration test (some skipped due to blockers)

---

## Files to Reference

- **llms.txt** - Project conventions and known limitations (Section: "DAML JSON API v2 Nested
  Numeric Encoding")
- **ADR-001** - Batch API design (`adr/001-batch-cap-table-updates.md`)
- **Test Fixtures** - `test/fixtures/production/` and `test/fixtures/synthetic/`
- **Integration Setup** - `test/integration/setup/integrationTestHarness.ts`

---

## Commands for Verification

```bash
# Run all tests (unit + type checking)
npm run test:ci

# Run integration tests (requires LocalNet)
npm run test:integration

# Check skipped tests
grep -r "test.skip" test/integration/ | wc -l

# Lint and format
npm run fix
```

---

_Last updated: 2026-01-23_
