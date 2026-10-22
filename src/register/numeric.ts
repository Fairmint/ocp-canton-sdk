/**
 * The shared floor function and the other quantity arithmetic the ledger, the SDK and apiv2 must compute identically
 * (a port of `Fairmint.OpenCapTable.Numeric`).
 *
 * A Daml `Decimal` is `Numeric 10`: 38 digits, 10 of them fractional. Here a decimal is held as a `bigint` count of
 * units of 10^-10, so x · a / b is X · A / B units. Every function fails where the ledger fails, including the
 * intermediate overflows of the ledger's long multiplication, so a value the SDK computes is one the ledger computes.
 *
 * Source: https://github.com/Fairmint/open-captable-protocol-daml/blob/main/OpenCapTable-v35/daml/Fairmint/OpenCapTable/Numeric.daml
 */

import { OcpErrorCodes } from '../errors/codes';
import { OcpValidationError } from '../errors/OcpValidationError';
import type { SplitRatio } from '../types/register';

/** Units per 1 at Daml `Decimal` scale. */
const UNIT = 10n ** 10n;
/** The largest magnitude 38 digits hold: the bound on every Daml `Numeric` value, in units of its scale. */
const MAX_NUMERIC = 10n ** 38n - 1n;
/** The base of the long multiplication's digits. */
const DIGIT_BASE = 1_000_000_000n;
const DECIMAL_PATTERN = /^(-?)(\d+)(?:\.(\d+))?$/;
const DECIMAL_EXPECTED_TYPE = 'decimal string with at most 28 integer and 10 fractional digits';

/**
 * A decimal string as units of 10^-10, the integer Daml's `N.shift` gives a `Decimal` at scale 0.
 *
 * @throws OcpValidationError when the text is not a plain decimal or does not fit a Daml `Decimal`
 */
export function toUnits(decimal: string, fieldPath = 'decimal'): bigint {
  const match = DECIMAL_PATTERN.exec(decimal);
  const whole = match?.[2];
  if (match === null || whole === undefined) {
    throw new OcpValidationError(fieldPath, 'Expected a decimal string', {
      expectedType: DECIMAL_EXPECTED_TYPE,
      receivedValue: decimal,
      code: OcpErrorCodes.INVALID_FORMAT,
    });
  }
  const fraction = match[3] ?? '';
  if (fraction.length > 10) {
    throw new OcpValidationError(fieldPath, 'Has more than 10 fractional digits', {
      expectedType: DECIMAL_EXPECTED_TYPE,
      receivedValue: decimal,
      code: OcpErrorCodes.OUT_OF_RANGE,
    });
  }
  if (whole.replace(/^0+/, '').length > 28) {
    throw new OcpValidationError(fieldPath, 'Has more than 28 integer digits', {
      expectedType: DECIMAL_EXPECTED_TYPE,
      receivedValue: decimal,
      code: OcpErrorCodes.OUT_OF_RANGE,
    });
  }
  const magnitude = BigInt(whole) * UNIT + BigInt(fraction.padEnd(10, '0'));
  return match[1] === '-' ? -magnitude : magnitude;
}

function requireDecimalUnits(units: bigint, fieldPath: string): void {
  if (units > MAX_NUMERIC || units < -MAX_NUMERIC) {
    throw new OcpValidationError(fieldPath, 'Does not fit a Daml Decimal', {
      expectedType: DECIMAL_EXPECTED_TYPE,
      receivedValue: units.toString(),
      code: OcpErrorCodes.OUT_OF_RANGE,
    });
  }
}

function splitUnits(units: bigint): { sign: string; whole: string; fraction: string } {
  const magnitude = units < 0n ? -units : units;
  return {
    sign: units < 0n ? '-' : '',
    whole: (magnitude / UNIT).toString(),
    fraction: (magnitude % UNIT).toString().padStart(10, '0').replace(/0+$/, ''),
  };
}

