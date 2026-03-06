# OCF Enum Schema Audit Report

**Generated:** 2025-03-05  
**Scope:** Comparison of OCF enum schemas vs SDK types vs DAML types, with converter coverage
analysis.

---

## Fixes Applied (This Audit)

| Fix                             | Description                                                         | Commit  |
| ------------------------------- | ------------------------------------------------------------------- | ------- |
| AuthorizedShares                | `NOT_APPLICABLE` → `NOT APPLICABLE` (space)                         | Phase 1 |
| ConversionMechanism             | `PERCENT_CONVERSION` → `FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION` | Phase 1 |
| SimpleTrigger                   | Removed unused type                                                 | Phase 1 |
| ConversionTrigger consolidation | Alias + deprecation                                                 | Phase 1 |
| Missing fields                  | Added OptionType, option_grant_type, QuantitySourceType             | Phase 2 |
| Required/optional               | 15 field alignment fixes                                            | Phase 2 |
| EXTRA fields documentation      | 22 @internal/@deprecated annotations                                | Phase 2 |
| Converter completeness          | 3 silent defaults → throws                                          | Phase 3 |
| Schema alignment tests          | 315 → 446 tests                                                     | Phase 4 |

---

## 1. EmailType

| OCF Value | SDK Value   | DAML Value           | OCF→DAML           | DAML→OCF           |
| --------- | ----------- | -------------------- | ------------------ | ------------------ |
| PERSONAL  | ✅ PERSONAL | OcfEmailTypePersonal | ✅ enumConversions | ✅ enumConversions |
| BUSINESS  | ✅ BUSINESS | OcfEmailTypeBusiness | ✅ enumConversions | ✅ enumConversions |
| OTHER     | ✅ OTHER    | OcfEmailTypeOther    | ✅ enumConversions | ✅ enumConversions |

**Status:** ✅ Full alignment. Converter: `enumConversions.ts` (emailTypeToDaml,
damlEmailTypeToNative).

---

## 2. AddressType

| OCF Value | SDK Value  | DAML Value            | OCF→DAML           | DAML→OCF           |
| --------- | ---------- | --------------------- | ------------------ | ------------------ |
| LEGAL     | ✅ LEGAL   | OcfAddressTypeLegal   | ✅ typeConversions | ✅ typeConversions |
| CONTACT   | ✅ CONTACT | OcfAddressTypeContact | ✅ typeConversions | ✅ typeConversions |
| OTHER     | ✅ OTHER   | OcfAddressTypeOther   | ✅ typeConversions | ✅ typeConversions |

**Status:** ✅ Full alignment. Converter: `typeConversions.ts` (addressTypeToDaml,
damlAddressTypeToNative).

---

## 3. PhoneType

| OCF Value | SDK Value   | DAML Value       | OCF→DAML           | DAML→OCF           |
| --------- | ----------- | ---------------- | ------------------ | ------------------ |
| HOME      | ✅ HOME     | OcfPhoneHome     | ✅ enumConversions | ✅ enumConversions |
| MOBILE    | ✅ MOBILE   | OcfPhoneMobile   | ✅ enumConversions | ✅ enumConversions |
| BUSINESS  | ✅ BUSINESS | OcfPhoneBusiness | ✅ enumConversions | ✅ enumConversions |
| OTHER     | ✅ OTHER    | OcfPhoneOther    | ✅ enumConversions | ✅ enumConversions |

**Status:** ✅ Full alignment. Converter: `enumConversions.ts` (phoneTypeToDaml,
damlPhoneTypeToNative).

---

## 4. StockClassType

| OCF Value | SDK Value    | DAML Value                 | OCF→DAML           | DAML→OCF           |
| --------- | ------------ | -------------------------- | ------------------ | ------------------ |
| COMMON    | ✅ COMMON    | OcfStockClassTypeCommon    | ✅ enumConversions | ✅ enumConversions |
| PREFERRED | ✅ PREFERRED | OcfStockClassTypePreferred | ✅ enumConversions | ✅ enumConversions |

**Status:** ✅ Full alignment. Converter: `enumConversions.ts` (stockClassTypeToDaml,
damlStockClassTypeToNative).

---

## 5. StakeholderType

| OCF Value   | SDK Value      | DAML Value                    | OCF→DAML           | DAML→OCF           |
| ----------- | -------------- | ----------------------------- | ------------------ | ------------------ |
| INDIVIDUAL  | ✅ INDIVIDUAL  | OcfStakeholderTypeIndividual  | ✅ enumConversions | ✅ enumConversions |
| INSTITUTION | ✅ INSTITUTION | OcfStakeholderTypeInstitution | ✅ enumConversions | ✅ enumConversions |

**Status:** ✅ Full alignment. Converter: `enumConversions.ts` (stakeholderTypeToDaml,
damlStakeholderTypeToNative).

---

## 6. StakeholderRelationshipType

**OCF schema has 13 values. DAML has extended set for legacy/ex- variants.**

