/**
 * DAML to OCF converter for StockClassConversionRatioAdjustment.
 */

import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfStockClassConversionRatioAdjustment } from '../../../types/native';
import { damlMonetaryToNative, damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';

/** DAML StockClassConversionRatioAdjustmentOcfData structure */
export type DamlStockClassConversionRatioAdjustmentData = DamlDataTypeFor<'stockClassConversionRatioAdjustment'>;

function unreachableRoundingType(value: never): never {
  throw new OcpValidationError(
    'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.rounding_type',
    'Unsupported DAML rounding type',
    {
      code: OcpErrorCodes.INVALID_TYPE,
      receivedValue: value,
    }
  );
}

function roundingTypeToNative(
  value: DamlStockClassConversionRatioAdjustmentData['new_ratio_conversion_mechanism']['rounding_type']
): 'CEILING' | 'FLOOR' | 'NORMAL' {
  switch (value) {
    case 'OcfRoundingCeiling':
      return 'CEILING';
    case 'OcfRoundingFloor':
      return 'FLOOR';
    case 'OcfRoundingNormal':
      return 'NORMAL';
    default:
      return unreachableRoundingType(value);
  }
}

/**
 * Convert DAML StockClassConversionRatioAdjustment data to native OCF format.
 *
 * Extracts the ratio from the nested OcfRatioConversionMechanism structure.
 */
export function damlStockClassConversionRatioAdjustmentToNative(
  d: DamlStockClassConversionRatioAdjustmentData
): OcfStockClassConversionRatioAdjustment {
  return {
    object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
    id: d.id,
    date: damlTimeToDateString(d.date, 'stockClassConversionRatioAdjustment.date'),
    stock_class_id: d.stock_class_id,
    new_ratio_conversion_mechanism: {
      type: 'RATIO_CONVERSION',
      conversion_price: damlMonetaryToNative(d.new_ratio_conversion_mechanism.conversion_price),
      ratio: {
        numerator: normalizeNumericString(d.new_ratio_conversion_mechanism.ratio.numerator),
        denominator: normalizeNumericString(d.new_ratio_conversion_mechanism.ratio.denominator),
      },
      rounding_type: roundingTypeToNative(d.new_ratio_conversion_mechanism.rounding_type),
    },
    ...(d.comments.length ? { comments: d.comments } : {}),
  };
}
