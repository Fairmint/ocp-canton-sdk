/**
 * DAML to OCF converters for StockCancellation entities.
 */

import type { OcfStockCancellation } from '../../../types';
import { damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';

/**
 * DAML StockCancellation data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlStockCancellationData {
  id: string;
  date: string;
  security_id: string;
  quantity: string;
  reason_text: string;
  balance_security_id?: string;
  comments: string[];
}

/**
 * Convert DAML StockCancellation data to native OCF format.
 *
 * @param d - The DAML stock cancellation data object
 * @returns The native OCF StockCancellation object
 */
export function damlStockCancellationToNative(d: DamlStockCancellationData): OcfStockCancellation {
  return {
    id: d.id,
    date: damlTimeToDateString(d.date),
    security_id: d.security_id,
    quantity: normalizeNumericString(d.quantity),
    reason_text: d.reason_text,
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id } : {}),
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
