import type { OcfStockRepurchase } from '../../../types';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { canonicalOptionalTextToDaml, requiredTextToDaml } from '../shared/damlText';
import { requireDecimalString, requireMonetary } from '../shared/ocfValues';
import { commentsToDaml, requireExactWriterInput, validateCanonicalWriterInput } from '../shared/ocfWriterValidation';

const ROOT_FIELDS = [
  'balance_security_id',
  'comments',
  'consideration_text',
  'date',
  'id',
  'object_type',
  'price',
  'quantity',
  'security_id',
] as const;

export function stockRepurchaseDataToDaml(d: OcfStockRepurchase): DamlDataTypeFor<'stockRepurchase'> {
  const path = 'stockRepurchase';
  const input = requireExactWriterInput(d, path, ROOT_FIELDS);
  const result = {
    id: requiredTextToDaml(input.id, `${path}.id`),
    date: dateStringToDAMLTime(input.date, `${path}.date`),
    security_id: requiredTextToDaml(input.security_id, `${path}.security_id`),
    quantity: requireDecimalString(input.quantity, `${path}.quantity`),
    price: requireMonetary(input.price, `${path}.price`),
    balance_security_id: canonicalOptionalTextToDaml(input.balance_security_id, `${path}.balance_security_id`),
    consideration_text: canonicalOptionalTextToDaml(input.consideration_text, `${path}.consideration_text`),
    comments: commentsToDaml(input.comments, `${path}.comments`),
  } satisfies DamlDataTypeFor<'stockRepurchase'>;

  validateCanonicalWriterInput('stockRepurchase', 'TX_STOCK_REPURCHASE', input, path);
  return result;
}