| OCF Value       | SDK Value          | DAML Value          | OCF→DAML           | DAML→OCF                                                   |
| --------------- | ------------------ | ------------------- | ------------------ | ---------------------------------------------------------- |
| ADVISOR         | ✅ ADVISOR         | OcfRelAdvisor       | ✅ enumConversions | ✅ (OcfRelAdvisor, OcfRelExAdvisor)                        |
| BOARD_MEMBER    | ✅ BOARD_MEMBER    | OcfRelBoardMember   | ✅ enumConversions | ✅ enumConversions                                         |
| CONSULTANT      | ✅ CONSULTANT      | OcfRelConsultant    | ✅ enumConversions | ✅ (OcfRelConsultant, OcfRelExConsultant, OcfRelOther)     |
| EMPLOYEE        | ✅ EMPLOYEE        | OcfRelEmployee      | ✅ enumConversions | ✅ (OcfRelEmployee, OcfRelExEmployee, OcfRelNonUsEmployee) |
| EX_ADVISOR      | ✅ EX_ADVISOR      | OcfRelExAdvisor     | ✅ enumConversions | ✅ maps to ADVISOR                                         |
| EX_CONSULTANT   | ✅ EX_CONSULTANT   | OcfRelExConsultant  | ✅ enumConversions | ✅ maps to OTHER                                           |
| EX_EMPLOYEE     | ✅ EX_EMPLOYEE     | OcfRelExEmployee    | ✅ enumConversions | ✅ maps to EMPLOYEE                                        |
| EXECUTIVE       | ✅ EXECUTIVE       | OcfRelExecutive     | ✅ enumConversions | ✅ (OcfRelOfficer, OcfRelExecutive)                        |
| FOUNDER         | ✅ FOUNDER         | OcfRelFounder       | ✅ enumConversions | ✅ enumConversions                                         |
| INVESTOR        | ✅ INVESTOR        | OcfRelInvestor      | ✅ enumConversions | ✅ enumConversions                                         |
| NON_US_EMPLOYEE | ✅ NON_US_EMPLOYEE | OcfRelNonUsEmployee | ✅ enumConversions | ✅ maps to EMPLOYEE                                        |
| OFFICER         | ✅ OFFICER         | OcfRelOfficer       | ✅ enumConversions | ✅ (OcfRelOfficer, OcfRelExecutive)                        |
| OTHER           | ✅ OTHER           | OcfRelOther         | ✅ enumConversions | ✅ (OcfRelConsultant, OcfRelExConsultant, OcfRelOther)     |

**Status:** ✅ Fixed. All 13 OCF values present in SDK StakeholderRelationshipType.

---

## 7. StakeholderStatusType

| OCF Value                          | SDK Value                             | DAML Value                                           | OCF→DAML           | DAML→OCF           |
| ---------------------------------- | ------------------------------------- | ---------------------------------------------------- | ------------------ | ------------------ |
| ACTIVE                             | ✅ ACTIVE                             | OcfStakeholderStatusActive                           | ✅ enumConversions | ✅ enumConversions |
| LEAVE_OF_ABSENCE                   | ✅ LEAVE_OF_ABSENCE                   | OcfStakeholderStatusLeaveOfAbsence                   | ✅ enumConversions | ✅ enumConversions |
| TERMINATION_VOLUNTARY_OTHER        | ✅ TERMINATION_VOLUNTARY_OTHER        | OcfStakeholderStatusTerminationVoluntaryOther        | ✅ enumConversions | ✅ enumConversions |
| TERMINATION_VOLUNTARY_GOOD_CAUSE   | ✅ TERMINATION_VOLUNTARY_GOOD_CAUSE   | OcfStakeholderStatusTerminationVoluntaryGoodCause    | ✅ enumConversions | ✅ enumConversions |
| TERMINATION_VOLUNTARY_RETIREMENT   | ✅ TERMINATION_VOLUNTARY_RETIREMENT   | OcfStakeholderStatusTerminationVoluntaryRetirement   | ✅ enumConversions | ✅ enumConversions |
| TERMINATION_INVOLUNTARY_OTHER      | ✅ TERMINATION_INVOLUNTARY_OTHER      | OcfStakeholderStatusTerminationInvoluntaryOther      | ✅ enumConversions | ✅ enumConversions |
| TERMINATION_INVOLUNTARY_DEATH      | ✅ TERMINATION_INVOLUNTARY_DEATH      | OcfStakeholderStatusTerminationInvoluntaryDeath      | ✅ enumConversions | ✅ enumConversions |
| TERMINATION_INVOLUNTARY_DISABILITY | ✅ TERMINATION_INVOLUNTARY_DISABILITY | OcfStakeholderStatusTerminationInvoluntaryDisability | ✅ enumConversions | ✅ enumConversions |
| TERMINATION_INVOLUNTARY_WITH_CAUSE | ✅ TERMINATION_INVOLUNTARY_WITH_CAUSE | OcfStakeholderStatusTerminationInvoluntaryWithCause  | ✅ enumConversions | ✅ enumConversions |

**Status:** ✅ Full alignment. Converter: `enumConversions.ts` (stakeholderStatusToDaml,
damlStakeholderStatusToNative).

---

## 8. RoundingType

| OCF Value | SDK Value  | DAML Value         | OCF→DAML                                         | DAML→OCF                                                         |
| --------- | ---------- | ------------------ | ------------------------------------------------ | ---------------------------------------------------------------- |
| CEILING   | ✅ CEILING | OcfRoundingCeiling | ✅ stockClassConversionRatioAdjustmentDataToDaml | ✅ getStockClassAsOcf, damlToStockClassConversionRatioAdjustment |
| FLOOR     | ✅ FLOOR   | OcfRoundingFloor   | ✅                                               | ✅                                                               |
| NORMAL    | ✅ NORMAL  | OcfRoundingNormal  | ✅ stockClassConversionRatioAdjustmentDataToDaml | ✅                                                               |

**Status:** ✅ Fixed. SDK has `CEILING | FLOOR | NORMAL` matching OCF. DOWN, UP, NEAREST removed.

---

## 9. ConversionMechanismType

**OCF schema:** FIXED_AMOUNT_CONVERSION, FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION,
RATIO_CONVERSION, SAFE_CONVERSION, VALUATION_BASED_CONVERSION, CONVERTIBLE_NOTE_CONVERSION,
CUSTOM_CONVERSION, PPS_BASED_CONVERSION

**SDK `ConversionMechanism` (stock class only):** RATIO_CONVERSION, PERCENT_CONVERSION,
FIXED_AMOUNT_CONVERSION

