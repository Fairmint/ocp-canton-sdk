import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type {
  CapitalizationDefinitionRules,
  ConversionTriggerType,
  ConvertibleConversionMechanism,
  ConvertibleConversionRight,
  ConvertibleConversionTrigger,
  ConvertibleInterestRate,
  ExitMultiple,
  Monetary,
  OcfConvertibleIssuance,
} from '../../../types/native';
import { isDamlEnumConstructor, ocfEnumValue } from '../../../utils/damlEnums';
import {
  damlDateToDateString,
  damlMonetaryToNativeWithValidation,
  isRecord,
  mapDamlTriggerTypeToOcf,
  normalizeNumericString,
  optionalDamlDateToDateString,
  safeString,
} from '../../../utils/typeConversions';
import { readSingleContract } from '../shared/singleContractRead';
import { triggerFieldsFromDaml } from '../shared/triggerFields';

export type OcfConvertibleIssuanceEvent = OcfConvertibleIssuance;

export interface GetConvertibleIssuanceAsOcfParams extends GetByContractIdParams {}

export interface GetConvertibleIssuanceAsOcfResult {
  event: OcfConvertibleIssuanceEvent;
  contractId: string;
}

/** A Daml `Numeric` as OCF carries it: a normalized decimal string (the ledger may hand back a number). */
function numericFromDaml(value: unknown, fieldPath: string): string {
  if (typeof value === 'number') return normalizeNumericString(value.toString(), fieldPath);
  if (typeof value === 'string') return normalizeNumericString(value, fieldPath);
  throw new OcpValidationError(fieldPath, `Must be string or number, got ${typeof value}`, {
    code: OcpErrorCodes.INVALID_TYPE,
    expectedType: 'string | number',
    receivedValue: value,
  });
}

function optionalNumericFromDaml(value: unknown, fieldPath: string): string | undefined {
  return value === null || value === undefined ? undefined : numericFromDaml(value, fieldPath);
}

function optionalMonetaryFromDaml(value: unknown, fieldPath: string): Monetary | undefined {
  if (value === null || value === undefined) return undefined;
  const monetary = damlMonetaryToNativeWithValidation(value, fieldPath);
  if (!monetary) {
    throw new OcpValidationError(fieldPath, `Invalid monetary value for ${fieldPath.split('.').pop() ?? fieldPath}`, {
      code: OcpErrorCodes.INVALID_TYPE,
      receivedValue: value,
    });
  }
  return monetary;
}

function optionalExitMultipleFromDaml(value: unknown, fieldPath: string): ExitMultiple | undefined {
  if (value === null || value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new OcpValidationError(fieldPath, 'Exit multiple must be an object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'object',
      receivedValue: value,
    });
  }
  return {
    numerator: normalizeNumericString(String(value.numerator), `${fieldPath}.numerator`),
    denominator: normalizeNumericString(String(value.denominator), `${fieldPath}.denominator`),
  };
}

/** The v35 `OcfCapitalizationDefinitionRules`: all eight flags are required, and so they are in OCF. */
function optionalCapitalizationRulesFromDaml(
  value: unknown,
  fieldPath: string
): CapitalizationDefinitionRules | undefined {
  if (value === null || value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new OcpValidationError(fieldPath, 'Capitalization definition rules must be an object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'object',
      receivedValue: value,
    });
  }
  return {
    include_outstanding_shares: value.include_outstanding_shares === true,
    include_outstanding_options: value.include_outstanding_options === true,
    include_outstanding_unissued_options: value.include_outstanding_unissued_options === true,
    include_this_security: value.include_this_security === true,
    include_other_converting_securities: value.include_other_converting_securities === true,
    include_option_pool_topup_for_promised_options: value.include_option_pool_topup_for_promised_options === true,
    include_additional_option_pool_topup: value.include_additional_option_pool_topup === true,
    include_new_money: value.include_new_money === true,
  };
}

