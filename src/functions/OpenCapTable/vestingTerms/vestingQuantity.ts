import { OcpErrorCodes, OcpValidationError } from '../../../errors';

const DAML_VESTING_QUANTITY_SCALE = 10n;
const DAML_VESTING_QUANTITY_INTEGER_DIGITS = 28n;
// Numeric(10) values need at most 40 characters once normalized. Keep generous
// room for valid exponent forms while bounding parser work on untrusted input.
const MAX_VESTING_QUANTITY_INPUT_LENGTH = 256;
const DAML_VESTING_QUANTITY_PATTERN = /^(-?)((?:0|[1-9]\d*))(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/;
const OCF_VESTING_QUANTITY_PATTERN = /^([+-]?)(\d+)(?:\.(\d{1,10}))?$/;

function invalidDamlVestingQuantity(
  receivedValue: string | number,
  message: string,
  expectedType = 'decimal string or finite number',
  fieldPath = 'vestingCondition.quantity'
): never {
  throw new OcpValidationError(fieldPath, message, {
    code: OcpErrorCodes.INVALID_FORMAT,
    expectedType,
    receivedValue,
  });
}

/** Canonicalize a DAML Numeric 10 value through exact digit/exponent arithmetic. */
function canonicalizeDamlVestingQuantity(
  value: string,
  receivedValue: string | number,
  expectedType = 'decimal string or finite number',
  fieldPath = 'vestingCondition.quantity'
): string {
  if (value.length > MAX_VESTING_QUANTITY_INPUT_LENGTH) {
    return invalidDamlVestingQuantity(
      receivedValue,
      'Numeric representation is unreasonably long',
      expectedType,
      fieldPath
    );
  }

  const match = DAML_VESTING_QUANTITY_PATTERN.exec(value);
  if (!match) {
    return invalidDamlVestingQuantity(receivedValue, 'Must be a valid DAML Numeric 10 value', expectedType, fieldPath);
  }

  const captures: ReadonlyArray<string | undefined> = match;
  const sign = captures[1] ?? '';
  const integerDigits = captures[2];
  const fractionalDigits = captures[3] ?? '';
  const rawExponent = captures[4] ?? '0';
  if (integerDigits === undefined) {
    return invalidDamlVestingQuantity(receivedValue, 'Must be a valid DAML Numeric 10 value', expectedType, fieldPath);
  }

  const digitsWithoutLeadingZeros = `${integerDigits}${fractionalDigits}`.replace(/^0+/, '');
  if (digitsWithoutLeadingZeros === '') return '0';

  const significantDigits = digitsWithoutLeadingZeros.replace(/0+$/, '');
  const trailingZeroCount = BigInt(digitsWithoutLeadingZeros.length - significantDigits.length);
  const decimalPower = BigInt(rawExponent) - BigInt(fractionalDigits.length) + trailingZeroCount;
  const decimalIndex = BigInt(significantDigits.length) + decimalPower;
  const scale = decimalPower < 0n ? -decimalPower : 0n;

  if (scale > DAML_VESTING_QUANTITY_SCALE) {
    return invalidDamlVestingQuantity(
      receivedValue,
      `Must not exceed DAML Numeric ${DAML_VESTING_QUANTITY_SCALE} scale`,
      expectedType,
      fieldPath
    );
  }
  if (decimalIndex > DAML_VESTING_QUANTITY_INTEGER_DIGITS) {
    return invalidDamlVestingQuantity(
      receivedValue,
      `Must not exceed DAML Numeric ${DAML_VESTING_QUANTITY_INTEGER_DIGITS}-digit integer range`,
      expectedType,
      fieldPath
    );
  }

  let magnitude: string;
  if (decimalPower >= 0n) {
    magnitude = `${significantDigits}${'0'.repeat(Number(decimalPower))}`;
  } else if (decimalIndex > 0n) {
    const splitIndex = Number(decimalIndex);
    magnitude = `${significantDigits.slice(0, splitIndex)}.${significantDigits.slice(splitIndex)}`;
  } else {
    magnitude = `0.${'0'.repeat(Number(-decimalIndex))}${significantDigits}`;
  }

  return sign === '-' ? `-${magnitude}` : magnitude;
}

function requireNonNegativeVestingQuantity(
  normalized: string,
  receivedValue: string | number,
  expectedType = 'decimal string or finite number',
  fieldPath = 'vestingCondition.quantity'
): string {
  if (normalized.startsWith('-')) {
    return invalidDamlVestingQuantity(receivedValue, 'Vesting quantity must be non-negative', expectedType, fieldPath);
  }
  return normalized;
}

/** Validate and normalize the string representation returned by generated DAML Numeric codecs. */
export function damlVestingNumericToNative(value: unknown, fieldPath: string): string {
  const expectedType = 'DAML Numeric 10 string';
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, 'Must be a DAML Numeric 10 string', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType,
      receivedValue: value,
    });
  }
  return requireNonNegativeVestingQuantity(
    canonicalizeDamlVestingQuantity(value, value, expectedType, fieldPath),
    value,
    expectedType,
    fieldPath
  );
}

