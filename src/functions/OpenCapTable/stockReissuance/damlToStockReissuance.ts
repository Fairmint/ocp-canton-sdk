/**
 * DAML to OCF converter for StockReissuance.
 */

import type { OcfStockReissuance } from '../../../types/native';

/** DAML StockReissuanceOcfData structure */
export interface DamlStockReissuanceData {
  id: string;
  date: string;
  security_id: string;
  resulting_security_ids: string[];
  reason_text: string | null;
  split_transaction_id: string | null;
  comments: string[];
}

/**
 * Convert DAML StockReissuance data to native OCF format.
 */
export function damlStockReissuanceToNative(d: DamlStockReissuanceData): OcfStockReissuance {
  return {
    id: d.id,
    date: d.date.split('T')[0],
    security_id: d.security_id,
    resulting_security_ids: d.resulting_security_ids,
    ...(d.reason_text ? { reason_text: d.reason_text } : {}),
    ...(d.split_transaction_id ? { split_transaction_id: d.split_transaction_id } : {}),
    ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments } : {}),
  };
}
