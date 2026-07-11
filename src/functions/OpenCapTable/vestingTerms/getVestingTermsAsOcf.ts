import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type {
  AllocationType,
  OcfVestingTerms,
  VestingCondition,
  VestingConditionPortion,
  VestingDayOfMonth,
  VestingPeriod,
  VestingTrigger,
} from '../../../types/native';
import { damlTimeToDateString, isRecord, normalizeNumericString } from '../../../utils/typeConversions';
import { readSingleContract } from '../shared/singleContractRead';

function damlAllocationTypeToNative(t: Fairmint.OpenCapTable.OCF.VestingTerms.OcfAllocationType): AllocationType {
  switch (t) {
    case 'OcfAllocationCumulativeRounding':
      return 'CUMULATIVE_ROUNDING';
    case 'OcfAllocationCumulativeRoundDown':
      return 'CUMULATIVE_ROUND_DOWN';
    case 'OcfAllocationFrontLoaded':
      return 'FRONT_LOADED';
    case 'OcfAllocationBackLoaded':
      return 'BACK_LOADED';
    case 'OcfAllocationFrontLoadedToSingleTranche':
      return 'FRONT_LOADED_TO_SINGLE_TRANCHE';
    case 'OcfAllocationBackLoadedToSingleTranche':
      return 'BACK_LOADED_TO_SINGLE_TRANCHE';
    case 'OcfAllocationFractional':
      return 'FRACTIONAL';
    default: {
      const exhaustiveCheck: never = t;
      throw new OcpParseError(`Unknown DAML allocation type: ${String(exhaustiveCheck)}`, {
        source: 'vestingTerms.allocation_type',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}

function mapDamlDayOfMonthToOcf(day: string): VestingDayOfMonth {
  const table: Partial<Record<string, VestingDayOfMonth>> = {
    OcfVestingDay01: '01',
    OcfVestingDay02: '02',
    OcfVestingDay03: '03',
    OcfVestingDay04: '04',
    OcfVestingDay05: '05',
    OcfVestingDay06: '06',
    OcfVestingDay07: '07',
    OcfVestingDay08: '08',
    OcfVestingDay09: '09',
    OcfVestingDay10: '10',
    OcfVestingDay11: '11',
    OcfVestingDay12: '12',
    OcfVestingDay13: '13',
    OcfVestingDay14: '14',
    OcfVestingDay15: '15',
    OcfVestingDay16: '16',
    OcfVestingDay17: '17',
    OcfVestingDay18: '18',
    OcfVestingDay19: '19',
    OcfVestingDay20: '20',
    OcfVestingDay21: '21',
    OcfVestingDay22: '22',
    OcfVestingDay23: '23',
    OcfVestingDay24: '24',
    OcfVestingDay25: '25',
    OcfVestingDay26: '26',
    OcfVestingDay27: '27',
    OcfVestingDay28: '28',
    OcfVestingDay29OrLast: '29_OR_LAST_DAY_OF_MONTH',
    OcfVestingDay30OrLast: '30_OR_LAST_DAY_OF_MONTH',
    OcfVestingDay31OrLast: '31_OR_LAST_DAY_OF_MONTH',
    OcfVestingStartDayOrLast: 'VESTING_START_DAY_OR_LAST_DAY_OF_MONTH',
  };
  const mapped = table[day];
  if (!mapped) {
    throw new OcpParseError(`Unknown DAML vesting day: ${day}`, {
      source: 'vestingPeriod.day_of_month',
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
    });
  }
  return mapped;
}

/**
 * Helper to validate and extract shared vesting period fields (length, occurrences, cliff_installment).
 */
function parseVestingPeriodCommonFields(v: Record<string, unknown>): {
  length: number;
  occurrences: number;
  cliffInstallment?: number;
} {
  const parseNumericLike = (fieldPath: string, raw: unknown): number => {
    const isNumericString = typeof raw === 'string' && /^-?\d+(\.\d+)?$/.test(raw);
    if (typeof raw !== 'number' && !isNumericString) {
      throw new OcpValidationError(fieldPath, 'Invalid numeric value format', {
        code: OcpErrorCodes.INVALID_FORMAT,
        receivedValue: raw,
      });
    }

    const parsed = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(parsed)) {
      throw new OcpValidationError(fieldPath, 'Invalid numeric value format', {
        code: OcpErrorCodes.INVALID_FORMAT,
        receivedValue: raw,
      });
    }

    return parsed;
  };

  const lengthRaw = v.length_;
  if (lengthRaw === undefined || lengthRaw === null) {
    throw new OcpValidationError('vestingPeriod.length', 'Missing vesting period length', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });
  }
  const length = parseNumericLike('vestingPeriod.length', lengthRaw);
  if (length <= 0) {
    throw new OcpValidationError('vestingPeriod.length', 'Invalid vesting period length', {
      code: OcpErrorCodes.INVALID_FORMAT,
      receivedValue: lengthRaw,
    });
  }

  const occRaw = v.occurrences;
  if (occRaw === undefined || occRaw === null) {
    throw new OcpValidationError('vestingPeriod.occurrences', 'Missing vesting period occurrences', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });
  }
  const occurrences = parseNumericLike('vestingPeriod.occurrences', occRaw);
  if (occurrences < 1) {
    throw new OcpValidationError('vestingPeriod.occurrences', 'Invalid vesting period occurrences', {
      code: OcpErrorCodes.INVALID_FORMAT,
      receivedValue: occRaw,
    });
  }

  const cliffInstallment =
    v.cliff_installment !== null && v.cliff_installment !== undefined
      ? parseNumericLike('vestingPeriod.cliff_installment', v.cliff_installment)
      : undefined;

  return { length, occurrences, cliffInstallment };
}

function damlVestingPeriodToNative(p: { tag: string; value?: Record<string, unknown> }): VestingPeriod {
  if (p.tag === 'OcfVestingPeriodDays') {
    const v = p.value ?? {};
    const { length, occurrences, cliffInstallment } = parseVestingPeriodCommonFields(v);
    return {
      type: 'DAYS',
      length,
      occurrences,
      ...(cliffInstallment !== undefined ? { cliff_installment: cliffInstallment } : {}),
    };
  }
  if (p.tag === 'OcfVestingPeriodMonths') {
    const v = p.value ?? {};
    const { length, occurrences, cliffInstallment } = parseVestingPeriodCommonFields(v);
    if (v.day_of_month === undefined || v.day_of_month === null) {
      throw new OcpValidationError('vestingPeriod.day_of_month', 'Missing vesting period day_of_month for MONTHS', {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      });
    }
    const dayOfMonth = v.day_of_month;
    if (typeof dayOfMonth !== 'string') {
      throw new OcpValidationError('vestingPeriod.day_of_month', 'day_of_month must be a string', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'string',
        receivedValue: dayOfMonth,
      });
    }
    return {
      type: 'MONTHS',
      length,
      occurrences,
      day_of_month: mapDamlDayOfMonthToOcf(dayOfMonth),
      ...(cliffInstallment !== undefined ? { cliff_installment: cliffInstallment } : {}),
    };
  }
  throw new OcpParseError('Unknown DAML vesting period', {
    source: 'vestingPeriod.tag',
    code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
  });
}

