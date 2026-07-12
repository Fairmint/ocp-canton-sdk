import type { OcfEquityCompensationTransfer } from '../../../types';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { canonicalOptionalTextToDaml } from '../shared/damlText';
import { requireDecimalString } from '../shared/ocfValues';
import { commentsToDaml, requirePlainWriterInput, validateCanonicalWriterInput } from '../shared/ocfWriterValidation';
import { requiredTransferTextToDaml, resultingSecurityIdsToDaml } from '../shared/transferWriterValidation';

type DamlEquityCompensationTransferOutput = DamlDataTypeFor<'equityCompensationTransfer'> & Record<string, unknown>;

export function equityCompensationTransferDataToDaml(
  d: OcfEquityCompensationTransfer
): DamlEquityCompensationTransferOutput {
  const path = 'equityCompensationTransfer';
  const input = requirePlainWriterInput(d, path);
  const result = {
    id: requiredTransferTextToDaml(input.id, `${path}.id`),
    date: dateStringToDAMLTime(input.date, `${path}.date`),
    security_id: requiredTransferTextToDaml(input.security_id, `${path}.security_id`),
    quantity: requireDecimalString(input.quantity, `${path}.quantity`),
    resulting_security_ids: resultingSecurityIdsToDaml(input.resulting_security_ids, `${path}.resulting_security_ids`),
    balance_security_id: canonicalOptionalTextToDaml(input.balance_security_id, `${path}.balance_security_id`),
    consideration_text: canonicalOptionalTextToDaml(input.consideration_text, `${path}.consideration_text`),
    comments: commentsToDaml(input.comments, `${path}.comments`),
  } satisfies DamlDataTypeFor<'equityCompensationTransfer'>;

  validateCanonicalWriterInput('equityCompensationTransfer', 'TX_EQUITY_COMPENSATION_TRANSFER', input, path);
  return result;
}
