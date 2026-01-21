import { OcpValidationError } from '../../../errors';
import type { OcfConvertibleTransfer } from '../../../types';
import {
  cleanComments,
  dateStringToDAMLTime,
  monetaryToDaml,
  optionalString,
} from '../../../utils/typeConversions';

export function convertibleTransferDataToDaml(d: OcfConvertibleTransfer): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('convertibleTransfer.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    amount: monetaryToDaml(d.amount),
    resulting_security_ids: d.resulting_security_ids,
    balance_security_id: optionalString(d.balance_security_id),
    consideration_text: optionalString(d.consideration_text),
    comments: cleanComments(d.comments),
  };
}
