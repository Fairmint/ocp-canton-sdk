/** Type definitions for ProposedPaymentStream contracts */

export interface PaymentStreamProposal {
  payer: string;
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
  payerApproved: boolean;
  recipientApproved: boolean;
  processorApproved: boolean;
}

export interface ProposedPaymentStreamPayload {
  paymentStreamProposal: PaymentStreamProposal;
  processorContext: {
    processor: string;
    dso: string;
  };
  approvals: Approvals;
}

export interface ProposedPaymentStreamContract {
  contractId: string;
  payload: ProposedPaymentStreamPayload;
}

/**
 * Check if a proposed paymentStream is pending recipient approval
 *
 * @param proposal - The proposed paymentStream contract
 * @param recipientPartyId - The recipient party ID to check
 * @returns True if the proposal is pending the recipient's approval
 */
export function isProposalPendingRecipientApproval(
  proposal: ProposedPaymentStreamContract,
  recipientPartyId: string
): boolean {
  return (
    proposal.payload.paymentStreamProposal.recipient === recipientPartyId &&
    !proposal.payload.approvals.recipientApproved
  );
}

/**
 * Check if a proposed paymentStream is pending payer approval
 *
 * @param proposal - The proposed paymentStream contract
 * @param payerPartyId - The payer party ID to check
 * @returns True if the proposal is pending the payer's approval
 */
export function isProposalPendingPayerApproval(
  proposal: ProposedPaymentStreamContract,
  payerPartyId: string
): boolean {
  return (
    proposal.payload.paymentStreamProposal.payer === payerPartyId &&
    !proposal.payload.approvals.payerApproved
  );
}

/**
 * Check if a proposed paymentStream is pending processor approval
 *
 * @param proposal - The proposed paymentStream contract
 * @param processorPartyId - The processor party ID to check
 * @returns True if the proposal is pending the processor's approval
 */
export function isProposalPendingProcessorApproval(
  proposal: ProposedPaymentStreamContract,
  processorPartyId: string
): boolean {
  return (
    proposal.payload.processorContext.processor === processorPartyId && !proposal.payload.approvals.processorApproved
  );
}

/**
 * Check if all parties have approved the paymentStream proposal
 *
 * @param proposal - The proposed paymentStream contract
 * @returns True if all parties have approved
 */
export function areAllNonPayerPartiesApproved(proposal: ProposedPaymentStreamContract): boolean {
  return proposal.payload.approvals.recipientApproved && proposal.payload.approvals.processorApproved;
}
