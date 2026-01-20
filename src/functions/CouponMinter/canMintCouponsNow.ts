/**
 * Client-side helper to check if coupon minting is allowed based on TPS rate limits.
 *
 * This utility allows callers to check rate limits before submitting a MintCoupons transaction to the ledger, avoiding
 * unnecessary transaction failures.
 */

/** Result of checking if minting is allowed. */
export type CanMintResult = { canMint: true } | { canMint: false; waitMs: number };

/** Last mint information from the CouponMinter contract. */
export interface LastMint {
  /** DAML timestamp in ISO 8601 format (e.g., "2026-01-13T12:00:00.000000Z") */
  time: string;
  /** Number of coupons minted in the last transaction */
  count: number;
}

/** Relevant fields from the CouponMinter contract payload. */
export interface CouponMinterPayload {
  /** The operator party controlling this minter */
  operator: string;
  /** Maximum transactions per second, or null if rate limiting is disabled */
  maxTps: string | null;
  /** Information about the last mint operation, or null if no mints have occurred */
  lastMint: LastMint | null;
}

/**
 * Checks if minting coupons is currently allowed based on the TPS rate limit configuration.
 *
 * The rate limit formula from the DAML contract is:
 *
 *     minIntervalMicros = (lastMint.count * 1_000_000) / maxTps;
 *
 * If enough time has elapsed since the last mint, minting is allowed. Otherwise, returns the number of milliseconds to
 * wait before minting is allowed.
 *
 * @example
 *   ```typescript
 *   const result = canMintCouponsNow(couponMinterPayload);
 *   if (result.canMint) {
 *   await mintCoupons(...);
 *   } else {
 *   console.log(`Rate limited. Waiting ${result.waitMs}ms...`);
 *   await sleep(result.waitMs);
 *   }
 *   ```
 *
 * @param payload - The CouponMinter contract payload
 * @param now - Optional current time for testing (defaults to new Date())
 * @returns {canMint: true} If minting is allowed, or { canMint: false, waitMs: number } with the wait time
 */
export function canMintCouponsNow(payload: CouponMinterPayload, now?: Date): CanMintResult {
  // No rate limit configured - always allow minting
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive runtime check
  if (payload.maxTps === null || payload.maxTps === undefined) {
    return { canMint: true };
  }

  // No previous mint - always allow minting
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive runtime check
  if (payload.lastMint === null || payload.lastMint === undefined) {
    return { canMint: true };
  }

  // Parse maxTps
  const maxTps = parseFloat(payload.maxTps);
  if (isNaN(maxTps) || maxTps <= 0) {
    throw new Error(`Invalid maxTps value: "${payload.maxTps}". Expected a positive number.`);
  }

  const { time: lastMintTime, count: lastMintCount } = payload.lastMint;

  // Zero count means no effective rate limit from last mint
  if (lastMintCount <= 0) {
    return { canMint: true };
  }

  // Calculate required wait time in microseconds
  // Formula: minIntervalMicros = lastMint.count * 1_000_000 / maxTps
  const minIntervalMicros = (lastMintCount * 1_000_000) / maxTps;

  // Parse the DAML timestamp
  const lastMintDate = new Date(lastMintTime);
  if (isNaN(lastMintDate.getTime())) {
    throw new Error(`Invalid lastMint.time format: "${lastMintTime}". Expected ISO 8601 timestamp.`);
  }

  // Calculate elapsed time in microseconds
  const currentTime = now ?? new Date();
  const elapsedMicros = (currentTime.getTime() - lastMintDate.getTime()) * 1000;

  // Check if enough time has elapsed
  if (elapsedMicros >= minIntervalMicros) {
    return { canMint: true };
  }

  // Calculate remaining wait time in milliseconds
  const remainingMicros = minIntervalMicros - elapsedMicros;
  const waitMs = Math.ceil(remainingMicros / 1000);

  return { canMint: false, waitMs };
}