/** Validate a strictly positive DAML Numeric 10 value. */
export function damlPositiveVestingNumericToNative(value: unknown, fieldPath: string): string {
  const normalized = damlVestingNumericToNative(value, fieldPath);
  if (normalized === '0') {
    throw new OcpValidationError(fieldPath, 'Vesting quantity must be greater than zero', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'positive DAML Numeric 10 string',
      receivedValue: value,
    });
  }
  return normalized;
}

/** Convert a schema-valid OCF Numeric string into a canonical DAML Numeric 10 string. */
export function ocfVestingConditionQuantityToDaml(value: unknown, fieldPath = 'vestingCondition.quantity'): string {
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, 'OCF vesting quantity must be a string', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'OCF Numeric string',
      receivedValue: value,
    });
  }

  if (value.length > MAX_VESTING_QUANTITY_INPUT_LENGTH) {
    throw new OcpValidationError(fieldPath, 'Numeric representation is unreasonably long', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'OCF Numeric string',
      receivedValue: value,
    });
  }

  const match = OCF_VESTING_QUANTITY_PATTERN.exec(value);
  const captures: ReadonlyArray<string | undefined> | undefined = match ?? undefined;
  const sign = captures?.[1] ?? '';
  const integerDigits = captures?.[2];
  const fractionalDigits = captures?.[3];
  if (integerDigits === undefined) {
    throw new OcpValidationError(
      fieldPath,
      'Must be a valid OCF fixed-point Numeric string with at most 10 decimal places',
      {
        code: OcpErrorCodes.INVALID_FORMAT,
        expectedType: 'OCF Numeric string',
        receivedValue: value,
      }
    );
  }

  const canonicalIntegerDigits = integerDigits.replace(/^0+(?=\d)/, '');
  const damlLexicalValue = `${sign === '+' ? '' : sign}${canonicalIntegerDigits}${
    fractionalDigits === undefined ? '' : `.${fractionalDigits}`
  }`;
  return requireNonNegativeVestingQuantity(
    canonicalizeDamlVestingQuantity(damlLexicalValue, value, 'OCF Numeric string', fieldPath),
    value,
    'OCF Numeric string',
    fieldPath
  );
}

/** Validate a strictly positive OCF Numeric value for contracts that disallow zero. */
export function ocfPositiveVestingNumericToDaml(value: unknown, fieldPath: string): string {
  const normalized = ocfVestingConditionQuantityToDaml(value, fieldPath);
  if (normalized === '0') {
    throw new OcpValidationError(fieldPath, 'Vesting quantity must be greater than zero', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'positive OCF Numeric string',
      receivedValue: value,
    });
  }
  return normalized;
}
