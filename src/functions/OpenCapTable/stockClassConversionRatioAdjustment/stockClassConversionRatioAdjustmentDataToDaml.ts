/**
 * OCF to DAML converter for StockClassConversionRatioAdjustment.
 */

import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfStockClassConversionRatioAdjustment } from '../../../types/native';
import { canonicalizeOcfNumeric10 } from '../../../utils/numeric10';
import { assertSafeOcfJson } from '../../../utils/ocfJsonValidation';
import { parseOcfEntityInput } from '../../../utils/ocfZodSchemas';
import { cleanComments, dateStringToDAMLTime, monetaryToDaml } from '../../../utils/typeConversions';

const ROOT_PATH = 'stockClassConversionRatioAdjustment';
const MECHANISM_PATH = `${ROOT_PATH}.new_ratio_conversion_mechanism`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireRecord(value: unknown, fieldPath: string): Record<string, unknown> {
  if (value === undefined) {
    throw new OcpValidationError(fieldPath, 'Required value is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'object',
      receivedValue: value,
    });
  }
  if (!isRecord(value)) {
    throw new OcpValidationError(fieldPath, 'Expected a non-null object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'object',
      receivedValue: value,
    });
  }
  return value;
}

function rejectUnknownFields(
  value: Record<string, unknown>,
  fieldPath: string,
  allowedFields: readonly string[]
): void {
  const allowed = new Set(allowedFields);
  const unknownField = Object.keys(value).find((field) => !allowed.has(field));
  if (unknownField !== undefined) {
    throw new OcpValidationError(`${fieldPath}.${unknownField}`, 'Unexpected field', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: `only ${allowedFields.join(', ')}`,
      receivedValue: value[unknownField],
    });
  }
}

function requireString(value: unknown, fieldPath: string): string {
  if (value === undefined) {
    throw new OcpValidationError(fieldPath, 'Required value is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'non-empty string',
      receivedValue: value,
    });
  }
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, 'Expected a non-empty string', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'non-empty string',
      receivedValue: value,
    });
  }
  if (value.trim().length === 0) {
    throw new OcpValidationError(fieldPath, 'Expected a non-blank string', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'non-empty string',
      receivedValue: value,
    });
  }
  return value;
}

function requireNumeric(value: unknown, fieldPath: string): string {
  if (value === undefined) {
    throw new OcpValidationError(fieldPath, 'Required numeric value is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'decimal string or finite number',
      receivedValue: value,
    });
  }
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, 'Expected an OCF Numeric string', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'OCF Numeric string',
      receivedValue: value,
    });
  }
  const result = canonicalizeOcfNumeric10(value);
  if (!result.ok) {
    throw new OcpValidationError(fieldPath, result.message, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'OCF Numeric string within DAML Numeric 10 bounds',
      receivedValue: value,
    });
  }
  return result.value;
}

