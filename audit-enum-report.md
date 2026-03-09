# OCF Enum Schema Audit Report

Generated: 2026-03-09

## Scope

Audit of OCF enum schema alignment against SDK enum modeling and converter coverage.

Primary sources:

- `test/schemaAlignment/enumAlignment.test.ts`
- `test/schemaAlignment/converterCoverage.test.ts`
- `src/types/native.ts`
- `src/utils/enumConversions.ts`
- `src/utils/typeConversions.ts`

## Current Status

- Non-skipped OCF enum schemas are mapped in `enumAlignment` (the suite fails on unmapped enums).
- Canonical value alignment is enforced for previously problematic values:
  - `AuthorizedShares`: uses `NOT APPLICABLE` (space form).
  - `ConversionMechanismType`: includes `FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION`.
  - `RoundingType`: `CEILING | FLOOR | NORMAL`.
  - `StakeholderRelationshipType`: all 13 OCF values are covered.
- Converter coverage tests exercise mapped enum values in both directions (OCF->DAML and
  DAML->OCF) for implemented converter paths.

## Important Notes

### Standalone SDK enum types

- Present and modeled directly in `native.ts`:
  - `OptionType` (`NSO | ISO | INTL`)
  - `QuantitySourceType`
  - Core OCF enums used across entity models (stakeholder/stock/valuation/etc.)

### Intentional non-standalone handling

- `FileType` and `ObjectType` are intentionally skipped by the enum alignment suite because they are
  handled contextually (file loading and object references), not as standalone SDK enums.
- Some schema enums are represented in DAML as tagged unions or structured variants rather than flat
  enums (for example `ConversionRightType`, `VestingTriggerType`), so alignment is validated via
  converter behavior instead of a single enum declaration.

### DAML structural nuance

- Relative vesting schedule periods in DAML (`OcfVestingPeriod`) support days and months variants;
  years is not available in that specific union type.

## Verification Workflow

```bash
git submodule update --init --recursive
npx jest test/schemaAlignment/enumAlignment.test.ts --runInBand
npx jest test/schemaAlignment/converterCoverage.test.ts --runInBand
```

## Caveat

There is no dedicated enum-report generator script in this repository today. This report is
maintained from the test suites above and targeted manual verification.
