/**
 * OCF to DAML converter for EquityCompensationRepricing entities.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfEquityCompensationRepricing } from '../../../types';
import { cleanComments, dateStringToDAMLTime } from '../../../utils/typeConversions';

/**
 * Convert native OCF EquityCompensationRepricing data to DAML format.
 *
 * @param d - The native OCF equity compensation repricing data object
 * @returns The DAML-formatted equity compensation repricing data
 * @throws OcpValidationError if required fields are missing
 */
export function equityCompensationRepricingDataToDaml(d: OcfEquityCompensationRepricing): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('equityCompensationRepricing.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    resulting_security_ids: d.resulting_security_ids,
    comments: cleanComments(d.comments),
  };
}
