import { OcpValidationError } from '../../../errors';
import type { OcfWarrantTransfer } from '../../../types';
import { cleanComments, dateStringToDAMLTime, numberToString, optionalString } from '../../../utils/typeConversions';

export function warrantTransferDataToDaml(d: OcfWarrantTransfer): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('warrantTransfer.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  // Validate required array field
  if (d.resulting_security_ids.length === 0) {
    throw new Error('resulting_security_ids must contain at least one element');
  }
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    quantity: numberToString(d.quantity),
    resulting_security_ids: d.resulting_security_ids,
    balance_security_id: optionalString(d.balance_security_id),
    consideration_text: optionalString(d.consideration_text),
    comments: cleanComments(d.comments),
  };
}
