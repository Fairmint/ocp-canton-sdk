# OCF Schema vs SDK TypeScript Interface Field-by-Field Audit

Generated: 2026-03-05T14:28:30.987Z

## Executive Summary

This audit compares all 56 OCF object schemas against their corresponding SDK TypeScript interfaces
in `src/types/native.ts`.

**Key findings:**

- OCF schemas use `allOf` inheritance (Object base adds `id`, `object_type`, `comments`; Transaction
  adds `date`; SecurityTransaction adds `security_id`; Issuance adds `custom_id`, `stakeholder_id`,
  `security_law_exemptions`, etc.)
- Most discrepancies fall into: (1) **MISSING** - OCF field not in SDK, (2) **EXTRA** - SDK field
  not in OCF (potential `additionalProperties: false` violation), (3) **MISMATCH** -
  required/optional or type differences
- **Financing**: OCF uses `name` and `date`; SDK uses `round_name` and `financing_date`. OCF
  requires `issuance_ids`; SDK omits it. SDK adds `financing_type`, `amount_raised`,
  `pre_money_valuation`, `post_money_valuation`, `stock_class_id`.
- **PlanSecurity\*** schemas inherit from EquityCompensation equivalents; base fields (id, date,
  security_id) come from Transaction/SecurityTransaction.

---

## Per-Object Audit

### Document → OcfDocument

| Field           | OCF Type               | OCF Required? | SDK Type             | SDK Required? | Status |
| --------------- | ---------------------- | ------------- | -------------------- | ------------- | ------ |
| comments        | array<string>          | No            | string[]             | No            | OK     |
| id              | string                 | Yes           | string               | Yes           | OK     |
| md5             | Md5                    | Yes           | string               | Yes           | OK     |
| path            | string                 | No            | string               | No            | OK     |
| related_objects | array<ObjectReference> | No            | OcfObjectReference[] | No            | OK     |
| uri             | string                 | No            | string               | No            | OK     |

### Financing → OcfFinancing

| Field                | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status  |
| -------------------- | ------------- | ------------- | -------- | ------------- | ------- |
| comments             | array<string> | No            | string[] | No            | OK      |
| date                 | Date          | Yes           | string   | Yes           | OK      |
| id                   | string        | Yes           | string   | Yes           | OK      |
| issuance_ids         | array<string> | Yes           | -        | -             | MISSING |
| name                 | string        | Yes           | string   | Yes           | OK      |
| amount_raised        | -             | -             | Monetary | No            | EXTRA   |
| pre_money_valuation  | -             | -             | Monetary | No            | EXTRA   |
| post_money_valuation | -             | -             | Monetary | No            | EXTRA   |
| stock_class_id       | -             | -             | string   | No            | EXTRA   |

### Issuer → OcfIssuer

| Field                                 | OCF Type               | OCF Required? | SDK Type                | SDK Required? | Status   |
| ------------------------------------- | ---------------------- | ------------- | ----------------------- | ------------- | -------- |
| address                               | Address                | No            | Address                 | No            | OK       |
| comments                              | array<string>          | No            | string[]                | No            | OK       |
| country_of_formation                  | CountryCode            | Yes           | string                  | Yes           | OK       |
| country_subdivision_name_of_formation | string                 | No            | string                  | No            | OK       |
| country_subdivision_of_formation      | CountrySubdivisionCode | No            | string                  | No            | OK       |
| dba                                   | string                 | No            | string                  | No            | OK       |
| email                                 | Email                  | No            | Email                   | No            | OK       |
| formation_date                        | Date                   | Yes           | string                  | Yes           | OK       |
| id                                    | string                 | Yes           | string                  | Yes           | OK       |
| initial_shares_authorized             | oneOf                  | No            | InitialSharesAuthorized | No            | OK       |
| legal_name                            | string                 | Yes           | string                  | Yes           | OK       |
| phone                                 | Phone                  | No            | Phone                   | No            | OK       |
| tax_ids                               | array<TaxID>           | No            | TaxId[]                 | Yes           | MISMATCH |

### Stakeholder → OcfStakeholder

| Field                 | OCF Type                           | OCF Required? | SDK Type                      | SDK Required? | Status |
| --------------------- | ---------------------------------- | ------------- | ----------------------------- | ------------- | ------ |
| addresses             | array<Address>                     | No            | Address[]                     | No            | OK     |
| comments              | array<string>                      | No            | string[]                      | No            | OK     |
| contact_info          | ContactInfoWithoutName             | No            | ContactInfoWithoutName        | No            | OK     |
| current_relationship  | StakeholderRelationshipType        | No            | StakeholderRelationshipType   | No            | OK     |
| current_relationships | array<StakeholderRelationshipType> | No            | StakeholderRelationshipType[] | No            | OK     |
| current_status        | StakeholderStatusType              | No            | StakeholderStatus             | No            | OK     |
| id                    | string                             | Yes           | string                        | Yes           | OK     |
| issuer_assigned_id    | string                             | No            | string                        | No            | OK     |
| name                  | Name                               | Yes           | Name                          | Yes           | OK     |
| primary_contact       | ContactInfo                        | No            | ContactInfo                   | No            | OK     |
| stakeholder_type      | StakeholderType                    | Yes           | StakeholderType               | Yes           | OK     |
| tax_ids               | array<TaxID>                       | No            | TaxId[]                       | No            | OK     |

### StockClass → OcfStockClass

| Field                           | OCF Type                         | OCF Required? | SDK Type                    | SDK Required? | Status |
| ------------------------------- | -------------------------------- | ------------- | --------------------------- | ------------- | ------ |
| board_approval_date             | Date                             | No            | string                      | No            | OK     |
| class_type                      | StockClassType                   | Yes           | StockClassType              | Yes           | OK     |
| comments                        | array<string>                    | No            | string[]                    | No            | OK     |
| conversion_rights               | array<StockClassConversionRight> | No            | StockClassConversionRight[] | No            | OK     |
| default_id_prefix               | string                           | Yes           | string                      | Yes           | OK     |
| id                              | string                           | Yes           | string                      | Yes           | OK     |
| initial_shares_authorized       | oneOf                            | Yes           | string                      | Yes           | OK     |
| liquidation_preference_multiple | Numeric                          | No            | string                      | No            | OK     |
| name                            | string                           | Yes           | string                      | Yes           | OK     |
| par_value                       | Monetary                         | No            | Monetary                    | No            | OK     |
| participation_cap_multiple      | Numeric                          | No            | string                      | No            | OK     |
| price_per_share                 | Monetary                         | No            | Monetary                    | No            | OK     |
| seniority                       | Numeric                          | Yes           | string                      | Yes           | OK     |
| stockholder_approval_date       | Date                             | No            | string                      | No            | OK     |
| votes_per_share                 | Numeric                          | Yes           | string                      | Yes           | OK     |

