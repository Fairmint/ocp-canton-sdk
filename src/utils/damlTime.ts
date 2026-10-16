/**
 * Exact DAML `Time` values: instants with microsecond precision from 0001-01-01 to 9999-12-31 (UTC), as the JSON
 * Ledger API encodes them in RFC 3339. A JavaScript `Date` keeps only milliseconds, so instants are compared as integer
 * microseconds since the Unix epoch instead.
 *
 * @module damlTime
 */

/** RFC 3339 `date-time` with a mandatory offset (`T` and `Z` may be lower case, per the RFC's ABNF). */
const RFC3339_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:([Zz])|([+-])(\d{2}):(\d{2}))$/;

const MICROS_PER_SECOND = 1_000_000n;
const MICROS_PER_DAY = 86_400n * MICROS_PER_SECOND;

/** Days from 1970-01-01 in the proleptic Gregorian calendar (H. Hinnant's `days_from_civil`). */
function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (month > 2 ? month - 3 : month + 9) + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/** First and last microsecond a DAML `Time` can hold. */
const MIN_MICROS = BigInt(daysFromCivil(1, 1, 1)) * MICROS_PER_DAY;
const MAX_MICROS = BigInt(daysFromCivil(10000, 1, 1)) * MICROS_PER_DAY - 1n;

/**
 * Parse a DAML `Time` (RFC 3339 with an offset) into microseconds since 1970-01-01T00:00:00Z.
 *
 * @returns `null` for anything a DAML `Time` cannot be: not RFC 3339 with an offset, an invalid calendar date or time
 *   of day, a leap second, a non-zero digit below the microsecond, or an instant outside years 0001 to 9999 (UTC)
 */
export function damlTimeToMicros(value: string): bigint | null {
  const match = RFC3339_PATTERN.exec(value);
  if (match === null) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction = '', , sign, offH, offM] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  if (/[1-9]/.test(fraction.slice(6))) return null;
  const offsetMinutes = sign === undefined ? 0 : (sign === '-' ? -1 : 1) * (Number(offH) * 60 + Number(offM));
  if (sign !== undefined && (Number(offH) > 23 || Number(offM) > 59)) return null;

  const seconds = ((daysFromCivil(year, month, day) * 24 + hour) * 60 + minute - offsetMinutes) * 60 + second;
  const micros = BigInt(seconds) * MICROS_PER_SECOND + BigInt(fraction.slice(0, 6).padEnd(6, '0'));
  return micros < MIN_MICROS || micros > MAX_MICROS ? null : micros;
}

/** Format microseconds since the epoch as canonical DAML `Time` text: UTC, `Z`, six fractional digits. */
export function microsToDamlTime(micros: bigint): string {
  let days = micros / MICROS_PER_DAY;
  let rest = micros % MICROS_PER_DAY;
  if (rest < 0n) {
    days -= 1n;
    rest += MICROS_PER_DAY;
  }
  // `Date` renders the calendar date of any day in years 0001-9999 exactly; the time of day is formatted here.
  const date = new Date(Number(days) * 86_400_000).toISOString().slice(0, 10);
  const second = rest / MICROS_PER_SECOND;
  const pad = (n: bigint, width: number) => n.toString().padStart(width, '0');
  return `${date}T${pad(second / 3600n, 2)}:${pad((second / 60n) % 60n, 2)}:${pad(second % 60n, 2)}.${pad(rest % MICROS_PER_SECOND, 6)}Z`;
}

/** Microseconds since the epoch of a JavaScript `Date` (millisecond precision), or `null` for an invalid `Date`. */
export function dateToMicros(value: Date): bigint | null {
  const ms = value.getTime();
  if (Number.isNaN(ms)) return null;
  const micros = BigInt(ms) * 1000n;
  return micros < MIN_MICROS || micros > MAX_MICROS ? null : micros;
}