| OCF Value                                  | SDK Value                                     | DAML Value                                            | OCF→DAML                     | DAML→OCF |
| ------------------------------------------ | --------------------------------------------- | ----------------------------------------------------- | ---------------------------- | -------- |
| RATIO_CONVERSION                           | ✅ (as RATIO_CONVERSION)                      | OcfConversionMechanismRatioConversion                 | ✅                           | ✅       |
| FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION | ✅ FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION | OcfConversionMechanismPercentCapitalizationConversion | ✅                           | ✅       |
| FIXED_AMOUNT_CONVERSION                    | ✅ FIXED_AMOUNT_CONVERSION                    | OcfConversionMechanismFixedAmountConversion           | ✅                           | ✅       |
| SAFE_CONVERSION                            | ❌ (convertible only)                         | OcfConvMechSAFE (tag)                                 | ✅ createConvertibleIssuance | ✅       |
| VALUATION_BASED_CONVERSION                 | ❌ (convertible only)                         | OcfConversionMechanismValuationBasedConversion        | ✅                           | ✅       |
| CONVERTIBLE_NOTE_CONVERSION                | ❌ (convertible only)                         | OcfConvMechNote (tag)                                 | ✅                           | ✅       |
| CUSTOM_CONVERSION                          | ❌ (convertible only)                         | OcfConversionMechanismCustomConversion                | ✅                           | ✅       |
| PPS_BASED_CONVERSION                       | ❌ (convertible only)                         | ⚠️ OcfConversionMechanismPpsBasedConversion (naming)  | ✅                           | ✅       |

**Status:** ✅ Fixed. PERCENT_CONVERSION renamed to FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION.
Convertible mechanisms use different DAML tagged unions.

---

## 10. ConversionTriggerType

**OCF schema:** AUTOMATIC_ON_CONDITION, AUTOMATIC_ON_DATE, ELECTIVE_IN_RANGE, ELECTIVE_ON_CONDITION,
ELECTIVE_AT_WILL, UNSPECIFIED

| OCF Value              | SDK ConversionTriggerType | DAML Value                             | OCF→DAML | DAML→OCF |
| ---------------------- | ------------------------- | -------------------------------------- | -------- | -------- |
| AUTOMATIC_ON_CONDITION | ✅                        | OcfTriggerTypeTypeAutomaticOnCondition | ✅       | ✅       |
| AUTOMATIC_ON_DATE      | ✅                        | OcfTriggerTypeTypeAutomaticOnDate      | ✅       | ✅       |
| ELECTIVE_IN_RANGE      | ✅                        | OcfTriggerTypeTypeElectiveInRange      | ✅       | ✅       |
| ELECTIVE_ON_CONDITION  | ✅                        | OcfTriggerTypeTypeElectiveOnCondition  | ✅       | ✅       |
| ELECTIVE_AT_WILL       | ✅                        | OcfTriggerTypeTypeElectiveAtWill       | ✅       | ✅       |
| UNSPECIFIED            | ✅                        | OcfTriggerTypeTypeUnspecified          | ✅       | ✅       |

**Status:** ✅ Fixed. ELECTIVE_ON_DATE removed. ConversionTrigger is now alias of
ConversionTriggerType; types consolidated.

---

## 11. ConvertibleType

| OCF Value            | SDK Value               | DAML Value             | OCF→DAML                     | DAML→OCF |
| -------------------- | ----------------------- | ---------------------- | ---------------------------- | -------- |
| NOTE                 | ✅ NOTE                 | OcfConvertibleNote     | ✅ createConvertibleIssuance | ✅       |
| SAFE                 | ✅ SAFE                 | OcfConvertibleSafe     | ✅                           | ✅       |
| CONVERTIBLE_SECURITY | ✅ CONVERTIBLE_SECURITY | OcfConvertibleSecurity | ✅                           | ✅       |

**Status:** ✅ Fixed. SDK now uses CONVERTIBLE_SECURITY matching OCF.

---

## 12. CompensationType

| OCF Value  | SDK Value     | DAML Value                   | OCF→DAML                      | DAML→OCF                              |
| ---------- | ------------- | ---------------------------- | ----------------------------- | ------------------------------------- |
| OPTION_NSO | ✅ OPTION_NSO | OcfCompensationTypeOptionNSO | ✅ equityCompensationIssuance | ✅ getEquityCompensationIssuanceAsOcf |
| OPTION_ISO | ✅ OPTION_ISO | OcfCompensationTypeOptionISO | ✅                            | ✅                                    |
| OPTION     | ✅ OPTION     | OcfCompensationTypeOption    | ✅                            | ✅                                    |
| RSU        | ✅ RSU        | OcfCompensationTypeRSU       | ✅                            | ✅                                    |
| CSAR       | ✅ CSAR       | OcfCompensationTypeCSAR      | ✅                            | ✅                                    |
| SSAR       | ✅ SSAR       | OcfCompensationTypeSSAR      | ✅                            | ✅                                    |

**Status:** ✅ Full alignment. Converter:
`equityCompensationIssuance/createEquityCompensationIssuance.ts`,
`getEquityCompensationIssuanceAsOcf.ts`.

---

## 13. PeriodType

| OCF Value | SDK Value | DAML Value      | OCF→DAML                                               | DAML→OCF                              |
| --------- | --------- | --------------- | ------------------------------------------------------ | ------------------------------------- |
| DAYS      | ✅ DAYS   | OcfPeriodDays   | ✅ equityCompensationIssuance (TERMINATION_WINDOW_MAP) | ✅ getEquityCompensationIssuanceAsOcf |
| MONTHS    | ✅ MONTHS | OcfPeriodMonths | ✅                                                     | ✅                                    |
| YEARS     | ✅ YEARS  | OcfPeriodYears  | ✅                                                     | ✅                                    |

**Status:** ✅ Full alignment. Converter: `equityCompensationIssuance` (PERIOD_TYPE_MAP).

---

## 14. AllocationType

