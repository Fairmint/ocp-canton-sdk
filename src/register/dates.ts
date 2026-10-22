/**
 * Daml `Date` helpers for the register rules. Register dates are exact `YYYY-MM-DD` strings, so they compare
 * lexically in date order.
 */

import { OcpErrorCodes } from '../errors/codes';
import { OcpValidationError } from '../errors/OcpValidationError';
import { tryIsoDateToDateString } from '../utils/typeConversions';

const MAX_YEAR = 9999;

/**
 * Returns the value when it is an exact, valid `YYYY-MM-DD` date.
 *
 * @throws OcpValidationError otherwise
 */
export function requireDate(value: string, fieldPath: string): string {
  if (tryIsoDateToDateString(value) === value) return value;
  throw new OcpValidationError(fieldPath, 'Expected a Daml Date (YYYY-MM-DD)', {
    expectedType: 'YYYY-MM-DD',
    receivedValue: value,
    code: OcpErrorCodes.INVALID_FORMAT,
  });
}

/** The later of two dates. */
export function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

/**
 * The date `days` days after a date, as Daml's `addDays`.
 *
 * @throws OcpValidationError when the result is past 9999-12-31, the last Daml `Date`
 */
export function addDays(date: string, days: number): string {
  const result = new Date(0);
  result.setUTCFullYear(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)) + days);
  if (result.getUTCFullYear() > MAX_YEAR || result.getUTCFullYear() < 1) {
    throw new OcpValidationError('date', `addDays: ${date} + ${days} days is not a Daml Date`, {
      code: OcpErrorCodes.OUT_OF_RANGE,
    });
  }
  return result.toISOString().slice(0, 10);
}
