/**
 * DAML to OCF converters for ConvertibleConversion entities.
 */

import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfConvertibleConversion } from '../../../types';
import { damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';

/**
 * DAML ConvertibleConversion data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlConvertibleConversionData = DamlDataTypeFor<'convertibleConversion'>;

/**
 * Convert DAML ConvertibleConversion data to native OCF format.
 *
 * @param d - The DAML convertible conversion data object
 * @returns The native OCF ConvertibleConversion object
 */
export function damlConvertibleConversionToNative(d: DamlConvertibleConversionData): OcfConvertibleConversion {
  if (d.resulting_security_ids.length === 0) {
    throw new OcpValidationError(
      'convertibleConversion.resulting_security_ids',
      'Required field must be a non-empty array',
      {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        receivedValue: d.resulting_security_ids,
      }
    );
  }
  if (d.reason_text.length === 0) {
    throw new OcpValidationError('convertibleConversion.reason_text', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.reason_text,
    });
  }
  if (d.trigger_id.length === 0) {
    throw new OcpValidationError('convertibleConversion.trigger_id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.trigger_id,
    });
  }

  return {
    object_type: 'TX_CONVERTIBLE_CONVERSION',
    id: d.id,
    date: damlTimeToDateString(d.date),
    reason_text: d.reason_text,
    security_id: d.security_id,
    trigger_id: d.trigger_id,
    resulting_security_ids: d.resulting_security_ids,
    ...(d.balance_security_id && { balance_security_id: d.balance_security_id }),
    ...(d.capitalization_definition ? { capitalization_definition: d.capitalization_definition } : {}),
    ...(d.quantity_converted != null ? { quantity_converted: normalizeNumericString(d.quantity_converted) } : {}),
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
