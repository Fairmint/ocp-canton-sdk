const NUMERIC_10_SCALE = 10n;
const NUMERIC_10_INTEGER_DIGITS = 28n;
const MAX_INPUT_LENGTH = 256;
const NUMERIC_PATTERN = /^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/;
const OCF_NUMERIC_PATTERN = /^[+-]?\d+(?:\.\d{1,10})?$/;

export type Numeric10Result =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly message: string };

export interface Numeric10Options {
  readonly allowExponent?: boolean;
  readonly nonNegative?: boolean;
}

function failure(message: string): Numeric10Result {
  return { ok: false, message };
}

/** Canonicalize a Numeric(10) string using exact digit arithmetic. */
export function canonicalizeNumeric10(value: string, options: Numeric10Options = {}): Numeric10Result {
  if (value.length > MAX_INPUT_LENGTH) return failure('Numeric representation is unreasonably long');

  const match = NUMERIC_PATTERN.exec(value);
  if (!match) return failure('Must be a valid fixed-point Numeric string');
  const captures: ReadonlyArray<string | undefined> = match;
  const sign = captures[1] ?? '';
  const integerDigits = captures[2];
  const fractionalDigits = captures[3] ?? '';
  const exponentText = captures[4];
  if (integerDigits === undefined) return failure('Must be a valid fixed-point Numeric string');
  if (exponentText !== undefined && !options.allowExponent) {
    return failure('Scientific notation is not supported');
  }

  const allDigits = `${integerDigits}${fractionalDigits}`.replace(/^0+/, '');
  if (allDigits === '') return { ok: true, value: '0' };

  const significantDigits = allDigits.replace(/0+$/, '');
  const trailingZeros = BigInt(allDigits.length - significantDigits.length);
  const exponent = BigInt(exponentText ?? '0');
  const decimalPower = exponent - BigInt(fractionalDigits.length) + trailingZeros;
  const decimalIndex = BigInt(significantDigits.length) + decimalPower;
  const scale = decimalPower < 0n ? -decimalPower : 0n;

  if (scale > NUMERIC_10_SCALE) return failure('Must not exceed DAML Numeric 10 scale');
  if (decimalIndex > NUMERIC_10_INTEGER_DIGITS) {
    return failure('Must not exceed DAML Numeric 10 28-digit integer range');
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

  if (options.nonNegative && sign === '-') return failure('Numeric value must be non-negative');
  return { ok: true, value: sign === '-' ? `-${magnitude}` : magnitude };
}

/** Canonicalize a schema-valid OCF Numeric at the DAML Numeric(10) boundary. */
export function canonicalizeOcfNumeric10(
  value: string,
  options: Omit<Numeric10Options, 'allowExponent'> = {}
): Numeric10Result {
  if (value.length > MAX_INPUT_LENGTH) return failure('Numeric representation is unreasonably long');
  if (!OCF_NUMERIC_PATTERN.test(value)) {
    return failure('Must be a fixed-point OCF Numeric string with at most 10 decimal places');
  }
  return canonicalizeNumeric10(value, { ...options, allowExponent: false });
}