function optionalDescription(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function mapMechanism(m: unknown, mechanismPath: string): ConvertibleConversionMechanism {
  const mechanismField = (field: string): string => `${mechanismPath}.${field}`;

  if (typeof m === 'string') {
    throw new OcpParseError(`conversion_mechanism missing variant value (got tag '${m}')`, {
      source: mechanismPath,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }
  if (!m || typeof m !== 'object') {
    throw new OcpParseError('Unknown conversion_mechanism shape', {
      source: mechanismPath,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

  const mechanism = m as Record<string, unknown>;
  const { tag } = mechanism;
  if (typeof tag !== 'string' || tag.length === 0) {
    throw new OcpValidationError(mechanismField('tag'), 'A non-empty mechanism tag is required', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'non-empty string',
      receivedValue: tag,
    });
  }
  const rawValue = mechanism.value;
  if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
    throw new OcpValidationError(mechanismField('value'), 'A mechanism value object is required', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'non-null object',
      receivedValue: rawValue,
    });
  }
  const value = rawValue as Record<string, unknown>;

  // The v35 register carries exactly OCF's five convertible conversion mechanisms.
  switch (tag) {
    case 'OcfConvMechSAFE': {
      const timingPath = mechanismField('conversion_timing');
      const timing = safeString(value.conversion_timing, timingPath);
      const conversionDiscount = optionalNumericFromDaml(
        value.conversion_discount,
        mechanismField('conversion_discount')
      );
      const valuationCap = optionalMonetaryFromDaml(
        value.conversion_valuation_cap,
        mechanismField('conversion_valuation_cap')
      );
      const exitMultiple = optionalExitMultipleFromDaml(value.exit_multiple, mechanismField('exit_multiple'));
      const capitalizationDefinition = optionalDescription(value.capitalization_definition);
      const capitalizationRules = optionalCapitalizationRulesFromDaml(
        value.capitalization_definition_rules,
        mechanismField('capitalization_definition_rules')
      );
      return {
        type: 'SAFE_CONVERSION',
        conversion_mfn: Boolean(value.conversion_mfn),
        ...(conversionDiscount !== undefined ? { conversion_discount: conversionDiscount } : {}),
        ...(valuationCap !== undefined ? { conversion_valuation_cap: valuationCap } : {}),
        ...(timing ? { conversion_timing: ocfEnumValue('OcfConversionTimingType', timing, timingPath) } : {}),
        ...(capitalizationDefinition !== undefined ? { capitalization_definition: capitalizationDefinition } : {}),
        ...(capitalizationRules !== undefined ? { capitalization_definition_rules: capitalizationRules } : {}),
        ...(exitMultiple !== undefined ? { exit_multiple: exitMultiple } : {}),
      };
    }
    case 'OcfConvMechPercentCapitalization': {
      const capitalizationDefinition = optionalDescription(value.capitalization_definition);
      const capitalizationRules = optionalCapitalizationRulesFromDaml(
        value.capitalization_definition_rules,
        mechanismField('capitalization_definition_rules')
      );
      return {
        type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
        converts_to_percent: numericFromDaml(value.converts_to_percent, mechanismField('converts_to_percent')),
        ...(capitalizationDefinition !== undefined ? { capitalization_definition: capitalizationDefinition } : {}),
        ...(capitalizationRules !== undefined ? { capitalization_definition_rules: capitalizationRules } : {}),
      };
    }
    case 'OcfConvMechFixedAmount':
      return {
        type: 'FIXED_AMOUNT_CONVERSION',
        converts_to_quantity: numericFromDaml(value.converts_to_quantity, mechanismField('converts_to_quantity')),
      };
    case 'OcfConvMechNote': {
      const rawInterestRates = value.interest_rates;
      if (rawInterestRates === null || rawInterestRates === undefined) {
        throw new OcpValidationError(mechanismField('interest_rates'), 'Interest rates are required for a note', {
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          receivedValue: rawInterestRates,
        });
      }
      if (!Array.isArray(rawInterestRates)) {
        throw new OcpValidationError(mechanismField('interest_rates'), 'Interest rates must be an array', {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'array',
          receivedValue: rawInterestRates,
        });
      }
      const interestRates = rawInterestRates.map((ir: unknown, interestRateIndex: number): ConvertibleInterestRate => {
        const interestRatePath = `${mechanismPath}.interest_rates[${interestRateIndex}]`;
        if (!isRecord(ir)) {
          throw new OcpValidationError(interestRatePath, 'Interest rate must be an object', {
            code: OcpErrorCodes.INVALID_TYPE,
            expectedType: 'object',
            receivedValue: ir,
          });
        }
        if (ir.rate === undefined || ir.rate === null) {
          throw new OcpValidationError(`${interestRatePath}.rate`, 'Required field is missing', {
            code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          });
        }
        const accrualEndDate = optionalDamlDateToDateString(
          ir.accrual_end_date,
          `${interestRatePath}.accrual_end_date`
        );
        return {
          rate: numericFromDaml(ir.rate, `${interestRatePath}.rate`),
          accrual_start_date: damlDateToDateString(ir.accrual_start_date, `${interestRatePath}.accrual_start_date`),
          ...(accrualEndDate !== undefined ? { accrual_end_date: accrualEndDate } : {}),
        };
      });
      const requiredEnum = <T extends string>(field: string, read: (constructor: string, path: string) => T): T => {
        const fieldPath = mechanismField(field);
        const constructor = safeString(value[field], fieldPath);
        if (!constructor) {
          throw new OcpValidationError(fieldPath, `${field} is required for a note`, {
            code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
            receivedValue: value[field],
          });
        }
        return read(constructor, fieldPath);
      };
      const conversionDiscount = optionalNumericFromDaml(
        value.conversion_discount,
        mechanismField('conversion_discount')
      );
      const valuationCap = optionalMonetaryFromDaml(
        value.conversion_valuation_cap,
        mechanismField('conversion_valuation_cap')
      );
      const exitMultiple = optionalExitMultipleFromDaml(value.exit_multiple, mechanismField('exit_multiple'));
      const capitalizationDefinition = optionalDescription(value.capitalization_definition);
      const capitalizationRules = optionalCapitalizationRulesFromDaml(
        value.capitalization_definition_rules,
        mechanismField('capitalization_definition_rules')
      );
      return {
        type: 'CONVERTIBLE_NOTE_CONVERSION',
        interest_rates: interestRates,
        day_count_convention: requiredEnum('day_count_convention', (c, path) =>
          ocfEnumValue('OcfDayCountType', c, path)
        ),
        interest_payout: requiredEnum('interest_payout', (c, path) => ocfEnumValue('OcfInterestPayoutType', c, path)),
        interest_accrual_period: requiredEnum('interest_accrual_period', (c, path) =>
          ocfEnumValue('OcfAccrualPeriodType', c, path)
        ),
        compounding_type: requiredEnum('compounding_type', (c, path) => ocfEnumValue('OcfCompoundingType', c, path)),
        ...(conversionDiscount !== undefined ? { conversion_discount: conversionDiscount } : {}),
        ...(valuationCap !== undefined ? { conversion_valuation_cap: valuationCap } : {}),
        ...(capitalizationDefinition !== undefined ? { capitalization_definition: capitalizationDefinition } : {}),
        ...(capitalizationRules !== undefined ? { capitalization_definition_rules: capitalizationRules } : {}),
        ...(exitMultiple !== undefined ? { exit_multiple: exitMultiple } : {}),
        ...(value.conversion_mfn !== null && value.conversion_mfn !== undefined
          ? { conversion_mfn: Boolean(value.conversion_mfn) }
          : {}),
      };
    }
    case 'OcfConvMechCustom': {
      if (!value.custom_conversion_description) {
        throw new OcpValidationError(
          mechanismField('custom_conversion_description'),
          'Required for CUSTOM_CONVERSION',
          { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
        );
      }
      return {
        type: 'CUSTOM_CONVERSION',
        custom_conversion_description: value.custom_conversion_description as string,
      };
    }
    default:
      throw new OcpParseError(`Unknown convertible conversion mechanism tag: ${String(tag)}`, {
        source: mechanismField('tag'),
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

/** The v35 `OcfConvertibleConversionRight` of a trigger: the right itself, with no variant wrapper. */
function mapConversionRight(rawRight: unknown, rightPath: string): ConvertibleConversionRight {
  if (!rawRight || typeof rawRight !== 'object' || Array.isArray(rawRight)) {
    throw new OcpValidationError(rightPath, 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: rawRight,
    });
  }
  const right = rawRight as Record<string, unknown>;
  return {
    type: 'CONVERTIBLE_CONVERSION_RIGHT',
    conversion_mechanism: mapMechanism(right.conversion_mechanism, `${rightPath}.conversion_mechanism`),
    ...(typeof right.converts_to_future_round === 'boolean'
      ? { converts_to_future_round: right.converts_to_future_round }
      : {}),
    ...(typeof right.converts_to_stock_class_id === 'string' && right.converts_to_stock_class_id.length
      ? { converts_to_stock_class_id: right.converts_to_stock_class_id }
      : {}),
  };
}

const convertTriggers = (ts: unknown[] | undefined): ConvertibleConversionTrigger[] => {
  if (!Array.isArray(ts)) return [];

  return ts.map((raw, idx) => {
    const triggerPath = `convertibleIssuance.conversion_triggers[${idx}]`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new OcpValidationError(triggerPath, 'Expected a conversion trigger object', {
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        expectedType: 'non-null object',
        receivedValue: raw,
      });
    }
    const r = raw as Record<string, unknown>;
    const hasCanonicalType = typeof r.type_ === 'string';
    const tag = hasCanonicalType ? r.type_ : typeof r.tag === 'string' ? r.tag : '';
    const type: ConversionTriggerType = mapDamlTriggerTypeToOcf(
      String(tag),
      `${triggerPath}.${hasCanonicalType ? 'type_' : typeof r.tag === 'string' ? 'tag' : 'type_'}`
    );
    if (typeof r.trigger_id !== 'string' || r.trigger_id.length === 0) {
      throw new OcpValidationError(`${triggerPath}.trigger_id`, 'A non-empty trigger_id is required', {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        expectedType: 'non-empty string',
        receivedValue: r.trigger_id,
      });
    }
    const { trigger_id } = r as { trigger_id: string };
    const nickname: string | undefined = typeof r.nickname === 'string' && r.nickname.length ? r.nickname : undefined;
    const trigger_description: string | undefined =
      typeof r.trigger_description === 'string' && r.trigger_description.length ? r.trigger_description : undefined;
    const triggerFields = triggerFieldsFromDaml(r, type, triggerPath);
    const conversion_right = mapConversionRight(r.conversion_right, `${triggerPath}.conversion_right`);

    const trigger: ConvertibleConversionTrigger = {
      trigger_id,
      conversion_right,
      ...(nickname ? { nickname } : {}),
      ...(trigger_description ? { trigger_description } : {}),
      ...triggerFields,
    };
    return trigger;
  });
};

/** Convert DAML ConvertibleIssuance data to native OCF format */
export function damlConvertibleIssuanceDataToNative(d: Record<string, unknown>): OcfConvertibleIssuance {
  // Validate required fields
  if (typeof d.id !== 'string' || !d.id) {
    throw new OcpValidationError('convertibleIssuance.id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.id,
    });
  }
  if (typeof d.security_id !== 'string' || !d.security_id) {
    throw new OcpValidationError('convertibleIssuance.security_id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.security_id,
    });
  }

  const investmentAmount = d.investment_amount as { amount?: unknown; currency?: unknown } | undefined;

  // Validate investment amount
  if (
    !investmentAmount ||
    (typeof investmentAmount.amount !== 'string' && typeof investmentAmount.amount !== 'number')
  ) {
    throw new OcpValidationError(
      'convertibleIssuance.investment_amount.amount',
      'Required field must be string or number',
      {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        expectedType: 'string | number',
        receivedValue: investmentAmount?.amount,
      }
    );
  }
  if (typeof investmentAmount.currency !== 'string' || !investmentAmount.currency) {
    throw new OcpValidationError(
      'convertibleIssuance.investment_amount.currency',
      'Required field must be a non-empty string',
      {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        expectedType: 'string',
        receivedValue: investmentAmount.currency,
      }
    );
  }

  // Convert to string after validation
  const investmentAmountStr =
    typeof investmentAmount.amount === 'number' ? investmentAmount.amount.toString() : investmentAmount.amount;

  const boardApprovalDate = optionalDamlDateToDateString(
    d.board_approval_date,
    'convertibleIssuance.board_approval_date'
  );
  const stockholderApprovalDate = optionalDamlDateToDateString(
    d.stockholder_approval_date,
    'convertibleIssuance.stockholder_approval_date'
  );

  const issuance = {
    object_type: 'TX_CONVERTIBLE_ISSUANCE',
    id: d.id,
    date: damlDateToDateString(d.date, 'convertibleIssuance.date'),
    security_id: d.security_id,
    custom_id: d.custom_id as string,
    stakeholder_id: d.stakeholder_id as string,
    ...(boardApprovalDate !== undefined ? { board_approval_date: boardApprovalDate } : {}),
    ...(stockholderApprovalDate !== undefined ? { stockholder_approval_date: stockholderApprovalDate } : {}),
    investment_amount: {
      amount: normalizeNumericString(investmentAmountStr),
      currency: investmentAmount.currency,
    },
    ...(typeof d.consideration_text === 'string' && d.consideration_text.length
      ? { consideration_text: d.consideration_text }
      : {}),
    convertible_type: (() => {
      const ct = typeof d.convertible_type === 'string' ? d.convertible_type : '';
      if (!isDamlEnumConstructor('OcfConvertibleType', ct)) {
        throw new OcpValidationError(
          'convertibleIssuance.convertible_type',
          `Unknown or missing convertible_type: ${ct}`,
          {
            code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
            receivedValue: d.convertible_type,
          }
        );
      }
      return ocfEnumValue('OcfConvertibleType', ct, 'convertibleIssuance.convertible_type');
    })(),
    conversion_triggers: convertTriggers(d.conversion_triggers as unknown[]),
    ...(typeof d.pro_rata === 'number' || typeof d.pro_rata === 'string'
      ? {
          pro_rata: normalizeNumericString(typeof d.pro_rata === 'number' ? d.pro_rata.toString() : d.pro_rata),
        }
      : {}),
    seniority: typeof d.seniority === 'number' ? d.seniority : Number(d.seniority),
    security_law_exemptions: d.security_law_exemptions as Array<{
      description: string;
      jurisdiction: string;
    }>,
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments as string[] } : {}),
  } satisfies OcfConvertibleIssuance;

  return issuance;
}

/** Retrieve a ConvertibleIssuance contract and return it as an OCF JSON object */
export async function getConvertibleIssuanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetConvertibleIssuanceAsOcfParams
): Promise<GetConvertibleIssuanceAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getConvertibleIssuanceAsOcf',
  });
  const arg = createArgument;
  if (typeof arg !== 'object' || !('ocf_data' in arg)) {
    throw new OcpParseError('Unexpected createArgument for ConvertibleIssuance', {
      source: 'ConvertibleIssuance.createArgument',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }
  const d = (arg as { ocf_data: Record<string, unknown> }).ocf_data;

  const native = damlConvertibleIssuanceDataToNative(d);
  return { event: native, contractId: params.contractId };
}
