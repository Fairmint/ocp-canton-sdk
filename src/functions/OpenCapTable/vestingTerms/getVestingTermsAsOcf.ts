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
import { damlTimeToDateString, toNonEmptyArray } from '../../../utils/typeConversions';
import { validateRequiredString } from '../../../utils/validation';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlVestingNumericToNative } from './vestingQuantity';
import { validateVestingTermsGraph } from './vestingTermsValidation';

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
  periodPath: string
): {
  length: number;
  occurrences: number;
  cliffInstallment?: number;
} {
  const parseDamlInteger = (fieldPath: string, raw: unknown, minimum: number): number => {
    if (typeof raw !== 'string' || !/^-?\d+$/.test(raw)) {
      throw new OcpValidationError(fieldPath, 'Invalid DAML Int value', {
        code: OcpErrorCodes.INVALID_FORMAT,
        expectedType: `DAML Int string >= ${minimum}`,
        receivedValue: raw,
      });
    }

    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed < minimum) {
      throw new OcpValidationError(fieldPath, `Must be a safe integer greater than or equal to ${minimum}`, {
        code: OcpErrorCodes.INVALID_FORMAT,
        expectedType: `safe integer >= ${minimum}`,
        receivedValue: raw,
      });
    }

    return parsed;
  };

  const lengthRaw = v.length_;
  if (lengthRaw === undefined || lengthRaw === null) {
    throw new OcpValidationError(`${periodPath}.length`, 'Missing vesting period length', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });
  }
  // Mirror the on-ledger VestingTerms invariant: period length is strictly positive.
  const length = parseDamlInteger(`${periodPath}.length`, lengthRaw, 1);

  const occRaw = v.occurrences;
  if (occRaw === undefined || occRaw === null) {
    throw new OcpValidationError(`${periodPath}.occurrences`, 'Missing vesting period occurrences', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });
  }
  const occurrences = parseDamlInteger(`${periodPath}.occurrences`, occRaw, 1);

  const cliffInstallment =
    v.cliff_installment !== null && v.cliff_installment !== undefined
      ? parseDamlInteger(`${periodPath}.cliff_installment`, v.cliff_installment, 0)
      : undefined;

  return {
    length,
    occurrences,
    ...(cliffInstallment !== undefined ? { cliffInstallment } : {}),
  };
}

function damlVestingPeriodToNative(
  p: Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingPeriod,
  periodPath: string
): VestingPeriod {
  switch (p.tag) {
    case 'OcfVestingPeriodDays': {
      const v = p.value as unknown as Record<string, unknown>;
      const { length, occurrences, cliffInstallment } = parseVestingPeriodCommonFields(v, periodPath);
      return {
        type: 'DAYS',
        length,
        occurrences,
        ...(cliffInstallment !== undefined ? { cliff_installment: cliffInstallment } : {}),
      };
    }
    case 'OcfVestingPeriodMonths': {
      const v = p.value as unknown as Record<string, unknown>;
      const { length, occurrences, cliffInstallment } = parseVestingPeriodCommonFields(v, periodPath);
      if (v.day_of_month === undefined || v.day_of_month === null) {
        throw new OcpValidationError(`${periodPath}.day_of_month`, 'Missing vesting period day_of_month for MONTHS', {
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        });
      }
      const dayOfMonth = v.day_of_month;
      if (typeof dayOfMonth !== 'string') {
        throw new OcpValidationError(`${periodPath}.day_of_month`, 'day_of_month must be a string', {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'string',
          receivedValue: dayOfMonth,
        });
      }
      return {
        type: 'MONTHS',
        length,
        occurrences,
        day_of_month: mapDamlDayOfMonthToOcf(dayOfMonth, `${periodPath}.day_of_month`),
        ...(cliffInstallment !== undefined ? { cliff_installment: cliffInstallment } : {}),
      };
    }
  }
}

