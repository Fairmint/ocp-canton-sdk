import type { OcfStockCancellation } from '../../../types';
import type { PkgStockCancellationOcfData } from '../../../types/daml';
import { canonicalizeNonnegativeOcfNumeric10 } from '../../../utils/damlNumeric';
import { cancellationBalanceSecurityIdToDaml, dateStringToDAMLTime } from '../../../utils/typeConversions';
import { assertCanonicalJsonGraph, optionalStringArrayToDaml } from '../shared/ocfValues';

export function stockCancellationDataToDaml(d: OcfStockCancellation): PkgStockCancellationOcfData {
  assertCanonicalJsonGraph(d, 'stockCancellation', { rejectUndefined: true });
  return {
    id: d.id,
    security_id: d.security_id,
    reason_text: d.reason_text,
    date: dateStringToDAMLTime(d.date, 'stockCancellation.date'),
    quantity: canonicalizeNonnegativeOcfNumeric10(d.quantity, 'stockCancellation.quantity'),
    balance_security_id: cancellationBalanceSecurityIdToDaml(
      d.balance_security_id,
      'stockCancellation.balance_security_id'
    ),
    comments: optionalStringArrayToDaml(d.comments, 'stockCancellation.comments'),
  };
}
