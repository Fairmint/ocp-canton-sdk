import type { OcfWarrantCancellation } from '../../../types';
import type { PkgWarrantCancellationOcfData } from '../../../types/daml';
import { canonicalizeNonnegativeOcfNumeric10 } from '../../../utils/damlNumeric';
import { cancellationBalanceSecurityIdToDaml, dateStringToDAMLTime } from '../../../utils/typeConversions';
import { assertCanonicalJsonGraph, optionalStringArrayToDaml } from '../shared/ocfValues';

export function warrantCancellationDataToDaml(d: OcfWarrantCancellation): PkgWarrantCancellationOcfData {
  assertCanonicalJsonGraph(d, 'warrantCancellation', { rejectUndefined: true });
  return {
    id: d.id,
    security_id: d.security_id,
    reason_text: d.reason_text,
    date: dateStringToDAMLTime(d.date, 'warrantCancellation.date'),
    quantity: canonicalizeNonnegativeOcfNumeric10(d.quantity, 'warrantCancellation.quantity'),
    balance_security_id: cancellationBalanceSecurityIdToDaml(
      d.balance_security_id,
      'warrantCancellation.balance_security_id'
    ),
    comments: optionalStringArrayToDaml(d.comments, 'warrantCancellation.comments'),
  };
}
