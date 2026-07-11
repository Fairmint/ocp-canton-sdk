import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type {
  CapitalizationDefinitionRules,
  ConvertibleConversionMechanism,
  ConvertibleInterestRate,
  Monetary,
  NoteConversionMechanism,
  RatioConversionMechanism,
  SafeConversionMechanism,
  SharePriceBasedConversionMechanism,
  ValuationBasedConversionMechanism,
  WarrantConversionMechanism,
} from '../../../types/native';
import {
  damlTimeToDateString,
  dateStringToDAMLTime,
  isRecord,
  monetaryToDaml,
  normalizeNumericString,
  optionalDamlTimeToDateString,
  optionalDateStringToDAMLTime,
} from '../../../utils/typeConversions';

type DamlCapitalizationRules = Fairmint.OpenCapTable.Types.Conversion.OcfCapitalizationDefinitionRules;
type DamlConvertibleMechanism = Fairmint.OpenCapTable.Types.Conversion.OcfConvertibleConversionMechanism;
type DamlWarrantMechanism = Fairmint.OpenCapTable.Types.Conversion.OcfWarrantConversionMechanism;

function validationError(field: string, message: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(field, message, {
    code: OcpErrorCodes.INVALID_FORMAT,
    receivedValue,
  });
}

function requiredMissing(field: string, expectedType: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(field, `${field} is required`, {
    code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    expectedType,
    receivedValue,
  });
}

function invalidType(field: string, expectedType: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(field, `${field} has an invalid type`, {
    code: OcpErrorCodes.INVALID_TYPE,
    expectedType,
    receivedValue,
  });
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) throw invalidType(field, 'object', value);
  return value;
}

function requireRequiredRecord(value: unknown, field: string): Record<string, unknown> {
  if (value === null || value === undefined) throw requiredMissing(field, 'object', value);
  return requireRecord(value, field);
}

function requireArray(value: unknown, field: string): unknown[] {
  if (value === null || value === undefined) throw requiredMissing(field, 'array', value);
  if (!Array.isArray(value)) throw invalidType(field, 'array', value);
  return value;
}

/**
 * Require the JSON representation emitted by the generated DAML bindings.
 *
 * For non-nullable records such as Monetary and Ratio, `damlTypes.Optional<T>`
 * is encoded as `T | null`. A `{ tag: 'Some', value: T }` object is not a
 * generated or JSON API Optional encoding and accepting it would weaken the
 * ledger boundary with an undocumented compatibility shape.
 */
function requireDirectDamlRecord(value: unknown, field: string, recordType: string): Record<string, unknown> {
  const record = requireRecord(value, field);
  if (record.tag === 'Some' || record.tag === 'None') {
    throw new OcpValidationError(
      field,
      `${field} must use the generated DAML Optional encoding: a direct ${recordType} record or null`,
      {
        code: OcpErrorCodes.INVALID_FORMAT,
        expectedType: `direct ${recordType} record or null`,
        receivedValue: value,
      }
    );
  }
  return record;
}

function requireString(value: unknown, field: string): string {
  if (value === null || value === undefined) throw requiredMissing(field, 'non-empty string', value);
  if (typeof value !== 'string') throw invalidType(field, 'non-empty string', value);
  if (value.length === 0) throw validationError(field, `${field} must be a non-empty string`, value);
  return value;
}

function requireText(value: unknown, field: string): string {
  if (value === null || value === undefined) throw requiredMissing(field, 'string', value);
  if (typeof value !== 'string') throw invalidType(field, 'string', value);
  return value;
}

function requireNonEmptyText(value: unknown, field: string): string {
  const text = requireText(value, field);
  if (text.length === 0) throw validationError(field, `${field} must be a non-empty string`, value);
  return text;
}

function requireBoolean(value: unknown, field: string): boolean {
  if (value === null || value === undefined) {
    throw new OcpValidationError(field, `${field} is required`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'boolean',
      receivedValue: value,
    });
  }
  if (typeof value !== 'boolean') {
    throw new OcpValidationError(field, `${field} must be a boolean`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'boolean',
      receivedValue: value,
    });
  }
  return value;
}

function requireNumeric(value: unknown, field: string): string {
  if (value === null || value === undefined) throw requiredMissing(field, 'decimal string or number', value);
  if (typeof value !== 'string' && typeof value !== 'number') throw invalidType(field, 'decimal string or number', value);
  try {
    return normalizeNumericString(value);
  } catch (error) {
    if (error instanceof OcpValidationError) {
      throw new OcpValidationError(field, `${field} must be a valid decimal string`, {
        code: error.code,
        ...(error.expectedType !== undefined ? { expectedType: error.expectedType } : {}),
        receivedValue: error.receivedValue,
      });
    }
    throw error;
  }
}

function requireCanonicalNumeric(value: unknown, field: string): string {
  if (value === null || value === undefined) throw requiredMissing(field, 'decimal string', value);
  if (typeof value !== 'string') throw invalidType(field, 'decimal string', value);
  return requireNumeric(value, field);
}

/**
 * Encode an optional canonical OCF numeric field for DAML.
 *
 * Omission is represented as DAML `null`, but explicit JSON `null` is not a
 * canonical OCF Numeric value and must not be silently normalized to absence.
 */
export function canonicalOptionalNumericToDaml(value: unknown, field: string): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string') {
    throw new OcpValidationError(
      field,
      'Expected a canonical decimal string when provided; omit the property when absent (explicit null is invalid)',
      {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'decimal string or omitted property',
        receivedValue: value,
      }
    );
  }
  return requireNumeric(value, field);
}

