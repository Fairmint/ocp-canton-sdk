/**
 * OCF to DAML converter for StockConsolidation.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfStockConsolidation } from '../../../types/native';
import { cleanComments, dateStringToDAMLTime, optionalString } from '../../../utils/typeConversions';

/**
 * Convert native OCF StockConsolidation data to DAML format.
 *
 * DAML expects resulting_security_id (singular) while OCF has resulting_security_ids (array).
 * Takes the first item from the array to match DAML schema.
 */
export function stockConsolidationDataToDaml(d: OcfStockConsolidation): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('stockConsolidation.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  // DAML expects resulting_security_id (singular) - take first item from array
  const resultingSecurityId = d.resulting_security_ids.length > 0 ? d.resulting_security_ids[0] : '';
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_ids: d.security_ids,
    resulting_security_id: resultingSecurityId,
    reason_text: optionalString(null), // Optional field
    comments: cleanComments(d.comments),
  };
}
