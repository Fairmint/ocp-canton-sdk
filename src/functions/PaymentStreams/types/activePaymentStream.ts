/** Type definitions for ActivePaymentStream contracts */

export interface PaymentStreamAmount {
  tag: 'AmuletAmount' | 'USDAmount';
  value: string;
}

export interface PaymentStreamDetails {
  payer: string;
  recipient: string;
  recipientPaymentPerDay: PaymentStreamAmount;
  processorPaymentPerDay: PaymentStreamAmount | null;
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

export interface PaymentStreamStats {
  roundsProcessed: string;
  totalPaidByPayerCC: string;
  totalPaidByPayerUSD: string;
  totalReceivedByRecipientCC: string;
  totalReceivedByRecipientUSD: string;
  totalReceivedByProcessorCC: string;
  totalReceivedByProcessorUSD: string;
}

export interface ActivePaymentStreamPayload {
  paymentStream: PaymentStreamDetails;
  processorContext: ProcessorContext;
  processedAndPaidUntil: string; // ISO 8601 timestamp
  lockedAmuletCid: string;
  stats: PaymentStreamStats;
}

export interface ActivePaymentStreamContract {
  contractId: string;
  payload: ActivePaymentStreamPayload;
}

/**
 * Check if a paymentStream is ready for processing based on the processing period
 *
 * @param paymentStream - The active paymentStream contract
 * @param processingPeriodSeconds - The processing period in seconds
 * @returns True if the paymentStream is ready for processing
 */
export function isPaymentStreamReadyForProcessing(
  paymentStream: ActivePaymentStreamContract,
  processingPeriodSeconds: number
): boolean {
  // If processedAndPaidUntil is undefined or empty, the paymentStream hasn't been processed yet
  if (!paymentStream.payload.processedAndPaidUntil) {
    return true;
  }

  // Convert ISO timestamp to microseconds
  const processedUntilDate = new Date(paymentStream.payload.processedAndPaidUntil);
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
