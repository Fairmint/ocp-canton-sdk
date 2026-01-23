# Synthetic OCF Fixtures

This directory contains **synthetic test fixtures** for OCF object types that do not yet have
production data. These fixtures are realistic, plausible examples designed to exercise the SDK's
functionality.

## Important Note

**These fixtures should be replaced with anonymized production data when available.**

Each fixture contains a `_source: "synthetic"` field to indicate it was generated rather than
derived from real-world data.

## Fixture Coverage (23 types)

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
