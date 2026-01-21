import type { OcfConvertibleCancellation } from '../../../types';
import { cleanComments, dateStringToDAMLTime, optionalString } from '../../../utils/typeConversions';

export function convertibleCancellationDataToDaml(d: OcfConvertibleCancellation): Record<string, unknown> {
  return {
    id: d.id,
    security_id: d.security_id,
    reason_text: d.reason_text,
    date: dateStringToDAMLTime(d.date),
    balance_security_id: optionalString(d.balance_security_id),
    comments: cleanComments(d.comments),
  };
}
