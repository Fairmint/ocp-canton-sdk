import fc from 'fast-check';

import { OcpValidationError } from '../../src/errors';
import {
  canonicalDecimal,
  floorMulDiv,
  floorMulDivUnits,
  fromUnits,
  mulHalfEven,
  mulHalfEvenUnits,
  scaleByRatio,
  showDaml,
  toUnits,
} from '../../src/register';
import { canonicalizeNumeric10 } from '../../src/utils/numeric10';
import vectors from '../fixtures/register/v35-test-vectors.json';

const UNIT = 10n ** 10n;
const MAX_DECIMAL_UNITS = 10n ** 38n - 1n;

describe('decimal units', () => {
  test('a decimal string is a count of units of 10^-10', () => {
    expect(toUnits('250')).toBe(2_500_000_000_000n);
    expect(toUnits('250.0')).toBe(2_500_000_000_000n);
    expect(toUnits('0.0000000001')).toBe(1n);
    expect(toUnits('-0.5')).toBe(-5_000_000_000n);
    expect(toUnits('-0')).toBe(0n);
    expect(toUnits('007.10')).toBe(71_000_000_000n);
    expect(toUnits(`${'9'.repeat(28)}.${'9'.repeat(10)}`)).toBe(MAX_DECIMAL_UNITS);
  });

  test.each(['', '.5', '5.', '+1', '1e5', '1,000', ' 1', 'NaN'])('rejects %p', (text) => {
    expect(() => toUnits(text, 'quantity')).toThrow(OcpValidationError);
  });

  test('rejects more than 10 fractional or 28 integer digits', () => {
    expect(() => toUnits('0.00000000001')).toThrow('more than 10 fractional digits');
    expect(() => toUnits('1'.padEnd(29, '0'))).toThrow('more than 28 integer digits');
    expect(toUnits(`000${'1'.padEnd(28, '0')}`)).toBe(10n ** 37n);
  });

  test('canonical and Daml show forms', () => {
    expect(fromUnits(2_500_000_000_000n)).toBe('250');
    expect(showDaml(2_500_000_000_000n)).toBe('250.0');
    expect(fromUnits(0n)).toBe('0');
    expect(showDaml(0n)).toBe('0.0');
    expect(fromUnits(-5_000_000_000n)).toBe('-0.5');
    expect(showDaml(-5_000_000_000n)).toBe('-0.5');
    expect(fromUnits(3_333_333_333n)).toBe('0.3333333333');
    expect(canonicalDecimal('1500.00')).toBe('1500');
    expect(() => fromUnits(MAX_DECIMAL_UNITS + 1n)).toThrow('Does not fit a Daml Decimal');
    expect(() => showDaml(-MAX_DECIMAL_UNITS - 1n)).toThrow(OcpValidationError);
  });

  test('the canonical form is the one canonicalizeNumeric10 gives (fast-check)', () => {
    const decimal = fc
      .tuple(
        fc.boolean(),
        fc.string({ unit: fc.constantFrom(...'0123456789'), minLength: 1, maxLength: 28 }),
        fc.string({ unit: fc.constantFrom(...'0123456789'), maxLength: 10 })
      )
      .map(([negative, whole, fraction]) => `${negative ? '-' : ''}${whole}${fraction === '' ? '' : `.${fraction}`}`);
    fc.assert(
      fc.property(decimal, (text) => {
        const canonical = canonicalizeNumeric10(text);
        expect(canonical.ok).toBe(true);
        if (canonical.ok) expect(canonicalDecimal(text)).toBe(canonical.value);
      })
    );
  });

  test('round-trips every Decimal (fast-check)', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: -MAX_DECIMAL_UNITS, max: MAX_DECIMAL_UNITS }), (units) => {
        expect(toUnits(fromUnits(units))).toBe(units);
        expect(toUnits(showDaml(units))).toBe(units);
      })
    );
  });
});

