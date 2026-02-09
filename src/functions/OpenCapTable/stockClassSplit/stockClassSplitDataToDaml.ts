/**
 * OCF to DAML converter for StockClassSplit.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfStockClassSplit } from '../../../types/native';
import { cleanComments, dateStringToDAMLTime } from '../../../utils/typeConversions';

/**
 * Convert native OCF StockClassSplit data to DAML format.
 *
 * DAML expects split_ratio as an OcfRatio object { numerator, denominator }
 * while OCF has flat split_ratio_numerator and split_ratio_denominator fields.
 *
 * Note: The OCF type includes optional `board_approval_date` and `stockholder_approval_date`
 * fields, but the DAML StockClassSplitOcfData contract does not support these fields.
 * They are intentionally omitted from the conversion.
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
      numerator: d.split_ratio_numerator,
      denominator: d.split_ratio_denominator,
    },
    comments: cleanComments(d.comments),
  };
}
