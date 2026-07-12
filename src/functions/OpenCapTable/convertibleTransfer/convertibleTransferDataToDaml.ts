import { OcpValidationError } from '../../../errors';
import type { OcfConvertibleTransfer } from '../../../types';
import {
  cleanComments,
  dateStringToDAMLTime,
  monetaryToDaml,
  optionalString,
  toNonEmptyStringArray,
} from '../../../utils/typeConversions';
import { assertCanonicalJsonGraph } from '../shared/ocfValues';

export function convertibleTransferDataToDaml(d: OcfConvertibleTransfer): Record<string, unknown> {
  assertCanonicalJsonGraph(d, 'convertibleTransfer', { rejectUndefined: true });
  if (!d.id) {
    throw new OcpValidationError('convertibleTransfer.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  const resultingSecurityIds = toNonEmptyStringArray(
    d.resulting_security_ids,
    'convertibleTransfer.resulting_security_ids',
    { uniqueItems: true }
  );
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date, 'convertibleTransfer.date'),
    security_id: d.security_id,
    amount: monetaryToDaml(d.amount),
    resulting_security_ids: resultingSecurityIds,
    balance_security_id: optionalString(d.balance_security_id),
    consideration_text: optionalString(d.consideration_text),
    comments: cleanComments(d.comments),
  };
}
