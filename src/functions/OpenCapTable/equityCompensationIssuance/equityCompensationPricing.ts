import { types as nodeUtilTypes } from 'node:util';

import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { describeDiagnosticValue } from '../../../errors/diagnostics';
import type { CompensationType, Monetary } from '../../../types';
import { canonicalizeNumeric10, canonicalizeOcfNumeric10 } from '../../../utils/numeric10';

type OptionCompensationType = Extract<CompensationType, 'OPTION' | 'OPTION_ISO' | 'OPTION_NSO'>;
type SarCompensationType = Extract<CompensationType, 'CSAR' | 'SSAR'>;
type MonetaryBoundary = 'daml' | 'ocf';

const MONETARY_FIELDS = new Set(['amount', 'currency']);

interface MonetarySnapshot {
  readonly amount: unknown;
  readonly currency: unknown;
}

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

function invalidMonetaryType(value: unknown, fieldPath: string): never {
  throw new OcpValidationError(fieldPath, 'Monetary value must be a plain, non-proxy JSON object', {
    code: OcpErrorCodes.INVALID_TYPE,
    expectedType: 'plain Monetary JSON object',
    receivedValue: value,
  });
}

function invalidMonetaryShape(fieldPath: string, message: string, receivedValue: unknown): never {
  throw new OcpValidationError(fieldPath, message, {
    code: OcpErrorCodes.INVALID_FORMAT,
    expectedType: 'plain JSON object with exactly amount and currency data properties',
    receivedValue,
  });
}

function requiredMonetaryField(fieldPath: string): never {
  throw new OcpValidationError(fieldPath, 'Required Monetary field is missing', {
    code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    expectedType: 'own enumerable data property',
  });
}

function monetaryDataPropertyValue(descriptor: PropertyDescriptor | undefined, fieldPath: string): unknown {
  if (descriptor === undefined) requiredMonetaryField(fieldPath);
  if (!('value' in descriptor)) {
    invalidMonetaryShape(fieldPath, 'Monetary fields must not be accessors', { propertyKind: 'accessor' });
  }
  if (!descriptor.enumerable) {
    invalidMonetaryShape(fieldPath, 'Monetary fields must be enumerable', descriptor.value);
  }
  return descriptor.value;
}

/**
 * Snapshot an exact JSON Monetary without invoking getters, proxy traps, or coercion hooks.
 *
 * The returned record is detached from the caller's object so validation and
 * conversion always operate on the same two stable values.
 */
function snapshotExactMonetary(value: unknown, fieldPath: string): MonetarySnapshot {
  if (value === null || typeof value !== 'object') invalidMonetaryType(value, fieldPath);
  if (nodeUtilTypes.isProxy(value)) invalidMonetaryType(value, fieldPath);
  if (Array.isArray(value)) invalidMonetaryType(value, fieldPath);

  let prototype: object | null;
  let ownKeys: ReadonlyArray<string | symbol>;
  try {
    prototype = Object.getPrototypeOf(value);
    ownKeys = Reflect.ownKeys(value);
  } catch {
    return invalidMonetaryType(value, fieldPath);
  }

  if (prototype !== Object.prototype && prototype !== null) {
    invalidMonetaryType(value, fieldPath);
  }

  for (const key of ownKeys) {
    if (typeof key === 'symbol') {
      invalidMonetaryShape(fieldPath, 'Unexpected Monetary symbol field', key);
    }
    if (!MONETARY_FIELDS.has(key)) {
      invalidMonetaryShape(`${fieldPath}.${key}`, 'Unexpected Monetary field', key);
    }
  }

  let amountDescriptor: PropertyDescriptor | undefined;
  let currencyDescriptor: PropertyDescriptor | undefined;
  try {
    amountDescriptor = Object.getOwnPropertyDescriptor(value, 'amount');
    currencyDescriptor = Object.getOwnPropertyDescriptor(value, 'currency');
  } catch {
    return invalidMonetaryType(value, fieldPath);
  }

  return {
    amount: monetaryDataPropertyValue(amountDescriptor, `${fieldPath}.amount`),
    currency: monetaryDataPropertyValue(currencyDescriptor, `${fieldPath}.currency`),
  };
}

function requireExactMonetary(value: unknown, fieldPath: string, boundary: MonetaryBoundary): Monetary {
  const monetary = snapshotExactMonetary(value, fieldPath);

  const amountPath = `${fieldPath}.amount`;
  const { amount } = monetary;
  if (amount === undefined) {
    throw new OcpValidationError(amountPath, 'Monetary amount is required', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'Numeric(10) string',
      receivedValue: amount,
    });
  }
  if (typeof amount !== 'string') {
    throw new OcpValidationError(amountPath, 'Monetary amount must be a string', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'Numeric(10) string',
      receivedValue: amount,
    });
  }

  const amountResult =
    boundary === 'ocf' ? canonicalizeOcfNumeric10(amount) : canonicalizeNumeric10(amount, { allowExponent: true });
  if (!amountResult.ok) {
    throw new OcpValidationError(amountPath, amountResult.message, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: boundary === 'ocf' ? 'OCF Numeric with at most 10 decimal places' : 'DAML Numeric(10)',
      receivedValue: amount,
    });
  }

  const currencyPath = `${fieldPath}.currency`;
  const { currency } = monetary;
  if (currency === undefined) {
    throw new OcpValidationError(currencyPath, 'Monetary currency is required', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'three-letter uppercase ISO 4217 currency code',
      receivedValue: currency,
    });
  }
  if (typeof currency !== 'string') {
    throw new OcpValidationError(currencyPath, 'Monetary currency must be a string', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'three-letter uppercase ISO 4217 currency code',
      receivedValue: currency,
    });
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new OcpValidationError(currencyPath, 'Currency must be a three-letter uppercase ISO 4217 code', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'three-letter uppercase ISO 4217 currency code',
      receivedValue: currency,
    });
  }

  return { amount: amountResult.value, currency };
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
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const monetary = value as Record<string, unknown>;
    for (const monetaryField of ['amount', 'currency'] as const) {
      if (monetary[monetaryField] === undefined) {
        throw new OcpValidationError(`${source}.${field}.${monetaryField}`, `${monetaryField} is required`, {
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          expectedType: 'non-empty string',
          receivedValue: monetary[monetaryField],
        });
      }
    }
  }
  validateRequiredMonetary(value, `${source}.${field}`);
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
        `Unknown compensation type: ${describeDiagnosticValue(exhaustiveCheck)}`,
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
