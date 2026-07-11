import { OcpErrorCodes, OcpValidationError } from '../../../errors';

const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_INTEGER = BigInt(Number.MIN_SAFE_INTEGER);
const CANONICAL_DAML_INT_PATTERN = /^(?:0|[1-9]\d*|-[1-9]\d*)$/;

/** Parse the exact string representation emitted for a generated DAML Int. */
export function parseDamlSafeInteger(value: unknown, fieldPath: string): number {
  const expectedType = 'canonical DAML Int string within the JavaScript safe integer range';

  if (value === null || value === undefined) {
    throw new OcpValidationError(fieldPath, `${fieldPath} is required`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType,
      receivedValue: value,
    });
  }
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a ${expectedType}`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType,
      receivedValue: value,
    });
  }
  if (!CANONICAL_DAML_INT_PATTERN.test(value)) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a ${expectedType}`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType,
      receivedValue: value,
    });
  }

  const integer = BigInt(value);
  if (integer < MIN_SAFE_INTEGER || integer > MAX_SAFE_INTEGER) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a ${expectedType}`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType,
      receivedValue: value,
    });
  }
  return Number(integer);
}