describe('floorMulDiv, the shared floor function', () => {
  test.each(vectors.floor_mul_div)('floorMulDiv($x, $a, $b) = $result', ({ x, a, b, result }) => {
    expect(showDaml(floorMulDivUnits(toUnits(x), toUnits(a), toUnits(b)))).toBe(result);
    expect(floorMulDiv(x, a, b)).toBe(canonicalDecimal(result));
  });

  test('equals the exact floor of X · A / B (fast-check against BigInt)', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 10n ** 30n }),
        fc.bigInt({ min: 0n, max: 10n ** 22n }),
        fc.bigInt({ min: 1n, max: 10n ** 26n }),
        (x, a, b) => {
          const reference = (x * a) / b;
          if (reference > MAX_DECIMAL_UNITS) {
            expect(() => floorMulDivUnits(x, a, b)).toThrow(OcpValidationError);
          } else {
            expect(floorMulDivUnits(x, a, b)).toBe(reference);
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  test('never overstates: the result times the divisor never exceeds the product', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 10n ** 20n }),
        fc.bigInt({ min: 0n, max: 10n ** 15n }),
        fc.bigInt({ min: 1n, max: 10n ** 15n }),
        (x, a, b) => {
          const result = floorMulDivUnits(x, a, b);
          expect(result * b <= x * a).toBe(true);
          expect((result + 1n) * b > x * a).toBe(true);
        }
      )
    );
  });

  test('fails closed on a negative operand or a non-positive divisor', () => {
    expect(() => floorMulDiv('-1', '1', '1')).toThrow('floorMulDiv: negative operand');
    expect(() => floorMulDiv('1', '-0.0000000001', '1')).toThrow('floorMulDiv: negative operand');
    expect(() => floorMulDiv('1', '1', '0')).toThrow('floorMulDiv: non-positive divisor');
    expect(() => floorMulDiv('1', '1', '-3')).toThrow('floorMulDiv: non-positive divisor');
    expect(() => floorMulDiv('1', 'x', '1')).toThrow(OcpValidationError);
  });

  test('fails closed on a result beyond a Decimal', () => {
    expect(() => floorMulDiv('9'.repeat(28), '10', '1')).toThrow(OcpValidationError);
  });

  test('fails where the ledger’s long multiplication overflows, even when the exact result fits', () => {
    // On the ledger, an intermediate rX · digit beyond 38 digits aborts with an ArithmeticError; only a divisor of
    // 5 · 10^18 or more can reach it. The exact result here would be 0.9999999999.
    expect(() => floorMulDiv(`${'8'}${'9'.repeat(27)}.${'9'.repeat(10)}`, '1', `9${'0'.repeat(27)}`)).toThrow(
      'ArithmeticError'
    );
    expect(floorMulDiv('1', '1', '4999999999999999999')).toBe('0');
  });

  test('scales a quantity by a split ratio', () => {
    expect(scaleByRatio({ numerator: '2', denominator: '3' }, '100')).toBe('66.6666666666');
    expect(scaleByRatio({ numerator: '2', denominator: '1' }, '600')).toBe('1200');
    expect(scaleByRatio({ numerator: '1', denominator: '10' }, '0.0000000001')).toBe('0');
  });
});

describe('mulHalfEven, Daml Numeric 10 multiplication', () => {
  test.each([
    ['0.5', '0.0000000001', '0'],
    ['1.5', '0.0000000001', '0.0000000002'],
    ['2.5', '0.0000000001', '0.0000000002'],
    ['3.5', '0.0000000001', '0.0000000004'],
    ['0.4', '0.0000000001', '0'],
    ['0.6', '0.0000000001', '0.0000000001'],
    ['-0.5', '0.0000000001', '0'],
    ['-1.5', '0.0000000001', '-0.0000000002'],
    ['1.2345678901', '0.5', '0.617283945'],
    ['1.2345678903', '0.5', '0.6172839452'],
  ])('%s × %s = %s, rounded half-even to scale 10', (a, b, product) => {
    expect(mulHalfEven(a, b)).toBe(product);
  });

  test('the worked example: a buyer’s cost basis of 2.00 × 750 and the balance’s floored basis', () => {
    expect(showDaml(mulHalfEvenUnits(toUnits('2.00'), toUnits('750')))).toBe('1500.0');
    expect(showDaml(floorMulDivUnits(toUnits('1000'), toUnits('250'), toUnits('1000')))).toBe('250.0');
  });

  test('is within half a unit of the exact product, ties to even (fast-check)', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -(10n ** 19n), max: 10n ** 19n }),
        fc.bigInt({ min: -(10n ** 19n), max: 10n ** 19n }),
        (a, b) => {
          const result = mulHalfEvenUnits(a, b);
          const error = result * UNIT - a * b;
          const magnitude = error < 0n ? -error : error;
          expect(2n * magnitude <= UNIT).toBe(true);
          if (2n * magnitude === UNIT) expect(result % 2n).toBe(0n);
        }
      )
    );
  });

  test('fails on a product beyond a Decimal', () => {
    expect(() => mulHalfEven('9'.repeat(28), '10')).toThrow('ArithmeticError');
  });
});
