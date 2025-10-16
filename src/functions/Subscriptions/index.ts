export * from './partyMigrationProposal';
export * from './subscriptionChangeProposal';
// Export subscription factory with explicit types to avoid naming conflicts
export { buildCreateProposedSubscriptionCommand } from './subscriptionFactory';
export type {
  CreateProposedSubscriptionParams,
  SubscriptionAmountInput,
  SubscriptionProposalInput,
  SubscriptionTimeInput,
} from './subscriptionFactory';

// Export activeSubscription explicitly to avoid PaymentContext conflict with utils
export {
  buildActiveSubscriptionChangePartyCommand,
  buildAddFundsCommand,
  buildArchiveInactiveSubscriptionCommand,
  buildCancelSubscriptionCommand,
  buildProcessFreeTrialCommand,
  buildProcessPaymentCommand,
  buildProposeChangesCommand,
  buildRefundSubscriptionCommand,
  buildReplaceLockedAmuletCommand,
  buildWithdrawFundsCommand,
} from './activeSubscription';
export type {
  ActiveSubscriptionChangePartyParams,
  AddFundsParams,
  ArchiveInactiveSubscriptionParams,
  CancelSubscriptionParams,
  ProcessFreeTrialParams,
  ProcessPaymentParams,
  ProposeChangesParams,
  RefundSubscriptionParams,
  ReplaceLockedAmuletParams,
  SubscriptionChanges,
  WithdrawFundsParams,
} from './activeSubscription';

// Export utils last with explicit types to avoid conflicts
export {
  buildPaymentContext,
  buildPaymentContextWithAmulets,
  getFactoryContractId,
  getFactoryDisclosedContracts,
  getProposedSubscriptionDisclosedContracts,
} from './utils';
export type {
  FactoryContractInfo,
  Network,
  PaymentContext,
  PaymentContextWithAmulets,
  PaymentContextWithAmuletsAndDisclosed,
  PaymentContextWithDisclosedContracts,
} from './utils';

// Export types
export { isSubscriptionReadyForProcessing, secondsToMicroseconds } from './types/activeSubscription';
export type {
  ActiveSubscriptionContract,
  ActiveSubscriptionPayload,
  ProcessorContext,
  SubscriptionAmount,
  SubscriptionDetails,
  SubscriptionStats,
} from './types/activeSubscription';
export type { LockFundsInput } from './types/lockFundsInput';
export {
  areAllNonSubscriberPartiesApproved,
  isProposalPendingProcessorApproval,
  isProposalPendingRecipientApproval,
  isProposalPendingSubscriberApproval,
} from './types/proposedSubscription';
export type {
  Approvals,
  ProposedSubscriptionContract,
  ProposedSubscriptionPayload,
  SubscriptionProposal,
} from './types/proposedSubscription';

// Re-export proposedSubscription with explicit exports to avoid PartyRole conflict
export {
  buildEditSubscriptionProposalCommand,
  buildProposedSubscriptionApproveCommand,
  buildProposedSubscriptionChangePartyCommand,
  buildProposedSubscriptionStartCommand,
  buildProposedSubscriptionWithdrawCommand,
} from './proposedSubscription';
export type {
  EditSubscriptionProposalParams,
  ProposedSubscriptionApproveParams,
  ProposedSubscriptionChangePartyParams,
  PartyRole as ProposedSubscriptionPartyRole,
  ProposedSubscriptionStartParams,
  ProposedSubscriptionWithdrawParams,
  SubscriptionProposalChanges,
} from './proposedSubscription';