| OCF Value                      | SDK Value                         | DAML Value                              | OCF→DAML        | DAML→OCF                |
| ------------------------------ | --------------------------------- | --------------------------------------- | --------------- | ----------------------- |
| CUMULATIVE_ROUNDING            | ✅ CUMULATIVE_ROUNDING            | OcfAllocationCumulativeRounding         | ✅ vestingTerms | ✅ getVestingTermsAsOcf |
| CUMULATIVE_ROUND_DOWN          | ✅ CUMULATIVE_ROUND_DOWN          | OcfAllocationCumulativeRoundDown        | ✅              | ✅                      |
| FRONT_LOADED                   | ✅ FRONT_LOADED                   | OcfAllocationFrontLoaded                | ✅              | ✅                      |
| BACK_LOADED                    | ✅ BACK_LOADED                    | OcfAllocationBackLoaded                 | ✅              | ✅                      |
| FRONT_LOADED_TO_SINGLE_TRANCHE | ✅ FRONT_LOADED_TO_SINGLE_TRANCHE | OcfAllocationFrontLoadedToSingleTranche | ✅              | ✅                      |
| BACK_LOADED_TO_SINGLE_TRANCHE  | ✅ BACK_LOADED_TO_SINGLE_TRANCHE  | OcfAllocationBackLoadedToSingleTranche  | ✅              | ✅                      |
| FRACTIONAL                     | ✅ FRACTIONAL                     | OcfAllocationFractional                 | ✅              | ✅                      |

**Status:** ✅ Fixed. SDK now has FRONT_LOADED_TO_SINGLE_TRANCHE and BACK_LOADED_TO_SINGLE_TRANCHE
matching OCF.

---

## 15. TerminationWindowType (TerminationWindowReason in SDK)

| OCF Value              | SDK Value                 | DAML Value                   | OCF→DAML                      | DAML→OCF                              |
| ---------------------- | ------------------------- | ---------------------------- | ----------------------------- | ------------------------------------- |
| VOLUNTARY_OTHER        | ✅ VOLUNTARY_OTHER        | OcfTermVoluntaryOther        | ✅ equityCompensationIssuance | ✅ getEquityCompensationIssuanceAsOcf |
| VOLUNTARY_GOOD_CAUSE   | ✅ VOLUNTARY_GOOD_CAUSE   | OcfTermVoluntaryGoodCause    | ✅                            | ✅                                    |
| VOLUNTARY_RETIREMENT   | ✅ VOLUNTARY_RETIREMENT   | OcfTermVoluntaryRetirement   | ✅                            | ✅                                    |
| INVOLUNTARY_OTHER      | ✅ INVOLUNTARY_OTHER      | OcfTermInvoluntaryOther      | ✅                            | ✅                                    |
| INVOLUNTARY_DEATH      | ✅ INVOLUNTARY_DEATH      | OcfTermInvoluntaryDeath      | ✅                            | ✅                                    |
| INVOLUNTARY_DISABILITY | ✅ INVOLUNTARY_DISABILITY | OcfTermInvoluntaryDisability | ✅                            | ✅                                    |
| INVOLUNTARY_WITH_CAUSE | ✅ INVOLUNTARY_WITH_CAUSE | OcfTermInvoluntaryWithCause  | ✅                            | ✅                                    |

**Status:** ✅ Full alignment. SDK type `TerminationWindowReason`; converter in
`equityCompensationIssuance`.

---

## 16. StockPlanCancellationBehaviorType

| OCF Value                 | SDK Value                    | DAML Value                          | OCF→DAML           | DAML→OCF             |
| ------------------------- | ---------------------------- | ----------------------------------- | ------------------ | -------------------- |
| RETIRE                    | ✅ RETIRE                    | OcfPlanCancelRetire                 | ✅ createStockPlan | ✅ getStockPlanAsOcf |
| RETURN_TO_POOL            | ✅ RETURN_TO_POOL            | OcfPlanCancelReturnToPool           | ✅                 | ✅                   |
| HOLD_AS_CAPITAL_STOCK     | ✅ HOLD_AS_CAPITAL_STOCK     | OcfPlanCancelHoldAsCapitalStock     | ✅                 | ✅                   |
| DEFINED_PER_PLAN_SECURITY | ✅ DEFINED_PER_PLAN_SECURITY | OcfPlanCancelDefinedPerPlanSecurity | ✅                 | ✅                   |

**Status:** ✅ Full alignment.

---

## 17. ValuationType

| OCF Value | SDK Value | DAML Value           | OCF→DAML               | DAML→OCF     |
| --------- | --------- | -------------------- | ---------------------- | ------------ |
| 409A      | ✅ 409A   | OcfValuationType409A | ✅ valuationDataToDaml | ✅ damlToOcf |

**Status:** ✅ Full alignment. Converter: `valuation/valuationDataToDaml.ts`,
`valuation/damlToOcf.ts`.

---

## 18. StockIssuanceType

| OCF Value      | SDK Value         | DAML Value               | OCF→DAML               | DAML→OCF                 |
| -------------- | ----------------- | ------------------------ | ---------------------- | ------------------------ |
| RSA            | ✅ RSA            | OcfStockIssuanceRSA      | ✅ createStockIssuance | ✅ getStockIssuanceAsOcf |
| FOUNDERS_STOCK | ✅ FOUNDERS_STOCK | OcfStockIssuanceFounders | ✅                     | ✅                       |

**Status:** ✅ Full alignment.

---

## 19. AuthorizedShares

| OCF Value      | SDK Value                 | DAML Value                       | OCF→DAML                          | DAML→OCF                                     |
| -------------- | ------------------------- | -------------------------------- | --------------------------------- | -------------------------------------------- |
| NOT APPLICABLE | ✅ NOT APPLICABLE (space) | OcfAuthorizedSharesNotApplicable | ✅ typeConversions (accepts both) | ✅ getIssuerAsOcf (outputs "NOT APPLICABLE") |
| UNLIMITED      | ✅ UNLIMITED              | OcfAuthorizedSharesUnlimited     | ✅                                | ✅                                           |

**Status:** ✅ Fixed. SDK outputs `"NOT APPLICABLE"` (space) matching OCF schema.

---

## 20. OptionType

**OCF schema:** NSO, ISO, INTL

| OCF Value | SDK Value                            | DAML Value                          | OCF→DAML | DAML→OCF |
| --------- | ------------------------------------ | ----------------------------------- | -------- | -------- |
| NSO       | ❌ (CompensationType has OPTION_NSO) | N/A (compensation_type covers this) | N/A      | N/A      |
| ISO       | ❌                                   | N/A                                 | N/A      | N/A      |
| INTL      | ❌                                   | N/A                                 | N/A      | N/A      |

