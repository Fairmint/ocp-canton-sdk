import type { OcfConvertibleCancellation } from '../../../types';
import type { PkgConvertibleCancellationOcfData } from '../../../types/daml';
import { cleanComments, dateStringToDAMLDate, monetaryToDaml, optionalString } from '../../../utils/typeConversions';

export function convertibleCancellationDataToDaml(d: OcfConvertibleCancellation): PkgConvertibleCancellationOcfData {
  return {
    id: d.id,
    security_id: d.security_id,
    amount: monetaryToDaml(d.amount),
    reason_text: d.reason_text,
    date: dateStringToDAMLDate(d.date, 'convertibleCancellation.date'),
    balance_security_id: optionalString(d.balance_security_id),
    comments: cleanComments(d.comments),
  };
}
