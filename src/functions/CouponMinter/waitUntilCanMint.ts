/**
 * Utility functions for waiting until coupon minting is allowed based on TPS rate limits.
 *
 * These utilities provide "fire and forget" style minting with automatic rate limit handling.
 */

import { canMintCouponsNow, type CanMintResult, type CouponMinterPayload } from './canMintCouponsNow';

/** Default polling interval when waiting for mint readiness (in milliseconds) */
const DEFAULT_POLL_INTERVAL_MS = 100;

/** Maximum wait time to prevent infinite waiting (5 minutes) */
const DEFAULT_MAX_WAIT_MS = 5 * 60 * 1000;

/**
 * Options for waiting until minting is allowed.
 */
export interface WaitUntilCanMintOptions {
  /**
   * Maximum time to wait in milliseconds before giving up.
   * @default 300000 (5 minutes)
   */
  maxWaitMs?: number;

  /**
   * Minimum polling interval in milliseconds when rate limited.
   * The actual wait will use the calculated waitMs from canMintCouponsNow,
   * but this sets a minimum interval between checks.
   * @default 100
   */
  minPollIntervalMs?: number;

  /**
   * Signal to abort the wait operation.
   * If the signal is aborted, the promise will reject with an AbortError.
   */
  signal?: AbortSignal;

  /**
   * Optional callback invoked when waiting starts, providing the estimated wait time.
   * Useful for logging or updating UI.
   */
  onWaitStart?: (waitMs: number) => void;
}

/**
 * Error thrown when the wait operation is aborted.
 */
export class WaitAbortedError extends Error {
  constructor(message = 'Wait operation was aborted') {
    super(message);
    this.name = 'WaitAbortedError';
  }
}

/**
 * Error thrown when the maximum wait time is exceeded.
 */
export class WaitTimeoutError extends Error {
  constructor(maxWaitMs: number) {
    super(`Maximum wait time of ${maxWaitMs}ms exceeded while waiting for rate limit`);
    this.name = 'WaitTimeoutError';
  }
}

/**
 * Sleeps for the specified duration, respecting abort signals.
 *
 * @param ms - Duration to sleep in milliseconds
 * @param signal - Optional abort signal
 * @returns Promise that resolves after the sleep duration
 * @throws WaitAbortedError if the signal is aborted during sleep
 */
async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw new WaitAbortedError();
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);

    if (signal) {
      const abortHandler = (): void => {
        clearTimeout(timeout);
        reject(new WaitAbortedError());
      };
      signal.addEventListener('abort', abortHandler, { once: true });

      // Clean up the abort handler when the sleep completes
      const originalResolve = resolve;
      const wrappedResolve = (): void => {
        signal.removeEventListener('abort', abortHandler);
        originalResolve();
      };
      clearTimeout(timeout);
      setTimeout(wrappedResolve, ms);
    }
  });
}

/**
 * Waits until coupon minting is allowed based on the current rate limit state.
 *
 * This function will sleep until the rate limit allows minting, checking periodically
 * until either minting is allowed or the maximum wait time is exceeded.
 *
 * @example
 *   ```typescript
 *   // Wait until we can mint, then proceed
 *   await waitUntilCanMint(couponMinterPayload);
 *   await mintCoupons(...);
 *   ```
 *
 * @example
 *   ```typescript
 *   // Wait with a timeout and abort support
 *   const controller = new AbortController();
 *   setTimeout(() => controller.abort(), 10000); // 10 second timeout
 *
 *   try {
 *     await waitUntilCanMint(couponMinterPayload, {
 *       maxWaitMs: 30000,
 *       signal: controller.signal,
 *       onWaitStart: (ms) => console.log(`Waiting ${ms}ms for rate limit...`),
 *     });
 *     await mintCoupons(...);
 *   } catch (error) {
 *     if (error instanceof WaitAbortedError) {
 *       console.log('Wait was cancelled');
 *     }
 *   }
 *   ```
 *
 * @param payload - The CouponMinter contract payload with rate limit state
 * @param options - Optional configuration for the wait operation
 * @returns Promise that resolves when minting is allowed
 * @throws WaitAbortedError if the operation is aborted via the signal
 * @throws WaitTimeoutError if the maximum wait time is exceeded
 */