/** Encode an optional canonical OCF boolean without treating null or other falsy values as absence. */
export function canonicalOptionalBooleanToDaml(value: unknown, field: string): boolean | null {
  if (value === undefined) return null;
  if (typeof value !== 'boolean') {
    throw new OcpValidationError(field, 'Expected a boolean when provided; omit the property when absent', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'boolean or omitted property',
      receivedValue: value,
    });
  }
  return value;
}

/** Encode an optional canonical OCF Monetary without accepting JSON null or loose scalar values. */
function canonicalOptionalMonetaryToDaml(value: unknown, field: string): ReturnType<typeof monetaryToDaml> | null {
  if (value === undefined) return null;
  if (!isRecord(value)) {
    throw new OcpValidationError(field, 'Expected a Monetary object when provided; omit the property when absent', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'Monetary object or omitted property',
      receivedValue: value,
    });
  }
  const amount = requireCanonicalNumeric(value.amount, `${field}.amount`);
  const currency = requireNonEmptyText(value.currency, `${field}.currency`);
  return monetaryToDaml({ amount, currency }, field);
}

function canonicalRequiredMonetaryToDaml(value: unknown, field: string): ReturnType<typeof monetaryToDaml> {
  if (value === undefined || value === null) {
    throw new OcpValidationError(field, 'A Monetary object is required', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'Monetary object',
      receivedValue: value,
    });
  }
  const monetary = canonicalOptionalMonetaryToDaml(value, field);
  if (monetary === null) {
    throw new OcpValidationError(field, 'A Monetary object is required', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'Monetary object',
      receivedValue: value,
    });
  }
  return monetary;
}

function canonicalOptionalRatioToDaml(
  value: unknown,
  field: string
): { numerator: string; denominator: string } | null {
  if (value === undefined) return null;
  const ratio = requireRecord(value, field);
  return {
    numerator: requireCanonicalNumeric(ratio.numerator, `${field}.numerator`),
    denominator: requireCanonicalNumeric(ratio.denominator, `${field}.denominator`),
  };
}

/** Encode optional canonical OCF text without normalizing invalid blank values into DAML absence. */
function canonicalOptionalTextToDaml(value: unknown, field: string): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string') {
    throw new OcpValidationError(field, 'Expected text when provided; omit the property when absent', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'non-blank string or omitted property',
      receivedValue: value,
    });
  }
  if (value.trim().length === 0) {
    throw new OcpValidationError(field, 'Expected non-blank text when provided; omit the property when absent', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'non-blank string or omitted property',
      receivedValue: value,
    });
  }
  return value;
}

function optionalStringFromDaml(value: unknown, field: string): string | undefined {
  if (value === null || value === undefined) return undefined;
  return requireText(value, field);
}

function optionalBooleanFromDaml(value: unknown, field: string): boolean | undefined {
  if (value === null || value === undefined) return undefined;
  return requireBoolean(value, field);
}

function monetaryFromDaml(value: unknown, field: string): Monetary {
  if (value === null || value === undefined) throw requiredMissing(field, 'Monetary object', value);
  const monetary = requireDirectDamlRecord(value, field, 'Monetary');
  return {
    amount: requireNumeric(monetary.amount, `${field}.amount`),
    currency: requireString(monetary.currency, `${field}.currency`),
  };
}

function optionalMonetaryFromDaml(value: unknown, field: string): Monetary | undefined {
  if (value === null || value === undefined) return undefined;
  return monetaryFromDaml(value, field);
}

function ratioFromDaml(value: unknown, field: string): { numerator: string; denominator: string } {
  if (value === null || value === undefined) throw requiredMissing(field, 'Ratio object', value);
  const ratio = requireDirectDamlRecord(value, field, 'Ratio');
  return {
    numerator: requireNumeric(ratio.numerator, `${field}.numerator`),
    denominator: requireNumeric(ratio.denominator, `${field}.denominator`),
  };
}

function optionalRatioFromDaml(value: unknown, field: string): { numerator: string; denominator: string } | undefined {
  if (value === null || value === undefined) return undefined;
  return ratioFromDaml(value, field);
}

function taggedValue(value: unknown, field: string): { tag: string; value: Record<string, unknown> } {
  const variant = requireRequiredRecord(value, field);
  return {
    tag: requireString(variant.tag, `${field}.tag`),
    value: requireRequiredRecord(variant.value, `${field}.value`),
  };
}

function describeUnknown(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    const serialized: unknown = JSON.stringify(value);
    return typeof serialized === 'string' ? serialized : typeof value;
  } catch {
    return typeof value;
  }
}

function throwUnknownVariant(runtimeValue: unknown, description: string, source = description): never {
  const type =
    isRecord(runtimeValue) && typeof runtimeValue.type === 'string' ? runtimeValue.type : describeUnknown(runtimeValue);
  throw new OcpParseError(`Unknown ${description}: ${type}`, {
    source,
    code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
  });
}

function unknownVariant(value: never, description: string, source = description): never {
  return throwUnknownVariant(value, description, source);
}