### StockLegendTemplate → OcfStockLegendTemplate

| Field    | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| -------- | ------------- | ------------- | -------- | ------------- | ------ |
| comments | array<string> | No            | string[] | No            | OK     |
| id       | string        | Yes           | string   | Yes           | OK     |
| name     | string        | Yes           | string   | Yes           | OK     |
| text     | string        | Yes           | string   | Yes           | OK     |

### StockPlan → OcfStockPlan

| Field                         | OCF Type                          | OCF Required? | SDK Type                      | SDK Required? | Status |
| ----------------------------- | --------------------------------- | ------------- | ----------------------------- | ------------- | ------ |
| board_approval_date           | Date                              | No            | string                        | No            | OK     |
| comments                      | array<string>                     | No            | string[]                      | No            | OK     |
| default_cancellation_behavior | StockPlanCancellationBehaviorType | No            | StockPlanCancellationBehavior | No            | OK     |
| id                            | string                            | Yes           | string                        | Yes           | OK     |
| initial_shares_reserved       | Numeric                           | Yes           | string                        | Yes           | OK     |
| plan_name                     | string                            | Yes           | string                        | Yes           | OK     |
| stock_class_id                | string                            | No            | string                        | No            | OK     |
| stock_class_ids               | array<string>                     | No            | string[]                      | No            | OK     |
| stockholder_approval_date     | Date                              | No            | string                        | No            | OK     |

### Valuation → OcfValuation

| Field                     | OCF Type      | OCF Required? | SDK Type              | SDK Required? | Status |
| ------------------------- | ------------- | ------------- | --------------------- | ------------- | ------ |
| board_approval_date       | Date          | No            | string                | No            | OK     |
| comments                  | array<string> | No            | string[]              | No            | OK     |
| effective_date            | Date          | Yes           | string; // YYYY-MM-DD | Yes           | OK     |
| id                        | string        | Yes           | string                | Yes           | OK     |
| price_per_share           | Monetary      | Yes           | Monetary              | Yes           | OK     |
| provider                  | string        | No            | string                | No            | OK     |
| stock_class_id            | string        | Yes           | string                | Yes           | OK     |
| stockholder_approval_date | Date          | No            | string                | No            | OK     |
| valuation_type            | ValuationType | Yes           | ValuationType         | Yes           | OK     |

### VestingTerms → OcfVestingTerms

| Field              | OCF Type                | OCF Required? | SDK Type           | SDK Required? | Status |
| ------------------ | ----------------------- | ------------- | ------------------ | ------------- | ------ |
| allocation_type    | AllocationType          | Yes           | AllocationType     | Yes           | OK     |
| comments           | array<string>           | No            | string[]           | No            | OK     |
| description        | string                  | Yes           | string             | Yes           | OK     |
| id                 | string                  | Yes           | string             | Yes           | OK     |
| name               | string                  | Yes           | string             | Yes           | OK     |
| vesting_conditions | array<VestingCondition> | Yes           | VestingCondition[] | Yes           | OK     |

### ConvertibleAcceptance → OcfConvertibleAcceptance

| Field       | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ----------- | ------------- | ------------- | -------- | ------------- | ------ |
| comments    | array<string> | No            | string[] | No            | OK     |
| date        | Date          | Yes           | string   | Yes           | OK     |
| id          | string        | Yes           | string   | Yes           | OK     |
| security_id | string        | Yes           | string   | Yes           | OK     |

### EquityCompensationAcceptance → OcfEquityCompensationAcceptance

| Field       | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ----------- | ------------- | ------------- | -------- | ------------- | ------ |
| comments    | array<string> | No            | string[] | No            | OK     |
| date        | Date          | Yes           | string   | Yes           | OK     |
| id          | string        | Yes           | string   | Yes           | OK     |
| security_id | string        | Yes           | string   | Yes           | OK     |

### PlanSecurityAcceptance → OcfPlanSecurityAcceptance

| Field       | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ----------- | ------------- | ------------- | -------- | ------------- | ------ |
| comments    | array<string> | No            | string[] | No            | OK     |
| date        | Date          | Yes           | string   | Yes           | OK     |
| id          | string        | Yes           | string   | Yes           | OK     |
| security_id | string        | Yes           | string   | Yes           | OK     |

### StockAcceptance → OcfStockAcceptance

| Field       | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ----------- | ------------- | ------------- | -------- | ------------- | ------ |
| comments    | array<string> | No            | string[] | No            | OK     |
| date        | Date          | Yes           | string   | Yes           | OK     |
| id          | string        | Yes           | string   | Yes           | OK     |
| security_id | string        | Yes           | string   | Yes           | OK     |

### WarrantAcceptance → OcfWarrantAcceptance

| Field       | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ----------- | ------------- | ------------- | -------- | ------------- | ------ |
| comments    | array<string> | No            | string[] | No            | OK     |
| date        | Date          | Yes           | string   | Yes           | OK     |
| id          | string        | Yes           | string   | Yes           | OK     |
| security_id | string        | Yes           | string   | Yes           | OK     |

### IssuerAuthorizedSharesAdjustment → OcfIssuerAuthorizedSharesAdjustment

| Field                     | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ------------------------- | ------------- | ------------- | -------- | ------------- | ------ |
| board_approval_date       | Date          | No            | string   | No            | OK     |
| comments                  | array<string> | No            | string[] | No            | OK     |
| date                      | Date          | Yes           | string   | Yes           | OK     |
| id                        | string        | Yes           | string   | Yes           | OK     |
| issuer_id                 | string        | Yes           | string   | Yes           | OK     |
| new_shares_authorized     | Numeric       | Yes           | string   | Yes           | OK     |
| stockholder_approval_date | Date          | No            | string   | No            | OK     |

### StockClassAuthorizedSharesAdjustment → OcfStockClassAuthorizedSharesAdjustment

| Field                     | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ------------------------- | ------------- | ------------- | -------- | ------------- | ------ |
| board_approval_date       | Date          | No            | string   | No            | OK     |
| comments                  | array<string> | No            | string[] | No            | OK     |
| date                      | Date          | Yes           | string   | Yes           | OK     |
| id                        | string        | Yes           | string   | Yes           | OK     |
| new_shares_authorized     | Numeric       | Yes           | string   | Yes           | OK     |
| stock_class_id            | string        | Yes           | string   | Yes           | OK     |
| stockholder_approval_date | Date          | No            | string   | No            | OK     |

