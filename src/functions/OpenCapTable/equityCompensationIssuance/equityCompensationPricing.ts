import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { CompensationType, Monetary } from '../../../types';
import { canonicalizeNumeric10, canonicalizeOcfNumeric10 } from '../../../utils/numeric10';

type OptionCompensationType = Extract<CompensationType, 'OPTION' | 'OPTION_ISO' | 'OPTION_NSO'>;
type SarCompensationType = Extract<CompensationType, 'CSAR' | 'SSAR'>;
type MonetaryBoundary = 'daml' | 'ocf';

const MONETARY_FIELDS = new Set(['amount', 'currency']);

/** Exact pricing fields selected by an equity-compensation discriminator. */
export type EquityCompensationPricing =
  | Readonly<{
      compensation_type: OptionCompensationType;
      exercise_price: Monetary;
      base_price?: never;
    }>
  | Readonly<{
      compensation_type: SarCompensationType;
      exercise_price?: never;
      base_price: Monetary;
    }>
  | Readonly<{
      compensation_type: 'RSU';
      exercise_price?: never;
      base_price?: never;
    }>;

function requiredPrice(
  field: 'exercise_price' | 'base_price',
  source: string,
  compensationType: CompensationType
): never {
  throw new OcpValidationError(`${source}.${field}`, `${field} is required for ${compensationType}`, {
    code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    expectedType: 'Monetary',
  });
}

function rejectUnknownMonetaryFields(value: Record<string, unknown>, fieldPath: string): void {
  const unknownField = Object.keys(value).find((field) => !MONETARY_FIELDS.has(field));
  if (unknownField === undefined) return;

  throw new OcpValidationError(`${fieldPath}.${unknownField}`, 'Unexpected Monetary field', {
    code: OcpErrorCodes.INVALID_FORMAT,
    expectedType: 'only amount and currency',
    receivedValue: value[unknownField],
  });
}

function invalidMonetaryType(value: unknown, fieldPath: string): never {
  throw new OcpValidationError(fieldPath, 'Monetary value must be a non-null object', {
    code: OcpErrorCodes.INVALID_TYPE,
    expectedType: 'Monetary object',
    receivedValue: value,
  });
}

function requireExactMonetary(value: unknown, fieldPath: string, boundary: MonetaryBoundary): Monetary {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    invalidMonetaryType(value, fieldPath);
  }

  const monetary = value as Record<string, unknown>;
  rejectUnknownMonetaryFields(monetary, fieldPath);

  const amountPath = `${fieldPath}.amount`;
  if (monetary.amount === undefined || monetary.amount === null) {
    throw new OcpValidationError(amountPath, 'Monetary amount is required', {
      code: boundary === 'daml' ? OcpErrorCodes.REQUIRED_FIELD_MISSING : OcpErrorCodes.INVALID_TYPE,
      expectedType: 'Numeric(10) string',
      receivedValue: monetary.amount,
    });
  }
  if (typeof monetary.amount !== 'string') {
    throw new OcpValidationError(amountPath, 'Monetary amount must be a string', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'Numeric(10) string',
      receivedValue: monetary.amount,
    });
  }

  const amountResult =
    boundary === 'ocf'
      ? canonicalizeOcfNumeric10(monetary.amount)
      : canonicalizeNumeric10(monetary.amount, { allowExponent: true });
  if (!amountResult.ok) {
    throw new OcpValidationError(amountPath, amountResult.message, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: boundary === 'ocf' ? 'OCF Numeric with at most 10 decimal places' : 'DAML Numeric(10)',
      receivedValue: monetary.amount,
    });
  }

  const currencyPath = `${fieldPath}.currency`;
  if (monetary.currency === undefined || monetary.currency === null || monetary.currency === '') {
    throw new OcpValidationError(currencyPath, 'Monetary currency is required', {
      code:
        boundary === 'daml' || monetary.currency === ''
          ? OcpErrorCodes.REQUIRED_FIELD_MISSING
          : OcpErrorCodes.INVALID_TYPE,
      expectedType: 'three-letter uppercase ISO 4217 currency code',
      receivedValue: monetary.currency,
    });
  }
  if (typeof monetary.currency !== 'string') {
    throw new OcpValidationError(currencyPath, 'Monetary currency must be a string', {
      code: boundary === 'daml' ? OcpErrorCodes.REQUIRED_FIELD_MISSING : OcpErrorCodes.INVALID_TYPE,
      expectedType: 'three-letter uppercase ISO 4217 currency code',
      receivedValue: monetary.currency,
    });
  }
  if (!/^[A-Z]{3}$/.test(monetary.currency)) {
    throw new OcpValidationError(currencyPath, 'Currency must be a three-letter uppercase ISO 4217 code', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'three-letter uppercase ISO 4217 currency code',
      receivedValue: monetary.currency,
    });
  }

  return { amount: amountResult.value, currency: monetary.currency };
}

