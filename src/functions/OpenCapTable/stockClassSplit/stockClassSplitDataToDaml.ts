/**
 * OCF to DAML converter for StockClassSplit.
 */

import type { OcfStockClassSplit } from '../../../types/native';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { requiredTextToDaml } from '../shared/damlText';
import { requireDecimalString } from '../shared/ocfValues';
import { commentsToDaml, requireExactWriterInput, validateCanonicalWriterInput } from '../shared/ocfWriterValidation';

const ROOT_FIELDS = ['comments', 'date', 'id', 'object_type', 'split_ratio', 'stock_class_id'] as const;
const RATIO_FIELDS = ['denominator', 'numerator'] as const;

/**
 * Convert native OCF StockClassSplit data to DAML format.
 *
 * Both canonical OCF and DAML represent split_ratio as an OcfRatio object.
 */
export function stockClassSplitDataToDaml(d: OcfStockClassSplit): DamlDataTypeFor<'stockClassSplit'> {
  const path = 'stockClassSplit';
  const input = requireExactWriterInput(d, path, ROOT_FIELDS);
  const ratioPath = `${path}.split_ratio`;
  const ratio = requireExactWriterInput(input.split_ratio, ratioPath, RATIO_FIELDS);

  const result = {
    id: requiredTextToDaml(input.id, `${path}.id`),
    date: dateStringToDAMLTime(input.date, `${path}.date`),
    stock_class_id: requiredTextToDaml(input.stock_class_id, `${path}.stock_class_id`),
    split_ratio: {
      numerator: requireDecimalString(ratio.numerator, `${ratioPath}.numerator`),
      denominator: requireDecimalString(ratio.denominator, `${ratioPath}.denominator`),
    },
    comments: commentsToDaml(input.comments, `${path}.comments`),
  } satisfies DamlDataTypeFor<'stockClassSplit'>;

  validateCanonicalWriterInput('stockClassSplit', 'TX_STOCK_CLASS_SPLIT', input, path);
  return result;
}
