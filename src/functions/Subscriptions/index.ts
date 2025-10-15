export * from './subscriptionChangeProposal';
export * from './subscriptionFactory';
export * from './partyMigrationProposal';

// Export activeSubscription explicitly to avoid PaymentContext conflict with utils
export {
  buildProcessPaymentCommand,
  buildProcessFreeTrialCommand,
  buildCancelSubscriptionCommand,
  buildProposeChangesCommand,
  buildRefundSubscriptionCommand,
  buildArchiveInactiveSubscriptionCommand,
  buildActiveSubscriptionChangePartyCommand,
  buildAddFundsCommand,
  buildWithdrawFundsCommand,
  buildReplaceLockedAmuletCommand,
} from './activeSubscription';
export type {
  ProcessPaymentParams,
  ProcessingContext as ActiveSubscriptionProcessingContext,
  ProcessFreeTrialParams,
  CancelSubscriptionParams,
  ProposeChangesParams,
  SubscriptionChanges,
  RefundSubscriptionParams,
  ArchiveInactiveSubscriptionParams,
  ActiveSubscriptionChangePartyParams,
  AddFundsParams,
  WithdrawFundsParams,
  ReplaceLockedAmuletParams,
} from './activeSubscription';

// Export utils last with explicit types to avoid conflicts
export {
  getFactoryDisclosedContracts,
  getProposedSubscriptionDisclosedContracts,
  buildPaymentContext,
  buildPaymentContextWithAmulets,
  getFactoryContractId,
} from './utils';
export type {
  PaymentContext,
  PaymentContextWithDisclosedContracts,
  PaymentContextWithAmulets,
  PaymentContextWithAmuletsAndDisclosed,
  Network,
  FactoryContractInfo,
} from './utils';

// Export types
export type { LockFundsInput } from './types/lockFundsInput';

// Re-export proposedSubscription with explicit exports to avoid PartyRole conflict
export {
  buildProposedSubscriptionApproveCommand,
  buildProposedSubscriptionStartCommand,
  buildEditSubscriptionProposalCommand,
  buildProposedSubscriptionWithdrawCommand,
  buildProposedSubscriptionChangePartyCommand,
} from './proposedSubscription';
export type {
  ProposedSubscriptionApproveParams,
  ProposedSubscriptionStartParams,
  EditSubscriptionProposalParams,
  SubscriptionProposalChanges,
  ProposedSubscriptionWithdrawParams,
  ProposedSubscriptionChangePartyParams,
  PartyRole as ProposedSubscriptionPartyRole,
} from './proposedSubscription';
