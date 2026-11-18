/**
 * DAML to OCF converter for StockHoldCancellation entities (Fairmint OCF extension, TX_STOCK_HOLD_CANCELLATION).
 *
 * The register writes hold cancellations itself; the SDK only reads them.
 */

import type { PkgStockHoldCancellationOcfData } from '../../../types/daml';
import type { OcfStockHoldCancellation } from '../../../types/native';
import { damlDateToDateString } from '../../../utils/typeConversions';

/**
 * Convert DAML StockHoldCancellation data to native OCF format.
 *
 * @param d - The DAML stock hold cancellation data object
 * @returns The native OCF StockHoldCancellation object
 */
export function damlStockHoldCancellationToNative(d: PkgStockHoldCancellationOcfData): OcfStockHoldCancellation {
  return {
    object_type: 'TX_STOCK_HOLD_CANCELLATION',
    id: d.id,
    date: damlDateToDateString(d.date, 'stockHoldCancellation.date'),
    hold_id: d.hold_id,
    security_id: d.security_id,
    reason_text: d.reason_text,
    ...(d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}
