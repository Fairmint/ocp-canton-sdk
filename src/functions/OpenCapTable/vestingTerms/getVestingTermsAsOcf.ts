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
import {
  rejectUnknownGeneratedFields,
  requireGeneratedArray,
  requireGeneratedNonEmptyString,
  requireGeneratedNonEmptyStringArray,
  requireGeneratedRecord,
  requireGeneratedString,
} from '../../../utils/generatedDamlValidation';
import { damlTimeToDateString, isRecord } from '../../../utils/typeConversions';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { decodeLosslessGeneratedDamlValue, type ReadonlyGeneratedDaml } from '../capTable/damlCodecLosslessness';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { validateVestingDamlDataInput } from '../capTable/vestingContractData';
import { readSingleContract } from '../shared/singleContractRead';
import { findVestingGraphIssue } from './vestingGraphValidation';
import { damlVestingPeriodIntegerToNative } from './vestingPeriodInteger';
import {
  damlPositiveVestingNumericToNative,
  damlVestingConditionQuantityToNative,
  damlVestingNumericToNative,
} from './vestingQuantity';

function validateGeneratedVestingPeriod(period: unknown, source: string): void {
  const record = requireGeneratedRecord(period, source);
  rejectUnknownGeneratedFields(record, source, ['tag', 'value']);
  const tag = requireGeneratedString(record.tag, `${source}.tag`);
  const valuePath = `${source}.value`;
  const value = requireGeneratedRecord(record.value, valuePath);
  const commonFields = ['length_', 'occurrences', 'cliff_installment'] as const;
  if (tag === 'OcfVestingPeriodDays') {
    rejectUnknownGeneratedFields(value, valuePath, commonFields);
  } else if (tag === 'OcfVestingPeriodMonths') {
    rejectUnknownGeneratedFields(value, valuePath, [...commonFields, 'day_of_month']);
    requireGeneratedString(value.day_of_month, `${valuePath}.day_of_month`);
  } else {
    throw new OcpParseError('Unknown generated DAML vesting period tag', {
      source: `${source}.tag`,
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      context: { receivedValue: tag },
    });
  }
  requireGeneratedString(value.length_, `${valuePath}.length_`);
  requireGeneratedString(value.occurrences, `${valuePath}.occurrences`);
  if (value.cliff_installment !== null && value.cliff_installment !== undefined) {
    requireGeneratedString(value.cliff_installment, `${valuePath}.cliff_installment`);
  }
}

function validateGeneratedVestingTrigger(trigger: unknown, source: string): void {
  const record = requireGeneratedRecord(trigger, source);
  rejectUnknownGeneratedFields(record, source, ['tag', 'value']);
  const tag = requireGeneratedString(record.tag, `${source}.tag`);
  const valuePath = `${source}.value`;
  if (tag === 'OcfVestingStartTrigger' || tag === 'OcfVestingEventTrigger') {
    const value = requireGeneratedRecord(record.value, valuePath);
    rejectUnknownGeneratedFields(value, valuePath, []);
  } else if (tag === 'OcfVestingScheduleAbsoluteTrigger') {
    const value = requireGeneratedRecord(record.value, valuePath);
    rejectUnknownGeneratedFields(value, valuePath, ['date']);
    requireGeneratedString(value.date, `${valuePath}.date`);
  } else if (tag === 'OcfVestingScheduleRelativeTrigger') {
    const value = requireGeneratedRecord(record.value, valuePath);
    rejectUnknownGeneratedFields(value, valuePath, ['period', 'relative_to_condition_id']);
    validateGeneratedVestingPeriod(value.period, `${valuePath}.period`);
    requireGeneratedNonEmptyString(value.relative_to_condition_id, `${valuePath}.relative_to_condition_id`);
  } else {
    throw new OcpParseError('Unknown generated DAML vesting trigger tag', {
      source: `${source}.tag`,
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      context: { receivedValue: tag },
    });
  }
}

