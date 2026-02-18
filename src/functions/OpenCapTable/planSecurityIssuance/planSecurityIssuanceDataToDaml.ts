/**
 * OCF to DAML converter for PlanSecurityIssuance entities.
 *
 * PlanSecurityIssuance is an alias type that maps to the underlying EquityCompensation DAML contract.
 * The plan_security_type field is converted to compensation_type for the DAML representation.
 */

import { OcpValidationError } from '../../../errors';
import type { CompensationType, OcfPlanSecurityIssuance } from '../../../types';
import {
  cleanComments,
  dateStringToDAMLTime,
  monetaryToDaml,
  normalizeNumericString,
  optionalString,
} from '../../../utils/typeConversions';
import {
  compensationTypeToDaml,
  terminationWindowPeriodTypeMap,
  terminationWindowReasonMap,
} from '../equityCompensationIssuance/createEquityCompensationIssuance';

/**
 * Map PlanSecurity type to EquityCompensation type for DAML.
 * PlanSecurity types are aliases that map to EquityCompensation DAML contracts.
 * Note: 'OTHER' is not included because DAML has no equivalent type - it must be handled explicitly.
 */
const PLAN_SECURITY_TO_COMPENSATION_TYPE: Record<'OPTION' | 'RSU', CompensationType> = {
  OPTION: 'OPTION',
  RSU: 'RSU',
};

/**
 * Convert native OCF PlanSecurityIssuance data to DAML format.
 * Maps plan_security_type to compensation_type for the underlying EquityCompensation contract.
 *
 * @param d - The native OCF plan security issuance data object
 * @returns The DAML-formatted equity compensation issuance data
 * @throws OcpValidationError if required fields are missing or plan_security_type is 'OTHER'
 */
export function planSecurityIssuanceDataToDaml(d: OcfPlanSecurityIssuance): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('planSecurityIssuance.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }

  const compensationTypeInput = (d as OcfPlanSecurityIssuance & { compensation_type?: CompensationType })
    .compensation_type;
  let compensationType: CompensationType | undefined = compensationTypeInput;

  if (!compensationType) {
    // Validate legacy plan_security_type - 'OTHER' is not supported because DAML has no equivalent type
    if (d.plan_security_type === 'OTHER') {
      throw new OcpValidationError(
        'planSecurityIssuance.plan_security_type',
        "plan_security_type 'OTHER' is not supported. DAML only supports 'OPTION' and 'RSU' types. Use EquityCompensationIssuance with a specific compensation_type instead.",
        {
          expectedType: "'OPTION' | 'RSU'",
          receivedValue: d.plan_security_type,
        }
      );
    }

    compensationType =
      d.plan_security_type === undefined ? undefined : PLAN_SECURITY_TO_COMPENSATION_TYPE[d.plan_security_type];
  }

  if (!compensationType) {
    throw new OcpValidationError(
      'planSecurityIssuance.compensation_type',
      "compensation_type is required (or provide legacy plan_security_type as 'OPTION' or 'RSU').",
      {
        expectedType: "CompensationType or legacy 'OPTION' | 'RSU'",
        receivedValue: compensationTypeInput ?? d.plan_security_type,
      }
    );
  }

  const filteredVestings = (d.vestings ?? []).filter((v) => {
    const normalized = normalizeNumericString(v.amount);
    return parseFloat(normalized) > 0;
  });

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
    compensation_type: compensationTypeToDaml(compensationType),
    quantity: normalizeNumericString(d.quantity),
    exercise_price: d.exercise_price ? monetaryToDaml(d.exercise_price) : null,
    base_price: d.base_price ? monetaryToDaml(d.base_price) : null,
    early_exercisable: d.early_exercisable ?? null,
    vestings: filteredVestings.map((v) => ({
      date: dateStringToDAMLTime(v.date),
      amount: normalizeNumericString(v.amount),
    })),
    expiration_date: d.expiration_date ? dateStringToDAMLTime(d.expiration_date) : null,
    termination_exercise_windows: (d.termination_exercise_windows ?? []).map((w) => ({
      reason: terminationWindowReasonMap[w.reason],
      period: w.period.toString(),
      period_type: terminationWindowPeriodTypeMap[w.period_type],
    })),
    comments: cleanComments(d.comments),
  };
}