**Status:** ⚠️ **No standalone OptionType in SDK.** Option type is expressed via `CompensationType`
(OPTION_NSO, OPTION_ISO, OPTION). OCF OptionType (NSO, ISO, INTL) is a different enum—used in
different contexts. SDK does not model OptionType as a separate type.

---

## 21. QuantitySourceType

| OCF Value         | SDK Value                         | DAML Value                  | OCF→DAML                 | DAML→OCF                   |
| ----------------- | --------------------------------- | --------------------------- | ------------------------ | -------------------------- |
| HUMAN_ESTIMATED   | ✅ (inline in OcfWarrantIssuance) | OcfQuantityHumanEstimated   | ✅ createWarrantIssuance | ✅ getWarrantIssuanceAsOcf |
| MACHINE_ESTIMATED | ✅                                | OcfQuantityMachineEstimated | ✅                       | ✅                         |
| UNSPECIFIED       | ✅                                | OcfQuantityUnspecified      | ✅                       | ✅                         |
| INSTRUMENT_FIXED  | ✅                                | OcfQuantityInstrumentFixed  | ✅                       | ✅                         |
| INSTRUMENT_MAX    | ✅                                | OcfQuantityInstrumentMax    | ✅                       | ✅                         |
| INSTRUMENT_MIN    | ✅                                | OcfQuantityInstrumentMin    | ✅                       | ✅                         |

**Status:** ✅ Full alignment. No standalone SDK type; values inline in
`OcfWarrantIssuance.quantity_source`. Converter: `warrantIssuance/createWarrantIssuance.ts`,
`getWarrantIssuanceAsOcf.ts`.

---

## 22. VestingDayOfMonth

| OCF Value                              | SDK Value | DAML Value                      | OCF→DAML                                       | DAML→OCF                                         |
| -------------------------------------- | --------- | ------------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| 01–28                                  | ✅        | OcfVestingDay01–OcfVestingDay28 | ✅ createVestingTerms (mapOcfDayOfMonthToDaml) | ✅ getVestingTermsAsOcf (mapDamlDayOfMonthToOcf) |
| 29_OR_LAST_DAY_OF_MONTH                | ✅        | OcfVestingDay29OrLast           | ✅                                             | ✅                                               |
| 30_OR_LAST_DAY_OF_MONTH                | ✅        | OcfVestingDay30OrLast           | ✅                                             | ✅                                               |
| 31_OR_LAST_DAY_OF_MONTH                | ✅        | OcfVestingDay31OrLast           | ✅                                             | ✅                                               |
| VESTING_START_DAY_OR_LAST_DAY_OF_MONTH | ✅        | OcfVestingStartDayOrLast        | ✅                                             | ✅                                               |

**Status:** ✅ Full alignment. Converter: `vestingTerms/createVestingTerms.ts`,
`getVestingTermsAsOcf.ts`.

---

## 23. VestingTriggerType

**OCF schema:** VESTING_START_DATE, VESTING_SCHEDULE_ABSOLUTE, VESTING_SCHEDULE_RELATIVE,
VESTING_EVENT

**SDK `VestingTrigger`:** Object union with `type` field matching these values.

| OCF Value                 | SDK Value                                                                  | DAML Value                        | OCF→DAML        | DAML→OCF                |
| ------------------------- | -------------------------------------------------------------------------- | --------------------------------- | --------------- | ----------------------- |
| VESTING_START_DATE        | ✅ { type: 'VESTING_START_DATE' }                                          | OcfVestingStartTrigger            | ✅ vestingTerms | ✅ getVestingTermsAsOcf |
| VESTING_SCHEDULE_ABSOLUTE | ✅ { type: 'VESTING_SCHEDULE_ABSOLUTE', date }                             | OcfVestingScheduleAbsoluteTrigger | ✅              | ✅                      |
| VESTING_SCHEDULE_RELATIVE | ✅ { type: 'VESTING_SCHEDULE_RELATIVE', period, relative_to_condition_id } | OcfVestingScheduleRelativeTrigger | ✅              | ✅                      |
| VESTING_EVENT             | ✅ { type: 'VESTING_EVENT' }                                               | OcfVestingEventTrigger            | ✅              | ✅                      |

**Status:** ✅ Full alignment. Converter: `vestingTerms/createVestingTerms.ts`
(vestingTriggerToDaml), `getVestingTermsAsOcf.ts` (damlVestingTriggerToNative).

---

## 24. AccrualPeriodType

**OCF schema:** DAILY, MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL

**SDK:** Inline in `ConvertibleMechanismNote.interest_accrual_period`:
`'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL'`

| OCF Value   | SDK Value | DAML Value           | OCF→DAML                                            | DAML→OCF                         |
| ----------- | --------- | -------------------- | --------------------------------------------------- | -------------------------------- |
| DAILY       | ✅        | OcfAccrualDaily      | ✅ createConvertibleIssuance (dayCountToDaml, etc.) | ✅ (in ConvertibleMechanismNote) |
| MONTHLY     | ✅        | OcfAccrualMonthly    | ✅                                                  | ✅                               |
| QUARTERLY   | ✅        | OcfAccrualQuarterly  | ✅                                                  | ✅                               |
| SEMI_ANNUAL | ✅        | OcfAccrualSemiAnnual | ✅                                                  | ✅                               |
| ANNUAL      | ✅        | OcfAccrualAnnual     | ✅                                                  | ✅                               |

**Status:** ✅ Full alignment. Used in ConvertibleMechanismNote; converter in
`createConvertibleIssuance.ts`.

---

## 25. CompoundingType

**OCF schema:** COMPOUNDING, SIMPLE

**SDK:** Inline in `ConvertibleMechanismNote.compounding_type`: `'SIMPLE' | 'COMPOUNDING'`

| OCF Value   | SDK Value      | DAML Value     | OCF→DAML                     | DAML→OCF |
| ----------- | -------------- | -------------- | ---------------------------- | -------- |
| COMPOUNDING | ✅ COMPOUNDING | OcfCompounding | ✅ createConvertibleIssuance | ✅       |
| SIMPLE      | ✅ SIMPLE      | OcfSimple      | ✅                           | ✅       |

