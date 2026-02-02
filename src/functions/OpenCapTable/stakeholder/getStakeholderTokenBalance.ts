import type { ValidatorApiClient } from '@fairmint/canton-node-sdk';

/**
 * Token balance information for a stakeholder (external party).
 *
 * All coin values are strings representing decimal amounts in Canton Coin (CC).
 */
export interface StakeholderTokenBalance {
  /** The party ID of the stakeholder */
  partyId: string;
  /** Total unlocked coin balance */
  totalUnlockedCoin: string;
  /** Total locked coin balance */
  totalLockedCoin: string;
  /** Total coin holdings (unlocked + locked) */
  totalCoinHoldings: string;
  /** Accumulated holding fees on unlocked coins */
  accumulatedHoldingFeesUnlocked: string;
  /** Accumulated holding fees on locked coins */
  accumulatedHoldingFeesLocked: string;
  /** Total accumulated holding fees */
  accumulatedHoldingFeesTotal: string;
  /** Total available coin (after fees) */
  totalAvailableCoin: string;
  /** The round number as of which this balance was computed */
  computedAsOfRound: number;
}

export interface GetStakeholderTokenBalanceParams {
  /** The party ID of the stakeholder to get the balance for */
  partyId: string;
}

export interface GetStakeholderTokenBalanceResult {
  /** The token balance, or null if the party doesn't exist or has no balance */
  balance: StakeholderTokenBalance | null;
}

/**
 * Get the token balance for a stakeholder (external party).
 *
 * This function wraps the Validator API's `getExternalPartyBalance` endpoint
 * and handles the case where the party doesn't exist gracefully by returning
 * `null` instead of throwing an error.
 *
 * @param validatorClient - The Validator API client
 * @param params - Parameters including the party ID
 * @returns The token balance, or null if the party doesn't exist
 *
 * @example
 * ```typescript
 * import { ValidatorApiClient } from '@fairmint/canton-node-sdk';
 *
 * const validatorClient = new ValidatorApiClient({ network: 'localnet' });
 * const result = await getStakeholderTokenBalance(validatorClient, {
 *   partyId: 'stakeholder-party-id',
 * });
 *
 * if (result.balance) {
 *   console.log(`Available balance: ${result.balance.totalAvailableCoin} CC`);
 * } else {
 *   console.log('Stakeholder has no token balance');
 * }
 * ```
 */
export async function getStakeholderTokenBalance(
  validatorClient: ValidatorApiClient,
  params: GetStakeholderTokenBalanceParams
): Promise<GetStakeholderTokenBalanceResult> {
  try {
    const response = await validatorClient.getExternalPartyBalance({
      partyId: params.partyId,
    });

    const balance: StakeholderTokenBalance = {
      partyId: response.party_id,
      totalUnlockedCoin: response.total_unlocked_coin,
      totalLockedCoin: response.total_locked_coin,
      totalCoinHoldings: response.total_coin_holdings,
      accumulatedHoldingFeesUnlocked: response.accumulated_holding_fees_unlocked,
      accumulatedHoldingFeesLocked: response.accumulated_holding_fees_locked,
      accumulatedHoldingFeesTotal: response.accumulated_holding_fees_total,
      totalAvailableCoin: response.total_available_coin,
      computedAsOfRound: response.computed_as_of_round,
    };

    return { balance };
  } catch (error: unknown) {
    // Handle "not found" errors gracefully by returning null
    // The Validator API returns 404 when the party doesn't exist or has no balance
    if (isNotFoundError(error)) {
      return { balance: null };
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Check if an error indicates that the resource was not found.
 *
 * This handles various error formats that may be returned by the Validator API
 * when a party doesn't exist or has no balance.
 */
function isNotFoundError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  // Check for HTTP 404 status code
  if (typeof error === 'object') {
    const errorObj = error as Record<string, unknown>;

    // Check status property (common in HTTP errors)
    if (errorObj.status === 404 || errorObj.statusCode === 404) {
      return true;
    }

    // Check for response object with status
    if (typeof errorObj.response === 'object' && errorObj.response !== null) {
      const response = errorObj.response as Record<string, unknown>;
      if (response.status === 404 || response.statusCode === 404) {
        return true;
      }
    }

    // Check error message for "not found" patterns
    if (typeof errorObj.message === 'string') {
      const message = errorObj.message.toLowerCase();
      if (
        message.includes('not found') ||
        message.includes('404') ||
        message.includes('does not exist') ||
        message.includes('no balance')
      ) {
        return true;
      }
    }

    // Check for code property (some APIs use error codes)
    if (errorObj.code === 'NOT_FOUND' || errorObj.code === 'ENOTFOUND') {
      return true;
    }
  }

  return false;
}
