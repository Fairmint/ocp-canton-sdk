/**
 * DAML to OCF converters for StockTransfer entities.
 */

import type { OcfStockTransfer } from '../../../types';
import { damlTimeToDateString, toNonEmptyStringArray } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData } from '../capTable/damlEntityData';
import { requireDecimalString } from '../shared/ocfValues';

/**
 * DAML StockTransfer data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlStockTransferData = DamlDataTypeFor<'stockTransfer'>;

/**
 * Convert DAML StockTransfer data to native OCF format.
 *
 * @param d - The DAML stock transfer data object
 * @returns The native OCF StockTransfer object
 */
export function damlStockTransferToNative(d: DamlStockTransferData): OcfStockTransfer {
  const decoded = decodeDamlEntityData('stockTransfer', d);
  return {
    object_type: 'TX_STOCK_TRANSFER',
    id: decoded.id,
    date: damlTimeToDateString(decoded.date, 'stockTransfer.date'),
    security_id: decoded.security_id,
    quantity: requireDecimalString(decoded.quantity, 'stockTransfer.quantity'),
    resulting_security_ids: toNonEmptyStringArray(
      decoded.resulting_security_ids,
      'stockTransfer.resulting_security_ids',
      { uniqueItems: true }
    ),
    ...(decoded.balance_security_id !== null ? { balance_security_id: decoded.balance_security_id } : {}),
    ...(decoded.consideration_text !== null ? { consideration_text: decoded.consideration_text } : {}),
    ...(decoded.comments.length > 0 ? { comments: decoded.comments } : {}),
  };
}