function validateRequiredPrice(
  value: unknown,
  field: 'exercise_price' | 'base_price',
  source: string,
  compensationType: CompensationType
): Monetary {
  if (value === undefined) {
    requiredPrice(field, source, compensationType);
  }
  return requireExactMonetary(value, `${source}.${field}`, 'ocf');
}

function rejectNullPrice(value: unknown, field: 'exercise_price' | 'base_price', source: string): void {
  if (value !== null) return;
  throw new OcpValidationError(`${source}.${field}`, `${field} must be a Monetary object when provided`, {
    code: OcpErrorCodes.INVALID_TYPE,
    expectedType: 'Monetary or omitted',
    receivedValue: value,
  });
}

function forbiddenPrice(
  field: 'exercise_price' | 'base_price',
  source: string,
  compensationType: CompensationType
): never {
  throw new OcpValidationError(`${source}.${field}`, `${field} is not valid for ${compensationType}`, {
    code: OcpErrorCodes.INVALID_FORMAT,
    expectedType: 'absent',
  });
}

/**
 * Validate and narrow the price fields governed by {@code compensation_type}.
 *
 * This is used at both write and ledger-read boundaries so untyped JavaScript
 * callers and malformed ledger values cannot bypass the public discriminated union.
 */
export function validateEquityCompensationPricing(
  compensationType: CompensationType,
  exercisePrice: unknown,
  basePrice: unknown,
  source: string
): EquityCompensationPricing {
  rejectNullPrice(exercisePrice, 'exercise_price', source);
  rejectNullPrice(basePrice, 'base_price', source);

  switch (compensationType) {
    case 'OPTION':
    case 'OPTION_ISO':
    case 'OPTION_NSO': {
      const validatedExercisePrice = validateRequiredPrice(exercisePrice, 'exercise_price', source, compensationType);
      if (basePrice !== undefined) forbiddenPrice('base_price', source, compensationType);
      return { compensation_type: compensationType, exercise_price: validatedExercisePrice };
    }
    case 'CSAR':
    case 'SSAR': {
      const validatedBasePrice = validateRequiredPrice(basePrice, 'base_price', source, compensationType);
      if (exercisePrice !== undefined) forbiddenPrice('exercise_price', source, compensationType);
      return { compensation_type: compensationType, base_price: validatedBasePrice };
    }
    case 'RSU':
      if (exercisePrice !== undefined) forbiddenPrice('exercise_price', source, compensationType);
      if (basePrice !== undefined) forbiddenPrice('base_price', source, compensationType);
      return { compensation_type: compensationType };
    default: {
      const exhaustiveCheck: never = compensationType;
      throw new OcpValidationError(
        `${source}.compensation_type`,
        `Unknown compensation type: ${String(exhaustiveCheck)}`,
        {
          code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
          receivedValue: exhaustiveCheck,
        }
      );
    }
  }
}

/** Decode an optional generated DAML Monetary at the compensation ledger-read boundary. */
export function equityCompensationMonetaryFromDaml(value: unknown, fieldPath: string): Monetary | undefined {
  if (value === null || value === undefined) return undefined;
  return requireExactMonetary(value, fieldPath, 'daml');
}
