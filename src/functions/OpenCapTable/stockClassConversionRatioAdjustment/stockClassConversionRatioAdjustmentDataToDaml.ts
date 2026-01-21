/**
 * OCF to DAML converter for StockClassConversionRatioAdjustment.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfStockClassConversionRatioAdjustment } from '../../../types/native';
import { cleanComments, dateStringToDAMLTime, numberToString } from '../../../utils/typeConversions';

/**
 * Convert native OCF StockClassConversionRatioAdjustment data to DAML format.
 *
 * DAML expects new_ratio_conversion_mechanism as an OcfRatioConversionMechanism object
 * while OCF has flat new_ratio_numerator and new_ratio_denominator fields.
 */
export function stockClassConversionRatioAdjustmentDataToDaml(
  d: OcfStockClassConversionRatioAdjustment
): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('stockClassConversionRatioAdjustment.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    stock_class_id: d.stock_class_id,
    new_ratio_conversion_mechanism: {
      conversion_price: { amount: '0', currency: 'USD' }, // Default value for required field
      ratio: {
        numerator: numberToString(d.new_ratio_numerator),
        denominator: numberToString(d.new_ratio_denominator),
      },
      rounding_type: 'OcfRoundingNormal', // Default rounding type
    },
    comments: cleanComments(d.comments),
  };
}
