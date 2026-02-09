/**
 * OCF to DAML converter for EquityCompensationRelease entities.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfEquityCompensationRelease } from '../../../types';
import { cleanComments, dateStringToDAMLTime, optionalString } from '../../../utils/typeConversions';

/**
 * Convert native OCF EquityCompensationRelease data to DAML format.
 *
 * @param d - The native OCF equity compensation release data object
 * @returns The DAML-formatted equity compensation release data
 * @throws OcpValidationError if required fields are missing
 */
export function equityCompensationReleaseDataToDaml(d: OcfEquityCompensationRelease): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('equityCompensationRelease.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    quantity: d.quantity,
    resulting_security_ids: d.resulting_security_ids,
    balance_security_id: optionalString(d.balance_security_id),
    settlement_date: d.settlement_date ? dateStringToDAMLTime(d.settlement_date) : null,
    consideration_text: optionalString(d.consideration_text),
    comments: cleanComments(d.comments),
  };
}
