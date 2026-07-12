import type { OcfConvertibleTransfer } from '../../../types';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { canonicalOptionalTextToDaml } from '../shared/damlText';
import { requireMonetary } from '../shared/ocfValues';
import { commentsToDaml, requirePlainWriterInput, validateCanonicalWriterInput } from '../shared/ocfWriterValidation';
import { requiredTransferTextToDaml, resultingSecurityIdsToDaml } from '../shared/transferWriterValidation';

type DamlConvertibleTransferOutput = DamlDataTypeFor<'convertibleTransfer'> & Record<string, unknown>;

export function convertibleTransferDataToDaml(d: OcfConvertibleTransfer): DamlConvertibleTransferOutput {
  const path = 'convertibleTransfer';
  const input = requirePlainWriterInput(d, path);
  const result = {
    id: requiredTransferTextToDaml(input.id, `${path}.id`),
    date: dateStringToDAMLTime(input.date, `${path}.date`),
    security_id: requiredTransferTextToDaml(input.security_id, `${path}.security_id`),
    amount: requireMonetary(input.amount, `${path}.amount`),
    resulting_security_ids: resultingSecurityIdsToDaml(input.resulting_security_ids, `${path}.resulting_security_ids`),
    balance_security_id: canonicalOptionalTextToDaml(input.balance_security_id, `${path}.balance_security_id`),
    consideration_text: canonicalOptionalTextToDaml(input.consideration_text, `${path}.consideration_text`),
    comments: commentsToDaml(input.comments, `${path}.comments`),
  } satisfies DamlDataTypeFor<'convertibleTransfer'>;

  validateCanonicalWriterInput('convertibleTransfer', 'TX_CONVERTIBLE_TRANSFER', input, path);
  return result;
}
