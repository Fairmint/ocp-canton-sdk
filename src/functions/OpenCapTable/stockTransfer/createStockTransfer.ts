import type { OcfStockTransfer } from '../../../types';
import {
  cleanComments,
  dateStringToDAMLTime,
  normalizeNumericString,
  optionalString,
  toNonEmptyStringArray,
} from '../../../utils/typeConversions';
import { assertCanonicalJsonGraph } from '../shared/ocfValues';

export function stockTransferDataToDaml(d: OcfStockTransfer): Record<string, unknown> {
  assertCanonicalJsonGraph(d, 'stockTransfer', { rejectUndefined: true });
  const resultingSecurityIds = toNonEmptyStringArray(d.resulting_security_ids, 'stockTransfer.resulting_security_ids', {
    uniqueItems: true,
  });
  return {
    id: d.id,
    security_id: d.security_id,
    date: dateStringToDAMLTime(d.date, 'stockTransfer.date'),
    quantity: normalizeNumericString(d.quantity),
    resulting_security_ids: resultingSecurityIds,
    balance_security_id: optionalString(d.balance_security_id),
    consideration_text: optionalString(d.consideration_text),
    comments: cleanComments(d.comments),
  };
}
