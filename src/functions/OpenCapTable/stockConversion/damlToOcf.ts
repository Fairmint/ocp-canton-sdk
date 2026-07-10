/**
 * DAML to OCF converters for StockConversion entities.
 */

import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfStockConversion } from '../../../types';
import { damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';

/**
 * DAML StockConversion data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlStockConversionData = DamlDataTypeFor<'stockConversion'>;

/**
 * Convert DAML StockConversion data to native OCF format.
 *
 * @param d - The DAML stock conversion data object
 * @returns The native OCF StockConversion object
 */
export function damlStockConversionToNative(d: DamlStockConversionData): OcfStockConversion {
  if (d.resulting_security_ids.length === 0) {
    throw new OcpValidationError('stockConversion.resulting_security_ids', 'Required field must be a non-empty array', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.resulting_security_ids,
    });
  }

  return {
    object_type: 'TX_STOCK_CONVERSION',
    id: d.id,
    date: damlTimeToDateString(d.date),
    security_id: d.security_id,
    quantity_converted: normalizeNumericString(d.quantity_converted),
    resulting_security_ids: d.resulting_security_ids,
    ...(d.balance_security_id && { balance_security_id: d.balance_security_id }),
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
