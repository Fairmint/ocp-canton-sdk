import type { OcfWarrantCancellation } from '../../../types';
import type { PkgWarrantCancellationOcfData } from '../../../types/daml';
import {
  cleanComments,
  dateStringToDAMLDate,
  normalizeNumericString,
  optionalString,
} from '../../../utils/typeConversions';

export function warrantCancellationDataToDaml(d: OcfWarrantCancellation): PkgWarrantCancellationOcfData {
  return {
    id: d.id,
    security_id: d.security_id,
    reason_text: d.reason_text,
    date: dateStringToDAMLDate(d.date, 'warrantCancellation.date'),
    quantity: normalizeNumericString(d.quantity),
    balance_security_id: optionalString(d.balance_security_id),
    comments: cleanComments(d.comments),
  };
}
