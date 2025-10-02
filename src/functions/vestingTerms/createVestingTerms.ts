import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { dateStringToDAMLTime, cleanComments } from '../../utils/typeConversions';
import type {
  OcfVestingTermsData,
  CommandWithDisclosedContracts,
  AllocationType,
  VestingConditionPortion,
  VestingCondition,
} from '../../types';
import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

function allocationTypeToDaml(
  t: AllocationType
): Fairmint.OpenCapTable.VestingTerms.OcfAllocationType {
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
    default:
      throw new Error(`Unknown allocation type: ${t}`);
  }
}

function mapOcfDayOfMonthToDaml(day: string): any {
  const d = (day || '').toString().toUpperCase();
  const table: Record<string, any> = {
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
  return table[d] || 'OcfVestingStartDayOrLast';
}

function vestingTriggerToDaml(t: any): any {
  const type: string | undefined = typeof t?.type === 'string' ? t.type.toUpperCase() : undefined;

  if (type === 'VESTING_START_DATE')
    return {
      tag: 'OcfVestingStartTrigger',
      value: {},
    } as Fairmint.OpenCapTable.VestingTerms.OcfVestingTrigger;
  if (type === 'VESTING_EVENT')
    return {
      tag: 'OcfVestingEventTrigger',
      value: {},
    } as Fairmint.OpenCapTable.VestingTerms.OcfVestingTrigger;
  if (type === 'VESTING_SCHEDULE_ABSOLUTE') {
    const date: string | undefined = t?.date || t?.at;
    if (!date) throw new Error('Vesting absolute trigger requires date');
    return { tag: 'OcfVestingScheduleAbsoluteTrigger', value: dateStringToDAMLTime(date) };
  }
  if (type === 'VESTING_SCHEDULE_RELATIVE') {
    const p = t?.period || {};
    const pType: 'DAYS' | 'MONTHS' =
      (p?.type || '').toString().toUpperCase() === 'MONTHS' ? 'MONTHS' : 'DAYS';
    const lengthVal = p?.length ?? p?.value;
    const occurrencesVal = p?.occurrences;
    const cliffVal = p?.cliff_installment;
    const lengthNum: number = Number(lengthVal);
    if (occurrencesVal === undefined || occurrencesVal === null)
      throw new Error('Missing vesting relative period occurrences');
    const occurrencesNum: number = Number(occurrencesVal);
    if (!Number.isFinite(lengthNum) || lengthNum <= 0)
      throw new Error('Invalid vesting relative period length');
    if (!Number.isFinite(occurrencesNum) || occurrencesNum < 1)
      throw new Error('Invalid vesting relative period occurrences');
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
            day_of_month: any;
            cliff_installment: string | null;
          };
        };
    if (pType === 'DAYS') {
      period = {
        tag: 'OcfVestingPeriodDays',
        value: {
          length_: String(lengthNum),
          occurrences: String(occurrencesNum),
          cliff_installment: cliffVal === undefined ? null : String(Number(cliffVal)),
        },
      };
    } else {
      if (p?.day_of_month === undefined || p?.day_of_month === null)
        throw new Error('Missing vesting relative period day_of_month for MONTHS');
      period = {
        tag: 'OcfVestingPeriodMonths',
        value: {
          length_: String(lengthNum),
          occurrences: String(occurrencesNum),
          day_of_month: mapOcfDayOfMonthToDaml(p?.day_of_month),
          cliff_installment: cliffVal === undefined ? null : String(Number(cliffVal)),
        },
      };
    }
    return {
      tag: 'OcfVestingScheduleRelativeTrigger',
      value: {
        period: period as unknown as Fairmint.OpenCapTable.VestingTerms.OcfVestingPeriod,
        relative_to_condition_id: t?.relative_to_condition_id,
      },
    } as Fairmint.OpenCapTable.VestingTerms.OcfVestingTrigger;
  }

  throw new Error('Unknown vesting trigger');
}

function vestingConditionPortionToDaml(
  p: VestingConditionPortion
): Fairmint.OpenCapTable.VestingTerms.OcfVestingConditionPortion {
  return {
    numerator: typeof p.numerator === 'number' ? p.numerator.toString() : p.numerator,
    denominator: typeof p.denominator === 'number' ? p.denominator.toString() : p.denominator,
    remainder: p.remainder,
  };
}

function vestingConditionToDaml(
  c: VestingCondition
): Fairmint.OpenCapTable.VestingTerms.OcfVestingCondition {
  return {
    id: c.id,
    description: c.description || null,
    portion: c.portion
      ? ({
          tag: 'Some',
          value: vestingConditionPortionToDaml(c.portion),
        } as unknown as Fairmint.OpenCapTable.VestingTerms.OcfVestingCondition['portion'])
      : null,
    quantity:
      c.quantity !== undefined
        ? typeof c.quantity === 'number'
          ? c.quantity.toString()
          : c.quantity
        : null,
    trigger: vestingTriggerToDaml(c.trigger),
    next_condition_ids: c.next_condition_ids,
  };
}

function vestingTermsDataToDaml(
  d: OcfVestingTermsData
): Fairmint.OpenCapTable.VestingTerms.OcfVestingTermsData {
  if (!d.id) throw new Error('vestingTerms.id is required');
  return {
    id: d.id,
    name: d.name,
    description: d.description,
    allocation_type: allocationTypeToDaml(d.allocation_type),
    vesting_conditions: d.vesting_conditions.map(vestingConditionToDaml),
    comments: cleanComments(d.comments),
  };
}

export interface CreateVestingTermsParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  vestingTermsData: OcfVestingTermsData;
}

/**
 * Create vesting terms by exercising the CreateVestingTerms choice on an Issuer contract
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/VestingTerms.schema.json
 */

export function buildCreateVestingTermsCommand(
  params: CreateVestingTermsParams
): CommandWithDisclosedContracts {
  const damlArgs: Fairmint.OpenCapTable.Issuer.CreateVestingTerms = {
    vesting_terms_data: vestingTermsDataToDaml(params.vestingTermsData),
  } as any;

  // Normalize Optional fields for JSON API: use direct value for Some, null for None
  const vtData = damlArgs.vesting_terms_data;
  const choiceArguments: any = {
    vesting_terms_data: {
      id: vtData.id,
      name: vtData.name,
      description: vtData.description,
      allocation_type: vtData.allocation_type,
      comments: vtData.comments,
      vesting_conditions: (damlArgs as any).vesting_terms_data.vesting_conditions.map((c: any) => {
        const portion = c.portion && c.portion.tag === 'Some' ? c.portion.value : null;
        const trigger = ((): any => {
          if (c.trigger && typeof c.trigger === 'object' && 'tag' in c.trigger) {
            return 'value' in c.trigger ? c.trigger : { ...c.trigger, value: null };
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
    },
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateVestingTerms',
      choiceArgument: choiceArguments,
    },
  };

  const disclosedContracts: DisclosedContract[] = [
    {
      templateId: params.featuredAppRightContractDetails.templateId,
      contractId: params.featuredAppRightContractDetails.contractId,
      createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob,
      synchronizerId: params.featuredAppRightContractDetails.synchronizerId,
    },
  ];

  return { command, disclosedContracts };
}
