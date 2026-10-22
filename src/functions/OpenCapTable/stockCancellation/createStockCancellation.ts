import type { OcfStockCancellation } from '../../../types';
import type { PkgStockCancellationOcfData } from '../../../types/daml';
import {
  cleanComments,
  dateStringToDAMLDate,
  normalizeNumericString,
  optionalString,
} from '../../../utils/typeConversions';

export function stockCancellationDataToDaml(d: OcfStockCancellation): PkgStockCancellationOcfData {
  return {
    id: d.id,
    security_id: d.security_id,
    reason_text: d.reason_text,
    date: dateStringToDAMLDate(d.date, 'stockCancellation.date'),
    quantity: normalizeNumericString(d.quantity),
    balance_security_id: optionalString(d.balance_security_id),
    comments: cleanComments(d.comments),
  };
}
