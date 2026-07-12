import type { OcfEquityCompensationCancellation } from '../../../types';
import type { PkgEquityCompensationCancellationOcfData } from '../../../types/daml';
import { canonicalizeNonnegativeOcfNumeric10 } from '../../../utils/damlNumeric';
import { cancellationBalanceSecurityIdToDaml, dateStringToDAMLTime } from '../../../utils/typeConversions';
import { assertCanonicalJsonGraph, optionalStringArrayToDaml } from '../shared/ocfValues';

export function equityCompensationCancellationDataToDaml(
  d: OcfEquityCompensationCancellation
): PkgEquityCompensationCancellationOcfData {
  assertCanonicalJsonGraph(d, 'equityCompensationCancellation', { rejectUndefined: true });
  return {
    id: d.id,
    security_id: d.security_id,
    reason_text: d.reason_text,
    date: dateStringToDAMLTime(d.date, 'equityCompensationCancellation.date'),
    quantity: canonicalizeNonnegativeOcfNumeric10(d.quantity, 'equityCompensationCancellation.quantity'),
    balance_security_id: cancellationBalanceSecurityIdToDaml(
      d.balance_security_id,
      'equityCompensationCancellation.balance_security_id'
    ),
    comments: optionalStringArrayToDaml(d.comments, 'equityCompensationCancellation.comments'),
  };
}
