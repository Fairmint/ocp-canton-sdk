/**
 * OCF to DAML converter for ConvertibleConversion entities.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfConvertibleConversion } from '../../../types';
import type { PkgConvertibleConversionOcfData } from '../../../types/daml';
import {
  cleanComments,
  dateStringToDAMLDate,
  normalizeNumericString,
  optionalString,
} from '../../../utils/typeConversions';

/**
 * Convert native OCF ConvertibleConversion data to DAML format.
 *
 * @param d - The native OCF convertible conversion data object
 * @returns The DAML-formatted convertible conversion data
 * @throws OcpValidationError if required fields are missing
 */
export function convertibleConversionDataToDaml(d: OcfConvertibleConversion): PkgConvertibleConversionOcfData {
  if (!d.id) {
    throw new OcpValidationError('convertibleConversion.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  return {
    id: d.id,
    date: dateStringToDAMLDate(d.date, 'convertibleConversion.date'),
    reason_text: d.reason_text,
    security_id: d.security_id,
    trigger_id: d.trigger_id,
    resulting_security_ids: d.resulting_security_ids,
    balance_security_id: optionalString(d.balance_security_id),
    capitalization_definition: d.capitalization_definition ?? null,
    quantity_converted: d.quantity_converted ? normalizeNumericString(d.quantity_converted) : null,
    comments: cleanComments(d.comments),
  };
}
