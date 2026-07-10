import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { CompensationType, Monetary } from '../../../types';
import { validateRequiredMonetary } from '../../../utils/validation';

type OptionCompensationType = Extract<CompensationType, 'OPTION' | 'OPTION_ISO' | 'OPTION_NSO'>;
type SarCompensationType = Extract<CompensationType, 'CSAR' | 'SSAR'>;

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

function validateRequiredPrice(
  value: unknown,
  field: 'exercise_price' | 'base_price',
  source: string,
  compensationType: CompensationType
): asserts value is Monetary {
  if (value === undefined) {
    requiredPrice(field, source, compensationType);
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
    case 'OPTION_NSO':
      validateRequiredPrice(exercisePrice, 'exercise_price', source, compensationType);
      if (basePrice !== undefined) forbiddenPrice('base_price', source, compensationType);
      return { compensation_type: compensationType, exercise_price: exercisePrice };
    case 'CSAR':
    case 'SSAR':
      validateRequiredPrice(basePrice, 'base_price', source, compensationType);
      if (exercisePrice !== undefined) forbiddenPrice('exercise_price', source, compensationType);
      return { compensation_type: compensationType, base_price: basePrice };
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
