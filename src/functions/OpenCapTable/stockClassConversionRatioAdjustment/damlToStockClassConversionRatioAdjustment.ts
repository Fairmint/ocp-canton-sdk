/** DAML to OCF converter for StockClassConversionRatioAdjustment. */

import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { OcfStockClassConversionRatioAdjustment } from '../../../types/native';
import { damlTimeToDateString, isRecord } from '../../../utils/typeConversions';
import { decodeLosslessGeneratedDamlValue } from '../capTable/damlCodecLosslessness';
import { requireDenseArray, requireMonetary, requirePositiveDecimal } from '../shared/ocfValues';

/** Exact generated ledger representation accepted by the direct reader. */
export type DamlStockClassConversionRatioAdjustmentData =
  Fairmint.OpenCapTable.OCF.StockClassConversionRatioAdjustment.StockClassConversionRatioAdjustmentOcfData;

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

function invalidFormat(field: string, expectedType: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(field, `${field} has an invalid format`, {
    code: OcpErrorCodes.INVALID_FORMAT,
    expectedType,
    receivedValue,
  });
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (value === null || value === undefined) throw requiredMissing(field, 'object', value);
  if (!isRecord(value)) throw invalidType(field, 'object', value);
  return value;
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (value === null || value === undefined) throw requiredMissing(field, 'non-empty string', value);
  if (typeof value !== 'string') throw invalidType(field, 'non-empty string', value);
  if (value.length === 0) throw invalidFormat(field, 'non-empty string', value);
  return value;
}

function requireString(value: unknown, field: string): string {
  if (value === null || value === undefined) throw requiredMissing(field, 'string', value);
  if (typeof value !== 'string') throw invalidType(field, 'string', value);
  return value;
}

function roundingTypeFromDaml(value: unknown, field: string): 'NORMAL' | 'CEILING' | 'FLOOR' {
  const constructor = requireNonEmptyString(value, field);
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

function commentsFromDaml(value: unknown): string[] | undefined {
  if (value === null || value === undefined) return undefined;
  const comments = requireDenseArray(value, 'stockClassConversionRatioAdjustment.comments').map((comment, index) =>
    requireString(comment, `stockClassConversionRatioAdjustment.comments.${index}`)
  );
  return comments.length === 0 ? undefined : comments;
}

/** Convert exact generated DAML adjustment data to canonical OCF. */
export function damlStockClassConversionRatioAdjustmentToNative(
  value: DamlStockClassConversionRatioAdjustmentData
): OcfStockClassConversionRatioAdjustment {
  const data = requireRecord(value, 'stockClassConversionRatioAdjustment');
  const mechanismField = 'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism';
  const mechanism = requireRecord(data.new_ratio_conversion_mechanism, mechanismField);
  const ratio = requireRecord(mechanism.ratio, `${mechanismField}.ratio`);
  const comments = commentsFromDaml(data.comments);

  const native: OcfStockClassConversionRatioAdjustment = {
    object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
    id: requireNonEmptyString(data.id, 'stockClassConversionRatioAdjustment.id'),
    date: damlTimeToDateString(data.date, 'stockClassConversionRatioAdjustment.date'),
    stock_class_id: requireNonEmptyString(data.stock_class_id, 'stockClassConversionRatioAdjustment.stock_class_id'),
    new_ratio_conversion_mechanism: {
      type: 'RATIO_CONVERSION',
      conversion_price: requireMonetary(mechanism.conversion_price, `${mechanismField}.conversion_price`),
      ratio: {
        numerator: requirePositiveDecimal(ratio.numerator, `${mechanismField}.ratio.numerator`),
        denominator: requirePositiveDecimal(ratio.denominator, `${mechanismField}.ratio.denominator`),
      },
      rounding_type: roundingTypeFromDaml(mechanism.rounding_type, `${mechanismField}.rounding_type`),
    },
    ...(comments !== undefined ? { comments } : {}),
  };

  decodeLosslessGeneratedDamlValue(
    Fairmint.OpenCapTable.OCF.StockClassConversionRatioAdjustment.StockClassConversionRatioAdjustmentOcfData,
    data,
    {
      rootPath: 'stockClassConversionRatioAdjustment',
      description: 'stockClassConversionRatioAdjustment',
      decodeSource: 'getStockClassConversionRatioAdjustmentAsOcf',
      allowUndefinedOptional: true,
      allowNullishEmptyArray: true,
      context: {
        entityType: 'stockClassConversionRatioAdjustment',
        expectedTemplateId:
          Fairmint.OpenCapTable.OCF.StockClassConversionRatioAdjustment.StockClassConversionRatioAdjustment.templateId,
      },
    },
    {
      decodeInput: data.comments === null || data.comments === undefined ? { ...data, comments: [] } : data,
    }
  );

  return native;
}
