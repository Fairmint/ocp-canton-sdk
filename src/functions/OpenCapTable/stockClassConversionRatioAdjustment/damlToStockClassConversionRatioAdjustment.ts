/** DAML to OCF converter for StockClassConversionRatioAdjustment. */

import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { OcfStockClassConversionRatioAdjustment } from '../../../types/native';
import { damlTimeToDateString, isRecord } from '../../../utils/typeConversions';
import type { DamlDataTypeFor, OcfReadDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData } from '../capTable/damlEntityData';
import { requireGeneratedDamlMonetary, requireGeneratedDamlNumeric10 } from '../shared/generatedDamlValues';
import {
  freezeStockCorporateActionEvent,
  requireStockCorporateActionComments,
  requireStockCorporateActionText,
} from '../shared/stockCorporateActionValues';

/** Exact generated ledger representation accepted by the direct reader. */
export type DamlStockClassConversionRatioAdjustmentData = DamlDataTypeFor<'stockClassConversionRatioAdjustment'>;

function requiredMissing(field: string, expectedType: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(field, `${field} is required`, {
    code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    expectedType,
    receivedValue,
  });
}

function invalidType(field: string, expectedType: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(field, `${field} has an invalid type`, {
    code: OcpErrorCodes.INVALID_TYPE,
    expectedType,
    receivedValue,
  });
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (value === null || value === undefined) throw requiredMissing(field, 'object', value);
  if (!isRecord(value)) throw invalidType(field, 'object', value);
  return value;
}

function roundingTypeFromDaml(value: unknown, field: string): 'NORMAL' | 'CEILING' | 'FLOOR' {
  const constructor = requireStockCorporateActionText(value, field);
  switch (constructor) {
    case 'OcfRoundingNormal':
      return 'NORMAL';
    case 'OcfRoundingCeiling':
      return 'CEILING';
    case 'OcfRoundingFloor':
      return 'FLOOR';
    default:
      throw new OcpParseError(`Unknown rounding_type: ${constructor}`, {
        source: field,
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

/** Convert exact generated DAML adjustment data to canonical OCF. */
export function damlStockClassConversionRatioAdjustmentToNative(
  input: DamlStockClassConversionRatioAdjustmentData
): OcfReadDataTypeFor<'stockClassConversionRatioAdjustment'> {
  const data = decodeDamlEntityData('stockClassConversionRatioAdjustment', input);
  const mechanismField = 'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism';
  const mechanism = requireRecord(data.new_ratio_conversion_mechanism, mechanismField);
  const ratio = requireRecord(mechanism.ratio, `${mechanismField}.ratio`);
  const comments = requireStockCorporateActionComments(data.comments, 'stockClassConversionRatioAdjustment.comments');

  const native: OcfStockClassConversionRatioAdjustment = {
    object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
    id: requireStockCorporateActionText(data.id, 'stockClassConversionRatioAdjustment.id'),
    date: damlTimeToDateString(data.date, 'stockClassConversionRatioAdjustment.date'),
    stock_class_id: requireStockCorporateActionText(
      data.stock_class_id,
      'stockClassConversionRatioAdjustment.stock_class_id'
    ),
    new_ratio_conversion_mechanism: {
      type: 'RATIO_CONVERSION',
      conversion_price: requireGeneratedDamlMonetary(mechanism.conversion_price, `${mechanismField}.conversion_price`),
      ratio: {
        numerator: requireGeneratedDamlNumeric10(ratio.numerator, `${mechanismField}.ratio.numerator`, 'positive'),
        denominator: requireGeneratedDamlNumeric10(
          ratio.denominator,
          `${mechanismField}.ratio.denominator`,
          'positive'
        ),
      },
      rounding_type: roundingTypeFromDaml(mechanism.rounding_type, `${mechanismField}.rounding_type`),
    },
    ...(comments.length > 0 ? { comments } : {}),
  };

  return freezeStockCorporateActionEvent(native);
}
