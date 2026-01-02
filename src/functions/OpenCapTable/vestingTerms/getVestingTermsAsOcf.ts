import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type {
  AllocationType,
  OcfVestingTermsData,
  VestingCondition,
  VestingConditionPortion,
} from '../../../types/native';
import { damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';

function damlAllocationTypeToNative(t: Fairmint.OpenCapTable.VestingTerms.OcfAllocationType): AllocationType {
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
      return 'FRONT_LOADED_SINGLE_TRANCHE';
    case 'OcfAllocationBackLoadedToSingleTranche':
      return 'BACK_LOADED_SINGLE_TRANCHE';
    case 'OcfAllocationFractional':
      return 'FRACTIONAL';
    default: {
      const _exhaustiveCheck: never = t;
      throw new Error(`Unknown DAML allocation type: ${String(t)}`);
    }
  }
}

function mapDamlDayOfMonthToOcf(day: string): string {
  const table: Record<string, string> = {
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
  return table[day] || 'VESTING_START_DAY_OR_LAST_DAY_OF_MONTH';
}

function damlVestingPeriodToNative(p: { tag: string; value?: Record<string, unknown> }): {
  tag: 'DAYS' | 'MONTHS';
  length: number;
  occurrences: number;
  day_of_month?: string;
  cliff_installment?: number;
} {
  if (p.tag === 'OcfVestingPeriodDays') {
    const v = p.value ?? {};
    const occRaw = v.occurrences;
    if (occRaw === undefined || occRaw === null) throw new Error('Missing vesting period occurrences');
    const occ = Number(occRaw);
    if (!Number.isFinite(occ) || occ < 1) throw new Error('Invalid vesting period occurrences');
    return {
      tag: 'DAYS',
      length: Number(v.length_),
      occurrences: occ,
      ...(v.cliff_installment !== null && v.cliff_installment !== undefined
        ? { cliff_installment: Number(v.cliff_installment) }
        : {}),
    };
  }
  if (p.tag === 'OcfVestingPeriodMonths') {
    const v = p.value ?? {};
    const occRaw = v.occurrences;
    if (occRaw === undefined || occRaw === null) throw new Error('Missing vesting period occurrences');
    const occ = Number(occRaw);
    if (!Number.isFinite(occ) || occ < 1) throw new Error('Invalid vesting period occurrences');
    if (v.day_of_month === undefined || v.day_of_month === null) {
      throw new Error('Missing vesting period day_of_month for MONTHS');
    }
    const dayOfMonth = v.day_of_month;
    if (typeof dayOfMonth !== 'string') {
      throw new Error('day_of_month must be a string');
    }
    return {
      tag: 'MONTHS',
      length: Number(v.length_),
      occurrences: occ,
      day_of_month: mapDamlDayOfMonthToOcf(dayOfMonth),
      ...(v.cliff_installment !== null && v.cliff_installment !== undefined
        ? { cliff_installment: Number(v.cliff_installment) }
        : {}),
    };
  }
  throw new Error('Unknown DAML vesting period');
}

function damlVestingTriggerToNative(
  t: string | { tag?: string; value?: Record<string, unknown> }
): Record<string, unknown> {
  const tag: string | undefined = typeof t === 'string' ? t : t.tag;

  if (tag === 'OcfVestingStartTrigger') {
    return { type: 'VESTING_START_DATE' };
  }

  if (tag === 'OcfVestingEventTrigger') {
    return { type: 'VESTING_EVENT' };
  }

  if (tag === 'OcfVestingScheduleAbsoluteTrigger') {
    const value = typeof t === 'string' ? undefined : t.value;
    if (!value || typeof value !== 'string') throw new Error('Missing value for OcfVestingScheduleAbsoluteTrigger');
    return { type: 'VESTING_SCHEDULE_ABSOLUTE', date: damlTimeToDateString(value) };
  }

  if (tag === 'OcfVestingScheduleRelativeTrigger') {
    const value = typeof t === 'string' ? undefined : t.value;
    if (!value) throw new Error('Missing value for OcfVestingScheduleRelativeTrigger');
    const periodValue = (value as { period?: unknown }).period;
    if (
      !periodValue ||
      typeof periodValue !== 'object' ||
      !('tag' in periodValue) ||
      typeof (periodValue as { tag: unknown }).tag !== 'string'
    ) {
      throw new Error('Invalid period in OcfVestingScheduleRelativeTrigger');
    }
    const p = damlVestingPeriodToNative(periodValue as { tag: string; value?: Record<string, unknown> });
    if (p.tag === 'MONTHS') {
      return {
        type: 'VESTING_SCHEDULE_RELATIVE',
        period: {
          type: 'MONTHS',
          length: p.length,
          occurrences: p.occurrences,
          day_of_month: p.day_of_month ?? 'VESTING_START_DAY_OR_LAST_DAY_OF_MONTH',
          ...(p.cliff_installment !== undefined ? { cliff_installment: p.cliff_installment } : {}),
        },
        relative_to_condition_id: value.relative_to_condition_id,
      };
    }
    return {
      type: 'VESTING_SCHEDULE_RELATIVE',
      period: {
        type: 'DAYS',
        length: p.length,
        occurrences: p.occurrences,
        ...(p.cliff_installment !== undefined ? { cliff_installment: p.cliff_installment } : {}),
      },
      relative_to_condition_id: value.relative_to_condition_id,
    };
  }

  throw new Error('Unknown DAML vesting trigger');
}

function damlVestingConditionPortionToNative(
  p: Fairmint.OpenCapTable.VestingTerms.OcfVestingConditionPortion
): VestingConditionPortion {
  return {
    numerator: normalizeNumericString(p.numerator),
    denominator: normalizeNumericString(p.denominator),
    remainder: p.remainder,
  };
}

function damlVestingConditionToNative(c: Fairmint.OpenCapTable.VestingTerms.OcfVestingCondition): VestingCondition {
  const conditionWithId = c as unknown as { id?: string };
  const native: VestingCondition = {
    id: conditionWithId.id ?? '',
    ...(c.description && { description: c.description }),
    ...(c.quantity && { quantity: normalizeNumericString(c.quantity) }),
    trigger: damlVestingTriggerToNative(c.trigger) as VestingCondition['trigger'],
    next_condition_ids: c.next_condition_ids,
  };
  const portionUnknown = c.portion as unknown;
  if (portionUnknown) {
    if (
      typeof portionUnknown === 'object' &&
      'tag' in portionUnknown &&
      (portionUnknown as { tag: unknown }).tag === 'Some' &&
      'value' in portionUnknown
    ) {
      const { value } = portionUnknown as { value: Fairmint.OpenCapTable.VestingTerms.OcfVestingConditionPortion };
      native.portion = damlVestingConditionPortionToNative(value);
    } else if (typeof portionUnknown === 'object') {
      native.portion = damlVestingConditionPortionToNative(
        portionUnknown as Fairmint.OpenCapTable.VestingTerms.OcfVestingConditionPortion
      );
    }
  }
  return native;
}

function damlVestingTermsDataToNative(d: Fairmint.OpenCapTable.VestingTerms.OcfVestingTermsData): OcfVestingTermsData {
  const dataWithId = d as unknown as { id?: string };
  return {
    id: dataWithId.id ?? '',
    name: d.name || '',
    description: d.description || '',
    allocation_type: damlAllocationTypeToNative(d.allocation_type),
    vesting_conditions: d.vesting_conditions.map(damlVestingConditionToNative),
    comments: Array.isArray((d as unknown as { comments?: unknown }).comments)
      ? (d as unknown as { comments: string[] }).comments
      : [],
  };
}

export interface OcfVestingTerms {
  object_type: 'VESTING_TERMS';
  id?: string;
  name: string;
  description: string;
  allocation_type: string;
  vesting_conditions: VestingCondition[];
  comments?: string[];
}

export interface GetVestingTermsAsOcfParams {
  contractId: string;
}

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
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }
  const { createArgument } = eventsResponse.created.createdEvent;

  function hasData(
    arg: unknown
  ): arg is { vesting_terms_data: Fairmint.OpenCapTable.VestingTerms.OcfVestingTermsData } {
    const record = arg as Record<string, unknown>;
    return (
      typeof arg === 'object' &&
      arg !== null &&
      'vesting_terms_data' in record &&
      typeof record.vesting_terms_data === 'object'
    );
  }
  if (!hasData(createArgument)) {
    throw new Error('Vesting terms data not found in contract create argument');
  }

  const native = damlVestingTermsDataToNative(createArgument.vesting_terms_data);

  const ocf: OcfVestingTerms = {
    object_type: 'VESTING_TERMS',
    ...native,
  };

  return { vestingTerms: ocf, contractId: params.contractId };
}
