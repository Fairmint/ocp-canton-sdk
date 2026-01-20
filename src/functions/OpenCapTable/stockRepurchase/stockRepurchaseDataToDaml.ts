import type { OcfStockRepurchase } from '../../../types';
import {
  cleanComments,
  dateStringToDAMLTime,
  monetaryToDaml,
  numberToString,
  optionalString,
} from '../../../utils/typeConversions';

/**
 * Convert OCF stock repurchase data to DAML format.
 *
 * @deprecated Use `ocp.OpenCapTable.capTable.update().create('stockRepurchase', data).execute()` instead.
 *   This function will be removed in a future major version.
 */
export function stockRepurchaseDataToDaml(d: OcfStockRepurchase): Record<string, unknown> {
  if (!d.id) throw new Error('repurchaseData.id is required');
  if (!d.date) throw new Error('repurchaseData.date is required');
  if (!d.security_id) throw new Error('repurchaseData.security_id is required');

  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    quantity: numberToString(d.quantity),
    price: monetaryToDaml(d.price),
    balance_security_id: optionalString(d.balance_security_id),
    consideration_text: optionalString(d.consideration_text),
    comments: cleanComments(d.comments),
  };
}
