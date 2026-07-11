/**
 * OCF to DAML converter for ConvertibleConversion entities.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfConvertibleConversion } from '../../../types';
import { cleanComments, dateStringToDAMLTime, optionalString } from '../../../utils/typeConversions';
import { canonicalOptionalNumericToDaml } from '../shared/conversionMechanisms';

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
    date: dateStringToDAMLTime(d.date, 'convertibleConversion.date'),
    reason_text: d.reason_text,
    security_id: d.security_id,
    trigger_id: d.trigger_id,
    resulting_security_ids: d.resulting_security_ids,
    balance_security_id: optionalString(d.balance_security_id),
    capitalization_definition: d.capitalization_definition ?? null,
    quantity_converted: canonicalOptionalNumericToDaml(
      d.quantity_converted,
      'convertibleConversion.quantity_converted'
    ),
    comments: cleanComments(d.comments),
  };
}
