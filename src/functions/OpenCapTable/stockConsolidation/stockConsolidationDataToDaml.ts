/**
 * OCF to DAML converter for StockConsolidation.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfStockConsolidation } from '../../../types/native';
import { cleanComments, dateStringToDAMLTime, optionalString } from '../../../utils/typeConversions';

/**
 * Convert native OCF StockConsolidation data to DAML format.
 *
 * Both canonical OCF and DAML use resulting_security_id (singular).
 */
export function stockConsolidationDataToDaml(d: OcfStockConsolidation): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('stockConsolidation.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date, 'stockConsolidation.date'),
    security_ids: d.security_ids,
    resulting_security_id: d.resulting_security_id,
    reason_text: optionalString(d.reason_text),
    comments: cleanComments(d.comments),
  };
}
