import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfWarrantTransfer } from '../../../types';
import { cleanComments, dateStringToDAMLTime, optionalString } from '../../../utils/typeConversions';

export function warrantTransferDataToDaml(d: OcfWarrantTransfer): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('warrantTransfer.id', 'Required field is missing or empty', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  // Validate required array field
  if (d.resulting_security_ids.length === 0) {
    throw new OcpValidationError(
      'warrantTransfer.resulting_security_ids',
      'resulting_security_ids must contain at least one element',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, receivedValue: d.resulting_security_ids }
    );
  }
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    quantity: d.quantity,
    resulting_security_ids: d.resulting_security_ids,
    balance_security_id: optionalString(d.balance_security_id),
    consideration_text: optionalString(d.consideration_text),
    comments: cleanComments(d.comments),
  };
}
