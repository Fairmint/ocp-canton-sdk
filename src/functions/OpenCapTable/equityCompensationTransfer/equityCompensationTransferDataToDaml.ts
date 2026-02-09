import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfEquityCompensationTransfer } from '../../../types';
import { cleanComments, dateStringToDAMLTime, optionalString } from '../../../utils/typeConversions';

export function equityCompensationTransferDataToDaml(d: OcfEquityCompensationTransfer): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('equityCompensationTransfer.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  // Validate required array field
  if (d.resulting_security_ids.length === 0) {
    throw new OcpValidationError(
      'equityCompensationTransfer.resulting_security_ids',
      'Must contain at least one element',
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
