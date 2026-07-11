import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type {
  AllocationType,
  NonEmptyArray,
  OcfVestingTerms,
  VestingCondition,
  VestingConditionPortion,
  VestingDayOfMonth,
  VestingPeriod,
  VestingTrigger,
} from '../../../types/native';
import { damlTimeToDateString, isRecord, normalizeNumericString } from '../../../utils/typeConversions';
import { readSingleContract } from '../shared/singleContractRead';
import { damlVestingPeriodIntegerToNative } from './vestingPeriodInteger';
import { damlVestingConditionQuantityToNative } from './vestingQuantity';

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

function mapDamlDayOfMonthToOcf(day: string, fieldPath: string): VestingDayOfMonth {
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
      source: fieldPath,
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
    });
  }
  return mapped;
}

/**
 * Helper to validate and extract shared vesting period fields (length, occurrences, cliff_installment).
 */
function parseVestingPeriodCommonFields(
  v: Record<string, unknown>,
  fieldPath: string
): {
  length: number;
  occurrences: number;
  cliffInstallment?: number;
} {
  const length = damlVestingPeriodIntegerToNative(v.length_, `${fieldPath}.length`, 1);
  const occurrences = damlVestingPeriodIntegerToNative(v.occurrences, `${fieldPath}.occurrences`, 1);

  const cliffInstallment =
    v.cliff_installment !== null && v.cliff_installment !== undefined
      ? damlVestingPeriodIntegerToNative(v.cliff_installment, `${fieldPath}.cliff_installment`, 0)
      : undefined;

  return { length, occurrences, cliffInstallment };
}

function requireVestingPeriodValue(value: unknown, fieldPath: string): Record<string, unknown> {
  if (value === undefined) {
    throw new OcpValidationError(fieldPath, 'Required generated DAML vesting period value is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'generated DAML vesting period record',
      receivedValue: value,
    });
  }
  if (!isRecord(value)) {
    throw new OcpValidationError(fieldPath, 'Generated DAML vesting period value must be an object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'generated DAML vesting period record',
      receivedValue: value,
    });
  }
  return value;
}

function rejectUnknownVestingPeriodFields(
  value: Record<string, unknown>,
  fieldPath: string,
  allowedFields: readonly string[]
): void {
  const allowed = new Set(allowedFields);
  const unexpectedField = Object.keys(value).find((field) => !allowed.has(field));
  if (unexpectedField !== undefined) {
    throw new OcpValidationError(`${fieldPath}.${unexpectedField}`, 'Unexpected generated DAML vesting period field', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      expectedType: `only ${allowedFields.join(', ')}`,
      receivedValue: value[unexpectedField],
    });
  }
}

function damlVestingPeriodToNative(p: { tag: string; value?: unknown }, fieldPath: string): VestingPeriod {
  if (p.tag === 'OcfVestingPeriodDays') {
    const valuePath = `${fieldPath}.value`;
    const v = requireVestingPeriodValue(p.value, valuePath);
    rejectUnknownVestingPeriodFields(v, valuePath, ['length_', 'occurrences', 'cliff_installment']);
    const { length, occurrences, cliffInstallment } = parseVestingPeriodCommonFields(v, fieldPath);
    return {
      type: 'DAYS',
      length,
      occurrences,
      ...(cliffInstallment !== undefined ? { cliff_installment: cliffInstallment } : {}),
    };
  }
  if (p.tag === 'OcfVestingPeriodMonths') {
    const valuePath = `${fieldPath}.value`;
    const v = requireVestingPeriodValue(p.value, valuePath);
    rejectUnknownVestingPeriodFields(v, valuePath, ['length_', 'occurrences', 'day_of_month', 'cliff_installment']);
    const { length, occurrences, cliffInstallment } = parseVestingPeriodCommonFields(v, fieldPath);
    if (v.day_of_month === undefined) {
      throw new OcpValidationError(`${fieldPath}.day_of_month`, 'Missing vesting period day_of_month for MONTHS', {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        receivedValue: v.day_of_month,
      });
    }
    const dayOfMonth = v.day_of_month;
    if (typeof dayOfMonth !== 'string') {
      throw new OcpValidationError(`${fieldPath}.day_of_month`, 'day_of_month must be a string', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'string',
        receivedValue: dayOfMonth,
      });
    }
    return {
      type: 'MONTHS',
      length,
      occurrences,
      day_of_month: mapDamlDayOfMonthToOcf(dayOfMonth, `${fieldPath}.day_of_month`),
      ...(cliffInstallment !== undefined ? { cliff_installment: cliffInstallment } : {}),
    };
  }
  throw new OcpParseError('Unknown DAML vesting period', {
    source: `${fieldPath}.type`,
    code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
  });
}