/** Convert complete canonical capitalization rules to the generated DAML record. */
export function capitalizationRulesToDaml(
  rules: CapitalizationDefinitionRules | undefined,
  field = 'capitalization_definition_rules'
): DamlCapitalizationRules | null {
  if (rules === undefined) return null;
  const runtimeRules = requireRecord(rules, field);
  return {
    include_outstanding_shares: requireBoolean(
      runtimeRules.include_outstanding_shares,
      `${field}.include_outstanding_shares`
    ),
    include_outstanding_options: requireBoolean(
      runtimeRules.include_outstanding_options,
      `${field}.include_outstanding_options`
    ),
    include_outstanding_unissued_options: requireBoolean(
      runtimeRules.include_outstanding_unissued_options,
      `${field}.include_outstanding_unissued_options`
    ),
    include_this_security: requireBoolean(runtimeRules.include_this_security, `${field}.include_this_security`),
    include_other_converting_securities: requireBoolean(
      runtimeRules.include_other_converting_securities,
      `${field}.include_other_converting_securities`
    ),
    include_option_pool_topup_for_promised_options: requireBoolean(
      runtimeRules.include_option_pool_topup_for_promised_options,
      `${field}.include_option_pool_topup_for_promised_options`
    ),
    include_additional_option_pool_topup: requireBoolean(
      runtimeRules.include_additional_option_pool_topup,
      `${field}.include_additional_option_pool_topup`
    ),
    include_new_money: requireBoolean(runtimeRules.include_new_money, `${field}.include_new_money`),
  };
}

/** Read complete capitalization rules without silently defaulting omitted flags to false. */
export function capitalizationRulesFromDaml(
  value: unknown,
  field = 'capitalization_definition_rules'
): CapitalizationDefinitionRules | undefined {
  if (value === null || value === undefined) return undefined;
  const rules = requireRecord(value, field);
  return {
    include_outstanding_shares: requireBoolean(rules.include_outstanding_shares, `${field}.include_outstanding_shares`),
    include_outstanding_options: requireBoolean(
      rules.include_outstanding_options,
      `${field}.include_outstanding_options`
    ),
    include_outstanding_unissued_options: requireBoolean(
      rules.include_outstanding_unissued_options,
      `${field}.include_outstanding_unissued_options`
    ),
    include_this_security: requireBoolean(rules.include_this_security, `${field}.include_this_security`),
    include_other_converting_securities: requireBoolean(
      rules.include_other_converting_securities,
      `${field}.include_other_converting_securities`
    ),
    include_option_pool_topup_for_promised_options: requireBoolean(
      rules.include_option_pool_topup_for_promised_options,
      `${field}.include_option_pool_topup_for_promised_options`
    ),
    include_additional_option_pool_topup: requireBoolean(
      rules.include_additional_option_pool_topup,
      `${field}.include_additional_option_pool_topup`
    ),
    include_new_money: requireBoolean(rules.include_new_money, `${field}.include_new_money`),
  };
}