**Status:** ✅ Full alignment. Order differs (OCF: COMPOUNDING first; SDK: SIMPLE first) but both
values present.

---

## 26. DayCountType

**OCF schema:** ACTUAL_365, 30_360

| OCF Value  | SDK Value | DAML Value           | OCF→DAML                     | DAML→OCF |
| ---------- | --------- | -------------------- | ---------------------------- | -------- |
| ACTUAL_365 | ✅        | OcfDayCountActual365 | ✅ createConvertibleIssuance | ✅       |
| 30_360     | ✅        | OcfDayCount30_360    | ✅                           | ✅       |

**Status:** ✅ Full alignment. Inline in ConvertibleMechanismNote.

---

## 27. InterestPayoutType

**OCF schema:** DEFERRED, CASH

**SDK:** Inline in `ConvertibleMechanismNote.interest_payout`: `'DEFERRED' | 'CASH'`

| OCF Value | SDK Value | DAML Value                | OCF→DAML                     | DAML→OCF |
| --------- | --------- | ------------------------- | ---------------------------- | -------- |
| DEFERRED  | ✅        | OcfInterestPayoutDeferred | ✅ createConvertibleIssuance | ✅       |
| CASH      | ✅        | OcfInterestPayoutCash     | ✅                           | ✅       |

**Status:** ✅ Full alignment.

---

## 28. ValuationBasedFormulaType

**OCF schema:** FIXED, ACTUAL, CAP

**DAML:** OcfValuationFixed, OcfValuationActual, OcfValuationCap

| OCF Value | SDK Value               | DAML Value         | OCF→DAML | DAML→OCF |
| --------- | ----------------------- | ------------------ | -------- | -------- |
| FIXED     | ❌ (no standalone type) | OcfValuationFixed  | N/A      | N/A      |
| ACTUAL    | ❌                      | OcfValuationActual | N/A      | N/A      |
| CAP       | ❌                      | OcfValuationCap    | N/A      | N/A      |

**Status:** ⚠️ No standalone SDK type. Used in OcfValuationBasedConversionMechanism.valuation_type.
SDK does not expose this enum separately.

---

## 29. ObjectType

**OCF schema:** 62 object type values (ISSUER, STAKEHOLDER, TX\_\*, etc.)

**SDK:** `OcfObjectReference.object_type` — full union in `native.ts` lines 459–519.

| OCF Values | SDK Value                            | DAML Value                   | OCF→DAML | DAML→OCF |
| ---------- | ------------------------------------ | ---------------------------- | -------- | -------- |
| All 62     | ✅ All present in OcfObjectReference | Various OcfObj\* in Document | ✅       | ✅       |

**Status:** ✅ Full alignment. SDK has explicit union; used in object references.

---

## 30. ConversionRightType

**OCF schema:** CONVERTIBLE_CONVERSION_RIGHT, WARRANT_CONVERSION_RIGHT, STOCK_CLASS_CONVERSION_RIGHT

**SDK:** No standalone type; used as `type` string in conversion right objects.

| OCF Value                    | SDK Value              | DAML Value                | OCF→DAML | DAML→OCF |
| ---------------------------- | ---------------------- | ------------------------- | -------- | -------- |
| CONVERTIBLE_CONVERSION_RIGHT | ✅ (string in objects) | OcfRightConvertible (tag) | ✅       | ✅       |
| WARRANT_CONVERSION_RIGHT     | ✅                     | OcfRightWarrant (tag)     | ✅       | ✅       |
| STOCK_CLASS_CONVERSION_RIGHT | ✅                     | OcfRightStockClass (tag)  | ✅       | ✅       |

**Status:** ✅ Full alignment. No dedicated SDK enum; string literals in object types.

---

## 31. ConversionTimingType

**OCF schema:** PRE_MONEY, POST_MONEY

**SDK:** Inline in `ConvertibleMechanismSafe.conversion_timing`: `'PRE_MONEY' | 'POST_MONEY'`

| OCF Value  | SDK Value | DAML Value                           | OCF→DAML                     | DAML→OCF |
| ---------- | --------- | ------------------------------------ | ---------------------------- | -------- |
| PRE_MONEY  | ✅        | string in OcfSAFEConversionMechanism | ✅ createConvertibleIssuance | ✅       |
| POST_MONEY | ✅        | string                               | ✅                           | ✅       |

**Status:** ✅ Full alignment.

---

## 32. FileType

**OCF schema:** OCF_MANIFEST_FILE, OCF_STAKEHOLDERS_FILE, etc. (10 values)

**DAML:** OcfFileType (OcfManifestFile, OcfStakeholdersFile, etc.)

**SDK:** No standalone FileType; used for OCF bundle file loading, not in SDK types.

| OCF Value | SDK Value           | DAML Value     | OCF→DAML | DAML→OCF |
| --------- | ------------------- | -------------- | -------- | -------- |
| All 10    | ❌ Not in native.ts | ✅ OcfFileType | N/A      | N/A      |

**Status:** ⚠️ FileType not used in SDK entity types; OCF bundle loading is external.

---

## 33. ParentSecurityType

**OCF schema:** STOCK_PLAN, STOCK, WARRANT, CONVERTIBLE

**DAML:** OcfParentStockPlan, OcfParentStock, OcfParentWarrant, OcfParentConvertible

**SDK:** No standalone ParentSecurityType in native.ts.

| OCF Value   | SDK Value | DAML Value           | OCF→DAML | DAML→OCF |
| ----------- | --------- | -------------------- | -------- | -------- |
| STOCK_PLAN  | ❌        | OcfParentStockPlan   | N/A      | N/A      |
| STOCK       | ❌        | OcfParentStock       | N/A      | N/A      |
| WARRANT     | ❌        | OcfParentWarrant     | N/A      | N/A      |
| CONVERTIBLE | ❌        | OcfParentConvertible | N/A      | N/A      |