function damlVestingTriggerToNative(t: unknown, fieldPath: string): VestingTrigger {
  const triggerRecord = t !== null && typeof t === 'object' ? (t as Record<string, unknown>) : undefined;
  const tag: string | undefined =
    typeof t === 'string' ? t : typeof triggerRecord?.tag === 'string' ? triggerRecord.tag : undefined;

  if (tag === 'OcfVestingStartTrigger') {
    return { type: 'VESTING_START_DATE' };
  }

  if (tag === 'OcfVestingEventTrigger') {
    return { type: 'VESTING_EVENT' };
  }

  if (tag === 'OcfVestingScheduleAbsoluteTrigger') {
    const value = triggerRecord?.value;
    if (!value || typeof value !== 'object')
      throw new OcpValidationError(`${fieldPath}.value`, 'Missing value for OcfVestingScheduleAbsoluteTrigger', {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        receivedValue: value,
      });
    const valueRecord = value as Record<string, unknown>;
    return {
      type: 'VESTING_SCHEDULE_ABSOLUTE',
      date: damlTimeToDateString(valueRecord.date, `${fieldPath}.date`),
    };
  }

  if (tag === 'OcfVestingScheduleRelativeTrigger') {
    const value = triggerRecord?.value;
    if (!value || typeof value !== 'object') {
      throw new OcpValidationError(`${fieldPath}.value`, 'Invalid value for OcfVestingScheduleRelativeTrigger', {
        code: OcpErrorCodes.INVALID_TYPE,
        receivedValue: value,
      });
    }
    const valueRecord = value as Record<string, unknown>;
    const periodValue = valueRecord.period;
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
    const relativeToConditionId = valueRecord.relative_to_condition_id;
    if (typeof relativeToConditionId !== 'string' || relativeToConditionId.length === 0) {
      throw new OcpValidationError(
        `${fieldPath}.relative_to_condition_id`,
        'Missing relative_to_condition_id for OcfVestingScheduleRelativeTrigger',
        { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, receivedValue: relativeToConditionId }
      );
    }

    return {
      type: 'VESTING_SCHEDULE_RELATIVE',
      period: damlVestingPeriodToNative(periodValue as { tag: string; value?: unknown }, `${fieldPath}.period`),
      relative_to_condition_id: relativeToConditionId,
    };
  }

  throw new OcpParseError('Unknown DAML vesting trigger', {
    source: `${fieldPath}.type`,
    code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
  });
}

function damlVestingConditionPortionToNative(
  p: Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingConditionPortion,
  fieldPath: string
): VestingConditionPortion {
  return {
    numerator: normalizeNumericString(p.numerator, `${fieldPath}.numerator`),
    denominator: normalizeNumericString(p.denominator, `${fieldPath}.denominator`),
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- DAML Optional may serialize as undefined; include false
    ...(p.remainder != null ? { remainder: p.remainder } : {}),
  };
}