### StockClassConversionRatioAdjustment → OcfStockClassConversionRatioAdjustment

| Field                          | OCF Type                 | OCF Required? | SDK Type                                   | SDK Required? | Status   |
| ------------------------------ | ------------------------ | ------------- | ------------------------------------------ | ------------- | -------- | --- | ----- |
| comments                       | array<string>            | No            | string[]                                   | No            | OK       |
| date                           | Date                     | Yes           | string                                     | Yes           | OK       |
| id                             | string                   | Yes           | string                                     | Yes           | OK       |
| new_ratio_conversion_mechanism | RatioConversionMechanism | Yes           | {                                          | No            | MISMATCH |
| stock_class_id                 | string                   | Yes           | string                                     | Yes           | OK       |
| type                           | -                        | -             | 'RATIO_CONVERSION'                         | Yes           | EXTRA    |
| conversion_price               | -                        | -             | Monetary                                   | Yes           | EXTRA    |
| ratio                          | -                        | -             | { numerator: string; denominator: string } | Yes           | EXTRA    |
| rounding_type                  | -                        | -             | 'NORMAL'                                   | 'CEILING'     | 'FLOOR'  | Yes | EXTRA |
| new_ratio_numerator            | -                        | -             | string                                     | No            | EXTRA    |
| new_ratio_denominator          | -                        | -             | string                                     | No            | EXTRA    |
| board_approval_date            | -                        | -             | string                                     | No            | EXTRA    |
| stockholder_approval_date      | -                        | -             | string                                     | No            | EXTRA    |

### StockPlanPoolAdjustment → OcfStockPlanPoolAdjustment

| Field                     | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ------------------------- | ------------- | ------------- | -------- | ------------- | ------ |
| board_approval_date       | Date          | No            | string   | No            | OK     |
| comments                  | array<string> | No            | string[] | No            | OK     |
| date                      | Date          | Yes           | string   | Yes           | OK     |
| id                        | string        | Yes           | string   | Yes           | OK     |
| shares_reserved           | Numeric       | Yes           | string   | Yes           | OK     |
| stock_plan_id             | string        | Yes           | string   | Yes           | OK     |
| stockholder_approval_date | Date          | No            | string   | No            | OK     |

### ConvertibleCancellation → OcfConvertibleCancellation

| Field               | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ------------------- | ------------- | ------------- | -------- | ------------- | ------ |
| amount              | Monetary      | Yes           | Monetary | Yes           | OK     |
| balance_security_id | string        | No            | string   | No            | OK     |
| comments            | array<string> | No            | string[] | No            | OK     |
| date                | Date          | Yes           | string   | Yes           | OK     |
| id                  | string        | Yes           | string   | Yes           | OK     |
| reason_text         | string        | Yes           | string   | Yes           | OK     |
| security_id         | string        | Yes           | string   | Yes           | OK     |

### EquityCompensationCancellation → OcfEquityCompensationCancellation

| Field               | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ------------------- | ------------- | ------------- | -------- | ------------- | ------ |
| balance_security_id | string        | No            | string   | No            | OK     |
| comments            | array<string> | No            | string[] | No            | OK     |
| date                | Date          | Yes           | string   | Yes           | OK     |
| id                  | string        | Yes           | string   | Yes           | OK     |
| quantity            | Numeric       | Yes           | string   | Yes           | OK     |
| reason_text         | string        | Yes           | string   | Yes           | OK     |
| security_id         | string        | Yes           | string   | Yes           | OK     |

### PlanSecurityCancellation → OcfPlanSecurityCancellation

| Field               | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ------------------- | ------------- | ------------- | -------- | ------------- | ------ |
| balance_security_id | string        | No            | string   | No            | OK     |
| comments            | array<string> | No            | string[] | No            | OK     |
| date                | Date          | Yes           | string   | Yes           | OK     |
| id                  | string        | Yes           | string   | Yes           | OK     |
| quantity            | Numeric       | Yes           | string   | Yes           | OK     |
| reason_text         | string        | Yes           | string   | Yes           | OK     |
| security_id         | string        | Yes           | string   | Yes           | OK     |

### StockCancellation → OcfStockCancellation

| Field               | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ------------------- | ------------- | ------------- | -------- | ------------- | ------ |
| balance_security_id | string        | No            | string   | No            | OK     |
| comments            | array<string> | No            | string[] | No            | OK     |
| date                | Date          | Yes           | string   | Yes           | OK     |
| id                  | string        | Yes           | string   | Yes           | OK     |
| quantity            | Numeric       | Yes           | string   | Yes           | OK     |
| reason_text         | string        | Yes           | string   | Yes           | OK     |
| security_id         | string        | Yes           | string   | Yes           | OK     |

### WarrantCancellation → OcfWarrantCancellation

| Field               | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ------------------- | ------------- | ------------- | -------- | ------------- | ------ |
| balance_security_id | string        | No            | string   | No            | OK     |
| comments            | array<string> | No            | string[] | No            | OK     |
| date                | Date          | Yes           | string   | Yes           | OK     |
| id                  | string        | Yes           | string   | Yes           | OK     |
| quantity            | Numeric       | Yes           | string   | Yes           | OK     |
| reason_text         | string        | Yes           | string   | Yes           | OK     |
| security_id         | string        | Yes           | string   | Yes           | OK     |

### StakeholderRelationshipChangeEvent → OcfStakeholderRelationshipChangeEvent

| Field                | OCF Type                    | OCF Required? | SDK Type                      | SDK Required? | Status |
| -------------------- | --------------------------- | ------------- | ----------------------------- | ------------- | ------ |
| comments             | array<string>               | No            | string[]                      | No            | OK     |
| date                 | Date                        | Yes           | string                        | Yes           | OK     |
| id                   | string                      | Yes           | string                        | Yes           | OK     |
| relationship_ended   | StakeholderRelationshipType | No            | StakeholderRelationshipType   | No            | OK     |
| relationship_started | StakeholderRelationshipType | No            | StakeholderRelationshipType   | No            | OK     |
| stakeholder_id       | string                      | Yes           | string                        | Yes           | OK     |
| new_relationships    | -                           | -             | StakeholderRelationshipType[] | No            | EXTRA  |

### StakeholderStatusChangeEvent → OcfStakeholderStatusChangeEvent

| Field          | OCF Type              | OCF Required? | SDK Type          | SDK Required? | Status |
| -------------- | --------------------- | ------------- | ----------------- | ------------- | ------ |
| comments       | array<string>         | No            | string[]          | No            | OK     |
| date           | Date                  | Yes           | string            | Yes           | OK     |
| id             | string                | Yes           | string            | Yes           | OK     |
| new_status     | StakeholderStatusType | Yes           | StakeholderStatus | Yes           | OK     |
| stakeholder_id | string                | Yes           | string            | Yes           | OK     |
| reason_text    | -                     | -             | string            | No            | EXTRA  |

### StockConsolidation → OcfStockConsolidation

| Field                  | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status   |
| ---------------------- | ------------- | ------------- | -------- | ------------- | -------- |
| comments               | array<string> | No            | string[] | No            | OK       |
| date                   | Date          | Yes           | string   | Yes           | OK       |
| id                     | string        | Yes           | string   | Yes           | OK       |
| reason_text            | string        | No            | string   | No            | OK       |
| resulting_security_id  | string        | Yes           | string   | No            | MISMATCH |
| security_ids           | array<string> | Yes           | string[] | Yes           | OK       |
| resulting_security_ids | -             | -             | string[] | No            | EXTRA    |

### ConvertibleConversion → OcfConvertibleConversion

| Field                     | OCF Type                 | OCF Required? | SDK Type                      | SDK Required? | Status |
| ------------------------- | ------------------------ | ------------- | ----------------------------- | ------------- | ------ |
| balance_security_id       | string                   | No            | string                        | No            | OK     |
| capitalization_definition | CapitalizationDefinition | No            | CapitalizationDefinitionRules | No            | OK     |
| comments                  | array<string>            | No            | string[]                      | No            | OK     |
| date                      | Date                     | Yes           | string                        | Yes           | OK     |
| id                        | string                   | Yes           | string                        | Yes           | OK     |
| quantity_converted        | Numeric                  | No            | string                        | No            | OK     |
| reason_text               | string                   | Yes           | string                        | Yes           | OK     |
| resulting_security_ids    | array<string>            | Yes           | string[]                      | Yes           | OK     |
| security_id               | string                   | Yes           | string                        | Yes           | OK     |
| trigger_id                | string                   | Yes           | string                        | Yes           | OK     |

### StockConversion → OcfStockConversion

| Field                  | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ---------------------- | ------------- | ------------- | -------- | ------------- | ------ |
| balance_security_id    | string        | No            | string   | No            | OK     |
| comments               | array<string> | No            | string[] | No            | OK     |
| date                   | Date          | Yes           | string   | Yes           | OK     |
| id                     | string        | Yes           | string   | Yes           | OK     |
| quantity_converted     | Numeric       | Yes           | string   | Yes           | OK     |
| resulting_security_ids | array<string> | Yes           | string[] | Yes           | OK     |
| security_id            | string        | Yes           | string   | Yes           | OK     |
| quantity               | -             | -             | string   | No            | EXTRA  |

### EquityCompensationExercise → OcfEquityCompensationExercise

| Field                  | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ---------------------- | ------------- | ------------- | -------- | ------------- | ------ |
| comments               | array<string> | No            | string[] | No            | OK     |
| consideration_text     | string        | No            | string   | No            | OK     |
| date                   | Date          | Yes           | string   | Yes           | OK     |
| id                     | string        | Yes           | string   | Yes           | OK     |
| quantity               | Numeric       | Yes           | string   | Yes           | OK     |
| resulting_security_ids | array<string> | Yes           | string[] | Yes           | OK     |
| security_id            | string        | Yes           | string   | Yes           | OK     |

### PlanSecurityExercise → OcfPlanSecurityExercise

| Field                  | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ---------------------- | ------------- | ------------- | -------- | ------------- | ------ |
| comments               | array<string> | No            | string[] | No            | OK     |
| consideration_text     | string        | No            | string   | No            | OK     |
| date                   | Date          | Yes           | string   | Yes           | OK     |
| id                     | string        | Yes           | string   | Yes           | OK     |
| quantity               | Numeric       | Yes           | string   | Yes           | OK     |
| resulting_security_ids | array<string> | Yes           | string[] | Yes           | OK     |
| security_id            | string        | Yes           | string   | Yes           | OK     |
| balance_security_id    | -             | -             | string   | No            | EXTRA  |

### WarrantExercise → OcfWarrantExercise

| Field                  | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ---------------------- | ------------- | ------------- | -------- | ------------- | ------ |
| comments               | array<string> | No            | string[] | No            | OK     |
| consideration_text     | string        | No            | string   | No            | OK     |
| date                   | Date          | Yes           | string   | Yes           | OK     |
| id                     | string        | Yes           | string   | Yes           | OK     |
| resulting_security_ids | array<string> | Yes           | string[] | Yes           | OK     |
| security_id            | string        | Yes           | string   | Yes           | OK     |
| trigger_id             | string        | Yes           | string   | Yes           | OK     |
| quantity               | -             | -             | string   | No            | EXTRA  |
| balance_security_id    | -             | -             | string   | No            | EXTRA  |

### ConvertibleIssuance → OcfConvertibleIssuance

| Field                     | OCF Type                 | OCF Required? | SDK Type                                             | SDK Required? | Status   |
| ------------------------- | ------------------------ | ------------- | ---------------------------------------------------- | ------------- | -------- |
| board_approval_date       | Date                     | No            | string                                               | No            | OK       |
| comments                  | array<string>            | No            | string[]                                             | No            | OK       |
| consideration_text        | string                   | No            | string                                               | No            | OK       |
| conversion_triggers       | array                    | Yes           | ConvertibleConversionTrigger[]                       | Yes           | OK       |
| convertible_type          | ConvertibleType          | Yes           | ConvertibleType                                      | Yes           | OK       |
| custom_id                 | string                   | Yes           | string                                               | Yes           | OK       |
| date                      | Date                     | Yes           | string                                               | Yes           | OK       |
| id                        | string                   | Yes           | string                                               | Yes           | OK       |
| investment_amount         | Monetary                 | Yes           | Monetary                                             | Yes           | OK       |
| pro_rata                  | Numeric                  | No            | string                                               | No            | OK       |
| security_id               | string                   | Yes           | string                                               | Yes           | OK       |
| security_law_exemptions   | array<SecurityExemption> | Yes           | Array<{ description: string; jurisdiction: string }> | Yes           | MISMATCH |
| seniority                 | integer                  | Yes           | number                                               | Yes           | OK       |
| stakeholder_id            | string                   | Yes           | string                                               | Yes           | OK       |
| stockholder_approval_date | Date                     | No            | string                                               | No            | OK       |

### EquityCompensationIssuance → OcfEquityCompensationIssuance

| Field                        | OCF Type                 | OCF Required? | SDK Type            | SDK Required? | Status   |
| ---------------------------- | ------------------------ | ------------- | ------------------- | ------------- | -------- |
| base_price                   | Monetary                 | No            | Monetary            | No            | OK       |
| board_approval_date          | Date                     | No            | string              | No            | OK       |
| comments                     | array<string>            | No            | string[]            | No            | OK       |
| compensation_type            | CompensationType         | Yes           | CompensationType    | Yes           | OK       |
| consideration_text           | string                   | No            | string              | No            | OK       |
| custom_id                    | string                   | Yes           | string              | Yes           | OK       |
| date                         | Date                     | Yes           | string              | Yes           | OK       |
| early_exercisable            | boolean                  | No            | boolean             | No            | OK       |
| exercise_price               | Monetary                 | No            | Monetary            | No            | OK       |
| expiration_date              | oneOf                    | Yes           | string              | No            | MISMATCH |
| id                           | string                   | Yes           | string              | Yes           | OK       |
| option_grant_type            | OptionType               | No            | -                   | -             | MISSING  |
| quantity                     | Numeric                  | Yes           | string              | Yes           | OK       |
| security_id                  | string                   | Yes           | string              | Yes           | OK       |
| security_law_exemptions      | array<SecurityExemption> | Yes           | SecurityExemption[] | No            | MISMATCH |
| stakeholder_id               | string                   | Yes           | string              | Yes           | OK       |
| stock_class_id               | string                   | No            | string              | No            | OK       |
| stock_plan_id                | string                   | No            | string              | No            | OK       |
| stockholder_approval_date    | Date                     | No            | string              | No            | OK       |
| termination_exercise_windows | array<TerminationWindow> | Yes           | TerminationWindow[] | No            | MISMATCH |
| vesting_terms_id             | string                   | No            | string              | No            | OK       |
| vestings                     | array<Vesting>           | No            | Vesting[]           | No            | OK       |

### PlanSecurityIssuance → OcfPlanSecurityIssuance

| Field                        | OCF Type                 | OCF Required? | SDK Type            | SDK Required? | Status   |
| ---------------------------- | ------------------------ | ------------- | ------------------- | ------------- | -------- | -------- | ----- |
| base_price                   | Monetary                 | No            | Monetary            | No            | OK       |
| board_approval_date          | Date                     | No            | string              | No            | OK       |
| comments                     | array<string>            | No            | string[]            | No            | OK       |
| compensation_type            | CompensationType         | Yes           | CompensationType    | No            | MISMATCH |
| consideration_text           | string                   | No            | string              | No            | OK       |
| custom_id                    | string                   | Yes           | string              | Yes           | OK       |
| date                         | Date                     | Yes           | string              | Yes           | OK       |
| early_exercisable            | boolean                  | No            | boolean             | No            | OK       |
| exercise_price               | Monetary                 | No            | Monetary            | No            | OK       |
| expiration_date              | oneOf                    | Yes           | string              | null          | No       | MISMATCH |
| id                           | string                   | Yes           | string              | Yes           | OK       |
| option_grant_type            | OptionType               | No            | -                   | -             | MISSING  |
| quantity                     | Numeric                  | Yes           | string              | Yes           | OK       |
| security_id                  | string                   | Yes           | string              | Yes           | OK       |
| security_law_exemptions      | array<SecurityExemption> | Yes           | SecurityExemption[] | No            | MISMATCH |
| stakeholder_id               | string                   | Yes           | string              | Yes           | OK       |
| stock_class_id               | string                   | No            | string              | No            | OK       |
| stock_plan_id                | string                   | No            | string              | No            | OK       |
| stockholder_approval_date    | Date                     | No            | string              | No            | OK       |
| termination_exercise_windows | array<TerminationWindow> | Yes           | TerminationWindow[] | No            | MISMATCH |
| vesting_terms_id             | string                   | No            | string              | No            | OK       |
| vestings                     | array<Vesting>           | No            | Vesting[]           | No            | OK       |
| plan_security_type           | -                        | -             | 'OPTION'            | 'RSU'         | 'OTHER'  | No       | EXTRA |

### StockIssuance → OcfStockIssuance

| Field                     | OCF Type                 | OCF Required? | SDK Type              | SDK Required? | Status   |
| ------------------------- | ------------------------ | ------------- | --------------------- | ------------- | -------- |
| board_approval_date       | Date                     | No            | string                | No            | OK       |
| comments                  | array<string>            | No            | string[]              | No            | OK       |
| consideration_text        | string                   | No            | string                | No            | OK       |
| cost_basis                | Monetary                 | No            | Monetary              | No            | OK       |
| custom_id                 | string                   | Yes           | string                | Yes           | OK       |
| date                      | Date                     | Yes           | string; // YYYY-MM-DD | Yes           | OK       |
| id                        | string                   | Yes           | string                | Yes           | OK       |
| issuance_type             | StockIssuanceType        | No            | StockIssuanceType     | No            | OK       |
| quantity                  | Numeric                  | Yes           | string                | Yes           | OK       |
| security_id               | string                   | Yes           | string                | Yes           | OK       |
| security_law_exemptions   | array<SecurityExemption> | Yes           | SecurityExemption[]   | No            | MISMATCH |
| share_numbers_issued      | array<ShareNumberRange>  | No            | ShareNumberRange[]    | No            | OK       |
| share_price               | Monetary                 | Yes           | Monetary              | Yes           | OK       |
| stakeholder_id            | string                   | Yes           | string                | Yes           | OK       |
| stock_class_id            | string                   | Yes           | string                | Yes           | OK       |
| stock_legend_ids          | array<string>            | Yes           | string[]              | No            | MISMATCH |
| stock_plan_id             | string                   | No            | string                | No            | OK       |
| stockholder_approval_date | Date                     | No            | string                | No            | OK       |
| vesting_terms_id          | string                   | No            | string                | No            | OK       |
| vestings                  | array<Vesting>           | No            | VestingSimple[]       | No            | OK       |

### WarrantIssuance → OcfWarrantIssuance

| Field                     | OCF Type                 | OCF Required? | SDK Type                                             | SDK Required? | Status   |
| ------------------------- | ------------------------ | ------------- | ---------------------------------------------------- | ------------- | -------- |
| board_approval_date       | Date                     | No            | string                                               | No            | OK       |
| comments                  | array<string>            | No            | string[]                                             | No            | OK       |
| consideration_text        | string                   | No            | string                                               | No            | OK       |
| custom_id                 | string                   | Yes           | string                                               | Yes           | OK       |
| date                      | Date                     | Yes           | string                                               | Yes           | OK       |
| exercise_price            | Monetary                 | No            | Monetary                                             | No            | OK       |
| exercise_triggers         | array                    | Yes           | WarrantExerciseTrigger[]                             | Yes           | OK       |
| id                        | string                   | Yes           | string                                               | Yes           | OK       |
| purchase_price            | Monetary                 | Yes           | Monetary                                             | Yes           | OK       |
| quantity                  | Numeric                  | No            | string                                               | No            | OK       |
| quantity_source           | QuantitySourceType       | No            | -                                                    | -             | MISSING  |
| security_id               | string                   | Yes           | string                                               | Yes           | OK       |
| security_law_exemptions   | array<SecurityExemption> | Yes           | Array<{ description: string; jurisdiction: string }> | Yes           | MISMATCH |
| stakeholder_id            | string                   | Yes           | string                                               | Yes           | OK       |
| stockholder_approval_date | Date                     | No            | string                                               | No            | OK       |
| vesting_terms_id          | string                   | No            | string                                               | No            | OK       |
| vestings                  | array<Vesting>           | No            | -                                                    | -             | MISSING  |
| warrant_expiration_date   | Date                     | No            | string                                               | No            | OK       |
| ratio_numerator           | -                        | -             | string                                               | No            | EXTRA    |
| ratio_denominator         | -                        | -             | string                                               | No            | EXTRA    |
| percent_of_outstanding    | -                        | -             | string                                               | No            | EXTRA    |
| conversion_triggers       | -                        | -             | WarrantExerciseTrigger[]                             | No            | EXTRA    |

### StockReissuance → OcfStockReissuance

| Field                  | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ---------------------- | ------------- | ------------- | -------- | ------------- | ------ |
| comments               | array<string> | No            | string[] | No            | OK     |
| date                   | Date          | Yes           | string   | Yes           | OK     |
| id                     | string        | Yes           | string   | Yes           | OK     |
| reason_text            | string        | No            | string   | No            | OK     |
| resulting_security_ids | array<string> | Yes           | string[] | Yes           | OK     |
| security_id            | string        | Yes           | string   | Yes           | OK     |
| split_transaction_id   | string        | No            | string   | No            | OK     |

### EquityCompensationRelease → OcfEquityCompensationRelease

| Field                  | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ---------------------- | ------------- | ------------- | -------- | ------------- | ------ |
| comments               | array<string> | No            | string[] | No            | OK     |
| consideration_text     | string        | No            | string   | No            | OK     |
| date                   | Date          | Yes           | string   | Yes           | OK     |
| id                     | string        | Yes           | string   | Yes           | OK     |
| quantity               | Numeric       | Yes           | string   | Yes           | OK     |
| release_price          | Monetary      | Yes           | Monetary | Yes           | OK     |
| resulting_security_ids | array<string> | Yes           | string[] | Yes           | OK     |
| security_id            | string        | Yes           | string   | Yes           | OK     |
| settlement_date        | Date          | Yes           | string   | Yes           | OK     |
| balance_security_id    | -             | -             | string   | No            | EXTRA  |

### PlanSecurityRelease → OcfPlanSecurityRelease

| Field                  | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ---------------------- | ------------- | ------------- | -------- | ------------- | ------ |
| comments               | array<string> | No            | string[] | No            | OK     |
| consideration_text     | string        | No            | string   | No            | OK     |
| date                   | Date          | Yes           | string   | Yes           | OK     |
| id                     | string        | Yes           | string   | Yes           | OK     |
| quantity               | Numeric       | Yes           | string   | Yes           | OK     |
| release_price          | Monetary      | Yes           | Monetary | Yes           | OK     |
| resulting_security_ids | array<string> | Yes           | string[] | Yes           | OK     |
| security_id            | string        | Yes           | string   | Yes           | OK     |
| settlement_date        | Date          | Yes           | string   | Yes           | OK     |
| balance_security_id    | -             | -             | string   | No            | EXTRA  |

### EquityCompensationRepricing → OcfEquityCompensationRepricing

| Field                  | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ---------------------- | ------------- | ------------- | -------- | ------------- | ------ |
| comments               | array<string> | No            | string[] | No            | OK     |
| date                   | Date          | Yes           | string   | Yes           | OK     |
| id                     | string        | Yes           | string   | Yes           | OK     |
| new_exercise_price     | Monetary      | Yes           | Monetary | Yes           | OK     |
| security_id            | string        | Yes           | string   | Yes           | OK     |
| resulting_security_ids | -             | -             | string[] | No            | EXTRA  |

### StockRepurchase → OcfStockRepurchase

| Field               | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ------------------- | ------------- | ------------- | -------- | ------------- | ------ |
| balance_security_id | string        | No            | string   | No            | OK     |
| comments            | array<string> | No            | string[] | No            | OK     |
| consideration_text  | string        | No            | string   | No            | OK     |
| date                | Date          | Yes           | string   | Yes           | OK     |
| id                  | string        | Yes           | string   | Yes           | OK     |
| price               | Monetary      | Yes           | Monetary | Yes           | OK     |
| quantity            | Numeric       | Yes           | string   | Yes           | OK     |
| security_id         | string        | Yes           | string   | Yes           | OK     |

### ConvertibleRetraction → OcfConvertibleRetraction

| Field       | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ----------- | ------------- | ------------- | -------- | ------------- | ------ |
| comments    | array<string> | No            | string[] | No            | OK     |
| date        | Date          | Yes           | string   | Yes           | OK     |
| id          | string        | Yes           | string   | Yes           | OK     |
| reason_text | string        | Yes           | string   | Yes           | OK     |
| security_id | string        | Yes           | string   | Yes           | OK     |

### EquityCompensationRetraction → OcfEquityCompensationRetraction

| Field       | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ----------- | ------------- | ------------- | -------- | ------------- | ------ |
| comments    | array<string> | No            | string[] | No            | OK     |
| date        | Date          | Yes           | string   | Yes           | OK     |
| id          | string        | Yes           | string   | Yes           | OK     |
| reason_text | string        | Yes           | string   | Yes           | OK     |
| security_id | string        | Yes           | string   | Yes           | OK     |

### PlanSecurityRetraction → OcfPlanSecurityRetraction

| Field       | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ----------- | ------------- | ------------- | -------- | ------------- | ------ |
| comments    | array<string> | No            | string[] | No            | OK     |
| date        | Date          | Yes           | string   | Yes           | OK     |
| id          | string        | Yes           | string   | Yes           | OK     |
| reason_text | string        | Yes           | string   | Yes           | OK     |
| security_id | string        | Yes           | string   | Yes           | OK     |

### StockRetraction → OcfStockRetraction

| Field       | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ----------- | ------------- | ------------- | -------- | ------------- | ------ |
| comments    | array<string> | No            | string[] | No            | OK     |
| date        | Date          | Yes           | string   | Yes           | OK     |
| id          | string        | Yes           | string   | Yes           | OK     |
| reason_text | string        | Yes           | string   | Yes           | OK     |
| security_id | string        | Yes           | string   | Yes           | OK     |

### WarrantRetraction → OcfWarrantRetraction

| Field       | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ----------- | ------------- | ------------- | -------- | ------------- | ------ |
| comments    | array<string> | No            | string[] | No            | OK     |
| date        | Date          | Yes           | string   | Yes           | OK     |
| id          | string        | Yes           | string   | Yes           | OK     |
| reason_text | string        | Yes           | string   | Yes           | OK     |
| security_id | string        | Yes           | string   | Yes           | OK     |

### StockPlanReturnToPool → OcfStockPlanReturnToPool

| Field         | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ------------- | ------------- | ------------- | -------- | ------------- | ------ |
| comments      | array<string> | No            | string[] | No            | OK     |
| date          | Date          | Yes           | string   | Yes           | OK     |
| id            | string        | Yes           | string   | Yes           | OK     |
| quantity      | Numeric       | Yes           | string   | Yes           | OK     |
| reason_text   | string        | Yes           | string   | Yes           | OK     |
| security_id   | string        | Yes           | string   | Yes           | OK     |
| stock_plan_id | string        | Yes           | string   | Yes           | OK     |

### StockClassSplit → OcfStockClassSplit

| Field                     | OCF Type      | OCF Required? | SDK Type                                   | SDK Required? | Status   |
| ------------------------- | ------------- | ------------- | ------------------------------------------ | ------------- | -------- |
| comments                  | array<string> | No            | string[]                                   | No            | OK       |
| date                      | Date          | Yes           | string                                     | Yes           | OK       |
| id                        | string        | Yes           | string                                     | Yes           | OK       |
| split_ratio               | Ratio         | Yes           | { numerator: string; denominator: string } | No            | MISMATCH |
| stock_class_id            | string        | Yes           | string                                     | Yes           | OK       |
| split_ratio_numerator     | -             | -             | string                                     | No            | EXTRA    |
| split_ratio_denominator   | -             | -             | string                                     | No            | EXTRA    |
| board_approval_date       | -             | -             | string                                     | No            | EXTRA    |
| stockholder_approval_date | -             | -             | string                                     | No            | EXTRA    |

### ConvertibleTransfer → OcfConvertibleTransfer

| Field                  | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ---------------------- | ------------- | ------------- | -------- | ------------- | ------ |
| amount                 | Monetary      | Yes           | Monetary | Yes           | OK     |
| balance_security_id    | string        | No            | string   | No            | OK     |
| comments               | array<string> | No            | string[] | No            | OK     |
| consideration_text     | string        | No            | string   | No            | OK     |
| date                   | Date          | Yes           | string   | Yes           | OK     |
| id                     | string        | Yes           | string   | Yes           | OK     |
| resulting_security_ids | array<string> | Yes           | string[] | Yes           | OK     |
| security_id            | string        | Yes           | string   | Yes           | OK     |

### EquityCompensationTransfer → OcfEquityCompensationTransfer

| Field                  | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ---------------------- | ------------- | ------------- | -------- | ------------- | ------ |
| balance_security_id    | string        | No            | string   | No            | OK     |
| comments               | array<string> | No            | string[] | No            | OK     |
| consideration_text     | string        | No            | string   | No            | OK     |
| date                   | Date          | Yes           | string   | Yes           | OK     |
| id                     | string        | Yes           | string   | Yes           | OK     |
| quantity               | Numeric       | Yes           | string   | Yes           | OK     |
| resulting_security_ids | array<string> | Yes           | string[] | Yes           | OK     |
| security_id            | string        | Yes           | string   | Yes           | OK     |

### PlanSecurityTransfer → OcfPlanSecurityTransfer

| Field                  | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ---------------------- | ------------- | ------------- | -------- | ------------- | ------ |
| balance_security_id    | string        | No            | string   | No            | OK     |
| comments               | array<string> | No            | string[] | No            | OK     |
| consideration_text     | string        | No            | string   | No            | OK     |
| date                   | Date          | Yes           | string   | Yes           | OK     |
| id                     | string        | Yes           | string   | Yes           | OK     |
| quantity               | Numeric       | Yes           | string   | Yes           | OK     |
| resulting_security_ids | array<string> | Yes           | string[] | Yes           | OK     |
| security_id            | string        | Yes           | string   | Yes           | OK     |

### StockTransfer → OcfStockTransfer

| Field                  | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ---------------------- | ------------- | ------------- | -------- | ------------- | ------ |
| balance_security_id    | string        | No            | string   | No            | OK     |
| comments               | array<string> | No            | string[] | No            | OK     |
| consideration_text     | string        | No            | string   | No            | OK     |
| date                   | Date          | Yes           | string   | Yes           | OK     |
| id                     | string        | Yes           | string   | Yes           | OK     |
| quantity               | Numeric       | Yes           | string   | Yes           | OK     |
| resulting_security_ids | array<string> | Yes           | string[] | Yes           | OK     |
| security_id            | string        | Yes           | string   | Yes           | OK     |

### WarrantTransfer → OcfWarrantTransfer

| Field                  | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ---------------------- | ------------- | ------------- | -------- | ------------- | ------ |
| balance_security_id    | string        | No            | string   | No            | OK     |
| comments               | array<string> | No            | string[] | No            | OK     |
| consideration_text     | string        | No            | string   | No            | OK     |
| date                   | Date          | Yes           | string   | Yes           | OK     |
| id                     | string        | Yes           | string   | Yes           | OK     |
| quantity               | Numeric       | Yes           | string   | Yes           | OK     |
| resulting_security_ids | array<string> | Yes           | string[] | Yes           | OK     |
| security_id            | string        | Yes           | string   | Yes           | OK     |

### VestingAcceleration → OcfVestingAcceleration

| Field       | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| ----------- | ------------- | ------------- | -------- | ------------- | ------ |
| comments    | array<string> | No            | string[] | No            | OK     |
| date        | Date          | Yes           | string   | Yes           | OK     |
| id          | string        | Yes           | string   | Yes           | OK     |
| quantity    | Numeric       | Yes           | string   | Yes           | OK     |
| reason_text | string        | Yes           | string   | Yes           | OK     |
| security_id | string        | Yes           | string   | Yes           | OK     |

### VestingEvent → OcfVestingEvent

| Field                | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| -------------------- | ------------- | ------------- | -------- | ------------- | ------ |
| comments             | array<string> | No            | string[] | No            | OK     |
| date                 | Date          | Yes           | string   | Yes           | OK     |
| id                   | string        | Yes           | string   | Yes           | OK     |
| security_id          | string        | Yes           | string   | Yes           | OK     |
| vesting_condition_id | string        | Yes           | string   | Yes           | OK     |

### VestingStart → OcfVestingStart

| Field                | OCF Type      | OCF Required? | SDK Type | SDK Required? | Status |
| -------------------- | ------------- | ------------- | -------- | ------------- | ------ |
| comments             | array<string> | No            | string[] | No            | OK     |
| date                 | Date          | Yes           | string   | Yes           | OK     |
| id                   | string        | Yes           | string   | Yes           | OK     |
| security_id          | string        | Yes           | string   | Yes           | OK     |
| vesting_condition_id | string        | Yes           | string   | Yes           | OK     |

## All Discrepancies Summary

| Schema                              | Field                          | Status   | Detail                                                                                         |
| ----------------------------------- | ------------------------------ | -------- | ---------------------------------------------------------------------------------------------- |
| Financing                           | issuance_ids                   | MISSING  | Field in OCF schema but not in SDK                                                             |
| Financing                           | amount_raised                  | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| Financing                           | pre_money_valuation            | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| Financing                           | post_money_valuation           | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| Financing                           | stock_class_id                 | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| Issuer                              | tax_ids                        | MISMATCH | OCF optional but SDK required                                                                  |
| StockClassConversionRatioAdjustment | new_ratio_conversion_mechanism | MISMATCH | OCF required but SDK optional                                                                  |
| StockClassConversionRatioAdjustment | type                           | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| StockClassConversionRatioAdjustment | conversion_price               | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| StockClassConversionRatioAdjustment | ratio                          | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| StockClassConversionRatioAdjustment | rounding_type                  | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| StockClassConversionRatioAdjustment | new_ratio_numerator            | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| StockClassConversionRatioAdjustment | new_ratio_denominator          | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| StockClassConversionRatioAdjustment | board_approval_date            | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| StockClassConversionRatioAdjustment | stockholder_approval_date      | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| StakeholderRelationshipChangeEvent  | new_relationships              | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| StakeholderStatusChangeEvent        | reason_text                    | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| StockConsolidation                  | resulting_security_id          | MISMATCH | OCF required but SDK optional                                                                  |
| StockConsolidation                  | resulting_security_ids         | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| StockConversion                     | quantity                       | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| PlanSecurityExercise                | balance_security_id            | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| WarrantExercise                     | quantity                       | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| WarrantExercise                     | balance_security_id            | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| ConvertibleIssuance                 | security_law_exemptions        | MISMATCH | Type: OCF array<SecurityExemption> vs SDK Array<{ description: string; jurisdiction: string }> |
| EquityCompensationIssuance          | expiration_date                | MISMATCH | OCF required but SDK optional                                                                  |
| EquityCompensationIssuance          | option_grant_type              | MISSING  | Field in OCF schema but not in SDK                                                             |
| EquityCompensationIssuance          | security_law_exemptions        | MISMATCH | OCF required but SDK optional                                                                  |
| EquityCompensationIssuance          | termination_exercise_windows   | MISMATCH | OCF required but SDK optional                                                                  |
| PlanSecurityIssuance                | compensation_type              | MISMATCH | OCF required but SDK optional                                                                  |
| PlanSecurityIssuance                | expiration_date                | MISMATCH | OCF required but SDK optional                                                                  |
| PlanSecurityIssuance                | option_grant_type              | MISSING  | Field in OCF schema but not in SDK                                                             |
| PlanSecurityIssuance                | security_law_exemptions        | MISMATCH | OCF required but SDK optional                                                                  |
| PlanSecurityIssuance                | termination_exercise_windows   | MISMATCH | OCF required but SDK optional                                                                  |
| PlanSecurityIssuance                | plan_security_type             | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| StockIssuance                       | security_law_exemptions        | MISMATCH | OCF required but SDK optional                                                                  |
| StockIssuance                       | stock_legend_ids               | MISMATCH | OCF required but SDK optional                                                                  |
| WarrantIssuance                     | quantity_source                | MISSING  | Field in OCF schema but not in SDK                                                             |
| WarrantIssuance                     | security_law_exemptions        | MISMATCH | Type: OCF array<SecurityExemption> vs SDK Array<{ description: string; jurisdiction: string }> |
| WarrantIssuance                     | vestings                       | MISSING  | Field in OCF schema but not in SDK                                                             |
| WarrantIssuance                     | ratio_numerator                | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| WarrantIssuance                     | ratio_denominator              | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| WarrantIssuance                     | percent_of_outstanding         | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| WarrantIssuance                     | conversion_triggers            | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| EquityCompensationRelease           | balance_security_id            | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| PlanSecurityRelease                 | balance_security_id            | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| EquityCompensationRepricing         | resulting_security_ids         | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| StockClassSplit                     | split_ratio                    | MISMATCH | OCF required but SDK optional                                                                  |
| StockClassSplit                     | split_ratio_numerator          | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| StockClassSplit                     | split_ratio_denominator        | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| StockClassSplit                     | board_approval_date            | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |
| StockClassSplit                     | stockholder_approval_date      | EXTRA    | Field in SDK but not in OCF schema (additionalProperties: false)                               |

## Counts

- **OK**: 423
- **MISSING** (in SDK): 5
- **EXTRA** (in SDK, schema has additionalProperties: false): 31
- **MISMATCH**: 15
