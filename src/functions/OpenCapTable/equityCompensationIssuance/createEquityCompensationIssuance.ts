import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CompensationType, OcfEquityCompensationIssuance, TerminationWindow } from '../../../types';
import { damlEnumConstructor } from '../../../utils/damlEnums';
import {
  cleanComments,
  dateStringToDAMLDate,
  monetaryToDaml,
  normalizeNumericString,
  nullableDateStringToDAMLDate,
  optionalDateStringToDAMLDate,
  optionalString,
} from '../../../utils/typeConversions';
import { filterAndMapVestingsToDaml } from '../shared/vesting';

export function compensationTypeToDaml(t: CompensationType): Fairmint.OpenCapTable.Types.Vesting.OcfCompensationType {
  return damlEnumConstructor('OcfCompensationType', t, 'equityCompensationIssuance.compensation_type');
}

export function terminationWindowReasonToDaml(
  reason: TerminationWindow['reason']
): Fairmint.OpenCapTable.Types.Vesting.OcfTerminationWindowType {
  return damlEnumConstructor(
    'OcfTerminationWindowType',
    reason,
    'equityCompensationIssuance.termination_exercise_windows.reason'
  );
}

export function terminationWindowPeriodTypeToDaml(
  periodType: TerminationWindow['period_type']
): Fairmint.OpenCapTable.Types.Vesting.OcfPeriodType {
  return damlEnumConstructor(
    'OcfPeriodType',
    periodType,
    'equityCompensationIssuance.termination_exercise_windows.period_type'
  );
}

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
  return {
    id: d.id,
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    date: dateStringToDAMLDate(d.date, 'equityCompensationIssuance.date'),
    board_approval_date: optionalDateStringToDAMLDate(
      d.board_approval_date,
      'equityCompensationIssuance.board_approval_date'
    ),
    stockholder_approval_date: optionalDateStringToDAMLDate(
      d.stockholder_approval_date,
      'equityCompensationIssuance.stockholder_approval_date'
    ),
    consideration_text: optionalString(d.consideration_text),
    security_law_exemptions: d.security_law_exemptions.map((e) => ({
      description: e.description,
      jurisdiction: e.jurisdiction,
    })),
    stock_plan_id: optionalString(d.stock_plan_id),
    stock_class_id: optionalString(d.stock_class_id),
    vesting_terms_id: optionalString(d.vesting_terms_id),
    compensation_type: compensationTypeToDaml(d.compensation_type),
    quantity: normalizeNumericString(d.quantity),
    exercise_price: d.exercise_price ? monetaryToDaml(d.exercise_price) : null,
    base_price: d.base_price ? monetaryToDaml(d.base_price) : null,
    early_exercisable: d.early_exercisable ?? null,
    vestings: filterAndMapVestingsToDaml(d.vestings, 'equityCompensationIssuance.vestings'),
    expiration_date: nullableDateStringToDAMLDate(d.expiration_date, 'equityCompensationIssuance.expiration_date'),
    termination_exercise_windows: d.termination_exercise_windows.map((w) => ({
      reason: terminationWindowReasonToDaml(w.reason),
      period: w.period.toString(),
      period_type: terminationWindowPeriodTypeToDaml(w.period_type),
    })),
    comments: cleanComments(d.comments),
  };
}