**Status:** ⚠️ No SDK type. Used in OcfStockParent; SDK may not model parent security type
explicitly.

---

## Summary of Discrepancies

### Fixed (This Audit)

| Issue                       | Status                                                                    |
| --------------------------- | ------------------------------------------------------------------------- |
| RoundingType                | ✅ Fixed: SDK now CEILING \| FLOOR \| NORMAL                              |
| AllocationType naming       | ✅ Fixed: FRONT_LOADED_TO_SINGLE_TRANCHE, BACK_LOADED_TO_SINGLE_TRANCHE   |
| AuthorizedShares output     | ✅ Fixed: SDK outputs "NOT APPLICABLE" (space)                            |
| ConversionTrigger           | ✅ Fixed: ELECTIVE_ON_DATE removed, types consolidated                    |
| ConversionMechanismType     | ✅ Fixed: PERCENT_CONVERSION → FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION |
| ConvertibleType             | ✅ Fixed: SECURITY → CONVERTIBLE_SECURITY                                 |
| StakeholderRelationshipType | ✅ Fixed: All 13 values present                                           |

### Remaining DAML Gaps

| Issue                | Description                                     |
| -------------------- | ----------------------------------------------- |
| PPS_BASED_CONVERSION | In OCF ConversionMechanismType but not in DAML. |

### Remaining Missing Values / Types

| Enum                      | Missing in SDK     | Missing in DAML |
| ------------------------- | ------------------ | --------------- |
| OptionType                | No standalone type | N/A             |
| ValuationBasedFormulaType | No standalone type | —               |
| FileType                  | No standalone type | —               |
| ParentSecurityType        | No standalone type | —               |

### Converter Coverage

- **Full bidirectional:** EmailType, AddressType, PhoneType, StockClassType, StakeholderType,
  StakeholderStatusType, CompensationType, PeriodType, TerminationWindowReason,
  StockPlanCancellationBehavior, ValuationType, StockIssuanceType, VestingDayOfMonth,
  VestingTriggerType, QuantitySourceType, AccrualPeriodType, CompoundingType, DayCountType,
  InterestPayoutType, ConversionTimingType.
- **Partial / context-specific:** StakeholderRelationshipType (DAML→OCF collapses extended values),
  ConversionMechanismType (subset for stock class), ConversionTriggerType (two SDK types),
  RoundingType (stock class uses CEILING/FLOOR/NORMAL only).
- **No converter:** OptionType, ValuationBasedFormulaType, FileType, ParentSecurityType (not used in
  SDK entity flows).

---

## Recommendations

1. ~~**Fix RoundingType:**~~ ✅ Done. SDK now has CEILING \| FLOOR \| NORMAL.
2. ~~**Fix AllocationType:**~~ ✅ Done. FRONT_LOADED_TO_SINGLE_TRANCHE,
   BACK_LOADED_TO_SINGLE_TRANCHE.
3. ~~**Fix AuthorizedShares output:**~~ ✅ Done. SDK outputs "NOT APPLICABLE" (space).
4. ~~**Fix ConversionTrigger:**~~ ✅ Done. ELECTIVE_ON_DATE removed, types consolidated.
5. ~~**Consider adding StakeholderRelationshipType values:**~~ ✅ Done. All 13 values present.
6. ~~**Document ConvertibleType alias:**~~ ✅ Done. SDK uses CONVERTIBLE_SECURITY.
7. **Remaining:** OptionType, ValuationBasedFormulaType, FileType, ParentSecurityType — no
   standalone SDK types (low priority; expressed via other types or not used in SDK entity flows).

---

## DAML Gaps and Known Findings

This section documents OCF enum vs DAML TypeScript declaration alignment, focusing on DAML-specific
gaps and structural differences.

### Known Structural Limitations (Not Bugs)

#### OcfVestingPeriod — No Years Variant

**OCF PeriodType** has: `DAYS`, `MONTHS`, `YEARS`.

**DAML OcfPeriodType** (used for termination windows) has: `OcfPeriodDays`, `OcfPeriodMonths`,
`OcfPeriodYears` — full coverage.

**DAML OcfVestingPeriod** (used for vesting schedule relative triggers) is a sum type with only:

- `OcfVestingPeriodDays`
- `OcfVestingPeriodMonths`

There is **no `OcfVestingPeriodYears`** variant. This is a **DAML structural limitation**: vesting
periods in the DAML contract only support days and months as period types. Years is supported via
`OcfPeriodType` for termination windows. The VestingPeriod is a discriminated union, not an enum.
This is by design in the DAML contract model.

#### PPS_BASED_CONVERSION — Naming Convention Difference

**OCF ConversionMechanismType** uses: `PPS_BASED_CONVERSION` (abbreviated).

**DAML** uses: `OcfConversionMechanismPpsBasedConversion` (descriptive) for stock class, and
`OcfConvMechPpsBased` (tag) for convertibles.

Functionally mapped correctly in SDK converters (`createWarrantIssuance`,
`createConvertibleIssuance`, `getWarrantIssuanceAsOcf`, `getConvertibleIssuanceAsOcf`). OCF
`PPS_BASED_CONVERSION` ↔ DAML `OcfConversionMechanismPpsBasedConversion` / `OcfConvMechPpsBased` is
a naming convention difference only.

### OCF Enums Without Direct DAML Enum Counterpart

| OCF Enum                    | DAML Location                        | Notes                                                                                                                               |
| --------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| OptionType (NSO, ISO, INTL) | N/A                                  | Option type expressed via CompensationType (OPTION_NSO, OPTION_ISO, OPTION). No standalone OptionType in DAML.                      |
| ConversionRightType         | Tagged union `OcfAnyConversionRight` | OcfRightConvertible, OcfRightWarrant, OcfRightStockClass — not an enum.                                                             |
| VestingTriggerType          | Tagged union `OcfVestingTrigger`     | OcfVestingStartTrigger, OcfVestingScheduleAbsoluteTrigger, OcfVestingScheduleRelativeTrigger, OcfVestingEventTrigger — not an enum. |
| ConversionTimingType        | String in OcfSAFEConversionMechanism | PRE_MONEY, POST_MONEY stored as string, not enum.                                                                                   |
| ObjectType                  | Various OcfObj\* in Document         | 62 values; DAML uses template/contract types, not a single enum.                                                                    |