function damlVestingConditionToNative(
  c: Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingCondition,
  index: number
): VestingCondition {
  const conditionPath = `vestingTerms.vesting_conditions[${index}]`;
  const conditionWithId = c as unknown as { id?: string };
  if (typeof conditionWithId.id !== 'string' || conditionWithId.id.length === 0) {
    throw new OcpValidationError(`${conditionPath}.id`, 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: conditionWithId.id,
    });
  }

  const rawNextConditionIds: unknown = c.next_condition_ids;
  if (!Array.isArray(rawNextConditionIds)) {
    throw new OcpValidationError(`${conditionPath}.next_condition_ids`, 'Expected an array of condition IDs', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string[]',
      receivedValue: rawNextConditionIds,
    });
  }
  const nextConditionIds: string[] = [];
  const firstIndexes = new Map<string, number>();
  rawNextConditionIds.forEach((nextConditionId, nextIndex) => {
    const itemPath = `${conditionPath}.next_condition_ids[${nextIndex}]`;
    if (typeof nextConditionId !== 'string' || nextConditionId.length === 0) {
      throw new OcpValidationError(itemPath, 'Condition ID must be a non-empty string', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'non-empty string',
        receivedValue: nextConditionId,
      });
    }
    const firstIndex = firstIndexes.get(nextConditionId);
    if (firstIndex !== undefined) {
      throw new OcpValidationError(itemPath, 'Duplicate next condition ID', {
        code: OcpErrorCodes.INVALID_FORMAT,
        expectedType: 'unique condition IDs',
        receivedValue: nextConditionId,
        context: { firstIndex },
      });
    }
    firstIndexes.set(nextConditionId, nextIndex);
    nextConditionIds.push(nextConditionId);
  });

  const common = {
    id: conditionWithId.id,
    ...(c.description && { description: c.description }),
    trigger: damlVestingTriggerToNative(c.trigger, `${conditionPath}.trigger`),
    next_condition_ids: nextConditionIds,
  };
  const quantity = damlVestingConditionQuantityToNative(c.quantity, `${conditionPath}.quantity`);
  const portionUnknown = c.portion as unknown;
  let portion: VestingConditionPortion | undefined;
  if (portionUnknown) {
    if (
      typeof portionUnknown === 'object' &&
      'tag' in portionUnknown &&
      portionUnknown.tag === 'Some' &&
      'value' in portionUnknown
    ) {
      const { value } = portionUnknown as Record<string, unknown>;
      if (value === null || typeof value !== 'object') {
        throw new OcpValidationError(`${conditionPath}.portion`, 'Invalid vesting condition portion', {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'portion object or omitted',
          receivedValue: value,
        });
      }
      portion = damlVestingConditionPortionToNative(
        value as Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingConditionPortion,
        `${conditionPath}.portion`
      );
    } else if (typeof portionUnknown === 'object') {
      portion = damlVestingConditionPortionToNative(
        portionUnknown as Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingConditionPortion,
        `${conditionPath}.portion`
      );
    } else {
      throw new OcpValidationError(`${conditionPath}.portion`, 'Invalid vesting condition portion', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'portion object or omitted',
        receivedValue: portionUnknown,
      });
    }
  }

  if (portion !== undefined && quantity === undefined) return { ...common, portion };
  if (quantity !== undefined && portion === undefined) return { ...common, quantity };

  throw new OcpValidationError(conditionPath, 'Exactly one of portion or quantity is required', {
    code: portion === undefined ? OcpErrorCodes.REQUIRED_FIELD_MISSING : OcpErrorCodes.INVALID_FORMAT,
    expectedType: 'exactly one of portion or quantity',
    receivedValue: { portion: c.portion, quantity: c.quantity },
  });
}

export function damlVestingTermsDataToNative(
  d: Fairmint.OpenCapTable.OCF.VestingTerms.VestingTermsOcfData
): OcfVestingTerms {
  const dataWithId = d as unknown as { id?: string };

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

  const rawVestingConditions: unknown = d.vesting_conditions;
  if (!Array.isArray(rawVestingConditions) || rawVestingConditions.length === 0) {
    throw new OcpValidationError('vestingTerms.vesting_conditions', 'At least one vesting condition is required', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: '[VestingCondition, ...VestingCondition[]]',
      receivedValue: rawVestingConditions,
    });
  }
  const [firstVestingCondition, ...remainingVestingConditions] = d.vesting_conditions;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- required under noUncheckedIndexedAccess
  if (firstVestingCondition === undefined) {
    throw new OcpValidationError('vestingTerms.vesting_conditions', 'At least one vesting condition is required', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: '[VestingCondition, ...VestingCondition[]]',
      receivedValue: d.vesting_conditions,
    });
  }
  const vestingConditions: NonEmptyArray<VestingCondition> = [
    damlVestingConditionToNative(firstVestingCondition, 0),
    ...remainingVestingConditions.map((condition, index) => damlVestingConditionToNative(condition, index + 1)),
  ];

  const comments = Array.isArray((d as unknown as { comments?: unknown }).comments)
    ? (d as unknown as { comments: string[] }).comments
    : [];

  return {
    object_type: 'VESTING_TERMS',
    id: dataWithId.id,
    name: d.name,
    description: d.description,
    allocation_type: damlAllocationTypeToNative(d.allocation_type),
    vesting_conditions: vestingConditions,
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
    const record = arg as Record<string, unknown>;
    return (
      typeof arg === 'object' &&
      arg !== null &&
      'vesting_terms_data' in record &&
      typeof record.vesting_terms_data === 'object'
    );
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
