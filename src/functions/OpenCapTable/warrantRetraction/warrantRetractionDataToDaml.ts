/**
 * OCF to DAML converter for WarrantRetraction entities.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfWarrantRetraction } from '../../../types';
import { cleanComments, dateStringToDAMLTime } from '../../../utils/typeConversions';

/**
 * Convert native OCF WarrantRetraction data to DAML format.
 *
 * @param d - The native OCF warrant retraction data object
 * @returns The DAML-formatted warrant retraction data
 * @throws OcpValidationError if required fields are missing
 */
export function warrantRetractionDataToDaml(d: OcfWarrantRetraction): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('warrantRetraction.id', 'Required field is missing or empty', {
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