function requireRatioConversionMechanism(value: unknown): {
  conversionPrice: { amount: string; currency: string };
  ratio: { numerator: string; denominator: string };
  roundingType: 'OcfRoundingNormal' | 'OcfRoundingCeiling' | 'OcfRoundingFloor';
} {
  const mechanism = requireRecord(value, MECHANISM_PATH);
  rejectUnknownFields(mechanism, MECHANISM_PATH, ['type', 'conversion_price', 'ratio', 'rounding_type']);
  const typePath = `${MECHANISM_PATH}.type`;
  if (mechanism.type === undefined) {
    throw new OcpValidationError(typePath, 'Required discriminator is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'RATIO_CONVERSION',
      receivedValue: mechanism.type,
    });
  }
  if (typeof mechanism.type !== 'string') {
    throw new OcpValidationError(typePath, 'Conversion mechanism discriminator must be a string', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'RATIO_CONVERSION',
      receivedValue: mechanism.type,
    });
  }
  if (mechanism.type !== 'RATIO_CONVERSION') {
    throw new OcpValidationError(typePath, 'Unsupported conversion mechanism discriminator', {
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      expectedType: 'RATIO_CONVERSION',
      receivedValue: mechanism.type,
    });
  }

  const conversionPricePath = `${MECHANISM_PATH}.conversion_price`;
  const conversionPrice = requireRecord(mechanism.conversion_price, conversionPricePath);
  rejectUnknownFields(conversionPrice, conversionPricePath, ['amount', 'currency']);
  const amount = requireNumeric(conversionPrice.amount, `${conversionPricePath}.amount`);
  const currencyPath = `${conversionPricePath}.currency`;
  const currency = requireString(conversionPrice.currency, currencyPath);
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new OcpValidationError(currencyPath, 'Currency must be a three-letter uppercase ISO 4217 code', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'ISO 4217 currency code',
      receivedValue: currency,
    });
  }

  const ratioPath = `${MECHANISM_PATH}.ratio`;
  const ratio = requireRecord(mechanism.ratio, ratioPath);
  rejectUnknownFields(ratio, ratioPath, ['numerator', 'denominator']);
  const numerator = requireNumeric(ratio.numerator, `${ratioPath}.numerator`);
  const denominator = requireNumeric(ratio.denominator, `${ratioPath}.denominator`);

  const roundingPath = `${MECHANISM_PATH}.rounding_type`;
  if (mechanism.rounding_type === undefined) {
    throw new OcpValidationError(roundingPath, 'Required rounding type is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: "'NORMAL' | 'CEILING' | 'FLOOR'",
      receivedValue: mechanism.rounding_type,
    });
  }
  if (typeof mechanism.rounding_type !== 'string') {
    throw new OcpValidationError(roundingPath, 'Rounding type must be a string', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: "'NORMAL' | 'CEILING' | 'FLOOR'",
      receivedValue: mechanism.rounding_type,
    });
  }
  const roundingTypeMap: Partial<Record<string, 'OcfRoundingNormal' | 'OcfRoundingCeiling' | 'OcfRoundingFloor'>> = {
    NORMAL: 'OcfRoundingNormal',
    CEILING: 'OcfRoundingCeiling',
    FLOOR: 'OcfRoundingFloor',
  };
  const roundingType = roundingTypeMap[mechanism.rounding_type];
  if (roundingType === undefined) {
    throw new OcpValidationError(roundingPath, 'Unsupported rounding_type value', {
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      expectedType: "'NORMAL' | 'CEILING' | 'FLOOR'",
      receivedValue: mechanism.rounding_type,
    });
  }

  const result = {
    conversionPrice: { amount, currency },
    ratio: { numerator, denominator },
    roundingType,
  };
  return result;
}

/**
 * Convert native OCF StockClassConversionRatioAdjustment data to DAML format.
 *
 * The canonical OCF input requires the complete ratio conversion mechanism.
 */
export function stockClassConversionRatioAdjustmentDataToDaml(
  d: OcfStockClassConversionRatioAdjustment
): Record<string, unknown> {
  assertSafeOcfJson(d, ROOT_PATH);
  const root = requireRecord(d, ROOT_PATH);
  rejectUnknownFields(root, ROOT_PATH, [
    'object_type',
    'id',
    'date',
    'stock_class_id',
    'new_ratio_conversion_mechanism',
    'comments',
  ]);
  if (!d.id) {
    throw new OcpValidationError('stockClassConversionRatioAdjustment.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  const mechanism = requireRatioConversionMechanism(d.new_ratio_conversion_mechanism);

  const result = {
    id: d.id,
    date: dateStringToDAMLTime(d.date, 'stockClassConversionRatioAdjustment.date'),
    stock_class_id: d.stock_class_id,
    new_ratio_conversion_mechanism: {
      conversion_price: monetaryToDaml(mechanism.conversionPrice, `${MECHANISM_PATH}.conversion_price`),
      ratio: mechanism.ratio,
      rounding_type: mechanism.roundingType,
    },
    comments: cleanComments(d.comments),
  };
  parseOcfEntityInput('stockClassConversionRatioAdjustment', d);
  return result;
}
