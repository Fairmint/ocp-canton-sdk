import { damlTimeToMicros, dateToMicros, microsToDamlTime } from '../../src/utils/damlTime';

describe('damlTime', () => {
  it('parses RFC 3339 instants to microseconds since the epoch, whatever the offset', () => {
    expect(damlTimeToMicros('1970-01-01T00:00:00Z')).toBe(0n);
    expect(damlTimeToMicros('1970-01-01T00:00:00.000001Z')).toBe(1n);
    expect(damlTimeToMicros('1969-12-31T23:59:59.999999Z')).toBe(-1n);
    expect(damlTimeToMicros('2026-10-15T12:00:00Z')).toBe(BigInt(Date.parse('2026-10-15T12:00:00Z')) * 1000n);
    expect(damlTimeToMicros('2026-10-15T14:30:00+02:30')).toBe(damlTimeToMicros('2026-10-15T12:00:00Z'));
    expect(damlTimeToMicros('2026-10-14t21:00:00-03:00')).toBe(damlTimeToMicros('2026-10-15T00:00:00z'));
    // Zeros below the microsecond are allowed; a DAML Time has no finer precision.
    expect(damlTimeToMicros('2026-10-15T00:00:00.123456000Z')).toBe(damlTimeToMicros('2026-10-15T00:00:00.123456Z'));
    expect(damlTimeToMicros('2024-02-29T00:00:00Z')).not.toBeNull();
  });

  it('rejects what a DAML Time cannot be', () => {
    for (const value of [
      '2026-10-15', // a date
      '2026-10-15T00:00:00', // no offset
      '2026-10-15 00:00:00Z', // no T
      '2026-02-29T00:00:00Z', // not a leap year
      '2026-13-01T00:00:00Z',
      '2026-10-15T24:00:00Z',
      '2026-10-15T23:59:60Z', // a leap second
      '2026-10-15T00:00:00.0000001Z', // below a microsecond
      '2026-10-15T00:00:00+24:00',
      '0000-12-31T23:59:59Z', // before year 1
      '0001-01-01T00:30:00+01:00', // year 1 in its zone, year 0 in UTC
      '9999-12-31T23:30:00-01:00', // year 10000 in UTC
    ]) {
      expect(damlTimeToMicros(value)).toBeNull();
    }
    expect(damlTimeToMicros('0001-01-01T00:00:00Z')).not.toBeNull();
    expect(damlTimeToMicros('9999-12-31T23:59:59.999999Z')).not.toBeNull();
  });

  it('formats microseconds as canonical UTC text with six fractional digits', () => {
    for (const value of [
      '0001-01-01T00:00:00.000000Z',
      '1969-12-31T23:59:59.999999Z',
      '1970-01-01T00:00:00.000000Z',
      '2026-10-15T08:30:00.123456Z',
      '9999-12-31T23:59:59.999999Z',
    ]) {
      const micros = damlTimeToMicros(value);
      expect(micros).not.toBeNull();
      expect(microsToDamlTime(micros ?? 0n)).toBe(value);
    }
    expect(microsToDamlTime(damlTimeToMicros('2026-10-15T14:30:00.5+02:30') ?? 0n)).toBe('2026-10-15T12:00:00.500000Z');
  });

  it('reads a Date to the millisecond', () => {
    expect(dateToMicros(new Date('2026-10-15T08:30:00.123Z'))).toBe(damlTimeToMicros('2026-10-15T08:30:00.123Z'));
    expect(dateToMicros(new Date('nope'))).toBeNull();
    expect(dateToMicros(new Date(Date.UTC(10000, 0, 1)))).toBeNull();
  });
});