function damlVestingTriggerToNative(value: unknown, fieldPath: string): VestingTrigger {
  const trigger = typeof value === 'string' ? undefined : isRecord(value) ? value : undefined;
  if (typeof value !== 'string' && trigger === undefined) {
    throw new OcpValidationError(fieldPath, 'Vesting trigger must be a string or object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string | object',
      receivedValue: value,
    });
  }
  const tag: string | undefined =
    typeof value === 'string' ? value : typeof trigger?.tag === 'string' ? trigger.tag : undefined;

  if (tag === 'OcfVestingStartTrigger') {
    return { type: 'VESTING_START_DATE' };
  }

  if (tag === 'OcfVestingEventTrigger') {
    return { type: 'VESTING_EVENT' };
  }

  if (tag === 'OcfVestingScheduleAbsoluteTrigger') {
    const triggerValue = trigger?.value;
    if (!isRecord(triggerValue))
      throw new OcpValidationError(`${fieldPath}.value`, 'Missing value for OcfVestingScheduleAbsoluteTrigger', {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        receivedValue: triggerValue,
      });
    return {
      type: 'VESTING_SCHEDULE_ABSOLUTE',
      date: damlTimeToDateString(triggerValue.date, `${fieldPath}.date`),
    };
  }

  if (tag === 'OcfVestingScheduleRelativeTrigger') {
    const triggerValue = trigger?.value;
    if (!isRecord(triggerValue)) {
      throw new OcpValidationError(`${fieldPath}.value`, 'Invalid value for OcfVestingScheduleRelativeTrigger', {
        code: OcpErrorCodes.INVALID_TYPE,
        receivedValue: triggerValue,
      });
    }
    const periodValue = triggerValue.period;
    if (
      !periodValue ||
      typeof periodValue !== 'object' ||
      !('tag' in periodValue) ||
      typeof periodValue.tag !== 'string'
    ) {
      throw new OcpValidationError(`${fieldPath}.period`, 'Invalid period in OcfVestingScheduleRelativeTrigger', {
        code: OcpErrorCodes.INVALID_TYPE,
        receivedValue: periodValue,
      });
    }
    const relativeToConditionId = triggerValue.relative_to_condition_id;
    if (typeof relativeToConditionId !== 'string' || relativeToConditionId.length === 0) {
      throw new OcpValidationError(
        `${fieldPath}.relative_to_condition_id`,
        'Missing relative_to_condition_id for OcfVestingScheduleRelativeTrigger',
        { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, receivedValue: relativeToConditionId }
      );
    }

    return {
      type: 'VESTING_SCHEDULE_RELATIVE',
      period: damlVestingPeriodToNative(periodValue as { tag: string; value?: Record<string, unknown> }),
      relative_to_condition_id: relativeToConditionId,
    };
  }

  throw new OcpParseError('Unknown DAML vesting trigger', {
    source: `${fieldPath}.tag`,
    code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
  });
}

