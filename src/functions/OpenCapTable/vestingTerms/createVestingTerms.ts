import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type {
  AllocationType,
  OcfVestingTerms,
  VestingCondition,
  VestingConditionPortion,
  VestingPeriod,
  VestingTrigger,
} from '../../../types';
import type { PkgVestingTermsOcfData } from '../../../types/daml';
import { damlEnumConstructor, isOcfEnumValue } from '../../../utils/damlEnums';
import { canonicalizeOcfNumeric10 } from '../../../utils/numeric10';
import { assertSafeOcfJson } from '../../../utils/ocfJsonValidation';
import { parseOcfEntityInput } from '../../../utils/ocfZodSchemas';
import { cleanComments, dateStringToDAMLDate, optionalString } from '../../../utils/typeConversions';
import { findVestingGraphIssue } from './vestingGraphValidation';
import { ocfVestingPeriodIntegerToDaml } from './vestingPeriodInteger';
import { ocfVestingConditionQuantityToDaml } from './vestingQuantity';

function allocationTypeToDaml(t: AllocationType): Fairmint.OpenCapTable.OCF.VestingTerms.OcfAllocationType {
  if (typeof t !== 'string') {
    throw new OcpValidationError('vestingTerms.allocation_type', 'Allocation type must be a string', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'AllocationType',
      receivedValue: t,
    });
  }
  return damlEnumConstructor('OcfAllocationType', t, 'vestingTerms.allocation_type');
}

function mapOcfDayOfMonthToDaml(
  day: string,
  fieldPath: string
): Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingDayOfMonth {
  const d = day.toString().toUpperCase();
  if (!isOcfEnumValue('OcfVestingDayOfMonth', d)) {
    throw new OcpValidationError(fieldPath, 'Invalid vesting relative period day_of_month', {
      code: OcpErrorCodes.INVALID_FORMAT,
      receivedValue: day,
    });
  }
  return damlEnumConstructor('OcfVestingDayOfMonth', d, fieldPath);
}

