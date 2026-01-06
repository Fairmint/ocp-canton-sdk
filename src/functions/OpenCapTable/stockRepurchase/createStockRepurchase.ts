import type { OcfStockRepurchaseTxData } from '../../../types';
import {
  cleanComments,
  dateStringToDAMLTime,
  monetaryToDaml,
  numberToString,
  optionalString,
} from '../../../utils/typeConversions';

export function stockRepurchaseDataToDaml(d: OcfStockRepurchaseTxData): Record<string, unknown> {
  // Validate required fields
  if (!d.id) {
    throw new Error('repurchaseData.id is required');
  }
  if (!d.date) {
    throw new Error('repurchaseData.date is required');
  }
  if (!d.security_id) {
    throw new Error('repurchaseData.security_id is required');
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