function damlVestingConditionPortionToNative(value: unknown, fieldPath: string): VestingConditionPortion {
  if (!isRecord(value)) {
    throw new OcpValidationError(fieldPath, 'Vesting condition portion must be an object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'object',
      receivedValue: value,
    });
  }
  if (value.remainder !== null && value.remainder !== undefined && typeof value.remainder !== 'boolean') {
    throw new OcpValidationError(`${fieldPath}.remainder`, 'Vesting condition remainder must be a boolean', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'boolean',
      receivedValue: value.remainder,
    });
  }
  const normalizePortionValue = (raw: unknown, path: string): string => {
    if (typeof raw !== 'string' && typeof raw !== 'number') {
      throw new OcpValidationError(path, 'Vesting condition portion must be a string or number', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'string | number',
        receivedValue: raw,
      });
    }
    return normalizeNumericString(raw, path);
  };
  return {
    numerator: normalizePortionValue(value.numerator, `${fieldPath}.numerator`),
    denominator: normalizePortionValue(value.denominator, `${fieldPath}.denominator`),
    ...(value.remainder != null ? { remainder: value.remainder } : {}),
  };
}

function damlVestingConditionToNative(value: unknown, index: number): VestingCondition {
  const fieldPath = `vestingTerms.vesting_conditions[${index}]`;
  if (!isRecord(value)) {
    throw new OcpValidationError(fieldPath, 'Vesting condition must be an object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'object',
      receivedValue: value,
    });
  }
  const c = value as unknown as Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingCondition;
  const conditionWithId = value as { id?: string };
  const native: VestingCondition = {
    id: conditionWithId.id ?? '',
    ...(c.description && { description: c.description }),
    ...(c.quantity && { quantity: normalizeNumericString(c.quantity) }),
    trigger: damlVestingTriggerToNative(c.trigger, `vestingTerms.vesting_conditions[${index}].trigger`),
    next_condition_ids: c.next_condition_ids,
  };
  const portionUnknown = c.portion as unknown;
  if (portionUnknown !== null && portionUnknown !== undefined) {
    if (
      typeof portionUnknown === 'object' &&
      'tag' in portionUnknown &&
      portionUnknown.tag === 'Some' &&
      'value' in portionUnknown
    ) {
      const { value: portionValue } = portionUnknown as {
        value: Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingConditionPortion;
      };
      native.portion = damlVestingConditionPortionToNative(portionValue, `${fieldPath}.portion.value`);
    } else if (typeof portionUnknown === 'object') {
      native.portion = damlVestingConditionPortionToNative(portionUnknown, `${fieldPath}.portion`);
    } else {
      throw new OcpValidationError(`${fieldPath}.portion`, 'Vesting condition portion must be an object', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'object',
        receivedValue: portionUnknown,
      });
    }
  }
  return native;
}

