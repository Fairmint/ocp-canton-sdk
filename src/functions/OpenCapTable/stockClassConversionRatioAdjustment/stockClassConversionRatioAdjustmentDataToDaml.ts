/**
 * OCF to DAML converter for StockClassConversionRatioAdjustment.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfStockClassConversionRatioAdjustment } from '../../../types/native';
import {
  cleanComments,
  dateStringToDAMLTime,
  monetaryToDaml,
  normalizeNumericString,
} from '../../../utils/typeConversions';

function requireRatioConversionMechanism(
  value: OcfStockClassConversionRatioAdjustment['new_ratio_conversion_mechanism'] | undefined
): OcfStockClassConversionRatioAdjustment['new_ratio_conversion_mechanism'] {
  if (value) return value;

  throw new OcpValidationError(
    'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism',
    'Required conversion mechanism is missing',
    {
      expectedType: 'ConversionMechanism',
      receivedValue: value,
    }
  );
}

/**
 * Convert native OCF StockClassConversionRatioAdjustment data to DAML format.
 *
 * The canonical OCF input requires the complete ratio conversion mechanism.
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
  const newRatioConversionMechanism = requireRatioConversionMechanism(d.new_ratio_conversion_mechanism);

  const roundingTypeMap: Record<'NORMAL' | 'CEILING' | 'FLOOR', string> = {
    NORMAL: 'OcfRoundingNormal',
    CEILING: 'OcfRoundingCeiling',
    FLOOR: 'OcfRoundingFloor',
  };

  const normalizedRoundingType = roundingTypeMap[newRatioConversionMechanism.rounding_type];
  if (!normalizedRoundingType) {
    throw new OcpValidationError(
      'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.rounding_type',
      'Unsupported rounding_type value',
      {
        expectedType: "'NORMAL' | 'CEILING' | 'FLOOR'",
        receivedValue: newRatioConversionMechanism.rounding_type,
      }
    );
  }

  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    stock_class_id: d.stock_class_id,
    new_ratio_conversion_mechanism: {
      conversion_price: monetaryToDaml(newRatioConversionMechanism.conversion_price),
      ratio: {
        numerator: normalizeNumericString(newRatioConversionMechanism.ratio.numerator),
        denominator: normalizeNumericString(newRatioConversionMechanism.ratio.denominator),
      },
      rounding_type: normalizedRoundingType,
    },
    comments: cleanComments(d.comments),
  };
}
