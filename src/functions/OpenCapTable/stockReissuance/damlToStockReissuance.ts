/**
 * DAML to OCF converter for StockReissuance.
 */

import type { OcfStockReissuance } from '../../../types/native';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';

/** DAML StockReissuanceOcfData structure */
export type DamlStockReissuanceData = DamlDataTypeFor<'stockReissuance'>;

/**
 * Convert DAML StockReissuance data to native OCF format.
 */
export function damlStockReissuanceToNative(d: DamlStockReissuanceData): OcfStockReissuance {
  return {
    object_type: 'TX_STOCK_REISSUANCE',
    id: d.id,
    date: damlTimeToDateString(d.date, 'stockReissuance.date'),
    security_id: d.security_id,
    resulting_security_ids: d.resulting_security_ids,
    ...(d.reason_text ? { reason_text: d.reason_text } : {}),
    ...(d.split_transaction_id ? { split_transaction_id: d.split_transaction_id } : {}),
    ...(d.comments.length ? { comments: d.comments } : {}),
  };
}
