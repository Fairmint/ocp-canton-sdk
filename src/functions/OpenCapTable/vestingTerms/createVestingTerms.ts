import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type {
  AllocationType,
  OcfVestingTerms,
  VestingCondition,
  VestingConditionPortion,
  VestingTrigger,
} from '../../../types';
import { cleanComments, dateStringToDAMLTime, optionalString } from '../../../utils/typeConversions';

function allocationTypeToDaml(t: AllocationType): Fairmint.OpenCapTable.OCF.VestingTerms.OcfAllocationType {
  switch (t) {
    case 'CUMULATIVE_ROUNDING':
      return 'OcfAllocationCumulativeRounding';
    case 'CUMULATIVE_ROUND_DOWN':
      return 'OcfAllocationCumulativeRoundDown';
    case 'FRONT_LOADED':
      return 'OcfAllocationFrontLoaded';
    case 'BACK_LOADED':
      return 'OcfAllocationBackLoaded';
    case 'FRONT_LOADED_SINGLE_TRANCHE':
      return 'OcfAllocationFrontLoadedToSingleTranche';
    case 'BACK_LOADED_SINGLE_TRANCHE':
      return 'OcfAllocationBackLoadedToSingleTranche';
    case 'FRACTIONAL':
      return 'OcfAllocationFractional';
    default: {
      const exhaustiveCheck: never = t;
      throw new OcpParseError(`Unknown allocation type: ${exhaustiveCheck as string}`, {
        source: 'vestingTerms.allocation_type',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}

type OcfVestingDay =
  | 'OcfVestingDay01'
  | 'OcfVestingDay02'
  | 'OcfVestingDay03'
  | 'OcfVestingDay04'
  | 'OcfVestingDay05'
  | 'OcfVestingDay06'
  | 'OcfVestingDay07'
  | 'OcfVestingDay08'
  | 'OcfVestingDay09'
  | 'OcfVestingDay10'
  | 'OcfVestingDay11'
  | 'OcfVestingDay12'
  | 'OcfVestingDay13'
  | 'OcfVestingDay14'
  | 'OcfVestingDay15'
  | 'OcfVestingDay16'
  | 'OcfVestingDay17'
  | 'OcfVestingDay18'
  | 'OcfVestingDay19'
  | 'OcfVestingDay20'
  | 'OcfVestingDay21'
  | 'OcfVestingDay22'
  | 'OcfVestingDay23'
  | 'OcfVestingDay24'
  | 'OcfVestingDay25'
  | 'OcfVestingDay26'
  | 'OcfVestingDay27'
  | 'OcfVestingDay28'
  | 'OcfVestingDay29OrLast'
  | 'OcfVestingDay30OrLast'
  | 'OcfVestingDay31OrLast'
  | 'OcfVestingStartDayOrLast';

function mapOcfDayOfMonthToDaml(day: string): OcfVestingDay {
  const d = day.toString().toUpperCase();
  const table: Partial<Record<string, OcfVestingDay>> = {
    '01': 'OcfVestingDay01',
    '02': 'OcfVestingDay02',
    '03': 'OcfVestingDay03',
    '04': 'OcfVestingDay04',
    '05': 'OcfVestingDay05',
    '06': 'OcfVestingDay06',
    '07': 'OcfVestingDay07',
    '08': 'OcfVestingDay08',
    '09': 'OcfVestingDay09',
    '10': 'OcfVestingDay10',
    '11': 'OcfVestingDay11',
    '12': 'OcfVestingDay12',
    '13': 'OcfVestingDay13',
    '14': 'OcfVestingDay14',
    '15': 'OcfVestingDay15',
    '16': 'OcfVestingDay16',
    '17': 'OcfVestingDay17',
    '18': 'OcfVestingDay18',
    '19': 'OcfVestingDay19',
    '20': 'OcfVestingDay20',
    '21': 'OcfVestingDay21',
    '22': 'OcfVestingDay22',
    '23': 'OcfVestingDay23',
    '24': 'OcfVestingDay24',
    '25': 'OcfVestingDay25',
    '26': 'OcfVestingDay26',
    '27': 'OcfVestingDay27',
    '28': 'OcfVestingDay28',
    '29_OR_LAST_DAY_OF_MONTH': 'OcfVestingDay29OrLast',
    '30_OR_LAST_DAY_OF_MONTH': 'OcfVestingDay30OrLast',
    '31_OR_LAST_DAY_OF_MONTH': 'OcfVestingDay31OrLast',
    VESTING_START_DAY_OR_LAST_DAY_OF_MONTH: 'OcfVestingStartDayOrLast',
  };
  const mapped = table[d];
  if (!mapped) {
    throw new OcpValidationError('vestingPeriod.day_of_month', 'Invalid vesting relative period day_of_month', {
      code: OcpErrorCodes.INVALID_FORMAT,
      receivedValue: day,
    });
  }
  return mapped;
}

function vestingTriggerToDaml(t: VestingTrigger): Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingTrigger {
  switch (t.type) {
    case 'VESTING_START_DATE':
      return {
        tag: 'OcfVestingStartTrigger',
        value: {},
      } as Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingTrigger;

    case 'VESTING_EVENT':
      return {
        tag: 'OcfVestingEventTrigger',
        value: {},
      } as Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingTrigger;

    case 'VESTING_SCHEDULE_ABSOLUTE':
      return {
        tag: 'OcfVestingScheduleAbsoluteTrigger',
        value: {
          date: dateStringToDAMLTime(t.date),
        },
      } as Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingTrigger;

    case 'VESTING_SCHEDULE_RELATIVE': {
      if (typeof t.relative_to_condition_id !== 'string' || t.relative_to_condition_id.length === 0) {
        throw new OcpValidationError(
          'vestingTrigger.relative_to_condition_id',
          'Vesting relative trigger requires relative_to_condition_id',
          {
            code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
            receivedValue: t.relative_to_condition_id,
          }
        );
      }

      const { period: p } = t;
      const lengthNum = Number(p.length);
      const occurrencesNum = Number(p.occurrences);

      if (!Number.isFinite(lengthNum) || lengthNum <= 0) {
        throw new OcpValidationError('vestingPeriod.length', 'Invalid vesting relative period length', {
          code: OcpErrorCodes.INVALID_FORMAT,
          receivedValue: p.length,
        });
      }
      if (!Number.isFinite(occurrencesNum) || occurrencesNum < 1) {
        throw new OcpValidationError('vestingPeriod.occurrences', 'Invalid vesting relative period occurrences', {
          code: OcpErrorCodes.INVALID_FORMAT,
          receivedValue: p.occurrences,
        });
      }

      let cliffInstallment: string | null = null;
      if (p.cliff_installment !== undefined) {
        if (!Number.isFinite(p.cliff_installment)) {
          throw new OcpValidationError('vestingPeriod.cliff_installment', 'Invalid vesting cliff_installment', {
            code: OcpErrorCodes.INVALID_FORMAT,
            receivedValue: p.cliff_installment,
          });
        }
        cliffInstallment = p.cliff_installment.toString();
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
              day_of_month: OcfVestingDay;
              cliff_installment: string | null;
            };
          };

      if (p.type === 'DAYS') {
        period = {
          tag: 'OcfVestingPeriodDays',
          value: {
            length_: lengthNum.toString(),
            occurrences: occurrencesNum.toString(),
            cliff_installment: cliffInstallment,
          },
        };
      } else {
        period = {
          tag: 'OcfVestingPeriodMonths',
          value: {
            length_: lengthNum.toString(),
            occurrences: occurrencesNum.toString(),
            day_of_month: mapOcfDayOfMonthToDaml(p.day_of_month),
            cliff_installment: cliffInstallment,
          },
        };
      }

      return {
        tag: 'OcfVestingScheduleRelativeTrigger',
        value: {
          period: period as Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingPeriod,
          relative_to_condition_id: t.relative_to_condition_id,
        },
      } as Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingTrigger;
    }

    default: {
      const exhaustiveCheck: never = t;
      throw new OcpParseError(`Unknown vesting trigger: ${JSON.stringify(exhaustiveCheck)}`, {
        source: 'vestingTrigger.type',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}

function vestingConditionPortionToDaml(
  p: VestingConditionPortion
): Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingConditionPortion {
  return {
    numerator: p.numerator,
    denominator: p.denominator,
    remainder: p.remainder,
  };
}

function vestingConditionToDaml(c: VestingCondition): Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingCondition {
  return {
    id: c.id,
    description: optionalString(c.description),
    portion: c.portion
      ? ({
          tag: 'Some',
          value: vestingConditionPortionToDaml(c.portion),
        } as unknown as Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingCondition['portion'])
      : null,
    quantity: c.quantity ?? null,
    trigger: vestingTriggerToDaml(c.trigger),
    next_condition_ids: c.next_condition_ids,
  };
}

export function vestingTermsDataToDaml(d: OcfVestingTerms): Record<string, unknown> {
  if (!d.id)
    throw new OcpValidationError('vestingTerms.id', 'vestingTerms.id is required', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });

  const damlData: Fairmint.OpenCapTable.OCF.VestingTerms.VestingTermsOcfData = {
    id: d.id,
    name: d.name,
    description: d.description,
    allocation_type: allocationTypeToDaml(d.allocation_type),
    vesting_conditions: d.vesting_conditions.map(vestingConditionToDaml),
    comments: cleanComments(d.comments),
  };

  interface VestingConditionJson {
    id: string;
    description: string | null;
    quantity: string | null;
    next_condition_ids: string[];
    portion: Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingConditionPortion | null;
    trigger: Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingTrigger;
  }

  // Normalize Optional fields for JSON API: use direct value for Some, null for None
  return {
    id: damlData.id,
    name: damlData.name,
    description: damlData.description,
    allocation_type: damlData.allocation_type,
    comments: damlData.comments,
    vesting_conditions: damlData.vesting_conditions.map((c): VestingConditionJson => {
      // Extract portion value from Optional<OcfVestingConditionPortion>
      let portion: Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingConditionPortion | null = null;
      if (c.portion && typeof c.portion === 'object' && 'tag' in c.portion) {
        const portionOpt = c.portion as {
          tag: string;
          value?: Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingConditionPortion;
        };
        if (portionOpt.tag === 'Some' && portionOpt.value) {
          portion = portionOpt.value;
        }
      }

      // Normalize trigger for JSON API
      const trigger = ((): Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingTrigger => {
        if (typeof c.trigger === 'object' && 'tag' in c.trigger) {
          const t = c.trigger as { tag: string; value?: unknown };
          return 'value' in t
            ? c.trigger
            : ({ tag: t.tag, value: null } as unknown as Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingTrigger);
        }
        return c.trigger;
      })();

      return {
        id: c.id,
        description: c.description,
        quantity: c.quantity,
        next_condition_ids: c.next_condition_ids,
        portion,
        trigger,
      };
    }),
  };
}
