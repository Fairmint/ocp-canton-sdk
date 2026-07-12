/**
 * DAML to OCF converter for StockReissuance.
 */

import type { OcfStockReissuance } from '../../../types/native';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData } from '../capTable/damlEntityData';

/** DAML StockReissuanceOcfData structure */
export type DamlStockReissuanceData = DamlDataTypeFor<'stockReissuance'>;

/**
 * Convert DAML StockReissuance data to native OCF format.
 */
export function damlStockReissuanceToNative(input: DamlStockReissuanceData): OcfStockReissuance {
  const data = decodeDamlEntityData('stockReissuance', input);
  const reasonText = data.reason_text ?? undefined;
  const splitTransactionId = data.split_transaction_id ?? undefined;
  return {
    object_type: 'TX_STOCK_REISSUANCE',
    id: data.id,
    date: damlTimeToDateString(data.date, 'stockReissuance.date'),
    security_id: data.security_id,
    resulting_security_ids: data.resulting_security_ids,
    ...(reasonText !== undefined ? { reason_text: reasonText } : {}),
    ...(splitTransactionId !== undefined ? { split_transaction_id: splitTransactionId } : {}),
    ...(data.comments.length > 0 ? { comments: data.comments } : {}),
  };
}