export async function waitUntilCanMint(payload: CouponMinterPayload, options?: WaitUntilCanMintOptions): Promise<void> {
  const {
    maxWaitMs = DEFAULT_MAX_WAIT_MS,
    minPollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    signal,
    onWaitStart,
  } = options ?? {};

  if (signal?.aborted) {
    throw new WaitAbortedError();
  }

  const startTime = Date.now();

  // Initial check
  let result = canMintCouponsNow(payload);

  while (!result.canMint) {
    const elapsed = Date.now() - startTime;

    // Check if we've exceeded max wait time
    if (elapsed >= maxWaitMs) {
      throw new WaitTimeoutError(maxWaitMs);
    }

    // Calculate wait time (use the larger of waitMs and minPollIntervalMs)
    const waitMs = Math.max(result.waitMs, minPollIntervalMs);

    // Don't wait longer than remaining max wait time
    const remainingTime = maxWaitMs - elapsed;
    const actualWaitMs = Math.min(waitMs, remainingTime);

    // Notify callback if provided
    onWaitStart?.(actualWaitMs);

    // Sleep for the calculated duration
    await sleep(actualWaitMs, signal);

    // Re-check with current time
    result = canMintCouponsNow(payload);
  }
}

/**
 * Result of a mintWithRateLimit operation.
 */
export interface MintWithRateLimitResult<T> {
  /** Whether we had to wait due to rate limiting */
  wasRateLimited: boolean;
  /** How long we waited in milliseconds (0 if not rate limited) */
  waitedMs: number;
  /** The result from the mint function */
  result: T;
}

/**
 * Options for mintWithRateLimit operation.
 */
export interface MintWithRateLimitOptions extends WaitUntilCanMintOptions {
  /**
   * Callback invoked just before the mint function is called.
   * Useful for logging or updating UI.
   */
  onBeforeMint?: () => void;
}

/**
 * Waits until minting is allowed, then executes the provided mint function.
 *
 * This is a "fire and forget" style wrapper that handles rate limiting automatically.
 * It waits for the rate limit to allow minting, then executes your mint function.
 *
 * @example
 *   ```typescript
 *   // Simple usage with async mint function
 *   const { result, wasRateLimited, waitedMs } = await mintWithRateLimit(
 *     couponMinterPayload,
 *     async () => {
 *       return await ledgerClient.exerciseChoice(
 *         couponMinterCid,
 *         'MintCoupons',
 *         mintParams
 *       );
 *     }
 *   );
 *   console.log(`Minting complete. Rate limited: ${wasRateLimited}, waited: ${waitedMs}ms`);
 *   ```
 *
 * @example
 *   ```typescript
 *   // With callbacks for progress tracking
 *   const { result } = await mintWithRateLimit(
 *     couponMinterPayload,
 *     async () => mintCoupons(params),
 *     {
 *       onWaitStart: (ms) => console.log(`Rate limited, waiting ${ms}ms...`),
 *       onBeforeMint: () => console.log('Submitting mint transaction...'),
 *       maxWaitMs: 60000,
 *     }
 *   );
 *   ```
 *
 * @param payload - The CouponMinter contract payload with rate limit state
 * @param mintFn - The async function to execute once minting is allowed
 * @param options - Optional configuration for the wait and mint operation
 * @returns Promise resolving to the mint result along with rate limit metadata
 * @throws WaitAbortedError if the operation is aborted via the signal
 * @throws WaitTimeoutError if the maximum wait time is exceeded
 * @throws Any error thrown by the mintFn
 */
export async function mintWithRateLimit<T>(
  payload: CouponMinterPayload,
  mintFn: () => Promise<T>,
  options?: MintWithRateLimitOptions
): Promise<MintWithRateLimitResult<T>> {
  const startTime = Date.now();

  // Check initial rate limit status
  const initialCheck = canMintCouponsNow(payload);
  const wasRateLimited = !initialCheck.canMint;

  // Wait if necessary
  if (wasRateLimited) {
    await waitUntilCanMint(payload, options);
  }

  const waitedMs = Date.now() - startTime;

  // Notify before mint callback
  options?.onBeforeMint?.();

  // Execute the mint function
  const result = await mintFn();

  return {
    wasRateLimited,
    waitedMs,
    result,
  };
}

/**
 * Checks the current rate limit status and returns detailed information.
 *
 * This is a convenience wrapper around canMintCouponsNow that provides
 * additional context useful for UI display or logging.
 *
 * @example
 *   ```typescript
 *   const status = getRateLimitStatus(couponMinterPayload);
 *   if (status.canMint) {
 *     console.log('Ready to mint!');
 *   } else {
 *     console.log(`Rate limited. Can mint in ${status.waitMs}ms (${status.waitSeconds.toFixed(1)}s)`);
 *   }
 *   ```
 *
 * @param payload - The CouponMinter contract payload
 * @param now - Optional current time for testing
 * @returns Detailed rate limit status information
 */
export function getRateLimitStatus(
  payload: CouponMinterPayload,
  now?: Date
): CanMintResult & { waitSeconds?: number; isRateLimitEnabled: boolean } {
  const result = canMintCouponsNow(payload, now);
  const isRateLimitEnabled = payload.maxTps !== null;

  if (result.canMint) {
    return {
      ...result,
      isRateLimitEnabled,
    };
  }

  return {
    ...result,
    waitSeconds: result.waitMs / 1000,
    isRateLimitEnabled,
  };
}
