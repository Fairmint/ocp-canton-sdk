/** OCF to DAML converter for StockClassConversionRatioAdjustment. */

import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { Monetary, OcfStockClassConversionRatioAdjustment } from '../../../types/native';
import { dateStringToDAMLTime, isRecord } from '../../../utils/typeConversions';
import {
  assertCanonicalJsonGraph,
  assertExactObjectFields,
  assertNotRuntimeProxy,
  optionalStringArrayToDaml,
  requireCurrencyCode,
  requireNonnegativeDecimal,
  requirePositiveDecimal,
} from '../shared/ocfValues';

type DamlRatioAdjustment =
  Fairmint.OpenCapTable.OCF.StockClassConversionRatioAdjustment.StockClassConversionRatioAdjustmentOcfData;

const ROOT_FIELDS = [
  'object_type',
  'id',
  'date',
  'stock_class_id',
  'new_ratio_conversion_mechanism',
  'comments',
] as const;
const MECHANISM_FIELDS = ['type', 'conversion_price', 'ratio', 'rounding_type'] as const;
const MONETARY_FIELDS = ['amount', 'currency'] as const;
const RATIO_FIELDS = ['numerator', 'denominator'] as const;

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
  if (value === undefined) throw requiredMissing(field, 'object', value);
  assertNotRuntimeProxy(value, field, 'plain OCF object');
  if (!isRecord(value)) throw invalidType(field, 'object', value);
  return value;
}

function requireString(value: unknown, field: string): string {
  if (value === undefined) throw requiredMissing(field, 'string', value);
  if (typeof value !== 'string') throw invalidType(field, 'string', value);
  return value;
}

function requireNonEmptyString(value: unknown, field: string): string {
  const text = requireString(value, field);
  if (text.length === 0) throw invalidFormat(field, 'non-empty string', value);
  return text;
}

function requiredDateToDaml(value: unknown, fieldPath: string): string {
  if (value === undefined) {
    throw requiredMissing(fieldPath, 'YYYY-MM-DD or RFC 3339 date-time string', value);
  }
  return dateStringToDAMLTime(value, fieldPath);
}

function requiredPositiveDecimal(value: unknown, field: string): string {
  if (value === null) throw invalidType(field, 'positive decimal string', value);
  return requirePositiveDecimal(value, field);
}

function requiredMonetary(record: Record<string, unknown>, field: string): Monetary {
  if (record.amount === null) throw invalidType(`${field}.amount`, 'nonnegative decimal string', record.amount);
  if (record.currency === null) {
    throw invalidType(`${field}.currency`, 'three-letter uppercase currency code', record.currency);
  }
  return {
    amount: requireNonnegativeDecimal(record.amount, `${field}.amount`),
    currency: requireCurrencyCode(record.currency, `${field}.currency`),
  };
}

function requireObjectType(value: unknown): void {
  const field = 'stockClassConversionRatioAdjustment.object_type';
  const objectType = requireString(value, field);
  if (objectType !== 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT') {
    throw new OcpValidationError(field, `Unknown stock-class conversion-ratio adjustment object_type: ${objectType}`, {
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      expectedType: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
      receivedValue: value,
    });
  }
}

function requireMechanismType(value: unknown): void {
  const field = 'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.type';
  const type = requireString(value, field);
  if (type !== 'RATIO_CONVERSION') {
    throw new OcpValidationError(field, `Unknown stock-class conversion mechanism: ${type}`, {
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      expectedType: 'RATIO_CONVERSION',
      receivedValue: value,
    });
  }
}

function roundingTypeToDaml(value: unknown): Fairmint.OpenCapTable.Types.Conversion.OcfRoundingType {
  const field = 'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.rounding_type';
  const roundingType = requireString(value, field);
  switch (roundingType) {
    case 'NORMAL':
      return 'OcfRoundingNormal';
    case 'CEILING':
      return 'OcfRoundingCeiling';
    case 'FLOOR':
      return 'OcfRoundingFloor';
    default:
      throw new OcpValidationError(field, `Unknown rounding_type: ${roundingType}`, {
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        expectedType: 'NORMAL | CEILING | FLOOR',
        receivedValue: value,
      });
  }
}

/** Convert exact canonical OCF ratio-adjustment data to generated DAML data. */
export function stockClassConversionRatioAdjustmentDataToDaml(
  input: OcfStockClassConversionRatioAdjustment
): DamlRatioAdjustment {
  const field = 'stockClassConversionRatioAdjustment';
  const data = requireRecord(input, field);
  assertExactObjectFields(data, ROOT_FIELDS, field);
  requireObjectType(data.object_type);

  const mechanismField = `${field}.new_ratio_conversion_mechanism`;
  const mechanism = requireRecord(data.new_ratio_conversion_mechanism, mechanismField);
  assertExactObjectFields(mechanism, MECHANISM_FIELDS, mechanismField);
  requireMechanismType(mechanism.type);

  const monetaryField = `${mechanismField}.conversion_price`;
  const monetary = requireRecord(mechanism.conversion_price, monetaryField);
  assertExactObjectFields(monetary, MONETARY_FIELDS, monetaryField);

  const ratioField = `${mechanismField}.ratio`;
  const ratio = requireRecord(mechanism.ratio, ratioField);
  assertExactObjectFields(ratio, RATIO_FIELDS, ratioField);
  assertCanonicalJsonGraph(input, field, { rejectUndefined: true });

  return {
    id: requireNonEmptyString(data.id, `${field}.id`),
    date: requiredDateToDaml(data.date, `${field}.date`),
    stock_class_id: requireNonEmptyString(data.stock_class_id, `${field}.stock_class_id`),
    new_ratio_conversion_mechanism: {
      conversion_price: requiredMonetary(monetary, monetaryField),
      ratio: {
        numerator: requiredPositiveDecimal(ratio.numerator, `${ratioField}.numerator`),
        denominator: requiredPositiveDecimal(ratio.denominator, `${ratioField}.denominator`),
      },
      rounding_type: roundingTypeToDaml(mechanism.rounding_type),
    },
    comments: optionalStringArrayToDaml(data.comments, `${field}.comments`),
  };
}