/**
 * Units of 10^-10 as a canonical decimal string: no trailing fractional zeros, no trailing point, `0` for zero (the
 * form `canonicalizeNumeric10` gives).
 *
 * @throws OcpValidationError when the value does not fit a Daml `Decimal`
 */
export function fromUnits(units: bigint, fieldPath = 'decimal'): string {
  requireDecimalUnits(units, fieldPath);
  const { sign, whole, fraction } = splitUnits(units);
  return `${sign}${whole}${fraction === '' ? '' : `.${fraction}`}`;
}

/**
 * Units of 10^-10 as the text Daml's `show` gives a `Decimal`: at least one fractional digit (`250.0`). The ledger's
 * messages and the shared test vectors use this form.
 *
 * @throws OcpValidationError when the value does not fit a Daml `Decimal`
 */
export function showDaml(units: bigint, fieldPath = 'decimal'): string {
  requireDecimalUnits(units, fieldPath);
  const { sign, whole, fraction } = splitUnits(units);
  return `${sign}${whole}.${fraction === '' ? '0' : fraction}`;
}

/** A decimal string in its canonical form. */
export function canonicalDecimal(decimal: string, fieldPath = 'decimal'): string {
  return fromUnits(toUnits(decimal, fieldPath), fieldPath);
}

// Daml checks every arithmetic result against the 38 digits a Numeric holds and aborts with an ArithmeticError beyond.
function checked(value: bigint, operation: string, fieldPath: string): bigint {
  if (value > MAX_NUMERIC || value < -MAX_NUMERIC) {
    throw new OcpValidationError(fieldPath, `ArithmeticError: ${operation} overflows a Daml Numeric`, {
      receivedValue: value.toString(),
      code: OcpErrorCodes.OUT_OF_RANGE,
    });
  }
  return value;
}

// n / d rounded half-even, as Daml's `N.div @0`, for n >= 0 and d > 0.
function divHalfEven(n: bigint, d: bigint): bigint {
  const q = n / d;
  const twice = 2n * (n % d);
  if (twice > d || (twice === d && q % 2n === 1n)) return q + 1n;
  return q;
}

// ⌊n / d⌋ for n >= 0 and d > 0. `N.div` rounds half-even, so its result is at most one too high.
function floorDivUnits(n: bigint, d: bigint, fieldPath: string): bigint {
  const r = divHalfEven(n, d);
  return checked(r * d, 'MUL_NUMERIC', fieldPath) > n ? r - 1n : r;
}

// The base-10^9 digits of n >= 0, most significant first.
function digitsOf(n: bigint, fieldPath: string): bigint[] {
  const digits: bigint[] = [];
  let rest = n;
  while (rest >= DIGIT_BASE) {
    const high = floorDivUnits(rest, DIGIT_BASE, fieldPath);
    digits.unshift(rest - checked(high * DIGIT_BASE, 'MUL_NUMERIC', fieldPath));
    rest = high;
  }
  digits.unshift(rest);
  return digits;
}

// ⌊r · a / b⌋ for 0 <= r < b, a >= 0, by long multiplication over the base-10^9 digits of `a`, most significant first.
// After each digit, (q, rest) hold ⌊r · p / b⌋ and r · p − q · b for the prefix p of `a` read so far.
function mulDivFloor(r: bigint, a: bigint, b: bigint, fieldPath: string): bigint {
  let q = 0n;
  let rest = 0n;
  for (const digit of digitsOf(a, fieldPath)) {
    const t = checked(
      checked(rest * DIGIT_BASE, 'MUL_NUMERIC', fieldPath) + checked(r * digit, 'MUL_NUMERIC', fieldPath),
      'ADD_NUMERIC',
      fieldPath
    );
    const qt = floorDivUnits(t, b, fieldPath);
    q = checked(checked(q * DIGIT_BASE, 'MUL_NUMERIC', fieldPath) + qt, 'ADD_NUMERIC', fieldPath);
    rest = t - checked(qt * b, 'MUL_NUMERIC', fieldPath);
  }
  return q;
}

