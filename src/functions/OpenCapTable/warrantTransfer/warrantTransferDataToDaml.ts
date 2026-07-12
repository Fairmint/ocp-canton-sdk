import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfWarrantTransfer } from '../../../types';
import {
  cleanComments,
  dateStringToDAMLTime,
  normalizeNumericString,
  optionalString,
  toNonEmptyStringArray,
} from '../../../utils/typeConversions';
import { assertCanonicalJsonGraph } from '../shared/ocfValues';

export function warrantTransferDataToDaml(d: OcfWarrantTransfer): Record<string, unknown> {
  assertCanonicalJsonGraph(d, 'warrantTransfer', { rejectUndefined: true });
  if (!d.id) {
    throw new OcpValidationError('warrantTransfer.id', 'Required field is missing or empty', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  const resultingSecurityIds = toNonEmptyStringArray(
    d.resulting_security_ids,
    'warrantTransfer.resulting_security_ids',
    { uniqueItems: true }
  );
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date, 'warrantTransfer.date'),
    security_id: d.security_id,
    quantity: normalizeNumericString(d.quantity),
    resulting_security_ids: resultingSecurityIds,
    balance_security_id: optionalString(d.balance_security_id),
    consideration_text: optionalString(d.consideration_text),
    comments: cleanComments(d.comments),
  };
}