function validateGeneratedVestingTermsData(input: unknown): void {
  const rootPath = 'vestingTerms';
  const data = requireGeneratedRecord(input, rootPath);
  rejectUnknownGeneratedFields(data, rootPath, [
    'id',
    'allocation_type',
    'description',
    'name',
    'comments',
    'vesting_conditions',
  ]);
  requireGeneratedNonEmptyString(data.id, `${rootPath}.id`);
  requireGeneratedString(data.allocation_type, `${rootPath}.allocation_type`);
  requireGeneratedNonEmptyString(data.description, `${rootPath}.description`);
  requireGeneratedNonEmptyString(data.name, `${rootPath}.name`);
  requireGeneratedNonEmptyStringArray(data.comments, `${rootPath}.comments`);
  const conditions = requireGeneratedArray(data.vesting_conditions, `${rootPath}.vesting_conditions`);
  conditions.forEach((condition, index) => {
    const conditionPath = `${rootPath}.vesting_conditions[${index}]`;
    const record = requireGeneratedRecord(condition, conditionPath);
    rejectUnknownGeneratedFields(record, conditionPath, [
      'id',
      'trigger',
      'next_condition_ids',
      'description',
      'portion',
      'quantity',
    ]);
    requireGeneratedNonEmptyString(record.id, `${conditionPath}.id`);
    requireGeneratedNonEmptyStringArray(record.next_condition_ids, `${conditionPath}.next_condition_ids`);
    if (record.description !== null && record.description !== undefined) {
      requireGeneratedNonEmptyString(record.description, `${conditionPath}.description`);
    }
    if (record.portion !== null && record.portion !== undefined) {
      const portionPath = `${conditionPath}.portion`;
      const portion = requireGeneratedRecord(record.portion, portionPath);
      rejectUnknownGeneratedFields(portion, portionPath, ['numerator', 'denominator', 'remainder']);
      requireGeneratedString(portion.numerator, `${portionPath}.numerator`);
      requireGeneratedString(portion.denominator, `${portionPath}.denominator`);
      if (typeof portion.remainder !== 'boolean') {
        throw new OcpParseError('Generated DAML Bool must be a boolean', {
          source: `${portionPath}.remainder`,
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          classification: 'invalid_generated_daml_data',
          context: { expectedType: 'boolean', receivedValue: portion.remainder },
        });
      }
    }
    if (record.quantity !== null && record.quantity !== undefined) {
      requireGeneratedString(record.quantity, `${conditionPath}.quantity`);
    }
    validateGeneratedVestingTrigger(record.trigger, `${conditionPath}.trigger`);
  });
}

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

  return {
    length,
    occurrences,
    ...(cliffInstallment !== undefined ? { cliffInstallment } : {}),
  };
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
    if (typeof relativeToConditionId !== 'string') {
      throw new OcpValidationError(
        `${fieldPath}.relative_to_condition_id`,
        'Missing relative_to_condition_id for OcfVestingScheduleRelativeTrigger',
        {
          code: relativeToConditionId === undefined ? OcpErrorCodes.REQUIRED_FIELD_MISSING : OcpErrorCodes.INVALID_TYPE,
          expectedType: 'non-empty string',
          receivedValue: relativeToConditionId,
        }
      );
    }
    if (relativeToConditionId.length === 0) {
      throw new OcpValidationError(
        `${fieldPath}.relative_to_condition_id`,
        'relative_to_condition_id must be non-empty',
        {
          code: OcpErrorCodes.INVALID_FORMAT,
          expectedType: 'non-empty string',
          receivedValue: relativeToConditionId,
        }
      );
    }

    return {
      type: 'VESTING_SCHEDULE_RELATIVE',
      period: damlVestingPeriodToNative(periodValue as { tag: string; value?: unknown }, `${fieldPath}.period`),
      relative_to_condition_id: relativeToConditionId,
    };
  }

  throw new OcpParseError('Unknown DAML vesting trigger', {
    source: `${fieldPath}.tag`,
    code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
  });
}

type ReadonlyDamlVestingConditionPortion =
  ReadonlyGeneratedDaml<Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingConditionPortion>;

type ReadonlyDamlVestingCondition = ReadonlyGeneratedDaml<Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingCondition>;

type ReadonlyDamlVestingTermsData = ReadonlyGeneratedDaml<Fairmint.OpenCapTable.OCF.VestingTerms.VestingTermsOcfData>;

function damlVestingConditionPortionToNative(
  p: ReadonlyDamlVestingConditionPortion,
  fieldPath: string
): VestingConditionPortion {
  return {
    numerator: damlVestingNumericToNative(p.numerator, `${fieldPath}.numerator`),
    denominator: damlPositiveVestingNumericToNative(p.denominator, `${fieldPath}.denominator`),
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- DAML Optional may serialize as undefined; include false
    ...(p.remainder != null ? { remainder: p.remainder } : {}),
  };
}

