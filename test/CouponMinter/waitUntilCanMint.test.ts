/** Unit tests for the waitUntilCanMint and mintWithRateLimit utilities. */

import {
  getRateLimitStatus,
  mintWithRateLimit,
  WaitAbortedError,
  WaitTimeoutError,
  waitUntilCanMint,
  type CouponMinterPayload,
} from '../../src/functions/CouponMinter';

// Helper to create a payload that can mint immediately
function createCanMintPayload(): CouponMinterPayload {
  return {
    operator: 'alice::1234',
    maxTps: '100',
    lastMint: { time: '2020-01-01T00:00:00.000Z', count: 1 }, // Far in the past
  };
}

// Helper to create a payload that requires waiting
function createRateLimitedPayload(waitMs: number): CouponMinterPayload {
  // Calculate a lastMint time that will require approximately waitMs of waiting
  // For maxTps = 1000 and count = waitMs, we need waitMs milliseconds
  const now = Date.now();
  const lastMintTime = new Date(now).toISOString();

  return {
    operator: 'alice::1234',
    maxTps: '1000', // 1000 TPS
    lastMint: { time: lastMintTime, count: waitMs }, // count = waitMs gives us waitMs milliseconds required
  };
}

describe('waitUntilCanMint', () => {
  describe('immediate mint scenarios', () => {
    test('resolves immediately when no rate limit configured', async () => {
      const payload: CouponMinterPayload = {
        operator: 'alice::1234',
        maxTps: null,
        lastMint: { time: new Date().toISOString(), count: 100 },
      };

      const startTime = Date.now();
      await waitUntilCanMint(payload);
      const elapsed = Date.now() - startTime;

      // Should complete in under 50ms (essentially instant)
      expect(elapsed).toBeLessThan(50);
    });

    test('resolves immediately when no lastMint', async () => {
      const payload: CouponMinterPayload = {
        operator: 'alice::1234',
        maxTps: '100',
        lastMint: null,
      };

      const startTime = Date.now();
      await waitUntilCanMint(payload);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(50);
    });

    test('resolves immediately when enough time has elapsed', async () => {
      const payload = createCanMintPayload();

      const startTime = Date.now();
      await waitUntilCanMint(payload);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('waiting scenarios', () => {
    test('waits for the specified duration when rate limited', async () => {
      // Create a payload that needs ~100ms wait
      const payload = createRateLimitedPayload(100);

      const startTime = Date.now();
      await waitUntilCanMint(payload);
      const elapsed = Date.now() - startTime;

      // Should wait approximately 100ms (with some tolerance for timing)
      expect(elapsed).toBeGreaterThanOrEqual(80); // Allow 20ms tolerance
      expect(elapsed).toBeLessThanOrEqual(300); // Allow tolerance for CI server variations
    });

    test('invokes onWaitStart callback with wait duration', async () => {
      const payload = createRateLimitedPayload(100);
      const onWaitStart = jest.fn();

      await waitUntilCanMint(payload, { onWaitStart });

      expect(onWaitStart).toHaveBeenCalled();
      // The wait time should be approximately 100ms
      expect(onWaitStart.mock.calls[0][0]).toBeGreaterThanOrEqual(50);
    });
  });

  describe('timeout scenarios', () => {
    test('throws WaitTimeoutError when max wait time exceeded', async () => {
      // Create a payload that needs 500ms wait
      const payload = createRateLimitedPayload(500);

      await expect(
        waitUntilCanMint(payload, {
          maxWaitMs: 100, // Only allow 100ms
        })
      ).rejects.toThrow(WaitTimeoutError);
    });

    test('WaitTimeoutError includes max wait time in message', async () => {
      const payload = createRateLimitedPayload(500);

      try {
        await waitUntilCanMint(payload, { maxWaitMs: 50 });
        fail('Expected WaitTimeoutError');
      } catch (error) {
        expect(error).toBeInstanceOf(WaitTimeoutError);
        expect((error as WaitTimeoutError).message).toContain('50ms');
      }
    });
  });

  describe('abort scenarios', () => {
    test('throws WaitAbortedError when signal is already aborted', async () => {
      const payload = createCanMintPayload();
      const controller = new AbortController();
      controller.abort();

      await expect(waitUntilCanMint(payload, { signal: controller.signal })).rejects.toThrow(WaitAbortedError);
    });

    test('throws WaitAbortedError when signal is aborted during wait', async () => {
      const payload = createRateLimitedPayload(500);
      const controller = new AbortController();

      // Abort after 50ms
      setTimeout(() => controller.abort(), 50);

      await expect(
        waitUntilCanMint(payload, {
          signal: controller.signal,
          maxWaitMs: 10000,
        })
      ).rejects.toThrow(WaitAbortedError);
    });
  });

  describe('options', () => {
    test('respects minPollIntervalMs', async () => {
      // Even if we can mint immediately, this tests the option is accepted
      const payload = createCanMintPayload();

      await expect(
        waitUntilCanMint(payload, {
          minPollIntervalMs: 50,
        })
      ).resolves.toBeUndefined();
    });
  });
});

describe('mintWithRateLimit', () => {
  describe('successful mint scenarios', () => {
    test('executes mint function immediately when not rate limited', async () => {
      const payload = createCanMintPayload();
      const mintFn = jest.fn().mockResolvedValue({ txId: '123' });

      const result = await mintWithRateLimit(payload, mintFn);

      expect(mintFn).toHaveBeenCalledTimes(1);
      expect(result.wasRateLimited).toBe(false);
      expect(result.waitedMs).toBeLessThan(50);
      expect(result.result).toEqual({ txId: '123' });
    });

    test('waits then executes mint when rate limited', async () => {
      const payload = createRateLimitedPayload(100);
      const mintFn = jest.fn().mockResolvedValue({ txId: '456' });

      const result = await mintWithRateLimit(payload, mintFn);

      expect(mintFn).toHaveBeenCalledTimes(1);
      expect(result.wasRateLimited).toBe(true);
      expect(result.waitedMs).toBeGreaterThanOrEqual(80);
      expect(result.result).toEqual({ txId: '456' });
    });

    test('invokes onBeforeMint callback before mint function', async () => {
      const payload = createCanMintPayload();
      const callOrder: string[] = [];
      const mintFn = jest.fn().mockImplementation(async () => {
        callOrder.push('mint');
        return Promise.resolve({ txId: '789' });
      });
      const onBeforeMint = jest.fn().mockImplementation(() => {
        callOrder.push('beforeMint');
      });

      await mintWithRateLimit(payload, mintFn, { onBeforeMint });

      expect(onBeforeMint).toHaveBeenCalledTimes(1);
      expect(mintFn).toHaveBeenCalledTimes(1);
      // Verify order: beforeMint should be called before mint
      expect(callOrder).toEqual(['beforeMint', 'mint']);
    });

    test('invokes both onWaitStart and onBeforeMint callbacks in order', async () => {
      const payload = createRateLimitedPayload(100);
      const callOrder: string[] = [];

      const mintFn = jest.fn().mockImplementation(async () => {
        callOrder.push('mint');
        return Promise.resolve({ txId: 'abc' });
      });

      await mintWithRateLimit(payload, mintFn, {
        onWaitStart: () => callOrder.push('waitStart'),
        onBeforeMint: () => callOrder.push('beforeMint'),
      });

      expect(callOrder).toContain('waitStart');
      expect(callOrder).toContain('beforeMint');
      expect(callOrder).toContain('mint');
      // beforeMint should come before mint
      const beforeMintIndex = callOrder.indexOf('beforeMint');
      const mintIndex = callOrder.indexOf('mint');
      expect(beforeMintIndex).toBeLessThan(mintIndex);
    });
  });

  describe('error scenarios', () => {
    test('propagates mint function errors', async () => {
      const payload = createCanMintPayload();
      const mintError = new Error('Mint failed');
      const mintFn = jest.fn().mockRejectedValue(mintError);

      await expect(mintWithRateLimit(payload, mintFn)).rejects.toThrow('Mint failed');
    });

    test('throws WaitTimeoutError when wait times out', async () => {
      const payload = createRateLimitedPayload(500);
      const mintFn = jest.fn();

      await expect(mintWithRateLimit(payload, mintFn, { maxWaitMs: 50 })).rejects.toThrow(WaitTimeoutError);
      expect(mintFn).not.toHaveBeenCalled();
    });

    test('throws WaitAbortedError when aborted', async () => {
      const payload = createRateLimitedPayload(500);
      const controller = new AbortController();
      const mintFn = jest.fn();

      setTimeout(() => controller.abort(), 50);

      await expect(
        mintWithRateLimit(payload, mintFn, {
          signal: controller.signal,
        })
      ).rejects.toThrow(WaitAbortedError);
      expect(mintFn).not.toHaveBeenCalled();
    });
  });

  describe('generic type support', () => {
    test('preserves return type of mint function', async () => {
      interface MintResult {
        txId: string;
        timestamp: Date;
      }

      const payload = createCanMintPayload();
      const expectedResult: MintResult = { txId: 'typed-123', timestamp: new Date() };
      const mintFn = jest.fn().mockResolvedValue(expectedResult);

      const { result } = await mintWithRateLimit<MintResult>(payload, mintFn);

      // TypeScript should infer result as MintResult
      expect(result.txId).toBe('typed-123');
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });
});

describe('getRateLimitStatus', () => {
  test('returns canMint true and isRateLimitEnabled false when maxTps is null', () => {
    const payload: CouponMinterPayload = {
      operator: 'alice::1234',
      maxTps: null,
      lastMint: { time: new Date().toISOString(), count: 100 },
    };

    const status = getRateLimitStatus(payload);

    expect(status.canMint).toBe(true);
    expect(status.isRateLimitEnabled).toBe(false);
  });

  test('returns canMint true and isRateLimitEnabled true when can mint', () => {
    const payload = createCanMintPayload();

    const status = getRateLimitStatus(payload);

    expect(status.canMint).toBe(true);
    expect(status.isRateLimitEnabled).toBe(true);
  });

  test('returns waitMs and waitSeconds when rate limited', () => {
    const payload = createRateLimitedPayload(1000);

    const status = getRateLimitStatus(payload);

    expect(status.canMint).toBe(false);
    if (!status.canMint) {
      expect(status.waitMs).toBeGreaterThan(0);
      expect(status.waitSeconds).toBeCloseTo(status.waitMs / 1000, 3);
    }
    expect(status.isRateLimitEnabled).toBe(true);
  });

  test('accepts optional now parameter', () => {
    const payload: CouponMinterPayload = {
      operator: 'alice::1234',
      maxTps: '100',
      lastMint: { time: '2026-01-15T11:59:59.000Z', count: 100 },
    };
    const now = new Date('2026-01-15T12:00:00.000Z');

    const status = getRateLimitStatus(payload, now);

    expect(status.canMint).toBe(true);
  });
});

describe('error classes', () => {
  test('WaitAbortedError has correct name and message', () => {
    const error = new WaitAbortedError();
    expect(error.name).toBe('WaitAbortedError');
    expect(error.message).toBe('Wait operation was aborted');
  });

  test('WaitAbortedError accepts custom message', () => {
    const error = new WaitAbortedError('Custom abort message');
    expect(error.message).toBe('Custom abort message');
  });

  test('WaitTimeoutError has correct name and message', () => {
    const error = new WaitTimeoutError(5000);
    expect(error.name).toBe('WaitTimeoutError');
    expect(error.message).toContain('5000ms');
  });

  test('errors are instances of Error', () => {
    expect(new WaitAbortedError()).toBeInstanceOf(Error);
    expect(new WaitTimeoutError(1000)).toBeInstanceOf(Error);
  });
});
