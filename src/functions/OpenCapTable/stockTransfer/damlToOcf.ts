/**
 * DAML to OCF converters for StockTransfer entities.
 */

import type { OcfStockTransfer } from '../../../types';
import { damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';

/**
 * DAML StockTransfer data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlStockTransferData {
  id: string;
  date: string;
  security_id: string;
  quantity: string;
  resulting_security_ids: string[];
  balance_security_id?: string;
  consideration_text?: string;
  comments: string[];
}

/**
 * Convert DAML StockTransfer data to native OCF format.
 *
 * @param d - The DAML stock transfer data object
 * @returns The native OCF StockTransfer object
 */
export function damlStockTransferToNative(d: DamlStockTransferData): OcfStockTransfer {
  return {
    id: d.id,
    date: damlTimeToDateString(d.date),
    security_id: d.security_id,
    quantity: normalizeNumericString(d.quantity),
    resulting_security_ids: d.resulting_security_ids,
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id } : {}),
    ...(d.consideration_text ? { consideration_text: d.consideration_text } : {}),
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
