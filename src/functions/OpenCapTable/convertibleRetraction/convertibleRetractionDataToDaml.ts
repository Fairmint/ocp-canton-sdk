/**
 * OCF to DAML converter for ConvertibleRetraction entities.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfConvertibleRetraction } from '../../../types';
import { cleanComments, dateStringToDAMLTime } from '../../../utils/typeConversions';

/**
 * Convert native OCF ConvertibleRetraction data to DAML format.
 *
 * @param d - The native OCF convertible retraction data object
 * @returns The DAML-formatted convertible retraction data
 * @throws OcpValidationError if required fields are missing
 */
export function convertibleRetractionDataToDaml(d: OcfConvertibleRetraction): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('convertibleRetraction.id', 'Required field is missing or empty', {
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
