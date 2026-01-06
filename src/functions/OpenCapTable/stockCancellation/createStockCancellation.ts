import type { OcfStockCancellationTxData } from '../../../types';
import { cleanComments, dateStringToDAMLTime, numberToString, optionalString } from '../../../utils/typeConversions';

export function stockCancellationDataToDaml(d: OcfStockCancellationTxData): Record<string, unknown> {
  return {
    id: d.id,
    security_id: d.security_id,
    reason_text: d.reason_text,
    date: dateStringToDAMLTime(d.date),
    quantity: numberToString(d.quantity),
    balance_security_id: optionalString(d.balance_security_id),
    comments: cleanComments(d.comments),
  };
}
