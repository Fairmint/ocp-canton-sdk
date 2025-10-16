/** Type definitions for ActiveSubscription contracts */

export interface SubscriptionAmount {
  tag: 'AmuletAmount' | 'USDAmount';
  value: string;
}

export interface SubscriptionDetails {
  subscriber: string;
  recipient: string;
  recipientPaymentPerDay: SubscriptionAmount;
  processorPaymentPerDay: SubscriptionAmount | null;
  freeTrialExpiration: string | null;
  prepayWindow: { microseconds: string };
  paymentsEndAt: string | null;
  provider: string;
  appRewardBeneficiaries: Array<{ party: string; weight: string }>;
  description: string;
  metadata: Record<string, string>;
  observers: string[];
}

export interface ProcessorContext {
  processor: string;
  dso: string;
}

export interface SubscriptionStats {
  roundsProcessed: string;
  totalPaidBySubscriberCC: string;
  totalPaidBySubscriberUSD: string;
  totalReceivedByRecipientCC: string;
  totalReceivedByRecipientUSD: string;
  totalReceivedByProcessorCC: string;
  totalReceivedByProcessorUSD: string;
}

export interface ActiveSubscriptionPayload {
  subscription: SubscriptionDetails;
  processorContext: ProcessorContext;
  processedAndPaidUntil: string; // ISO 8601 timestamp
  lockedAmuletCid: string;
  stats: SubscriptionStats;
}

export interface ActiveSubscriptionContract {
  contractId: string;
  payload: ActiveSubscriptionPayload;
}

/**
 * Check if a subscription is ready for processing based on the processing period
 *
 * @param subscription - The active subscription contract
 * @param processingPeriodSeconds - The processing period in seconds
 * @returns True if the subscription is ready for processing
 */
export function isSubscriptionReadyForProcessing(
  subscription: ActiveSubscriptionContract,
  processingPeriodSeconds: number
): boolean {
  // If processedAndPaidUntil is undefined or empty, the subscription hasn't been processed yet
  if (!subscription.payload.processedAndPaidUntil) {
    return true;
  }

  // Convert ISO timestamp to microseconds
  const processedUntilDate = new Date(subscription.payload.processedAndPaidUntil);
  const processedUntilMicros = BigInt(processedUntilDate.getTime() * 1000);
  const currentTimestamp = BigInt(Date.now() * 1000);
  const processingPeriodMicros = BigInt(processingPeriodSeconds) * BigInt(1_000_000);
  const nextPaymentDue = processedUntilMicros + processingPeriodMicros;

  return currentTimestamp >= nextPaymentDue;
}

/**
 * Convert seconds to microseconds string for DAML RelTime
 *
 * @param seconds - Number of seconds
 * @returns Microseconds as a string
 */
export function secondsToMicroseconds(seconds: number | string): string {
  return (BigInt(seconds) * BigInt(1_000_000)).toString();
}
