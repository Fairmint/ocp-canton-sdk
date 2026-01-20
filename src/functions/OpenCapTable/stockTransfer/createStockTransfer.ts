import type { OcfStockTransfer } from '../../../types';
import { cleanComments, dateStringToDAMLTime, numberToString, optionalString } from '../../../utils/typeConversions';

/**
 * Convert OCF stock transfer data to DAML format.
 *
 * @deprecated Use `ocp.OpenCapTable.capTable.update().create('stockTransfer', data).execute()` instead.
 *   This function will be removed in a future major version.
 */
export function stockTransferDataToDaml(d: OcfStockTransfer): Record<string, unknown> {
  // Validate required array field
  if (d.resulting_security_ids.length === 0) {
    throw new Error('resulting_security_ids must contain at least one element');
  }
  return {
    id: d.id,
    security_id: d.security_id,
    date: dateStringToDAMLTime(d.date),
    quantity: numberToString(d.quantity),
    resulting_security_ids: d.resulting_security_ids,
    balance_security_id: optionalString(d.balance_security_id),
    consideration_text: optionalString(d.consideration_text),
    comments: cleanComments(d.comments),
  };
}
