import { OcpValidationError } from '../../../errors';
import type { OcfStockRepurchase } from '../../../types';
import {
  cleanComments,
  dateStringToDAMLTime,
  monetaryToDaml,
  numberToString,
  optionalString,
} from '../../../utils/typeConversions';

export function stockRepurchaseDataToDaml(d: OcfStockRepurchase): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('stockRepurchase.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  if (!d.date) {
    throw new OcpValidationError('stockRepurchase.date', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.date,
    });
  }
  if (!d.security_id) {
    throw new OcpValidationError('stockRepurchase.security_id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.security_id,
    });
  }

  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    quantity: numberToString(d.quantity),
    price: monetaryToDaml(d.price),
    balance_security_id: optionalString(d.balance_security_id),
    consideration_text: optionalString(d.consideration_text),
    comments: cleanComments(d.comments),
  };
}
