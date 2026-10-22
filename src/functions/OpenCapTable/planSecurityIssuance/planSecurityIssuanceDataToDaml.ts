/**
 * OCF to DAML converter for PlanSecurityIssuance entities.
 *
 * PlanSecurityIssuance is an alias type that maps to the underlying EquityCompensation DAML contract.
 * The plan_security_type field is converted to compensation_type for the DAML representation.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfPlanSecurityIssuance } from '../../../types';
import type { PkgEquityCompensationIssuanceOcfData } from '../../../types/daml';
import {
  cleanComments,
  dateStringToDAMLDate,
  monetaryToDaml,
  normalizeNumericString,
  nullableDateStringToDAMLDate,
  optionalDateStringToDAMLDate,
  optionalString,
} from '../../../utils/typeConversions';
import {
  compensationTypeToDaml,
  terminationWindowPeriodTypeToDaml,
  terminationWindowReasonToDaml,
} from '../equityCompensationIssuance/createEquityCompensationIssuance';
import { filterAndMapVestingsToDaml } from '../shared/vesting';

/**
 * Convert native OCF PlanSecurityIssuance data to DAML format.
 * Maps plan_security_type to compensation_type for the underlying EquityCompensation contract.
 *
 * @param d - The native OCF plan security issuance data object
 * @returns The DAML-formatted equity compensation issuance data
 * @throws OcpValidationError if required fields are missing or plan_security_type is 'OTHER'
 */
export function planSecurityIssuanceDataToDaml(d: OcfPlanSecurityIssuance): PkgEquityCompensationIssuanceOcfData {
  if (!d.id) {
    throw new OcpValidationError('planSecurityIssuance.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }

  const compensationType = d.compensation_type;

  return {
    id: d.id,
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    date: dateStringToDAMLDate(d.date, 'planSecurityIssuance.date'),
    board_approval_date: optionalDateStringToDAMLDate(
      d.board_approval_date,
      'planSecurityIssuance.board_approval_date'
    ),
    stockholder_approval_date: optionalDateStringToDAMLDate(
      d.stockholder_approval_date,
      'planSecurityIssuance.stockholder_approval_date'
    ),
    consideration_text: optionalString(d.consideration_text),
    security_law_exemptions: d.security_law_exemptions.map((e) => ({
      description: e.description,
      jurisdiction: e.jurisdiction,
    })),
    stock_plan_id: optionalString(d.stock_plan_id),
    stock_class_id: optionalString(d.stock_class_id),
    vesting_terms_id: optionalString(d.vesting_terms_id),
    compensation_type: compensationTypeToDaml(compensationType),
    quantity: normalizeNumericString(d.quantity),
    exercise_price: d.exercise_price ? monetaryToDaml(d.exercise_price) : null,
    base_price: d.base_price ? monetaryToDaml(d.base_price) : null,
    early_exercisable: d.early_exercisable ?? null,
    vestings: filterAndMapVestingsToDaml(d.vestings, 'planSecurityIssuance.vestings'),
    expiration_date: nullableDateStringToDAMLDate(d.expiration_date, 'planSecurityIssuance.expiration_date'),
    termination_exercise_windows: d.termination_exercise_windows.map((w) => ({
      reason: terminationWindowReasonToDaml(w.reason),
      period: w.period.toString(),
      period_type: terminationWindowPeriodTypeToDaml(w.period_type),
    })),
    comments: cleanComments(d.comments),
  };
}
