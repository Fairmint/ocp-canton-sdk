import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { CompensationType } from '../../../types';

function missingPrice(
  source: string,
  field: 'exercise_price' | 'base_price',
  compensationType: CompensationType
): never {
  throw new OcpValidationError(`${source}.${field}`, `${field} is required for ${compensationType}`, {
    code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    expectedType: 'Monetary',
  });
}

/**
 * Enforce the price fields the OCF EquityCompensationIssuance schema requires for each compensation type:
 * options need `exercise_price` and SARs need `base_price`. RSUs have no pricing requirement, and the
 * schema does not forbid additional price fields on any type, so none are rejected here.
 */
export function requireEquityCompensationPricing(
  compensationType: CompensationType,
  exercisePrice: unknown,
  basePrice: unknown,
  source: string
): void {
  const isOption =
    compensationType === 'OPTION' || compensationType === 'OPTION_ISO' || compensationType === 'OPTION_NSO';
  if (isOption && (exercisePrice === undefined || exercisePrice === null)) {
    missingPrice(source, 'exercise_price', compensationType);
  }

  const isSar = compensationType === 'CSAR' || compensationType === 'SSAR';
  if (isSar && (basePrice === undefined || basePrice === null)) {
    missingPrice(source, 'base_price', compensationType);
  }
}
