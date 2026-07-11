import { OcpErrorCodes, OcpValidationError, type OcpErrorCode } from '../../../errors';

const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

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
  if (typeof value !== 'string') {
    return invalidInteger(value, fieldPath, minimum, 'Generated DAML Int must be a string', OcpErrorCodes.INVALID_TYPE);
  }
  if (!/^(?:0|-?[1-9]\d*)$/.test(value)) {
    return invalidInteger(value, fieldPath, minimum, 'Generated DAML Int must use canonical integer syntax');
  }

  const exact = BigInt(value);
  if (exact < BigInt(minimum) || exact > MAX_SAFE_INTEGER_BIGINT) {
    return invalidInteger(
      value,
      fieldPath,
      minimum,
      `Generated DAML Int must fit safely in a JavaScript number and be at least ${minimum}`
    );
  }
  return Number(exact);
}
