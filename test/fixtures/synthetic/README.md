# Synthetic OCF Fixtures

This directory contains **synthetic test fixtures** for OCF object types that do not yet have
production data. These fixtures are realistic, plausible examples designed to exercise the SDK's
functionality.

## Important Note

**These fixtures should be replaced with anonymized production data when available.**

Each fixture contains a `_source: "synthetic"` field to indicate it was generated rather than
derived from real-world data.

## OpenCapTable-v35

A synthetic fixture follows the same conventions as the [production](../production/README.md) ones:
it is an OCF record as the SDK takes and returns it (the `ocf_data` of the ledger contract, plus the
`_source` marker), its dates are `YYYY-MM-DD` and its enum fields hold OCF's string values, which
the converters map to the generated constructors by the v35 rule
`<TypeName><PascalCase(OCF value)>`. `test/converters/generatedCodecRoundTrip.test.ts` takes every
fixture through the generated codecs and back, and it also requires every writable record kind to
have at least one, so a new kind or a new shape needs a fixture.

## Fixture Coverage (23 types, plus the variants below)

### Stock Lifecycle

| Type                | SDK Name             | Scenario                            |
| ------------------- | -------------------- | ----------------------------------- |
| Stock Acceptance    | `stockAcceptance`    | Employee accepting restricted stock |
| Stock Retraction    | `stockRetraction`    | Voiding shares issued in error      |
| Stock Conversion    | `stockConversion`    | Preferred to common at IPO          |
| Stock Reissuance    | `stockReissuance`    | Replacing lost certificate          |
| Stock Consolidation | `stockConsolidation` | Combining multiple certificates     |

### Convertible Lifecycle

| Type                   | SDK Name                | Scenario                  |
| ---------------------- | ----------------------- | ------------------------- |
| Convertible Acceptance | `convertibleAcceptance` | Investor accepting SAFE   |
| Convertible Retraction | `convertibleRetraction` | Voiding failed compliance |

### Equity Compensation Lifecycle

| Type                   | SDK Name                       | Scenario                 |
| ---------------------- | ------------------------------ | ------------------------ |
| Equity Comp Acceptance | `equityCompensationAcceptance` | Employee accepting grant |
| Equity Comp Transfer   | `equityCompensationTransfer`   | Transfer to family trust |
| Equity Comp Retraction | `equityCompensationRetraction` | Voiding incorrect grant  |
| Equity Comp Release    | `equityCompensationRelease`    | RSU settlement           |
| Equity Comp Repricing  | `equityCompensationRepricing`  | Underwater options       |

### Warrant Lifecycle

| Type                 | SDK Name              | Scenario                    |
| -------------------- | --------------------- | --------------------------- |
| Warrant Acceptance   | `warrantAcceptance`   | Investor accepting terms    |
| Warrant Transfer     | `warrantTransfer`     | Transfer to affiliated fund |
| Warrant Cancellation | `warrantCancellation` | Expired unexercised         |
| Warrant Exercise     | `warrantExercise`     | Cashless exercise           |
| Warrant Retraction   | `warrantRetraction`   | Voiding incorrect terms     |

### Corporate Actions

| Type                       | SDK Name                              | Scenario                  |
| -------------------------- | ------------------------------------- | ------------------------- |
| Stock Class Conv Ratio Adj | `stockClassConversionRatioAdjustment` | Post-split adjustment     |
| Vesting Event              | `vestingEvent`                        | Milestone achievement     |
| Vesting Acceleration       | `vestingAcceleration`                 | Single-trigger M&A        |
| Stakeholder Rel Change     | `stakeholderRelationshipChangeEvent`  | Employee to consultant    |
| Stakeholder Status Change  | `stakeholderStatusChangeEvent`        | Active to terminated      |
| Stock Plan Return to Pool  | `stockPlanReturnToPool`               | Forfeited shares returned |

## Variants (OpenCapTable-v35 conversion and hold shapes)

These fixtures are variants of a type that already has production or synthetic data. They pin every
arm of the v35 conversion records, the optional fields OCF makes optional, and the register-written
hold pair (`TX_STOCK_HOLD`, `TX_STOCK_HOLD_CANCELLATION`), which the register writes and the SDK
only reads. `test/converters/generatedCodecRoundTrip.test.ts` runs each one through the generated
Daml codecs and back, and the hold pair is checked against the Fairmint extension schemas in
`schemas/ocf-extension`.

| File                                            | What it covers                                                                                                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `convertibleIssuanceSafe`                       | SAFE mechanism with discount, cap, pre-money timing, exit multiple, capitalization definition and rules                                                                                     |
| `convertibleIssuanceNote`                       | Note mechanism with two interest rates (one ended), exit multiple, `conversion_mfn`, cap and rules                                                                                          |
| `convertibleIssuanceCustom`                     | Custom mechanism                                                                                                                                                                            |
| `convertibleIssuancePercentCapitalization`      | Fixed percent of capitalization mechanism on an in-range trigger                                                                                                                            |
| `convertibleIssuanceFixedAmount`                | Fixed amount mechanism                                                                                                                                                                      |
| `convertibleConversionCapitalizationDefinition` | Convertible conversion with a capitalization definition (the four security and class lists)                                                                                                 |
| `warrantIssuanceMechanisms`                     | Every warrant mechanism (custom, percent, fixed amount, valuation-based `CAP` and `ACTUAL`, share price with and without a discount) and stock class rights with and without a target class |
| `stockClassRatioConversion`                     | Stock class conversion rights: one with a target class, one converting to a future round                                                                                                    |
| `vestingTermsPortions`                          | Portions that omit, set and clear `remainder`, a relative schedule and a quantity condition                                                                                                 |
| `stockHoldRegisterSettlement`                   | `TX_STOCK_HOLD` of type `REGISTER_SETTLEMENT` with its quantity (Fairmint OCF extension, written by the register)                                                                           |
| `stockHoldStopTransfer`                         | `TX_STOCK_HOLD` of type `STOP_TRANSFER`, without a quantity                                                                                                                                 |
| `stockHoldCancellation`                         | `TX_STOCK_HOLD_CANCELLATION`                                                                                                                                                                |

## Usage

Load fixtures using the synthetic fixture loader:

```typescript
import { loadSyntheticFixture } from '../../utils/productionFixtures';

const fixture = loadSyntheticFixture('stockAcceptance');
```

## Contributing Real Data

When production examples become available for any of these types:

1. Query production database for representative examples
2. Anonymize all PII (names, emails, IDs, etc.)
3. Move fixture to `production/` directory
4. Remove `_source: "synthetic"` field
5. Update this README
