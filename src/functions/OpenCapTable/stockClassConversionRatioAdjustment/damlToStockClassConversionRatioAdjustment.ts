/**
 * DAML to OCF converter for StockClassConversionRatioAdjustment.
 */

import { OcpErrorCodes, OcpParseError, type OcpErrorCode } from '../../../errors';
import type { OcfStockClassConversionRatioAdjustment } from '../../../types/native';
import { assertSafeGeneratedDamlJson } from '../../../utils/generatedDamlValidation';
import { canonicalizeNumeric10 } from '../../../utils/numeric10';
import { damlTimeToDateString, isRecord } from '../../../utils/typeConversions';

export function damlRatioRoundingTypeToNative(
  value: unknown,
  fieldPath = 'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.rounding_type'
): 'NORMAL' | 'CEILING' | 'FLOOR' {
  switch (value) {
    case 'OcfRoundingNormal':
      return 'NORMAL';
    case 'OcfRoundingCeiling':
      return 'CEILING';
    case 'OcfRoundingFloor':
      return 'FLOOR';
    default:
      throw new OcpParseError(`Unknown DAML ratio rounding type: ${String(value)}`, {
        source: fieldPath,
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        context: { receivedValue: value },
      });
  }
}

/** DAML StockClassConversionRatioAdjustmentOcfData structure */
export interface DamlStockClassConversionRatioAdjustmentData {
  id: string;
  date: string;
  stock_class_id: string;
  new_ratio_conversion_mechanism: {
    conversion_price: { amount: string; currency: string };
    ratio: {
      numerator: string;
      denominator: string;
    };
    rounding_type: string;
  };
  comments: string[];
}

function invalidGeneratedField(
  source: string,
  message: string,
  receivedValue: unknown,
  code: OcpErrorCode = OcpErrorCodes.SCHEMA_MISMATCH
): never {
  throw new OcpParseError(message, {
    source,
    code,
    classification: 'invalid_ratio_adjustment_data',
    context: { receivedValue },
  });
}

function requireRecord(value: unknown, source: string): Record<string, unknown> {
  if (value === undefined) {
    return invalidGeneratedField(
      source,
      `Missing generated DAML record at ${source}`,
      value,
      OcpErrorCodes.REQUIRED_FIELD_MISSING
    );
  }
  if (!isRecord(value)) {
    return invalidGeneratedField(source, `Expected a generated DAML record at ${source}`, value);
  }
  return value;
}

function requireText(value: unknown, source: string): string {
  if (value === undefined) {
    return invalidGeneratedField(
      source,
      `Missing generated DAML Text at ${source}`,
      value,
      OcpErrorCodes.REQUIRED_FIELD_MISSING
    );
  }
  if (typeof value !== 'string') {
    return invalidGeneratedField(source, `Expected generated DAML Text at ${source}`, value);
  }
  return value;
}

function rejectUnknownFields(value: Record<string, unknown>, source: string, allowedFields: readonly string[]): void {
  const allowed = new Set(allowedFields);
  const unknownField = Object.keys(value).find((field) => !allowed.has(field));
  if (unknownField !== undefined) {
    invalidGeneratedField(
      `${source}.${unknownField}`,
      `Unexpected generated DAML field ${unknownField}`,
      value[unknownField]
    );
  }
}

function decodeRatioAdjustmentData(input: unknown): DamlStockClassConversionRatioAdjustmentData {
  const rootPath = 'stockClassConversionRatioAdjustment';
  assertSafeGeneratedDamlJson(input, rootPath);
  const data = requireRecord(input, rootPath);
  rejectUnknownFields(data, rootPath, ['id', 'date', 'stock_class_id', 'new_ratio_conversion_mechanism', 'comments']);

  const mechanismPath = `${rootPath}.new_ratio_conversion_mechanism`;
  const mechanism = requireRecord(data.new_ratio_conversion_mechanism, mechanismPath);
  rejectUnknownFields(mechanism, mechanismPath, ['conversion_price', 'ratio', 'rounding_type']);

  const pricePath = `${mechanismPath}.conversion_price`;
  const price = requireRecord(mechanism.conversion_price, pricePath);
  rejectUnknownFields(price, pricePath, ['amount', 'currency']);

  const ratioPath = `${mechanismPath}.ratio`;
  const ratio = requireRecord(mechanism.ratio, ratioPath);
  rejectUnknownFields(ratio, ratioPath, ['numerator', 'denominator']);

  const commentsPath = `${rootPath}.comments`;
  if (!Array.isArray(data.comments)) {
    invalidGeneratedField(commentsPath, `Expected generated DAML List Text at ${commentsPath}`, data.comments);
  }
  const comments: string[] = data.comments.map((comment, index) => requireText(comment, `${commentsPath}[${index}]`));

  return {
    id: requireText(data.id, `${rootPath}.id`),
    date: requireText(data.date, `${rootPath}.date`),
    stock_class_id: requireText(data.stock_class_id, `${rootPath}.stock_class_id`),
    new_ratio_conversion_mechanism: {
      conversion_price: {
        amount: requireText(price.amount, `${pricePath}.amount`),
        currency: requireText(price.currency, `${pricePath}.currency`),
      },
      ratio: {
        numerator: requireText(ratio.numerator, `${ratioPath}.numerator`),
        denominator: requireText(ratio.denominator, `${ratioPath}.denominator`),
      },
      rounding_type: requireText(mechanism.rounding_type, `${mechanismPath}.rounding_type`),
    },
    comments,
  };
}

function readNumeric10(value: string, source: string): string {
  const result = canonicalizeNumeric10(value, { allowExponent: true });
  if (!result.ok) {
    return invalidGeneratedField(source, result.message, value, OcpErrorCodes.INVALID_FORMAT);
  }
  return result.value;
}

function readCurrency(value: string, source: string): string {
  if (!/^[A-Z]{3}$/.test(value)) {
    return invalidGeneratedField(
      source,
      `Generated currency at ${source} must be a three-letter uppercase ISO 4217 code`,
      value,
      OcpErrorCodes.INVALID_FORMAT
    );
  }
  return value;
}

/**
 * Convert DAML StockClassConversionRatioAdjustment data to native OCF format.
 *
 * Extracts the ratio from the nested OcfRatioConversionMechanism structure.
 */
export function damlStockClassConversionRatioAdjustmentToNative(
  d: DamlStockClassConversionRatioAdjustmentData
): OcfStockClassConversionRatioAdjustment {
  const decoded = decodeRatioAdjustmentData(d);

  return {
    object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
    id: decoded.id,
    date: damlTimeToDateString(decoded.date, 'stockClassConversionRatioAdjustment.date'),
    stock_class_id: decoded.stock_class_id,
    new_ratio_conversion_mechanism: {
      type: 'RATIO_CONVERSION',
      conversion_price: {
        amount: readNumeric10(
          decoded.new_ratio_conversion_mechanism.conversion_price.amount,
          'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.conversion_price.amount'
        ),
        currency: readCurrency(
          decoded.new_ratio_conversion_mechanism.conversion_price.currency,
          'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.conversion_price.currency'
        ),
      },
      ratio: {
        numerator: readNumeric10(
          decoded.new_ratio_conversion_mechanism.ratio.numerator,
          'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.ratio.numerator'
        ),
        denominator: readNumeric10(
          decoded.new_ratio_conversion_mechanism.ratio.denominator,
          'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.ratio.denominator'
        ),
      },
      rounding_type: damlRatioRoundingTypeToNative(decoded.new_ratio_conversion_mechanism.rounding_type),
    },
    ...(decoded.comments.length ? { comments: decoded.comments } : {}),
  };
}
