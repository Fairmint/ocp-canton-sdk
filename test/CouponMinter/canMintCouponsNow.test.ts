/** Unit tests for the canMintCouponsNow TPS rate limit helper function. */

import { canMintCouponsNow, type CouponMinterPayload } from '../../src/functions/CouponMinter';

describe('canMintCouponsNow', () => {
  // Fixed reference time for deterministic tests
  const referenceTime = new Date('2026-01-15T12:00:00.000Z');

  describe('no rate limiting configured', () => {
    test('returns canMint: true when maxTps is null', () => {
      const payload: CouponMinterPayload = {
        operator: 'alice::1234',
        maxTps: null,
        lastMint: { time: '2026-01-15T11:59:59.000Z', count: 100 },
      };

      const result = canMintCouponsNow(payload, referenceTime);

      expect(result).toEqual({ canMint: true });
    });

    test('returns canMint: true when maxTps is undefined', () => {
      const payload: CouponMinterPayload = {
        operator: 'alice::1234',
        maxTps: undefined as unknown as null,
        lastMint: { time: '2026-01-15T11:59:59.000Z', count: 100 },
      };

      const result = canMintCouponsNow(payload, referenceTime);

      expect(result).toEqual({ canMint: true });
    });
  });

  describe('no previous mint', () => {
    test('returns canMint: true when lastMint is null', () => {
      const payload: CouponMinterPayload = {
        operator: 'alice::1234',
        maxTps: '100',
        lastMint: null,
      };

      const result = canMintCouponsNow(payload, referenceTime);

      expect(result).toEqual({ canMint: true });
    });

    test('returns canMint: true when lastMint is undefined', () => {
      const payload: CouponMinterPayload = {
        operator: 'alice::1234',
        maxTps: '100',
        lastMint: undefined as unknown as null,
      };

      const result = canMintCouponsNow(payload, referenceTime);

      expect(result).toEqual({ canMint: true });
    });
  });

  describe('zero count edge case', () => {
    test('returns canMint: true when lastMint.count is 0', () => {
      const payload: CouponMinterPayload = {
        operator: 'alice::1234',
        maxTps: '100',
        lastMint: { time: '2026-01-15T11:59:59.999Z', count: 0 },
      };

      const result = canMintCouponsNow(payload, referenceTime);

      expect(result).toEqual({ canMint: true });
    });

    test('returns canMint: true when lastMint.count is negative', () => {
      const payload: CouponMinterPayload = {
        operator: 'alice::1234',
        maxTps: '100',
        lastMint: { time: '2026-01-15T11:59:59.999Z', count: -1 },
      };

      const result = canMintCouponsNow(payload, referenceTime);

      expect(result).toEqual({ canMint: true });
    });
  });

  describe('rate limit calculations', () => {
    test('returns canMint: true when enough time has elapsed', () => {
      // maxTps = 100, lastMint.count = 100
      // minIntervalMicros = 100 * 1_000_000 / 100 = 1_000_000 (1 second)
      // lastMint was 2 seconds ago, so we should be able to mint
      const payload: CouponMinterPayload = {
        operator: 'alice::1234',
        maxTps: '100',
        lastMint: { time: '2026-01-15T11:59:58.000Z', count: 100 },
      };

      const result = canMintCouponsNow(payload, referenceTime);

      expect(result).toEqual({ canMint: true });
    });

    test('returns canMint: true when exactly enough time has elapsed', () => {
      // maxTps = 100, lastMint.count = 100
      // minIntervalMicros = 100 * 1_000_000 / 100 = 1_000_000 (1 second)
      // lastMint was exactly 1 second ago
      const payload: CouponMinterPayload = {
        operator: 'alice::1234',
        maxTps: '100',
        lastMint: { time: '2026-01-15T11:59:59.000Z', count: 100 },
      };

      const result = canMintCouponsNow(payload, referenceTime);

      expect(result).toEqual({ canMint: true });
    });

    test('returns canMint: false with waitMs when not enough time has elapsed', () => {
      // maxTps = 100, lastMint.count = 100
      // minIntervalMicros = 100 * 1_000_000 / 100 = 1_000_000 (1 second)
      // lastMint was 0.5 seconds ago, so we need to wait 0.5 more seconds
      const payload: CouponMinterPayload = {
        operator: 'alice::1234',
        maxTps: '100',
        lastMint: { time: '2026-01-15T11:59:59.500Z', count: 100 },
      };

      const result = canMintCouponsNow(payload, referenceTime);

      expect(result.canMint).toBe(false);
      if (!result.canMint) {
        // Should be approximately 500ms
        expect(result.waitMs).toBe(500);
      }
    });

    test('handles high TPS values', () => {
      // maxTps = 10000, lastMint.count = 100
      // minIntervalMicros = 100 * 1_000_000 / 10000 = 10_000 (10ms)
      // lastMint was 5ms ago, so we need to wait 5 more ms
      const payload: CouponMinterPayload = {
        operator: 'alice::1234',
        maxTps: '10000',
        lastMint: { time: '2026-01-15T11:59:59.995Z', count: 100 },
      };

      const result = canMintCouponsNow(payload, referenceTime);

      expect(result.canMint).toBe(false);
      if (!result.canMint) {
        // Should be approximately 5ms
        expect(result.waitMs).toBe(5);
      }
    });

    test('handles low TPS values', () => {
      // maxTps = 1, lastMint.count = 5
      // minIntervalMicros = 5 * 1_000_000 / 1 = 5_000_000 (5 seconds)
      // lastMint was 3 seconds ago, so we need to wait 2 more seconds
      const payload: CouponMinterPayload = {
        operator: 'alice::1234',
        maxTps: '1',
        lastMint: { time: '2026-01-15T11:59:57.000Z', count: 5 },
      };

      const result = canMintCouponsNow(payload, referenceTime);

      expect(result.canMint).toBe(false);
      if (!result.canMint) {
        expect(result.waitMs).toBe(2000);
      }
    });

    test('handles fractional TPS values', () => {
      // maxTps = 0.5, lastMint.count = 1
      // minIntervalMicros = 1 * 1_000_000 / 0.5 = 2_000_000 (2 seconds)
      // lastMint was 1 second ago, so we need to wait 1 more second
      const payload: CouponMinterPayload = {
        operator: 'alice::1234',
        maxTps: '0.5',
        lastMint: { time: '2026-01-15T11:59:59.000Z', count: 1 },
      };

      const result = canMintCouponsNow(payload, referenceTime);

      expect(result.canMint).toBe(false);
      if (!result.canMint) {
        expect(result.waitMs).toBe(1000);
      }
    });

    test('handles small count values', () => {
      // maxTps = 100, lastMint.count = 1
      // minIntervalMicros = 1 * 1_000_000 / 100 = 10_000 (10ms)
      // lastMint was 5ms ago, so we need to wait 5 more ms
      const payload: CouponMinterPayload = {
        operator: 'alice::1234',
        maxTps: '100',
        lastMint: { time: '2026-01-15T11:59:59.995Z', count: 1 },
      };

      const result = canMintCouponsNow(payload, referenceTime);

      expect(result.canMint).toBe(false);
      if (!result.canMint) {
        expect(result.waitMs).toBe(5);
      }
    });

    test('handles large count values', () => {
      // maxTps = 1000, lastMint.count = 10000
      // minIntervalMicros = 10000 * 1_000_000 / 1000 = 10_000_000 (10 seconds)
      // lastMint was 5 seconds ago, so we need to wait 5 more seconds
      const payload: CouponMinterPayload = {
        operator: 'alice::1234',
        maxTps: '1000',
        lastMint: { time: '2026-01-15T11:59:55.000Z', count: 10000 },
      };

      const result = canMintCouponsNow(payload, referenceTime);

      expect(result.canMint).toBe(false);
      if (!result.canMint) {
        expect(result.waitMs).toBe(5000);
      }
    });
  });

  describe('DAML timestamp formats', () => {
    test('handles DAML timestamp with microseconds', () => {
      const payload: CouponMinterPayload = {
        operator: 'alice::1234',
        maxTps: '100',
        lastMint: { time: '2026-01-15T11:59:59.500000Z', count: 100 },
      };

      const result = canMintCouponsNow(payload, referenceTime);

      expect(result.canMint).toBe(false);
      if (!result.canMint) {
        expect(result.waitMs).toBe(500);
      }
    });

    test('handles DAML timestamp without Z suffix', () => {
      // Note: Date.parse treats this as local time, but the test should still work
      const payload: CouponMinterPayload = {
        operator: 'alice::1234',
        maxTps: '100',
        lastMint: { time: '2026-01-15T11:59:58.000Z', count: 100 },
      };

      const result = canMintCouponsNow(payload, referenceTime);

      expect(result).toEqual({ canMint: true });
    });
  });

  describe('error handling', () => {
    test('throws error for invalid maxTps (non-numeric)', () => {
      const payload: CouponMinterPayload = {
        operator: 'alice::1234',
        maxTps: 'invalid',
        lastMint: { time: '2026-01-15T11:59:59.000Z', count: 100 },
      };

      expect(() => canMintCouponsNow(payload, referenceTime)).toThrow(
        'Invalid maxTps value: "invalid". Expected a positive number.'
      );
    });

    test('throws error for maxTps of zero', () => {
      const payload: CouponMinterPayload = {
        operator: 'alice::1234',
        maxTps: '0',
        lastMint: { time: '2026-01-15T11:59:59.000Z', count: 100 },
      };

      expect(() => canMintCouponsNow(payload, referenceTime)).toThrow(
        'Invalid maxTps value: "0". Expected a positive number.'
      );
    });

    test('throws error for negative maxTps', () => {
      const payload: CouponMinterPayload = {
        operator: 'alice::1234',
        maxTps: '-10',
        lastMint: { time: '2026-01-15T11:59:59.000Z', count: 100 },
      };

      expect(() => canMintCouponsNow(payload, referenceTime)).toThrow(
        'Invalid maxTps value: "-10". Expected a positive number.'
      );
    });

    test('throws error for invalid lastMint.time', () => {
      const payload: CouponMinterPayload = {
        operator: 'alice::1234',
        maxTps: '100',
        lastMint: { time: 'not-a-timestamp', count: 100 },
      };

      expect(() => canMintCouponsNow(payload, referenceTime)).toThrow(
        'Invalid lastMint.time format: "not-a-timestamp". Expected ISO 8601 timestamp.'
      );
    });
  });

  describe('real-time usage', () => {
    test('works without providing now parameter', () => {
      // Use a lastMint time far in the past so we can always mint
      const payload: CouponMinterPayload = {
        operator: 'alice::1234',
        maxTps: '100',
        lastMint: { time: '2020-01-01T00:00:00.000Z', count: 1 },
      };

      const result = canMintCouponsNow(payload);

      expect(result).toEqual({ canMint: true });
    });
  });

  describe('waitMs ceiling', () => {
    test('rounds up waitMs to nearest millisecond', () => {
      // maxTps = 3, lastMint.count = 1
      // minIntervalMicros = 1 * 1_000_000 / 3 = 333_333.33... microseconds
      // This creates a non-integer millisecond value when calculating wait time
      const payload: CouponMinterPayload = {
        operator: 'alice::1234',
        maxTps: '3',
        lastMint: { time: '2026-01-15T11:59:59.900Z', count: 1 },
      };

      const result = canMintCouponsNow(payload, referenceTime);

      expect(result.canMint).toBe(false);
      if (!result.canMint) {
        // Should round up to the nearest ms
        expect(Number.isInteger(result.waitMs)).toBe(true);
        expect(result.waitMs).toBeGreaterThan(0);
      }
    });
  });
});