function vestingTriggerToDaml(
  t: VestingTrigger,
  fieldPath: string
): Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingTrigger {
  const triggerUnknown: unknown = t;
  if (triggerUnknown === null || typeof triggerUnknown !== 'object' || Array.isArray(triggerUnknown)) {
    throw new OcpValidationError(fieldPath, 'Vesting trigger must be an object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'VestingTrigger',
      receivedValue: triggerUnknown,
    });
  }
  const trigger = triggerUnknown as VestingTrigger;
  switch (trigger.type) {
    case 'VESTING_START_DATE':
      return {
        tag: 'OcfVestingStartTrigger',
        value: {},
      };

    case 'VESTING_EVENT':
      return {
        tag: 'OcfVestingEventTrigger',
        value: {},
      };

    case 'VESTING_SCHEDULE_ABSOLUTE':
      return {
        tag: 'OcfVestingScheduleAbsoluteTrigger',
        value: {
          date: dateStringToDAMLDate(trigger.date, `${fieldPath}.date`),
        },
      };

    case 'VESTING_SCHEDULE_RELATIVE': {
      if (typeof trigger.relative_to_condition_id !== 'string' || trigger.relative_to_condition_id.length === 0) {
        throw new OcpValidationError(
          `${fieldPath}.relative_to_condition_id`,
          'Vesting relative trigger requires relative_to_condition_id',
          {
            code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
            receivedValue: trigger.relative_to_condition_id,
          }
        );
      }

      const periodUnknown = (trigger as unknown as { period?: unknown }).period;
      if (periodUnknown === null || typeof periodUnknown !== 'object' || Array.isArray(periodUnknown)) {
        throw new OcpValidationError(`${fieldPath}.period`, 'Vesting relative trigger requires a period', {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'VestingPeriod',
          receivedValue: periodUnknown,
        });
      }
      const periodRecord = periodUnknown as Record<string, unknown>;
      if (periodRecord.type !== 'DAYS' && periodRecord.type !== 'MONTHS') {
        throw new OcpValidationError(`${fieldPath}.period.type`, 'Unknown vesting period type', {
          code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
          expectedType: "'DAYS' | 'MONTHS'",
          receivedValue: periodRecord.type,
        });
      }
      const p = periodRecord as unknown as VestingPeriod;
      const length = ocfVestingPeriodIntegerToDaml(p.length, `${fieldPath}.period.length`, 0);
      const occurrences = ocfVestingPeriodIntegerToDaml(p.occurrences, `${fieldPath}.period.occurrences`, 1);

      let cliffInstallment: string | null = null;
      if (p.cliff_installment !== undefined) {
        cliffInstallment = ocfVestingPeriodIntegerToDaml(
          p.cliff_installment,
          `${fieldPath}.period.cliff_installment`,
          0
        );
      }

      let period:
        | {
            tag: 'OcfVestingPeriodDays';
            value: { length_: string; occurrences: string; cliff_installment: string | null };
          }
        | {
            tag: 'OcfVestingPeriodMonths';
            value: {
              length_: string;
              occurrences: string;
              day_of_month: Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingDayOfMonth;
              cliff_installment: string | null;
            };
          };

      if (p.type === 'DAYS') {
        period = {
          tag: 'OcfVestingPeriodDays',
          value: {
            length_: length,
            occurrences,
            cliff_installment: cliffInstallment,
          },
        };
      } else {
        if (typeof p.day_of_month !== 'string') {
          throw new OcpValidationError(
            `${fieldPath}.period.day_of_month`,
            'MONTHS period requires a day_of_month string',
            {
              code: OcpErrorCodes.INVALID_TYPE,
              expectedType: 'VestingDayOfMonth',
              receivedValue: p.day_of_month,
            }
          );
        }
        period = {
          tag: 'OcfVestingPeriodMonths',
          value: {
            length_: length,
            occurrences,
            day_of_month: mapOcfDayOfMonthToDaml(p.day_of_month, `${fieldPath}.period.day_of_month`),
            cliff_installment: cliffInstallment,
          },
        };
      }

      return {
        tag: 'OcfVestingScheduleRelativeTrigger',
        value: {
          period,
          relative_to_condition_id: trigger.relative_to_condition_id,
        },
      };
    }

    default: {
      const exhaustiveCheck: never = trigger;
      throw new OcpParseError('Unknown vesting trigger', {
        source: `${fieldPath}.type`,
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        context: { receivedValue: exhaustiveCheck },
      });
    }
  }
}

function vestingConditionPortionToDaml(
  p: VestingConditionPortion,
  fieldPath: string
): Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingConditionPortion {
  const rawPortion: unknown = p;
  if (rawPortion === null || typeof rawPortion !== 'object' || Array.isArray(rawPortion)) {
    throw new OcpValidationError(fieldPath, 'Vesting condition portion must be an object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'VestingConditionPortion',
      receivedValue: rawPortion,
    });
  }
  const writeNumeric = (value: unknown, path: string): string => {
    if (typeof value !== 'string') {
      throw new OcpValidationError(path, 'Vesting condition portion numeric must be a string', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'OCF Numeric string',
        receivedValue: value,
      });
    }
    const result = canonicalizeOcfNumeric10(value);
    if (!result.ok) {
      throw new OcpValidationError(path, result.message, {
        code: OcpErrorCodes.INVALID_FORMAT,
        expectedType: 'OCF Numeric string within DAML Numeric 10 bounds',
        receivedValue: value,
      });
    }
    return result.value;
  };
  const { remainder, numerator, denominator } = rawPortion as Record<string, unknown>;
  if (remainder !== undefined && typeof remainder !== 'boolean') {
    throw new OcpValidationError(`${fieldPath}.remainder`, 'Vesting condition remainder must be a boolean', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'boolean or omitted',
      receivedValue: remainder,
    });
  }
  const result = {
    numerator: writeNumeric(numerator, `${fieldPath}.numerator`),
    denominator: writeNumeric(denominator, `${fieldPath}.denominator`),
    // OCF makes `remainder` optional, and so does the register: an omitted remainder stays omitted (default `false`).
    remainder: remainder ?? null,
  };
  return result;
}

