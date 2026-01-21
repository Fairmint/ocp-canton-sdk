/**
 * OCF to DAML converter for StockReissuance.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfStockReissuance } from '../../../types/native';
import { cleanComments, dateStringToDAMLTime, optionalString } from '../../../utils/typeConversions';

/**
 * Convert native OCF StockReissuance data to DAML format.
 */
export function stockReissuanceDataToDaml(d: OcfStockReissuance): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('stockReissuance.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    resulting_security_ids: d.resulting_security_ids,
    reason_text: optionalString(null), // Optional field
    split_transaction_id: optionalString(null), // Optional field
    comments: cleanComments(d.comments),
  };
}
