/**
 * DAML to OCF converters for StockRepurchase entities.
 */

import type { OcfStockRepurchase } from '../../../types';
import { damlMonetaryToNative, damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';

/**
 * DAML StockRepurchase data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlStockRepurchaseData = DamlDataTypeFor<'stockRepurchase'>;

/**
 * Convert DAML StockRepurchase data to native OCF format.
 *
 * @param d - The DAML stock repurchase data object
 * @returns The native OCF StockRepurchase object
 */
export function damlStockRepurchaseToNative(d: DamlStockRepurchaseData): OcfStockRepurchase {
  return {
    object_type: 'TX_STOCK_REPURCHASE',
    id: d.id,
    date: damlTimeToDateString(d.date, 'stockRepurchase.date'),
    security_id: d.security_id,
    quantity: normalizeNumericString(d.quantity),
    price: damlMonetaryToNative(d.price),
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id } : {}),
    ...(d.consideration_text ? { consideration_text: d.consideration_text } : {}),
    ...(d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}
