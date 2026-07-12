import { OcpErrorCodes, OcpValidationError, type OcpErrorCode } from '../../../errors';
import { parseDamlSafeInteger } from '../shared/damlIntegers';

function invalidInteger(
  value: unknown,
  fieldPath: string,
  minimum: number,
  message: string,
  code: OcpErrorCode = OcpErrorCodes.INVALID_FORMAT
): never {
  throw new OcpValidationError(fieldPath, message, {
    code,
    expectedType: `safe integer >= ${minimum}`,
    receivedValue: value,
  });
}

/** Validate an OCF integer before encoding it as a generated DAML Int string. */
export function ocfVestingPeriodIntegerToDaml(value: unknown, fieldPath: string, minimum: number): string {
  if (value === undefined) {
    return invalidInteger(
      value,
      fieldPath,
      minimum,
      'Required vesting period integer is missing',
      OcpErrorCodes.REQUIRED_FIELD_MISSING
    );
  }
  if (typeof value !== 'number') {
    return invalidInteger(
      value,
      fieldPath,
      minimum,
      'Vesting period integer must be a number',
      OcpErrorCodes.INVALID_TYPE
    );
  }
  if (!Number.isSafeInteger(value) || value < minimum) {
    return invalidInteger(
      value,
      fieldPath,
      minimum,
      `Vesting period integer must be a safe integer greater than or equal to ${minimum}`
    );
  }
  return value.toString();
}

/** Decode an exact generated DAML Int string without first rounding it through Number. */
export function damlVestingPeriodIntegerToNative(value: unknown, fieldPath: string, minimum: number): number {
  if (value === null) {
    return invalidInteger(value, fieldPath, minimum, 'Generated DAML Int must be a string', OcpErrorCodes.INVALID_TYPE);
  }
  const exact = parseDamlSafeInteger(value, fieldPath);
  if (exact < minimum) {
    return invalidInteger(
      value,
      fieldPath,
      minimum,
      `Generated DAML Int must be at least ${minimum}`,
      OcpErrorCodes.OUT_OF_RANGE
    );
  }
  return exact;
}
