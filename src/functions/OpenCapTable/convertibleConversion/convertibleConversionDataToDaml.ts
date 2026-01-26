/**
 * OCF to DAML converter for ConvertibleConversion entities.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfConvertibleConversion } from '../../../types';
import { cleanComments, dateStringToDAMLTime, optionalString } from '../../../utils/typeConversions';

/**
 * Convert native OCF ConvertibleConversion data to DAML format.
 *
 * @param d - The native OCF convertible conversion data object
 * @returns The DAML-formatted convertible conversion data
 * @throws OcpValidationError if required fields are missing
 */
export function convertibleConversionDataToDaml(d: OcfConvertibleConversion): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('convertibleConversion.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    resulting_security_ids: d.resulting_security_ids,
    balance_security_id: optionalString(d.balance_security_id),
    trigger_id: optionalString(d.trigger_id),
    comments: cleanComments(d.comments),
  };
}
