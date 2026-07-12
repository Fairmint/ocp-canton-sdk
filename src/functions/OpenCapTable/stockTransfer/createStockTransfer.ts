import type { OcfStockTransfer } from '../../../types';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { canonicalOptionalTextToDaml } from '../shared/damlText';
import { requireDecimalString } from '../shared/ocfValues';
import { commentsToDaml, requirePlainWriterInput, validateCanonicalWriterInput } from '../shared/ocfWriterValidation';
import { requiredTransferTextToDaml, resultingSecurityIdsToDaml } from '../shared/transferWriterValidation';

type DamlStockTransferOutput = DamlDataTypeFor<'stockTransfer'> & Record<string, unknown>;

export function stockTransferDataToDaml(d: OcfStockTransfer): DamlStockTransferOutput {
  const path = 'stockTransfer';
  const input = requirePlainWriterInput(d, path);
  const result = {
    id: requiredTransferTextToDaml(input.id, `${path}.id`),
    security_id: requiredTransferTextToDaml(input.security_id, `${path}.security_id`),
    date: dateStringToDAMLTime(input.date, `${path}.date`),
    quantity: requireDecimalString(input.quantity, `${path}.quantity`),
    resulting_security_ids: resultingSecurityIdsToDaml(input.resulting_security_ids, `${path}.resulting_security_ids`),
    balance_security_id: canonicalOptionalTextToDaml(input.balance_security_id, `${path}.balance_security_id`),
    consideration_text: canonicalOptionalTextToDaml(input.consideration_text, `${path}.consideration_text`),
    comments: commentsToDaml(input.comments, `${path}.comments`),
  } satisfies DamlDataTypeFor<'stockTransfer'>;

  validateCanonicalWriterInput('stockTransfer', 'TX_STOCK_TRANSFER', input, path);
  return result;
}
