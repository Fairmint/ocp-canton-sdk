/**
 * OCF to DAML converter for EquityCompensationRetraction entities.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfEquityCompensationRetraction } from '../../../types';
import { cleanComments, dateStringToDAMLTime } from '../../../utils/typeConversions';

/**
 * Convert native OCF EquityCompensationRetraction data to DAML format.
 *
 * @param d - The native OCF equity compensation retraction data object
 * @returns The DAML-formatted equity compensation retraction data
 * @throws OcpValidationError if required fields are missing
 */
export function equityCompensationRetractionDataToDaml(d: OcfEquityCompensationRetraction): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('equityCompensationRetraction.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    reason_text: d.reason_text,
    comments: cleanComments(d.comments),
  };
}
