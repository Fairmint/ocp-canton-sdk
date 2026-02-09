/**
 * OCF to DAML converter for StockConversion entities.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfStockConversion } from '../../../types';
import {
  cleanComments,
  dateStringToDAMLTime,
  normalizeNumericString,
  optionalString,
} from '../../../utils/typeConversions';

/**
 * Convert native OCF StockConversion data to DAML format.
 *
 * @param d - The native OCF stock conversion data object
 * @returns The DAML-formatted stock conversion data
 * @throws OcpValidationError if required fields are missing
 */
export function stockConversionDataToDaml(d: OcfStockConversion): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('stockConversion.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    quantity: normalizeNumericString(d.quantity),
    resulting_security_ids: d.resulting_security_ids,
    balance_security_id: optionalString(d.balance_security_id),
    comments: cleanComments(d.comments),
  };
}
