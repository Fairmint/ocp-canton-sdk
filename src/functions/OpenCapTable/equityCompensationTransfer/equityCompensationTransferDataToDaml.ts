import { OcpValidationError } from '../../../errors';
import type { OcfEquityCompensationTransfer } from '../../../types';
import {
  cleanComments,
  dateStringToDAMLTime,
  normalizeNumericString,
  optionalString,
  toNonEmptyStringArray,
} from '../../../utils/typeConversions';
import { assertCanonicalJsonGraph } from '../shared/ocfValues';

export function equityCompensationTransferDataToDaml(d: OcfEquityCompensationTransfer): Record<string, unknown> {
  assertCanonicalJsonGraph(d, 'equityCompensationTransfer', { rejectUndefined: true });
  if (!d.id) {
    throw new OcpValidationError('equityCompensationTransfer.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  const resultingSecurityIds = toNonEmptyStringArray(
    d.resulting_security_ids,
    'equityCompensationTransfer.resulting_security_ids',
    { uniqueItems: true }
  );
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date, 'equityCompensationTransfer.date'),
    security_id: d.security_id,
    quantity: normalizeNumericString(d.quantity),
    resulting_security_ids: resultingSecurityIds,
    balance_security_id: optionalString(d.balance_security_id),
    consideration_text: optionalString(d.consideration_text),
    comments: cleanComments(d.comments),
  };
}