function conversionTimingToDaml(
  timing: SafeConversionMechanism['conversion_timing'],
  field = 'conversion_mechanism.conversion_timing'
): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTimingType | null {
  if (timing === undefined) return null;
  if (typeof timing !== 'string') throw invalidType(field, 'PRE_MONEY or POST_MONEY', timing);
  switch (timing as string) {
    case 'PRE_MONEY':
      return 'OcfConvTimingPreMoney';
    case 'POST_MONEY':
      return 'OcfConvTimingPostMoney';
    default:
      throw new OcpParseError(`Unknown conversion_timing: ${describeUnknown(timing)}`, {
        source: field,
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

function conversionTimingFromDaml(value: unknown, field: string): SafeConversionMechanism['conversion_timing'] {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') throw invalidType(field, 'PRE_MONEY or POST_MONEY constructor', value);
  switch (value) {
    case 'OcfConvTimingPreMoney':
      return 'PRE_MONEY';
    case 'OcfConvTimingPostMoney':
      return 'POST_MONEY';
    default:
      throw new OcpParseError(`Unknown conversion_timing: ${describeUnknown(value)}`, {
        source: field,
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

function dayCountToDaml(
  value: NoteConversionMechanism['day_count_convention'],
  field: string
): Fairmint.OpenCapTable.Types.Conversion.OcfDayCountType {
  const runtimeValue = requireString(value, field);
  switch (runtimeValue) {
    case 'ACTUAL_365':
      return 'OcfDayCountActual365';
    case '30_360':
      return 'OcfDayCount30_360';
    default:
      throw new OcpParseError(`Unknown day_count_convention: ${runtimeValue}`, {
        source: field,
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

function dayCountFromDaml(value: unknown, field: string): NoteConversionMechanism['day_count_convention'] {
  const runtimeValue = requireString(value, field);
  switch (runtimeValue) {
    case 'OcfDayCountActual365':
      return 'ACTUAL_365';
    case 'OcfDayCount30_360':
      return '30_360';
    default:
      throw new OcpParseError(`Unknown day_count_convention: ${describeUnknown(runtimeValue)}`, {
        source: field,
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

function payoutToDaml(
  value: NoteConversionMechanism['interest_payout'],
  field: string
): Fairmint.OpenCapTable.Types.Conversion.OcfInterestPayoutType {
  const runtimeValue = requireString(value, field);
  switch (runtimeValue) {
    case 'DEFERRED':
      return 'OcfInterestPayoutDeferred';
    case 'CASH':
      return 'OcfInterestPayoutCash';
    default:
      throw new OcpParseError(`Unknown interest_payout: ${runtimeValue}`, {
        source: field,
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

function payoutFromDaml(value: unknown, field: string): NoteConversionMechanism['interest_payout'] {
  const runtimeValue = requireString(value, field);
  switch (runtimeValue) {
    case 'OcfInterestPayoutDeferred':
      return 'DEFERRED';
    case 'OcfInterestPayoutCash':
      return 'CASH';
    default:
      throw new OcpParseError(`Unknown interest_payout: ${describeUnknown(runtimeValue)}`, {
        source: field,
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

function accrualPeriodToDaml(
  value: NoteConversionMechanism['interest_accrual_period'],
  field: string
): Fairmint.OpenCapTable.Types.Conversion.OcfAccrualPeriodType {
  const runtimeValue = requireString(value, field);
  switch (runtimeValue) {
    case 'DAILY':
      return 'OcfAccrualDaily';
    case 'MONTHLY':
      return 'OcfAccrualMonthly';
    case 'QUARTERLY':
      return 'OcfAccrualQuarterly';
    case 'SEMI_ANNUAL':
      return 'OcfAccrualSemiAnnual';
    case 'ANNUAL':
      return 'OcfAccrualAnnual';
    default:
      throw new OcpParseError(`Unknown interest_accrual_period: ${runtimeValue}`, {
        source: field,
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

function accrualPeriodFromDaml(value: unknown, field: string): NoteConversionMechanism['interest_accrual_period'] {
  const runtimeValue = requireString(value, field);
  switch (runtimeValue) {
    case 'OcfAccrualDaily':
      return 'DAILY';
    case 'OcfAccrualMonthly':
      return 'MONTHLY';
    case 'OcfAccrualQuarterly':
      return 'QUARTERLY';
    case 'OcfAccrualSemiAnnual':
      return 'SEMI_ANNUAL';
    case 'OcfAccrualAnnual':
      return 'ANNUAL';
    default:
      throw new OcpParseError(`Unknown interest_accrual_period: ${describeUnknown(runtimeValue)}`, {
        source: field,
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

function compoundingToDaml(
  value: NoteConversionMechanism['compounding_type'],
  field: string
): Fairmint.OpenCapTable.Types.Conversion.OcfCompoundingType {
  const runtimeValue = requireString(value, field);
  switch (runtimeValue) {
    case 'SIMPLE':
      return 'OcfSimple';
    case 'COMPOUNDING':
      return 'OcfCompounding';
    default:
      throw new OcpParseError(`Unknown compounding_type: ${runtimeValue}`, {
        source: field,
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

function compoundingFromDaml(value: unknown, field: string): NoteConversionMechanism['compounding_type'] {
  const runtimeValue = requireString(value, field);
  switch (runtimeValue) {
    case 'OcfSimple':
      return 'SIMPLE';
    case 'OcfCompounding':
      return 'COMPOUNDING';
    default:
      throw new OcpParseError(`Unknown compounding_type: ${describeUnknown(runtimeValue)}`, {
        source: field,
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

function requireInterestAccrualStartDate(value: unknown, field: string): unknown {
  if (value === null || value === undefined) {
    throw new OcpValidationError(field, 'accrual_start_date is required for each convertible note interest rate', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: value,
    });
  }
  return value;
}

function interestRateToDaml(
  value: unknown,
  index: number,
  mechanismField: string
): Fairmint.OpenCapTable.Types.Conversion.OcfInterestRate {
  const field = `${mechanismField}.interest_rates.${index}`;
  const rate = requireRecord(value, field);
  const accrualStartDate = requireInterestAccrualStartDate(rate.accrual_start_date, `${field}.accrual_start_date`);
  return {
    rate: requireCanonicalNumeric(rate.rate, `${field}.rate`),
    accrual_start_date: dateStringToDAMLTime(accrualStartDate, `${field}.accrual_start_date`),
    accrual_end_date: optionalDateStringToDAMLTime(rate.accrual_end_date, `${field}.accrual_end_date`),
  };
}

function interestRateFromDaml(value: unknown, index: number, mechanismField: string): ConvertibleInterestRate {
  const field = `${mechanismField}.interest_rates.${index}`;
  const rate = requireRecord(value, field);
  const accrualStartDate = requireInterestAccrualStartDate(rate.accrual_start_date, `${field}.accrual_start_date`);
  const accrualEndDate = optionalDamlTimeToDateString(rate.accrual_end_date, `${field}.accrual_end_date`);
  return {
    rate: requireNumeric(rate.rate, `${field}.rate`),
    accrual_start_date: damlTimeToDateString(accrualStartDate, `${field}.accrual_start_date`),
    ...(accrualEndDate !== undefined ? { accrual_end_date: accrualEndDate } : {}),
  };
}

/** Convert a canonical convertible mechanism to the exact generated DAML variant. */
export function convertibleMechanismToDaml(
  mechanism: ConvertibleConversionMechanism,
  field = 'conversion_mechanism'
): DamlConvertibleMechanism {
  const runtimeMechanism: unknown = mechanism;
  if (!isRecord(runtimeMechanism)) {
    throw new OcpValidationError(field, 'Convertible conversion mechanism must be an object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'ConvertibleConversionMechanism',
      receivedValue: mechanism,
    });
  }
  requireString(runtimeMechanism.type, `${field}.type`);
  switch (mechanism.type) {
    case 'SAFE_CONVERSION':
      return {
        tag: 'OcfConvMechSAFE',
        value: {
          conversion_mfn: requireBoolean(mechanism.conversion_mfn, `${field}.conversion_mfn`),
          conversion_discount: canonicalOptionalNumericToDaml(
            mechanism.conversion_discount,
            `${field}.conversion_discount`
          ),
          conversion_valuation_cap: canonicalOptionalMonetaryToDaml(
            mechanism.conversion_valuation_cap,
            `${field}.conversion_valuation_cap`
          ),
          conversion_timing: conversionTimingToDaml(mechanism.conversion_timing, `${field}.conversion_timing`),
          capitalization_definition: canonicalOptionalTextToDaml(
            mechanism.capitalization_definition,
            `${field}.capitalization_definition`
          ),
          capitalization_definition_rules: capitalizationRulesToDaml(
            mechanism.capitalization_definition_rules,
            `${field}.capitalization_definition_rules`
          ),
          exit_multiple: canonicalOptionalRatioToDaml(mechanism.exit_multiple, `${field}.exit_multiple`),
        },
      };
    case 'CONVERTIBLE_NOTE_CONVERSION': {
      const interestRates = requireArray(mechanism.interest_rates, `${field}.interest_rates`);
      return {
        tag: 'OcfConvMechNote',
        value: {
          interest_rates: interestRates.map((rate, index) => interestRateToDaml(rate, index, field)),
          day_count_convention: dayCountToDaml(mechanism.day_count_convention, `${field}.day_count_convention`),
          interest_payout: payoutToDaml(mechanism.interest_payout, `${field}.interest_payout`),
          interest_accrual_period: accrualPeriodToDaml(
            mechanism.interest_accrual_period,
            `${field}.interest_accrual_period`
          ),
          compounding_type: compoundingToDaml(mechanism.compounding_type, `${field}.compounding_type`),
          conversion_discount: canonicalOptionalNumericToDaml(
            mechanism.conversion_discount,
            `${field}.conversion_discount`
          ),
          conversion_valuation_cap: canonicalOptionalMonetaryToDaml(
            mechanism.conversion_valuation_cap,
            `${field}.conversion_valuation_cap`
          ),
          capitalization_definition: canonicalOptionalTextToDaml(
            mechanism.capitalization_definition,
            `${field}.capitalization_definition`
          ),
          capitalization_definition_rules: capitalizationRulesToDaml(
            mechanism.capitalization_definition_rules,
            `${field}.capitalization_definition_rules`
          ),
          exit_multiple: canonicalOptionalRatioToDaml(mechanism.exit_multiple, `${field}.exit_multiple`),
          conversion_mfn: canonicalOptionalBooleanToDaml(mechanism.conversion_mfn, `${field}.conversion_mfn`),
        },
      };
    }
    case 'CUSTOM_CONVERSION':
      return {
        tag: 'OcfConvMechCustom',
        value: {
          custom_conversion_description: requireNonEmptyText(
            mechanism.custom_conversion_description,
            `${field}.custom_conversion_description`
          ),
        },
      };
    case 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION':
      return {
        tag: 'OcfConvMechPercentCapitalization',
        value: {
          converts_to_percent: requireCanonicalNumeric(
            mechanism.converts_to_percent,
            `${field}.converts_to_percent`
          ),
          capitalization_definition: canonicalOptionalTextToDaml(
            mechanism.capitalization_definition,
            `${field}.capitalization_definition`
          ),
          capitalization_definition_rules: capitalizationRulesToDaml(
            mechanism.capitalization_definition_rules,
            `${field}.capitalization_definition_rules`
          ),
        },
      };
    case 'FIXED_AMOUNT_CONVERSION':
      return {
        tag: 'OcfConvMechFixedAmount',
        value: {
          converts_to_quantity: requireCanonicalNumeric(
            mechanism.converts_to_quantity,
            `${field}.converts_to_quantity`
          ),
        },
      };
    default:
      return unknownVariant(mechanism, 'convertible conversion mechanism', field);
  }
}

/** Convert a generated DAML convertible mechanism and reject variants forbidden by OCF. */
export function convertibleMechanismFromDaml(
  value: unknown,
  field = 'conversion_mechanism'
): ConvertibleConversionMechanism {
  const variant = taggedValue(value, field);
  const mechanism = variant.value;
  switch (variant.tag) {
    case 'OcfConvMechSAFE': {
      const conversionDiscount =
        mechanism.conversion_discount === null || mechanism.conversion_discount === undefined
          ? undefined
          : requireNumeric(mechanism.conversion_discount, `${field}.conversion_discount`);
      const conversionValuationCap = optionalMonetaryFromDaml(
        mechanism.conversion_valuation_cap,
        `${field}.conversion_valuation_cap`
      );
      const capitalizationDefinition = optionalStringFromDaml(
        mechanism.capitalization_definition,
        `${field}.capitalization_definition`
      );
      const capitalizationDefinitionRules = capitalizationRulesFromDaml(
        mechanism.capitalization_definition_rules,
        `${field}.capitalization_definition_rules`
      );
      const exitMultiple = optionalRatioFromDaml(mechanism.exit_multiple, `${field}.exit_multiple`);
      const conversionTiming = conversionTimingFromDaml(mechanism.conversion_timing, `${field}.conversion_timing`);
      return {
        type: 'SAFE_CONVERSION',
        conversion_mfn: requireBoolean(mechanism.conversion_mfn, `${field}.conversion_mfn`),
        ...(conversionDiscount ? { conversion_discount: conversionDiscount } : {}),
        ...(conversionValuationCap ? { conversion_valuation_cap: conversionValuationCap } : {}),
        ...(conversionTiming ? { conversion_timing: conversionTiming } : {}),
        ...(capitalizationDefinition !== undefined ? { capitalization_definition: capitalizationDefinition } : {}),
        ...(capitalizationDefinitionRules ? { capitalization_definition_rules: capitalizationDefinitionRules } : {}),
        ...(exitMultiple ? { exit_multiple: exitMultiple } : {}),
      };
    }
    case 'OcfConvMechNote': {
      const interestRates = requireArray(mechanism.interest_rates, `${field}.interest_rates`);
      const conversionDiscount =
        mechanism.conversion_discount === null || mechanism.conversion_discount === undefined
          ? undefined
          : requireNumeric(mechanism.conversion_discount, `${field}.conversion_discount`);
      const conversionValuationCap = optionalMonetaryFromDaml(
        mechanism.conversion_valuation_cap,
        `${field}.conversion_valuation_cap`
      );
      const capitalizationDefinition = optionalStringFromDaml(
        mechanism.capitalization_definition,
        `${field}.capitalization_definition`
      );
      const capitalizationDefinitionRules = capitalizationRulesFromDaml(
        mechanism.capitalization_definition_rules,
        `${field}.capitalization_definition_rules`
      );
      const exitMultiple = optionalRatioFromDaml(mechanism.exit_multiple, `${field}.exit_multiple`);
      const conversionMfn = optionalBooleanFromDaml(mechanism.conversion_mfn, `${field}.conversion_mfn`);
      return {
        type: 'CONVERTIBLE_NOTE_CONVERSION',
        interest_rates: interestRates.map((rate, index) => interestRateFromDaml(rate, index, field)),
        day_count_convention: dayCountFromDaml(mechanism.day_count_convention, `${field}.day_count_convention`),
        interest_payout: payoutFromDaml(mechanism.interest_payout, `${field}.interest_payout`),
        interest_accrual_period: accrualPeriodFromDaml(
          mechanism.interest_accrual_period,
          `${field}.interest_accrual_period`
        ),
        compounding_type: compoundingFromDaml(mechanism.compounding_type, `${field}.compounding_type`),
        ...(conversionDiscount ? { conversion_discount: conversionDiscount } : {}),
        ...(conversionValuationCap ? { conversion_valuation_cap: conversionValuationCap } : {}),
        ...(capitalizationDefinition !== undefined ? { capitalization_definition: capitalizationDefinition } : {}),
        ...(capitalizationDefinitionRules ? { capitalization_definition_rules: capitalizationDefinitionRules } : {}),
        ...(exitMultiple ? { exit_multiple: exitMultiple } : {}),
        ...(conversionMfn !== undefined ? { conversion_mfn: conversionMfn } : {}),
      };
    }
    case 'OcfConvMechCustom':
      return {
        type: 'CUSTOM_CONVERSION',
        custom_conversion_description: requireNonEmptyText(
          mechanism.custom_conversion_description,
          `${field}.custom_conversion_description`
        ),
      };
    case 'OcfConvMechPercentCapitalization': {
      const capitalizationDefinition = optionalStringFromDaml(
        mechanism.capitalization_definition,
        `${field}.capitalization_definition`
      );
      const capitalizationDefinitionRules = capitalizationRulesFromDaml(
        mechanism.capitalization_definition_rules,
        `${field}.capitalization_definition_rules`
      );
      return {
        type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
        converts_to_percent: requireNumeric(mechanism.converts_to_percent, `${field}.converts_to_percent`),
        ...(capitalizationDefinition !== undefined ? { capitalization_definition: capitalizationDefinition } : {}),
        ...(capitalizationDefinitionRules ? { capitalization_definition_rules: capitalizationDefinitionRules } : {}),
      };
    }
    case 'OcfConvMechFixedAmount':
      return {
        type: 'FIXED_AMOUNT_CONVERSION',
        converts_to_quantity: requireNumeric(mechanism.converts_to_quantity, `${field}.converts_to_quantity`),
      };
    case 'OcfConvMechPpsBased':
    case 'OcfConvMechValuationBased':
    case 'OcfConvMechRatio':
      throw new OcpParseError(`DAML mechanism ${variant.tag} is not permitted by OCF ConvertibleConversionRight`, {
        source: `${field}.tag`,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
      });
    default:
      throw new OcpParseError(`Unknown convertible conversion mechanism tag: ${variant.tag}`, {
        source: `${field}.tag`,
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

function valuationTypeToDaml(
  value: ValuationBasedConversionMechanism['valuation_type'],
  field: string
): ValuationBasedConversionMechanism['valuation_type'] {
  const runtimeValue = requireString(value, field);
  switch (runtimeValue) {
    case 'CAP':
    case 'FIXED':
    case 'ACTUAL':
      return runtimeValue;
    default:
      throw new OcpParseError(`Unknown valuation_type: ${describeUnknown(runtimeValue)}`, {
        source: field,
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

function valuationTypeFromDaml(value: unknown, field: string): ValuationBasedConversionMechanism['valuation_type'] {
  const runtimeValue = requireString(value, field);
  switch (runtimeValue) {
    case 'CAP':
    case 'FIXED':
    case 'ACTUAL':
      return runtimeValue;
    default:
      throw new OcpParseError(`Unknown valuation_type: ${describeUnknown(runtimeValue)}`, {
        source: field,
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

function sharePriceMechanismFromDaml(
  mechanism: Record<string, unknown>,
  field: string
): SharePriceBasedConversionMechanism {
  const description = requireNonEmptyText(mechanism.description, `${field}.description`);
  const discount = requireBoolean(mechanism.discount, `${field}.discount`);
  const percentage =
    mechanism.discount_percentage === null || mechanism.discount_percentage === undefined
      ? undefined
      : requireNumeric(mechanism.discount_percentage, `${field}.discount_percentage`);
  const amount = optionalMonetaryFromDaml(mechanism.discount_amount, `${field}.discount_amount`);

  if (!discount) {
    if (percentage !== undefined || amount !== undefined) {
      throw validationError(
        `${field}.discount`,
        'A non-discounted PPS conversion cannot include discount details',
        mechanism
      );
    }
    return { type: 'PPS_BASED_CONVERSION', description, discount: false };
  }
  if (percentage !== undefined && amount === undefined) {
    return { type: 'PPS_BASED_CONVERSION', description, discount: true, discount_percentage: percentage };
  }
  if (amount !== undefined && percentage === undefined) {
    return { type: 'PPS_BASED_CONVERSION', description, discount: true, discount_amount: amount };
  }
  throw validationError(
    `${field}.discount`,
    'A discounted PPS conversion requires exactly one of discount_percentage or discount_amount',
    mechanism
  );
}

/** Convert a canonical warrant mechanism to the exact generated DAML variant. */
export function warrantMechanismToDaml(
  mechanism: WarrantConversionMechanism,
  field = 'conversion_mechanism'
): DamlWarrantMechanism {
  if (!isRecord(mechanism)) {
    throw new OcpValidationError(field, 'Warrant conversion mechanism must be an object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'WarrantConversionMechanism',
      receivedValue: mechanism,
    });
  }
  requireString(mechanism.type, `${field}.type`);
  switch (mechanism.type) {
    case 'CUSTOM_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismCustom',
        value: {
          custom_conversion_description: requireNonEmptyText(
            mechanism.custom_conversion_description,
            `${field}.custom_conversion_description`
          ),
        },
      };
    case 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismPercentCapitalization',
        value: {
          converts_to_percent: requireCanonicalNumeric(
            mechanism.converts_to_percent,
            `${field}.converts_to_percent`
          ),
          capitalization_definition: canonicalOptionalTextToDaml(
            mechanism.capitalization_definition,
            `${field}.capitalization_definition`
          ),
          capitalization_definition_rules: capitalizationRulesToDaml(
            mechanism.capitalization_definition_rules,
            `${field}.capitalization_definition_rules`
          ),
        },
      };
    case 'FIXED_AMOUNT_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismFixedAmount',
        value: {
          converts_to_quantity: requireCanonicalNumeric(
            mechanism.converts_to_quantity,
            `${field}.converts_to_quantity`
          ),
        },
      };
    case 'VALUATION_BASED_CONVERSION': {
      const valuationType = valuationTypeToDaml(mechanism.valuation_type, `${field}.valuation_type`);
      const valuationAmount =
        valuationType === 'ACTUAL'
          ? canonicalOptionalMonetaryToDaml(mechanism.valuation_amount, `${field}.valuation_amount`)
          : canonicalRequiredMonetaryToDaml(mechanism.valuation_amount, `${field}.valuation_amount`);
      return {
        tag: 'OcfWarrantMechanismValuationBased',
        value: {
          valuation_type: valuationType,
          valuation_amount: valuationAmount,
          capitalization_definition: canonicalOptionalTextToDaml(
            mechanism.capitalization_definition,
            `${field}.capitalization_definition`
          ),
          capitalization_definition_rules: capitalizationRulesToDaml(
            mechanism.capitalization_definition_rules,
            `${field}.capitalization_definition_rules`
          ),
        },
      };
    }
    case 'PPS_BASED_CONVERSION': {
      const description = requireNonEmptyText(mechanism.description, `${field}.description`);
      const discount = requireBoolean(mechanism.discount, `${field}.discount`);
      const discountPercentage = canonicalOptionalNumericToDaml(
        mechanism.discount_percentage,
        `${field}.discount_percentage`
      );
      const discountAmount = canonicalOptionalMonetaryToDaml(
        mechanism.discount_amount,
        `${field}.discount_amount`
      );
      const hasPercentage = discountPercentage !== null;
      const hasAmount = discountAmount !== null;
      if (discount ? hasPercentage === hasAmount : hasPercentage || hasAmount) {
        throw validationError(
          `${field}.discount`,
          discount
            ? 'A discounted PPS conversion requires exactly one of discount_percentage or discount_amount'
            : 'A non-discounted PPS conversion cannot include discount details',
          mechanism
        );
      }
      return {
        tag: 'OcfWarrantMechanismPpsBased',
        value: {
          description,
          discount,
          discount_percentage: discountPercentage,
          discount_amount: discountAmount,
        },
      };
    }
    default:
      return unknownVariant(mechanism, 'warrant conversion mechanism', field);
  }
}

/** Convert a generated DAML warrant mechanism to its exact canonical OCF variant. */
export function warrantMechanismFromDaml(value: unknown, field = 'conversion_mechanism'): WarrantConversionMechanism {
  const variant = taggedValue(value, field);
  const mechanism = variant.value;
  switch (variant.tag) {
    case 'OcfWarrantMechanismCustom':
      return {
        type: 'CUSTOM_CONVERSION',
        custom_conversion_description: requireNonEmptyText(
          mechanism.custom_conversion_description,
          `${field}.custom_conversion_description`
        ),
      };
    case 'OcfWarrantMechanismPercentCapitalization': {
      const capitalizationDefinition = optionalStringFromDaml(
        mechanism.capitalization_definition,
        `${field}.capitalization_definition`
      );
      const capitalizationDefinitionRules = capitalizationRulesFromDaml(
        mechanism.capitalization_definition_rules,
        `${field}.capitalization_definition_rules`
      );
      return {
        type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
        converts_to_percent: requireNumeric(mechanism.converts_to_percent, `${field}.converts_to_percent`),
        ...(capitalizationDefinition !== undefined ? { capitalization_definition: capitalizationDefinition } : {}),
        ...(capitalizationDefinitionRules ? { capitalization_definition_rules: capitalizationDefinitionRules } : {}),
      };
    }
    case 'OcfWarrantMechanismFixedAmount':
      return {
        type: 'FIXED_AMOUNT_CONVERSION',
        converts_to_quantity: requireNumeric(mechanism.converts_to_quantity, `${field}.converts_to_quantity`),
      };
    case 'OcfWarrantMechanismValuationBased': {
      const valuationType = valuationTypeFromDaml(mechanism.valuation_type, `${field}.valuation_type`);
      const valuationAmount = optionalMonetaryFromDaml(mechanism.valuation_amount, `${field}.valuation_amount`);
      const capitalizationDefinition = optionalStringFromDaml(
        mechanism.capitalization_definition,
        `${field}.capitalization_definition`
      );
      const capitalizationDefinitionRules = capitalizationRulesFromDaml(
        mechanism.capitalization_definition_rules,
        `${field}.capitalization_definition_rules`
      );
      const common = {
        type: 'VALUATION_BASED_CONVERSION' as const,
        ...(capitalizationDefinition !== undefined ? { capitalization_definition: capitalizationDefinition } : {}),
        ...(capitalizationDefinitionRules ? { capitalization_definition_rules: capitalizationDefinitionRules } : {}),
      };
      if (valuationType === 'ACTUAL') {
        return {
          ...common,
          valuation_type: 'ACTUAL',
          ...(valuationAmount ? { valuation_amount: valuationAmount } : {}),
        };
      }
      if (!valuationAmount) {
        throw requiredMissing(`${field}.valuation_amount`, 'Monetary object', mechanism.valuation_amount);
      }
      return { ...common, valuation_type: valuationType, valuation_amount: valuationAmount };
    }
    case 'OcfWarrantMechanismPpsBased':
      return sharePriceMechanismFromDaml(mechanism, field);
    default:
      throw new OcpParseError(`Unknown warrant conversion mechanism tag: ${variant.tag}`, {
        source: `${field}.tag`,
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

/** Convert a complete ratio mechanism to fields stored flat in the DAML stock-class right. */
export function ratioMechanismToDaml(
  mechanism: RatioConversionMechanism,
  field = 'conversion_right.conversion_mechanism'
): {
  conversion_mechanism: Fairmint.OpenCapTable.Types.Conversion.OcfConversionMechanism;
  ratio: Fairmint.OpenCapTable.Types.Stock.OcfRatio;
  conversion_price: Fairmint.OpenCapTable.Types.Monetary.OcfMonetary;
} {
  const runtimeMechanism: unknown = mechanism;
  if (!isRecord(runtimeMechanism)) {
    throw invalidType(field, 'RatioConversionMechanism object', runtimeMechanism);
  }
  const mechanismType = requireString(runtimeMechanism.type, `${field}.type`);
  if (mechanismType !== 'RATIO_CONVERSION') {
    return throwUnknownVariant(runtimeMechanism, 'stock-class conversion mechanism', field);
  }
  const roundingType = requireString(runtimeMechanism.rounding_type, `${field}.rounding_type`);
  if (roundingType !== 'NORMAL') {
    throw new OcpValidationError(
      `${field}.rounding_type`,
      'The current DAML stock-class right cannot persist rounding_type; only NORMAL round-trips',
      { code: OcpErrorCodes.INVALID_FORMAT, receivedValue: runtimeMechanism.rounding_type }
    );
  }
  const ratio = requireRequiredRecord(runtimeMechanism.ratio, `${field}.ratio`);
  return {
    conversion_mechanism: 'OcfConversionMechanismRatioConversion',
    ratio: {
      numerator: requireCanonicalNumeric(ratio.numerator, `${field}.ratio.numerator`),
      denominator: requireCanonicalNumeric(ratio.denominator, `${field}.ratio.denominator`),
    },
    conversion_price: canonicalRequiredMonetaryToDaml(
      runtimeMechanism.conversion_price,
      `${field}.conversion_price`
    ),
  };
}

/** Rebuild the only OCF mechanism permitted for a stock-class right from flat DAML fields. */
export function ratioMechanismFromDaml(value: Record<string, unknown>, field: string): RatioConversionMechanism {
  const record = requireRequiredRecord(value, field);
  const rawMechanism = record.conversion_mechanism;
  if (rawMechanism === null || rawMechanism === undefined) {
    throw requiredMissing(`${field}.type`, 'ratio conversion constructor', rawMechanism);
  }
  const mechanismTag =
    typeof rawMechanism === 'string'
      ? rawMechanism
      : isRecord(rawMechanism)
        ? requireString(rawMechanism.tag, `${field}.tag`)
        : (() => {
            throw invalidType(`${field}.type`, 'ratio conversion constructor', rawMechanism);
          })();
  if (mechanismTag !== 'OcfConversionMechanismRatioConversion') {
    throw new OcpParseError(`Only ratio conversion is valid for ${field}; received ${mechanismTag || 'unknown'}`, {
      source: field,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }
  return {
    type: 'RATIO_CONVERSION',
    ratio: ratioFromDaml(record.ratio, `${field}.ratio`),
    conversion_price: monetaryFromDaml(record.conversion_price, `${field}.conversion_price`),
    rounding_type: 'NORMAL',
  };
}