export function damlVestingTermsDataToNative(
  value: Fairmint.OpenCapTable.OCF.VestingTerms.VestingTermsOcfData
): OcfVestingTerms;
export function damlVestingTermsDataToNative(value: unknown): OcfVestingTerms {
  if (!isRecord(value)) {
    throw new OcpValidationError('vestingTerms', 'Vesting terms data must be an object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'object',
      receivedValue: value,
    });
  }
  const d = value as unknown as Fairmint.OpenCapTable.OCF.VestingTerms.VestingTermsOcfData;
  const dataWithId = value as { id?: string };

  // Validate required fields - fail fast if missing
  if (typeof dataWithId.id !== 'string' || dataWithId.id.length === 0) {
    throw new OcpValidationError('vestingTerms.id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: dataWithId.id,
    });
  }
  if (!d.name) {
    throw new OcpValidationError('vestingTerms.name', 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.name,
    });
  }
  if (!d.description) {
    throw new OcpValidationError('vestingTerms.description', 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.description,
    });
  }

  const comments = Array.isArray((d as unknown as { comments?: unknown }).comments)
    ? (d as unknown as { comments: string[] }).comments
    : [];
  const vestingConditions = value.vesting_conditions;
  if (!Array.isArray(vestingConditions)) {
    throw new OcpValidationError('vestingTerms.vesting_conditions', 'Vesting conditions must be an array', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'array',
      receivedValue: vestingConditions,
    });
  }

  return {
    object_type: 'VESTING_TERMS',
    id: dataWithId.id,
    name: d.name,
    description: d.description,
    allocation_type: damlAllocationTypeToNative(d.allocation_type),
    vesting_conditions: vestingConditions.map(damlVestingConditionToNative),
    ...(comments.length > 0 ? { comments } : {}),
  };
}

export interface GetVestingTermsAsOcfParams extends GetByContractIdParams {}

export interface GetVestingTermsAsOcfResult {
  vestingTerms: OcfVestingTerms;
  contractId: string;
}

/**
 * Retrieve vesting terms and return them as an OCF JSON object
 *
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/VestingTerms.schema.json
 */
export async function getVestingTermsAsOcf(
  client: LedgerJsonApiClient,
  params: GetVestingTermsAsOcfParams
): Promise<GetVestingTermsAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getVestingTermsAsOcf',
    expectedTemplateId: Fairmint.OpenCapTable.OCF.VestingTerms.VestingTerms.templateId,
  });

  function hasData(
    arg: unknown
  ): arg is { vesting_terms_data: Fairmint.OpenCapTable.OCF.VestingTerms.VestingTermsOcfData } {
    return isRecord(arg) && isRecord(arg.vesting_terms_data);
  }
  if (!hasData(createArgument)) {
    throw new OcpParseError('Vesting terms data not found in contract create argument', {
      source: 'VestingTerms.createArgument',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

  const vestingTerms = damlVestingTermsDataToNative(createArgument.vesting_terms_data);

  return { vestingTerms, contractId: params.contractId };
}