function vestingConditionToDaml(
  c: VestingCondition,
  index: number
): Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingCondition {
  const conditionPath = `vestingTerms.vesting_conditions[${index}]`;
  const rawConditionValue: unknown = c;
  if (rawConditionValue === null || typeof rawConditionValue !== 'object' || Array.isArray(rawConditionValue)) {
    throw new OcpValidationError(conditionPath, 'Vesting condition must be an object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'VestingCondition',
      receivedValue: rawConditionValue,
    });
  }
  const rawCondition = rawConditionValue as Record<'portion' | 'quantity', unknown>;
  for (const field of ['portion', 'quantity'] as const) {
    if (rawCondition[field] === null) {
      throw new OcpValidationError(`${conditionPath}.${field}`, `${field} cannot be null`, {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: `${field} value or omitted`,
        receivedValue: rawCondition[field],
      });
    }
  }

  const hasPortion = c.portion !== undefined;
  const hasQuantity = c.quantity !== undefined;
  if (hasPortion === hasQuantity) {
    throw new OcpValidationError(conditionPath, 'Exactly one of portion or quantity is required', {
      code: hasPortion ? OcpErrorCodes.INVALID_FORMAT : OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'exactly one of portion or quantity',
      receivedValue: { portion: c.portion, quantity: c.quantity },
    });
  }

  if (typeof c.id !== 'string' || c.id.length === 0) {
    throw new OcpValidationError(`${conditionPath}.id`, 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'non-empty string',
      receivedValue: c.id,
    });
  }

  const nextConditionIds: unknown = c.next_condition_ids;
  if (!Array.isArray(nextConditionIds)) {
    throw new OcpValidationError(`${conditionPath}.next_condition_ids`, 'Expected an array of condition IDs', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string[]',
      receivedValue: nextConditionIds,
    });
  }
  const firstIndexes = new Map<string, number>();
  nextConditionIds.forEach((nextConditionId, nextIndex) => {
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
  });

  return {
    id: c.id,
    description: optionalString(c.description),
    portion: c.portion ? vestingConditionPortionToDaml(c.portion, `${conditionPath}.portion`) : null,
    quantity:
      c.quantity !== undefined ? ocfVestingConditionQuantityToDaml(c.quantity, `${conditionPath}.quantity`) : null,
    trigger: vestingTriggerToDaml(c.trigger, `${conditionPath}.trigger`),
    next_condition_ids: nextConditionIds,
  };
}

export function vestingTermsDataToDaml(d: OcfVestingTerms): PkgVestingTermsOcfData {
  assertSafeOcfJson(d, 'vestingTerms');
  if (!d.id)
    throw new OcpValidationError('vestingTerms.id', 'vestingTerms.id is required', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });

  const vestingConditions: unknown = d.vesting_conditions;
  if (!Array.isArray(vestingConditions) || vestingConditions.length === 0) {
    throw new OcpValidationError('vestingTerms.vesting_conditions', 'At least one vesting condition is required', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: '[VestingCondition, ...VestingCondition[]]',
      receivedValue: vestingConditions,
    });
  }

  const damlVestingConditions = d.vesting_conditions.map((condition, index) =>
    vestingConditionToDaml(condition, index)
  );
  const graphIssue = findVestingGraphIssue(d.vesting_conditions);
  if (graphIssue !== undefined) {
    throw new OcpValidationError(graphIssue.fieldPath, graphIssue.message, {
      code: OcpErrorCodes.INVALID_FORMAT,
      classification: 'invalid_vesting_graph',
      expectedType: graphIssue.expectedType,
      receivedValue: graphIssue.receivedValue,
      context: graphIssue.context,
    });
  }

  const damlData: PkgVestingTermsOcfData = {
    id: d.id,
    name: d.name,
    description: d.description,
    allocation_type: allocationTypeToDaml(d.allocation_type),
    vesting_conditions: damlVestingConditions,
    comments: cleanComments(d.comments),
  };

  parseOcfEntityInput('vestingTerms', d);
  return damlData;
}
