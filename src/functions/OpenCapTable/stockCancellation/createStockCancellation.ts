import type { OcfStockCancellation } from '../../../types';
import { cleanComments, dateStringToDAMLTime, normalizeNumericString, optionalString } from '../../../utils/typeConversions';

export function stockCancellationDataToDaml(d: OcfStockCancellation): Record<string, unknown> {
  return {
    id: d.id,
    security_id: d.security_id,
    reason_text: d.reason_text,
    date: dateStringToDAMLTime(d.date),
    quantity: normalizeNumericString(d.quantity),
    balance_security_id: optionalString(d.balance_security_id),
    comments: cleanComments(d.comments),
  };
}
