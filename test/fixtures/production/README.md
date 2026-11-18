# Production OCF Fixtures

This directory contains OCF test fixtures derived from **anonymized production data** from the
Fairmint database. These fixtures represent real-world usage patterns and field combinations.

## Fixture Organization

Fixtures are organized by OCF object type. Complex types with multiple variations have
subdirectories:

```
production/
├── issuer/                    # Issuer objects
├── stakeholder/               # Individual and Institution stakeholders
├── stockClass/                # Common and Preferred stock classes
├── stockPlan/                 # Equity incentive plans
├── vestingTerms/              # Vesting schedules
├── document/                  # Documents
├── stockLegendTemplate/       # Stock legends
├── valuation/                 # 409A valuations
├── financing/                 # Financing rounds
├── stockIssuance/             # Founders stock, vested shares
├── convertibleIssuance/       # SAFEs and convertible notes
├── equityCompensationIssuance/ # ISOs, NSOs, RSUs
└── [transaction].json         # Single-file transaction types
```

## Data Sources (26 types with production data)

| Type                             | SDK Name                               | Examples                          |
| -------------------------------- | -------------------------------------- | --------------------------------- |
| Issuer                           | `issuer`                               | with-full-details, basic          |
| Stakeholder                      | `stakeholder`                          | individual, institution           |
| Stock Class                      | `stockClass`                           | common, preferred                 |
| Stock Plan                       | `stockPlan`                            | basic                             |
| Vesting Terms                    | `vestingTerms`                         | time-based-cliff                  |
| Document                         | `document`                             | basic                             |
| Stock Legend Template            | `stockLegendTemplate`                  | rule-144                          |
| Valuation                        | `valuation`                            | 409a                              |
| Financing                        | `financing`                            | basic                             |
| Stock Issuance                   | `stockIssuance`                        | founders-stock, with-vesting      |
| Stock Transfer                   | `stockTransfer`                        | single                            |
| Stock Cancellation               | `stockCancellation`                    | single                            |
| Stock Repurchase                 | `stockRepurchase`                      | single                            |
| Convertible Issuance             | `convertibleIssuance`                  | safe-post-money, convertible-note |
| Convertible Transfer             | `convertibleTransfer`                  | single                            |
| Convertible Conversion           | `convertibleConversion`                | single                            |
| Convertible Cancellation         | `convertibleCancellation`              | single                            |
| Equity Compensation Issuance     | `equityCompensationIssuance`           | option-iso, option-nso, rsu       |
| Equity Compensation Exercise     | `equityCompensationExercise`           | single                            |
| Equity Compensation Cancellation | `equityCompensationCancellation`       | single                            |
| Warrant Issuance                 | `warrantIssuance`                      | single                            |
| Issuer Authorized Shares Adj     | `issuerAuthorizedSharesAdjustment`     | single                            |
| Stock Class Auth Shares Adj      | `stockClassAuthorizedSharesAdjustment` | single                            |
| Stock Class Split                | `stockClassSplit`                      | single                            |
| Stock Plan Pool Adjustment       | `stockPlanPoolAdjustment`              | single                            |
| Vesting Start                    | `vestingStart`                         | single                            |

## OpenCapTable-v35

A fixture is an OCF record exactly as the SDK takes and returns it, which is the `ocf_data` of the
ledger contract (the register stores `{ context, ocf_data }`), not a ledger payload:

- Dates are `YYYY-MM-DD`. The register stores a Daml `Date`, so the converters write the date's
  lexical first ten characters and read back only an exact `YYYY-MM-DD`; a fixture never carries a
  time or a zone.
- Enum fields hold OCF's string values (`FOUNDERS_STOCK`). The converters map them to the generated
  constructors by the v35 rule `<TypeName><PascalCase(OCF value)>`.
- `test/converters/generatedCodecRoundTrip.test.ts` takes every fixture through `convertToDaml`, the
  generated codecs and `convertToOcf`, and fails unless OCF comes back equal.
- The integration suite `test/integration/production` writes them to a v35 book through
  `CapTable_Apply` as the transfer agent and reads them back through `OpenCapTable.<entity>.get`.
  `test/register/replicationFixtures.ts` assembles them into one consistent book for replication.
- The hold pair (`TX_STOCK_HOLD`, `TX_STOCK_HOLD_CANCELLATION`) has no production fixture: the
  register writes it, and the SDK only reads it. Its fixtures are the `stockHold*` variants under
  `synthetic/`.

## Anonymization

All PII has been anonymized:

- Names replaced with generic test names
- Email addresses use `@example.com` domain
- Tax IDs replaced with placeholder values
- Addresses replaced with generic locations
- Company-specific IDs replaced with test prefixes

## Usage

Load fixtures in tests using the fixture loader utility:

```typescript
import { loadProductionFixture } from '../../utils/productionFixtures';

// Load with type and variant
const issuer = loadProductionFixture('issuer', 'with-full-details');

// Load single-file fixtures (no variant)
const transfer = loadProductionFixture('stockTransfer');
```
