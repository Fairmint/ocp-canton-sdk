import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CompensationType, OcfEquityCompensationIssuance, TerminationWindow } from '../../../types';
import {
  cleanComments,
  dateStringToDAMLTime,
  monetaryToDaml,
  numberToString,
  optionalString,
} from '../../../utils/typeConversions';

function compensationTypeToDaml(t: CompensationType): Fairmint.OpenCapTable.Types.OcfCompensationType {
  switch (t) {
    case 'OPTION_NSO':
      return 'OcfCompensationTypeOptionNSO';
    case 'OPTION_ISO':
      return 'OcfCompensationTypeOptionISO';
    case 'OPTION':
      return 'OcfCompensationTypeOption';
    case 'RSU':
      return 'OcfCompensationTypeRSU';
    case 'CSAR':
      return 'OcfCompensationTypeCSAR';
    case 'SSAR':
      return 'OcfCompensationTypeSSAR';
    default:
      throw new Error('Unknown compensation type');
  }
}

const terminationWindowReasonMap: Record<
  TerminationWindow['reason'],
  Fairmint.OpenCapTable.Types.OcfTerminationWindowType
> = {
  VOLUNTARY_OTHER: 'OcfTermVoluntaryOther',
  VOLUNTARY_GOOD_CAUSE: 'OcfTermVoluntaryGoodCause',
  VOLUNTARY_RETIREMENT: 'OcfTermVoluntaryRetirement',
  INVOLUNTARY_OTHER: 'OcfTermInvoluntaryOther',
  INVOLUNTARY_DEATH: 'OcfTermInvoluntaryDeath',
  INVOLUNTARY_DISABILITY: 'OcfTermInvoluntaryDisability',
  INVOLUNTARY_WITH_CAUSE: 'OcfTermInvoluntaryWithCause',
};

const terminationWindowPeriodTypeMap: Record<
  TerminationWindow['period_type'],
  Fairmint.OpenCapTable.Types.OcfPeriodType
> = {
  DAYS: 'OcfPeriodDays',
  MONTHS: 'OcfPeriodMonths',
};

export function equityCompensationIssuanceDataToDaml(
  d: OcfEquityCompensationIssuance & {
    id: string;
    date: string;
    security_id: string;
    custom_id: string;
    stakeholder_id: string;
    stock_plan_id?: string;
    stock_class_id?: string;
    board_approval_date?: string;
    stockholder_approval_date?: string;
    consideration_text?: string;
    vesting_terms_id?: string;
  }
): Record<string, unknown> {
  const filteredVestings = (d.vestings ?? []).filter((v) => Number(v.amount) > 0);

  return {
    id: d.id,
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    date: dateStringToDAMLTime(d.date),
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    consideration_text: optionalString(d.consideration_text),
    security_law_exemptions: (d.security_law_exemptions ?? []).map((e) => ({
      description: e.description,
      jurisdiction: e.jurisdiction,
    })),
    stock_plan_id: optionalString(d.stock_plan_id),
    stock_class_id: optionalString(d.stock_class_id),
    vesting_terms_id: optionalString(d.vesting_terms_id),
    compensation_type: compensationTypeToDaml(d.compensation_type),
    quantity: numberToString(d.quantity),
    exercise_price: d.exercise_price ? monetaryToDaml(d.exercise_price) : null,
    base_price: d.base_price ? monetaryToDaml(d.base_price) : null,
    early_exercisable: d.early_exercisable ?? null,
    vestings: filteredVestings.map((v) => ({
      date: dateStringToDAMLTime(v.date),
      amount: numberToString(v.amount),
    })),
    expiration_date: d.expiration_date ? dateStringToDAMLTime(d.expiration_date) : null,
    termination_exercise_windows: (d.termination_exercise_windows ?? []).map((w) => ({
      reason: terminationWindowReasonMap[w.reason],
      period: numberToString(w.period),
      period_type: terminationWindowPeriodTypeMap[w.period_type],
    })),
    comments: cleanComments(d.comments),
  };
}
