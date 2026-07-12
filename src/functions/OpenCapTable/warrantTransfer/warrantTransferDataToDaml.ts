import type { OcfWarrantTransfer } from '../../../types';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { requirePositiveOcfDecimal } from '../shared/ocfValues';
import { requirePlainWriterInput, validateCanonicalWriterInput } from '../shared/ocfWriterValidation';
import {
  optionalTransferTextToDaml,
  requiredTransferTextToDaml,
  resultingSecurityIdsToDaml,
  transferCommentsToDaml,
} from '../shared/transferWriterValidation';

export type DamlWarrantTransferOutput = DamlDataTypeFor<'warrantTransfer'>;

export function warrantTransferDataToDaml(d: OcfWarrantTransfer): DamlWarrantTransferOutput {
  const path = 'warrantTransfer';
  const input = requirePlainWriterInput(d, path);
  const result = {
    id: requiredTransferTextToDaml(input.id, `${path}.id`),
    date: dateStringToDAMLTime(input.date, `${path}.date`),
    security_id: requiredTransferTextToDaml(input.security_id, `${path}.security_id`),
    quantity: requirePositiveOcfDecimal(input.quantity, `${path}.quantity`),
    resulting_security_ids: resultingSecurityIdsToDaml(input.resulting_security_ids, `${path}.resulting_security_ids`),
    balance_security_id: optionalTransferTextToDaml(input.balance_security_id, `${path}.balance_security_id`),
    consideration_text: optionalTransferTextToDaml(input.consideration_text, `${path}.consideration_text`),
    comments: transferCommentsToDaml(input.comments, `${path}.comments`),
  } satisfies DamlDataTypeFor<'warrantTransfer'>;

  validateCanonicalWriterInput('warrantTransfer', 'TX_WARRANT_TRANSFER', input, path);
  return result;
}
