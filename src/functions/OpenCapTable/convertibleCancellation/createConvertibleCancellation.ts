import type { OcfConvertibleCancellation } from '../../../types';
import type { PkgConvertibleCancellationOcfData } from '../../../types/daml';
import {
  cancellationBalanceSecurityIdToDaml,
  dateStringToDAMLTime,
  monetaryToDaml,
} from '../../../utils/typeConversions';
import { assertCanonicalJsonGraph, optionalStringArrayToDaml, requireOcfMonetary } from '../shared/ocfValues';

export function convertibleCancellationDataToDaml(d: OcfConvertibleCancellation): PkgConvertibleCancellationOcfData {
  assertCanonicalJsonGraph(d, 'convertibleCancellation', { rejectUndefined: true });
  return {
    id: d.id,
    security_id: d.security_id,
    amount: monetaryToDaml(
      requireOcfMonetary(d.amount, 'convertibleCancellation.amount'),
      'convertibleCancellation.amount'
    ),
    reason_text: d.reason_text,
    date: dateStringToDAMLTime(d.date, 'convertibleCancellation.date'),
    balance_security_id: cancellationBalanceSecurityIdToDaml(
      d.balance_security_id,
      'convertibleCancellation.balance_security_id'
    ),
    comments: optionalStringArrayToDaml(d.comments, 'convertibleCancellation.comments'),
  };
}
