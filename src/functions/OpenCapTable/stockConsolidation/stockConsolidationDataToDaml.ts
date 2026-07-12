/**
 * OCF to DAML converter for StockConsolidation.
 */

import type { OcfStockConsolidation } from '../../../types/native';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { requireExactWriterInput, validateCanonicalWriterInput } from '../shared/ocfWriterValidation';
import {
  optionalStockCorporateActionTextToDaml,
  requireStockCorporateActionIdentifiers,
  requireStockCorporateActionText,
  stockCorporateActionCommentsToDaml,
} from '../shared/stockCorporateActionValues';

const ROOT_FIELDS = [
  'comments',
  'date',
  'id',
  'object_type',
  'reason_text',
  'resulting_security_id',
  'security_ids',
] as const;

/**
 * Convert native OCF StockConsolidation data to DAML format.
 *
 * Both canonical OCF and DAML use resulting_security_id (singular).
 */
export function stockConsolidationDataToDaml(d: OcfStockConsolidation): DamlDataTypeFor<'stockConsolidation'> {
  const path = 'stockConsolidation';
  const input = requireExactWriterInput(d, path, ROOT_FIELDS);
  const result = {
    id: requireStockCorporateActionText(input.id, `${path}.id`),
    date: dateStringToDAMLTime(input.date, `${path}.date`),
    security_ids: requireStockCorporateActionIdentifiers(input.security_ids, `${path}.security_ids`),
    resulting_security_id: requireStockCorporateActionText(
      input.resulting_security_id,
      `${path}.resulting_security_id`
    ),
    reason_text: optionalStockCorporateActionTextToDaml(input.reason_text, `${path}.reason_text`),
    comments: stockCorporateActionCommentsToDaml(input.comments, `${path}.comments`),
  } satisfies DamlDataTypeFor<'stockConsolidation'>;

  validateCanonicalWriterInput('stockConsolidation', 'TX_STOCK_CONSOLIDATION', input, path);
  return result;
}
