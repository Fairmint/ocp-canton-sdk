import { OcpValidationError } from '../../../errors';
import type { OcfStockRepurchase } from '../../../types';
import type { PkgStockRepurchaseOcfData } from '../../../types/daml';
import {
  cleanComments,
  dateStringToDAMLDate,
  monetaryToDaml,
  normalizeNumericString,
  optionalString,
} from '../../../utils/typeConversions';

export function stockRepurchaseDataToDaml(d: OcfStockRepurchase): PkgStockRepurchaseOcfData {
  if (!d.id) {
    throw new OcpValidationError('stockRepurchase.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
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
    date: dateStringToDAMLDate(d.date, 'stockRepurchase.date'),
    security_id: d.security_id,
    quantity: normalizeNumericString(d.quantity),
    price: monetaryToDaml(d.price),
    balance_security_id: optionalString(d.balance_security_id),
    consideration_text: optionalString(d.consideration_text),
    comments: cleanComments(d.comments),
  };
}
