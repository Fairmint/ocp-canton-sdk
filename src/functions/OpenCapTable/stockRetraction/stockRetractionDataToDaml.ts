/**
 * OCF to DAML converter for StockRetraction entities.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfStockRetraction } from '../../../types';
import { cleanComments, dateStringToDAMLTime } from '../../../utils/typeConversions';

/**
 * Convert native OCF StockRetraction data to DAML format.
 *
 * @param d - The native OCF stock retraction data object
 * @returns The DAML-formatted stock retraction data
 * @throws OcpValidationError if required fields are missing
 */
export function stockRetractionDataToDaml(d: OcfStockRetraction): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('stockRetraction.id', 'Required field is missing or empty', {
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
