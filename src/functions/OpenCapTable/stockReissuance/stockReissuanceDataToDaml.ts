/**
 * OCF to DAML converter for StockReissuance.
 */

import type { OcfStockReissuance } from '../../../types/native';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { canonicalOptionalTextToDaml, requiredTextToDaml } from '../shared/damlText';
import { requireStringArray } from '../shared/ocfValues';
import { commentsToDaml, requireExactWriterInput, validateCanonicalWriterInput } from '../shared/ocfWriterValidation';

const ROOT_FIELDS = [
  'comments',
  'date',
  'id',
  'object_type',
  'reason_text',
  'resulting_security_ids',
  'security_id',
  'split_transaction_id',
] as const;

/**
 * Convert native OCF StockReissuance data to DAML format.
 */
export function stockReissuanceDataToDaml(d: OcfStockReissuance): DamlDataTypeFor<'stockReissuance'> {
  const path = 'stockReissuance';
  const input = requireExactWriterInput(d, path, ROOT_FIELDS);
  const result = {
    id: requiredTextToDaml(input.id, `${path}.id`),
    date: dateStringToDAMLTime(input.date, `${path}.date`),
    security_id: requiredTextToDaml(input.security_id, `${path}.security_id`),
    resulting_security_ids: requireStringArray(input.resulting_security_ids, `${path}.resulting_security_ids`),
    reason_text: canonicalOptionalTextToDaml(input.reason_text, `${path}.reason_text`),
    split_transaction_id: canonicalOptionalTextToDaml(input.split_transaction_id, `${path}.split_transaction_id`),
    comments: commentsToDaml(input.comments, `${path}.comments`),
  } satisfies DamlDataTypeFor<'stockReissuance'>;

  validateCanonicalWriterInput('stockReissuance', 'TX_STOCK_REISSUANCE', input, path);
  return result;
}