function damlVestingConditionToNative(c: ReadonlyDamlVestingCondition, index: number): VestingCondition {
  const conditionPath = `vestingTerms.vesting_conditions[${index}]`;
  const conditionWithId = c as unknown as { id?: unknown };
  if (typeof conditionWithId.id !== 'string') {
    throw new OcpValidationError(`${conditionPath}.id`, 'Required field is missing or invalid', {
      code: conditionWithId.id === undefined ? OcpErrorCodes.REQUIRED_FIELD_MISSING : OcpErrorCodes.INVALID_TYPE,
      expectedType: 'non-empty string',
      receivedValue: conditionWithId.id,
    });
  }
  if (conditionWithId.id.length === 0) {
    throw new OcpValidationError(`${conditionPath}.id`, 'Condition ID must be non-empty', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'non-empty string',
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
    if (typeof nextConditionId !== 'string') {
      throw new OcpValidationError(itemPath, 'Condition ID must be a non-empty string', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'non-empty string',
        receivedValue: nextConditionId,
      });
    }
    if (nextConditionId.length === 0) {
      throw new OcpValidationError(itemPath, 'Condition ID must be a non-empty string', {
        code: OcpErrorCodes.INVALID_FORMAT,
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
    ...(c.description != null ? { description: c.description } : {}),
    trigger: damlVestingTriggerToNative(c.trigger, `${conditionPath}.trigger`),
    next_condition_ids: nextConditionIds,
  };
  const quantity = damlVestingConditionQuantityToNative(c.quantity, `${conditionPath}.quantity`);
  const portionUnknown = c.portion as unknown;
  let portion: VestingConditionPortion | undefined;
  if (portionUnknown !== null && portionUnknown !== undefined) {
    if (isRecord(portionUnknown)) {
      portion = damlVestingConditionPortionToNative(
        portionUnknown as ReadonlyDamlVestingConditionPortion,
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

export function damlVestingTermsDataToNative(d: ReadonlyDamlVestingTermsData): OcfVestingTerms {
  validateVestingDamlDataInput('vestingTerms', d);
  validateGeneratedVestingTermsData(d);
  const data = decodeLosslessGeneratedDamlValue(Fairmint.OpenCapTable.OCF.VestingTerms.VestingTermsOcfData, d, {
    rootPath: 'vestingTerms',
    description: 'vesting terms data',
    decodeSource: 'vestingTerms',
  });
  const allocationType = damlAllocationTypeToNative(data.allocation_type);

  const rawVestingConditions: unknown = data.vesting_conditions;
  if (!Array.isArray(rawVestingConditions)) {
    throw new OcpValidationError('vestingTerms.vesting_conditions', 'Vesting conditions must be an array', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'array',
      receivedValue: rawVestingConditions,
    });
  }
  if (rawVestingConditions.length === 0) {
    throw new OcpValidationError('vestingTerms.vesting_conditions', 'At least one vesting condition is required', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: '[VestingCondition, ...VestingCondition[]]',
      receivedValue: rawVestingConditions,
    });
  }
  const [firstVestingCondition, ...remainingVestingConditions] = data.vesting_conditions;
  if (firstVestingCondition === undefined) {
    throw new OcpValidationError('vestingTerms.vesting_conditions', 'At least one vesting condition is required', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: '[VestingCondition, ...VestingCondition[]]',
      receivedValue: data.vesting_conditions,
    });
  }
  const vestingConditions: NonEmptyArray<VestingCondition> = [
    damlVestingConditionToNative(firstVestingCondition, 0),
    ...remainingVestingConditions.map((condition, index) => damlVestingConditionToNative(condition, index + 1)),
  ];
  const graphIssue = findVestingGraphIssue(vestingConditions);
  if (graphIssue !== undefined) {
    throw new OcpParseError(graphIssue.message, {
      source: graphIssue.fieldPath,
      code: graphIssue.code ?? OcpErrorCodes.INVALID_FORMAT,
      classification: 'invalid_vesting_graph',
      context: {
        expectedType: graphIssue.expectedType,
        receivedValue: graphIssue.receivedValue,
        ...graphIssue.context,
      },
    });
  }

  const result: OcfVestingTerms = {
    object_type: 'VESTING_TERMS',
    id: data.id,
    name: data.name,
    description: data.description,
    allocation_type: allocationType,
    vesting_conditions: vestingConditions,
    ...(data.comments.length > 0 ? { comments: [...data.comments] } : {}),
  };
  return result;
}

export interface GetVestingTermsAsOcfParams extends GetByContractIdParams {}

export interface GetVestingTermsAsOcfResult {
  readonly event: OcfVestingTerms;
  readonly contractId: string;
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
  const { contractId, createArgument } = await readSingleContract(client, params, {
    operation: 'getVestingTermsAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.vestingTerms,
  });
  const vestingTermsData = extractAndDecodeDamlEntityData('vestingTerms', createArgument);
  const event = damlVestingTermsDataToNative(vestingTermsData);

  return { event, contractId };
}
