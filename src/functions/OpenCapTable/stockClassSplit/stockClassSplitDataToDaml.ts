/**
 * OCF to DAML converter for StockClassSplit.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfStockClassSplit } from '../../../types/native';
import { cleanComments, dateStringToDAMLTime, normalizeNumericString } from '../../../utils/typeConversions';

/**
 * Convert native OCF StockClassSplit data to DAML format.
 *
 * Both canonical OCF and DAML represent split_ratio as an OcfRatio object.
 */
export function stockClassSplitDataToDaml(d: OcfStockClassSplit): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('stockClassSplit.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  const splitRatio = d.split_ratio;
  const normalizedSplitRatio = {
    numerator: normalizeNumericString(splitRatio.numerator),
    denominator: normalizeNumericString(splitRatio.denominator),
  };

  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date, 'stockClassSplit.date'),
    stock_class_id: d.stock_class_id,
    split_ratio: normalizedSplitRatio,
    comments: cleanComments(d.comments),
  };
}
