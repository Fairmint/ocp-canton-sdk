/**
 * DAML to OCF converter for StockClassConversionRatioAdjustment.
 */

import type { OcfStockClassConversionRatioAdjustment } from '../../../types/native';
import { damlMonetaryToNative, normalizeNumericString } from '../../../utils/typeConversions';

export function damlRoundingTypeToOcf(roundingType: string): 'NORMAL' | 'CEILING' | 'FLOOR' {
  return roundingType === 'OcfRoundingCeiling' ? 'CEILING' : roundingType === 'OcfRoundingFloor' ? 'FLOOR' : 'NORMAL';
}

/** DAML StockClassConversionRatioAdjustmentOcfData structure */
export interface DamlStockClassConversionRatioAdjustmentData {
  id: string;
  date: string;
  stock_class_id: string;
  new_ratio_conversion_mechanism: {
    conversion_price: { amount: string; currency: string };
    ratio: {
      numerator: string | number;
      denominator: string | number;
    };
    rounding_type: string;
  };
  comments: string[];
}

/**
 * Convert DAML StockClassConversionRatioAdjustment data to native OCF format.
 *
 * Extracts the ratio from the nested OcfRatioConversionMechanism structure.
 */
export function damlStockClassConversionRatioAdjustmentToNative(
  d: DamlStockClassConversionRatioAdjustmentData
): OcfStockClassConversionRatioAdjustment {
  const numeratorStr =
    typeof d.new_ratio_conversion_mechanism.ratio.numerator === 'number'
      ? d.new_ratio_conversion_mechanism.ratio.numerator.toString()
      : d.new_ratio_conversion_mechanism.ratio.numerator;
  const denominatorStr =
    typeof d.new_ratio_conversion_mechanism.ratio.denominator === 'number'
      ? d.new_ratio_conversion_mechanism.ratio.denominator.toString()
      : d.new_ratio_conversion_mechanism.ratio.denominator;

  return {
    id: d.id,
    date: d.date.split('T')[0],
    stock_class_id: d.stock_class_id,
    new_ratio_conversion_mechanism: {
      type: 'RATIO_CONVERSION',
      conversion_price: damlMonetaryToNative(d.new_ratio_conversion_mechanism.conversion_price),
      ratio: {
        numerator: normalizeNumericString(numeratorStr),
        denominator: normalizeNumericString(denominatorStr),
      },
      rounding_type: damlRoundingTypeToOcf(d.new_ratio_conversion_mechanism.rounding_type),
    },
    ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments } : {}),
  };
}