function damlVestingTriggerToNative(
  t: Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingTrigger,
  triggerPath: string
): VestingTrigger {
  switch (t.tag) {
    case 'OcfVestingStartTrigger':
      return { type: 'VESTING_START_DATE' };
    case 'OcfVestingEventTrigger':
      return { type: 'VESTING_EVENT' };
    case 'OcfVestingScheduleAbsoluteTrigger':
      return {
        type: 'VESTING_SCHEDULE_ABSOLUTE',
        date: damlTimeToDateString(t.value.date, `${triggerPath}.date`),
      };
    case 'OcfVestingScheduleRelativeTrigger': {
      const { period, relative_to_condition_id: relativeToConditionId } = t.value;
      if (relativeToConditionId.length === 0) {
        throw new OcpValidationError(
          `${triggerPath}.relative_to_condition_id`,
          'Missing relative_to_condition_id for OcfVestingScheduleRelativeTrigger',
          { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, receivedValue: relativeToConditionId }
        );
      }

      return {
        type: 'VESTING_SCHEDULE_RELATIVE',
        period: damlVestingPeriodToNative(period, `${triggerPath}.period`),
        relative_to_condition_id: relativeToConditionId,
      };
    }
  }
}

function damlVestingConditionPortionToNative(
  p: Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingConditionPortion,
  fieldPath: string
): VestingConditionPortion {
  const numerator = damlVestingNumericToNative(p.numerator, `${fieldPath}.numerator`);
  const denominator = damlVestingNumericToNative(p.denominator, `${fieldPath}.denominator`);
  if (denominator === '0') {
    throw new OcpValidationError(`${fieldPath}.denominator`, 'Vesting portion denominator must be greater than zero', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'positive DAML Numeric 10 value',
      receivedValue: p.denominator,
    });
  }
  return {
    numerator,
    denominator,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- DAML Optional may serialize as undefined; include false
    ...(p.remainder != null ? { remainder: p.remainder } : {}),
  };
}

function damlVestingConditionToNative(
  c: Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingCondition,
  index: number
): VestingCondition {
  const conditionPath = `vestingTerms.vesting_conditions[${index}]`;
  const { id: generatedId } = c;
  const id: unknown = generatedId;
  if (typeof id !== 'string' || id.length === 0) {
    throw new OcpValidationError(`${conditionPath}.id`, 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: id,
    });
  }

  if (c.description != null) {
    validateRequiredString(c.description, `${conditionPath}.description`);
  }

  const common = {
    id,
    ...(c.description && { description: c.description }),
    trigger: damlVestingTriggerToNative(c.trigger, `${conditionPath}.trigger`),
    next_condition_ids: c.next_condition_ids,
  };
  const quantity = c.quantity == null ? undefined : damlVestingNumericToNative(c.quantity, `${conditionPath}.quantity`);
  const portion =
    c.portion == null ? undefined : damlVestingConditionPortionToNative(c.portion, `${conditionPath}.portion`);

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
  const { id: generatedId } = d;
  const id: unknown = generatedId;

  // Validate required fields - fail fast if missing
  if (typeof id !== 'string' || id.length === 0) {
    throw new OcpValidationError('vestingTerms.id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: id,
    });
  }
  validateRequiredString(d.name, 'vestingTerms.name');
  validateRequiredString(d.description, 'vestingTerms.description');
  d.comments.forEach((comment, index) => validateRequiredString(comment, `vestingTerms.comments[${index}]`));

  const vestingConditions = toNonEmptyArray(
    d.vesting_conditions.map(damlVestingConditionToNative),
    'vestingTerms.vesting_conditions'
  );
  validateVestingTermsGraph(vestingConditions);

  return {
    object_type: 'VESTING_TERMS',
    id,
    name: d.name,
    description: d.description,
    allocation_type: damlAllocationTypeToNative(d.allocation_type),
    vesting_conditions: vestingConditions,
    ...(d.comments.length > 0 ? { comments: d.comments } : {}),
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

  const vestingTermsData = extractAndDecodeDamlEntityData('vestingTerms', createArgument);
  const vestingTerms = damlVestingTermsDataToNative(vestingTermsData);

  return { vestingTerms, contractId: params.contractId };
}
