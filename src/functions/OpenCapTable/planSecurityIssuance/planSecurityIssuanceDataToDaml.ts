/**
 * OCF to DAML converter for PlanSecurityIssuance entities.
 *
 * PlanSecurityIssuance is an alias type that maps to the underlying EquityCompensation DAML contract.
 * The plan_security_type field is converted to compensation_type for the DAML representation.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfPlanSecurityIssuance } from '../../../types';
import { equityCompensationIssuanceLikeDataToDaml } from '../equityCompensationIssuance/createEquityCompensationIssuance';

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

  return equityCompensationIssuanceLikeDataToDaml(d, 'planSecurityIssuance');
}