---

## DAML Alignment Summary

| OCF Enum                          | DAML Type                                                                                  | DAML Coverage | Notes                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------ |
| ConversionTriggerType             | OcfConversionTriggerType                                                                   | ✅ Full       | 6/6 values                                                                           |
| ConvertibleType                   | OcfConvertibleType                                                                         | ✅ Full       | 3/3 values                                                                           |
| ConversionMechanismType           | OcfConversionMechanism / OcfConvertibleConversionMechanism / OcfWarrantConversionMechanism | ✅ Full       | 8/8 values; PPS_BASED→PpsBased (naming diff)                                         |
| RoundingType                      | OcfRoundingType                                                                            | ✅ Full       | 3/3 values                                                                           |
| AccrualPeriodType                 | OcfAccrualPeriodType                                                                       | ✅ Full       | 5/5 values                                                                           |
| DayCountType                      | OcfDayCountType                                                                            | ✅ Full       | 2/2 values                                                                           |
| CompoundingType                   | OcfCompoundingType                                                                         | ✅ Full       | 2/2 values                                                                           |
| InterestPayoutType                | OcfInterestPayoutType                                                                      | ✅ Full       | 2/2 values                                                                           |
| ValuationBasedFormulaType         | OcfValuationBasedFormulaType                                                               | ✅ Full       | 3/3 values (FIXED→OcfValuationFixed, ACTUAL→OcfValuationActual, CAP→OcfValuationCap) |
| StakeholderRelationshipType       | OcfStakeholderRelationshipType                                                             | ✅ Full       | 13/13 values                                                                         |
| StockClassType                    | OcfStockClassType                                                                          | ✅ Full       | 2/2 values                                                                           |
| AuthorizedShares                  | OcfAuthorizedShares                                                                        | ✅ Full       | 2/2 values (OCF "NOT APPLICABLE" vs DAML OcfAuthorizedSharesNotApplicable)           |
| QuantitySourceType                | OcfQuantitySourceType                                                                      | ✅ Full       | 6/6 values                                                                           |
| ParentSecurityType                | OcfParentSecurityType                                                                      | ✅ Full       | 4/4 values                                                                           |
| FileType                          | OcfFileType                                                                                | ✅ Full       | 10/10 values                                                                         |
| EmailType                         | OcfEmailType                                                                               | ✅ Full       | 3/3 values                                                                           |
| PhoneType                         | OcfPhoneType                                                                               | ✅ Full       | 4/4 values                                                                           |
| CompensationType                  | OcfCompensationType                                                                        | ✅ Full       | 6/6 values                                                                           |
| TerminationWindowType             | OcfTerminationWindowType                                                                   | ✅ Full       | 7/7 values                                                                           |
| PeriodType                        | OcfPeriodType                                                                              | ✅ Full       | 3/3 values                                                                           |
| AddressType                       | OcfAddressType                                                                             | ✅ Full       | 3/3 values                                                                           |
| StakeholderStatusType             | OcfStakeholderStatusType                                                                   | ✅ Full       | 9/9 values                                                                           |
| StakeholderType                   | OcfStakeholderType                                                                         | ✅ Full       | 2/2 values                                                                           |
| AllocationType                    | OcfAllocationType                                                                          | ✅ Full       | 7/7 values                                                                           |
| VestingDayOfMonth                 | OcfVestingDayOfMonth                                                                       | ✅ Full       | 33/33 values                                                                         |
| OptionType                        | —                                                                                          | ⚠️ No enum    | Expressed via CompensationType                                                       |
| ConversionRightType               | OcfAnyConversionRight (tags)                                                               | ✅ Full       | Tagged union, not enum                                                               |
| VestingTriggerType                | OcfVestingTrigger (tags)                                                                   | ✅ Full       | Tagged union, not enum                                                               |
| ConversionTimingType              | string in OcfSAFEConversionMechanism                                                       | ✅ Full       | PRE_MONEY, POST_MONEY                                                                |
| StockPlanCancellationBehaviorType | OcfPlanCancel\*                                                                            | ✅ Full       | 4/4 values (in Stock module)                                                         |
| ValuationType                     | OcfValuationType409A                                                                       | ✅ Full       | 1/1 value                                                                            |
| StockIssuanceType                 | OcfStockIssuance\*                                                                         | ✅ Full       | 2/2 values                                                                           |
| ObjectType                        | Various OcfObj\*                                                                           | ✅ Full       | Template/contract types                                                              |
| PeriodType (Vesting)              | OcfVestingPeriod                                                                           | ⚠️ Partial    | Days + Months only; no Years (structural limitation)                                 |

**Summary:** All OCF enum schemas that have direct DAML enum counterparts are fully covered. The
only DAML structural gap is **OcfVestingPeriod** (no Years variant), which is a design choice in the
vesting contract model. **PPS_BASED_CONVERSION** is correctly mapped to DAML
`OcfConversionMechanismPpsBasedConversion` / `OcfConvMechPpsBased`; the difference is naming only.

### Changes Applied (This Audit)

- **Enum fixes:** RoundingType, AuthorizedShares, ConversionMechanismType, ConversionTriggerType,
  AllocationType, ConvertibleType, StakeholderRelationshipType — all aligned with OCF.
- **Phase 1:** AuthorizedShares NOT_APPLICABLE→"NOT APPLICABLE"; ConversionMechanism
  PERCENT_CONVERSION→FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION; SimpleTrigger removed;
  ConversionTrigger consolidation.
- **Phase 2:** OptionType, option_grant_type, QuantitySourceType added; 15 field alignment fixes; 22
  @internal/@deprecated annotations for EXTRA fields.
- **Phase 3:** 3 converter silent defaults → throws.
- **Phase 4:** Schema alignment tests 315 → 446.
