import { OcpErrorCodes, OcpValidationError, type OcpErrorCode } from '../../../errors';
import { nativeSafeIntegerToDaml, parseDamlSafeInteger } from '../shared/damlIntegers';

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
  const encoded = nativeSafeIntegerToDaml(value, fieldPath);
  if ((value as number) < minimum) {
    return invalidInteger(
      value,
      fieldPath,
      minimum,
      `Vesting period integer must be a safe integer greater than or equal to ${minimum}`,
      OcpErrorCodes.OUT_OF_RANGE
    );
  }
  return encoded;
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