/**
 * ⌊X · A / B⌋ in units of 10^-10: the shared floor function on units, computed as the ledger computes it.
 *
 * It splits X = qX · B + rX and computes ⌊rX · A / B⌋ by long multiplication over the base-10^9 digits of A. It is
 * exact, and fails closed where the ledger aborts: on x < 0, a < 0 or b <= 0, on a result beyond a `Decimal`, and on
 * an intermediate beyond 38 digits, which only a divisor of 5 · 10^18 or more can reach.
 *
 * @throws OcpValidationError where the ledger's `floorMulDiv` aborts
 */
export function floorMulDivUnits(x: bigint, a: bigint, b: bigint, fieldPath = 'floorMulDiv'): bigint {
  requireDecimalUnits(x, `${fieldPath}.x`);
  requireDecimalUnits(a, `${fieldPath}.a`);
  requireDecimalUnits(b, `${fieldPath}.b`);
  if (x < 0n || a < 0n) {
    throw new OcpValidationError(fieldPath, 'floorMulDiv: negative operand', { code: OcpErrorCodes.OUT_OF_RANGE });
  }
  if (b <= 0n) {
    throw new OcpValidationError(fieldPath, 'floorMulDiv: non-positive divisor', { code: OcpErrorCodes.OUT_OF_RANGE });
  }
  const qx = floorDivUnits(x, b, fieldPath);
  const rx = x - checked(qx * b, 'MUL_NUMERIC', fieldPath);
  return checked(
    checked(qx * a, 'MUL_NUMERIC', fieldPath) + mulDivFloor(rx, a, b, fieldPath),
    'ADD_NUMERIC',
    fieldPath
  );
}

/**
 * ⌊x · a / b⌋ at scale 10, exactly: the shared floor function. The ledger, the SDK and apiv2 scale split quantities,
 * tranches and snapshots and divide a balance's cost basis with it, so it never overstates a quantity.
 *
 * @throws OcpValidationError where the ledger's `floorMulDiv` aborts, or when an operand is not a Daml `Decimal`
 */
export function floorMulDiv(x: string, a: string, b: string, fieldPath = 'floorMulDiv'): string {
  return fromUnits(
    floorMulDivUnits(
      toUnits(x, `${fieldPath}.x`),
      toUnits(a, `${fieldPath}.a`),
      toUnits(b, `${fieldPath}.b`),
      fieldPath
    ),
    fieldPath
  );
}

/** Scales a quantity by a split ratio (numerator / denominator), flooring at scale 10. */
export function scaleByRatio(ratio: SplitRatio, quantity: string, fieldPath = 'scaleByRatio'): string {
  return floorMulDiv(quantity, ratio.numerator, ratio.denominator, fieldPath);
}

/**
 * A · B in units of 10^-10, rounded half-even from scale 20 to scale 10, as Daml multiplies `Numeric 10` values.
 *
 * @throws OcpValidationError when an operand or the product does not fit a Daml `Decimal`
 */
export function mulHalfEvenUnits(a: bigint, b: bigint, fieldPath = 'mulHalfEven'): bigint {
  requireDecimalUnits(a, `${fieldPath}.a`);
  requireDecimalUnits(b, `${fieldPath}.b`);
  const product = a * b;
  const magnitude = product < 0n ? -product : product;
  const rounded = divHalfEven(magnitude, UNIT);
  return checked(product < 0n ? -rounded : rounded, 'MUL_NUMERIC', fieldPath);
}

/**
 * a · b at scale 10, rounded half-even, as Daml multiplies `Numeric 10` values. A settlement's buyer cost basis is the
 * share price times the quantity drawn, computed this way, as the trade terms' cash amount is.
 *
 * @throws OcpValidationError when an operand or the product does not fit a Daml `Decimal`
 */
export function mulHalfEven(a: string, b: string, fieldPath = 'mulHalfEven'): string {
  return fromUnits(mulHalfEvenUnits(toUnits(a, `${fieldPath}.a`), toUnits(b, `${fieldPath}.b`), fieldPath), fieldPath);
}
