/**
 * OCF to DAML converter for StockClassSplit.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfStockClassSplit } from '../../../types/native';
import { cleanComments, dateStringToDAMLTime, numberToString } from '../../../utils/typeConversions';

/**
 * Convert native OCF StockClassSplit data to DAML format.
 *
 * DAML expects split_ratio as an OcfRatio object { numerator, denominator }
 * while OCF has flat split_ratio_numerator and split_ratio_denominator fields.
 */
export function stockClassSplitDataToDaml(d: OcfStockClassSplit): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('stockClassSplit.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    stock_class_id: d.stock_class_id,
    split_ratio: {
      numerator: numberToString(d.split_ratio_numerator),
      denominator: numberToString(d.split_ratio_denominator),
    },
    comments: cleanComments(d.comments),
  };
}
