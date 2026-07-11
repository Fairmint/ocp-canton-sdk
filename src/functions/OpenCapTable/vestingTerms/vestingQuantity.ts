import { OcpErrorCodes, OcpValidationError } from '../../../errors';

const DAML_VESTING_QUANTITY_SCALE = 10n;
const DAML_VESTING_QUANTITY_INTEGER_DIGITS = 28n;
// Canonical Numeric(10) values need at most 40 characters. Keep generous room
// for harmless non-canonical zero/exponent forms while bounding parser work on
// untrusted ledger and SDK inputs.
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

function damlVestingQuantityNumberToNative(value: number, fieldPath: string): string {
  if (!Number.isFinite(value)) {
    throw new OcpValidationError(fieldPath, 'Must be a finite number', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'decimal string or finite number',
      receivedValue: value,
    });
  }

  if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
    throw new OcpValidationError(fieldPath, 'Integer exceeds JavaScript safe precision', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'decimal string or finite number',
      receivedValue: value,
    });
  }

  const normalized = requireNonNegativeVestingQuantity(
    canonicalizeDamlVestingQuantity(value.toString(), value, 'decimal string or finite number', fieldPath),
    value,
    'decimal string or finite number',
    fieldPath
  );
  const coefficient = normalized
    .replace('-', '')
    .replace('.', '')
    .replace(/^0+(?=\d)/, '');
  if (BigInt(coefficient) > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new OcpValidationError(fieldPath, 'Number exceeds JavaScript safe precision', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'decimal string or finite number',
      receivedValue: value,
    });
  }

  return normalized;
}

/** Validate and canonicalize a quantity read from a DAML ledger payload. */
export function damlVestingConditionQuantityToNative(
  value: unknown,
  fieldPath = 'vestingCondition.quantity'
): string | undefined {
  if (value === null || value === undefined) return undefined;

  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new OcpValidationError(fieldPath, 'Must be a decimal string or finite number', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'decimal string or finite number',
      receivedValue: value,
    });
  }

  return typeof value === 'number'
    ? damlVestingQuantityNumberToNative(value, fieldPath)
    : requireNonNegativeVestingQuantity(
        canonicalizeDamlVestingQuantity(value, value, 'decimal string or finite number', fieldPath),
        value,
        'decimal string or finite number',
        fieldPath
      );
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
