/**
 * OCF to DAML converter for StockClassConversionRatioAdjustment.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfStockClassConversionRatioAdjustment } from '../../../types/native';
import { cleanComments, dateStringToDAMLTime } from '../../../utils/typeConversions';

/**
 * Convert native OCF StockClassConversionRatioAdjustment data to DAML format.
 *
 * DAML expects new_ratio_conversion_mechanism as an OcfRatioConversionMechanism object
 * while OCF has flat new_ratio_numerator and new_ratio_denominator fields.
 *
 * Note: The OCF type includes optional `board_approval_date` and `stockholder_approval_date`
 * fields, but the DAML StockClassConversionRatioAdjustmentOcfData contract does not support
 * these fields. They are intentionally omitted from the conversion.
 *
 * The DAML OcfRatioConversionMechanism requires `conversion_price` and `rounding_type` fields
 * that are not present in the OCF type. Default values are used:
 * - conversion_price: { amount: '0', currency: 'USD' }
 * - rounding_type: 'OcfRoundingNormal'
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
  const legacyRatioMechanism =
    d.new_ratio_numerator && d.new_ratio_denominator
      ? {
          type: 'RATIO_CONVERSION',
          conversion_price: { amount: '0', currency: 'USD' },
          ratio: {
            numerator: d.new_ratio_numerator,
            denominator: d.new_ratio_denominator,
          },
          rounding_type: 'NORMAL',
        }
      : null;

  const newRatioConversionMechanism = d.new_ratio_conversion_mechanism ?? legacyRatioMechanism;
  if (!newRatioConversionMechanism) {
    throw new OcpValidationError(
      'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism',
      'Required conversion mechanism is missing',
      {
        expectedType: 'ConversionMechanism',
        receivedValue: d.new_ratio_conversion_mechanism,
      }
    );
  }

  const roundingTypeMap: Record<'NORMAL' | 'CEILING' | 'FLOOR', string> = {
    NORMAL: 'OcfRoundingNormal',
    CEILING: 'OcfRoundingCeiling',
    FLOOR: 'OcfRoundingFloor',
  };

  const normalizedRoundingType =
    roundingTypeMap[newRatioConversionMechanism.rounding_type as keyof typeof roundingTypeMap];
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
      conversion_price: newRatioConversionMechanism.conversion_price,
      ratio: newRatioConversionMechanism.ratio,
      rounding_type: normalizedRoundingType,
    },
    comments: cleanComments(d.comments),
  };
}
