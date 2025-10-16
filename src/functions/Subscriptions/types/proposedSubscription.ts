/** Type definitions for ProposedSubscription contracts */

export interface SubscriptionProposal {
  subscriber: string;
  recipient: string;
  provider: string;
  recipientPaymentPerDay: {
    tag: 'AmuletAmount' | 'USDAmount';
    value: string;
  };
  processorPaymentPerDay: {
    tag: 'AmuletAmount' | 'USDAmount';
    value: string;
  } | null;
  prepayWindow: { microseconds: string };
  paymentsEndAt: {
    tag: 'PreciseTime' | 'RelativeTime';
    value: string;
  } | null;
  freeTrialExpiration: {
    tag: 'PreciseTime' | 'RelativeTime';
    value: string;
  } | null;
  appRewardBeneficiaries: Array<{ beneficiary: string; weight: string }>;
  observers: string[];
  description?: string;
  metadata?: Record<string, string>;
}

export interface Approvals {
  subscriberApproved: boolean;
  recipientApproved: boolean;
  processorApproved: boolean;
}

export interface ProposedSubscriptionPayload {
  subscriptionProposal: SubscriptionProposal;
  processorContext: {
    processor: string;
    dso: string;
  };
  approvals: Approvals;
}

export interface ProposedSubscriptionContract {
  contractId: string;
  payload: ProposedSubscriptionPayload;
}

/**
 * Check if a proposed subscription is pending recipient approval
 *
 * @param proposal - The proposed subscription contract
 * @param recipientPartyId - The recipient party ID to check
 * @returns True if the proposal is pending the recipient's approval
 */
export function isProposalPendingRecipientApproval(
  proposal: ProposedSubscriptionContract,
  recipientPartyId: string
): boolean {
  return (
    proposal.payload.subscriptionProposal.recipient === recipientPartyId &&
    !proposal.payload.approvals.recipientApproved
  );
}

/**
 * Check if a proposed subscription is pending subscriber approval
 *
 * @param proposal - The proposed subscription contract
 * @param subscriberPartyId - The subscriber party ID to check
 * @returns True if the proposal is pending the subscriber's approval
 */
export function isProposalPendingSubscriberApproval(
  proposal: ProposedSubscriptionContract,
  subscriberPartyId: string
): boolean {
  return (
    proposal.payload.subscriptionProposal.subscriber === subscriberPartyId &&
    !proposal.payload.approvals.subscriberApproved
  );
}

/**
 * Check if a proposed subscription is pending processor approval
 *
 * @param proposal - The proposed subscription contract
 * @param processorPartyId - The processor party ID to check
 * @returns True if the proposal is pending the processor's approval
 */
export function isProposalPendingProcessorApproval(
  proposal: ProposedSubscriptionContract,
  processorPartyId: string
): boolean {
  return (
    proposal.payload.processorContext.processor === processorPartyId && !proposal.payload.approvals.processorApproved
  );
}

/**
 * Check if all parties have approved the subscription proposal
 *
 * @param proposal - The proposed subscription contract
 * @returns True if all parties have approved
 */
export function areAllNonSubscriberPartiesApproved(proposal: ProposedSubscriptionContract): boolean {
  return proposal.payload.approvals.recipientApproved && proposal.payload.approvals.processorApproved;
}
