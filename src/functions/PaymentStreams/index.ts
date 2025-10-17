export * from './partyMigrationProposal';
export * from './paymentStreamChangeProposal';
// Export paymentStream factory with explicit types to avoid naming conflicts
export { buildCreatePaymentStreamProposalCommand } from './paymentStreamFactory';
export type {
  CreatePaymentStreamProposalParams,
  PaymentStreamAmountInput,
  PaymentStreamProposalInput,
  PaymentStreamTimeInput,
} from './paymentStreamFactory';

// Export activePaymentStream explicitly to avoid PaymentContext conflict with utils
export {
  buildActivePaymentStreamChangePartyCommand,
  buildAddFundsCommand,
  buildArchiveInactivePaymentStreamCommand,
  buildCancelPaymentStreamCommand,
  buildProcessFreeTrialCommand,
  buildProcessPaymentCommand,
  buildProposeChangesCommand,
  buildRefundPaymentStreamCommand,
  buildReplaceLockedAmuletCommand,
  buildWithdrawFundsCommand,
} from './activePaymentStream';
export type {
  ActivePaymentStreamChangePartyParams,
  AddFundsParams,
  ArchiveInactivePaymentStreamParams,
  CancelPaymentStreamParams,
  PaymentStreamChanges,
  ProcessFreeTrialParams,
  ProcessPaymentParams,
  ProposeChangesParams,
  RefundPaymentStreamParams,
  ReplaceLockedAmuletParams,
  WithdrawFundsParams,
} from './activePaymentStream';

// Export utils last with explicit types to avoid conflicts
export {
  buildPaymentContext,
  buildPaymentContextWithAmulets,
  getFactoryContractId,
  getFactoryDisclosedContracts,
  getProposedPaymentStreamDisclosedContracts,
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
export { isPaymentStreamReadyForProcessing, secondsToMicroseconds } from './types/activePaymentStream';
export type {
  ActivePaymentStreamContract,
  ActivePaymentStreamPayload,
  PaymentStreamAmount,
  PaymentStreamDetails,
  PaymentStreamStats,
  ProcessorContext,
} from './types/activePaymentStream';
export type { LockFundsInput } from './types/lockFundsInput';
export {
  areAllNonPayerPartiesApproved,
  isProposalPendingPayerApproval,
  isProposalPendingProcessorApproval,
  isProposalPendingRecipientApproval,
} from './types/proposedPaymentStream';
export type {
  Approvals,
  PaymentStreamProposal,
  ProposedPaymentStreamContract,
  ProposedPaymentStreamPayload,
} from './types/proposedPaymentStream';

// Re-export proposedPaymentStream with explicit exports to avoid PartyRole conflict
export {
  buildEditPaymentStreamProposalCommand,
  buildProposedPaymentStreamApproveCommand,
  buildProposedPaymentStreamChangePartyCommand,
  buildProposedPaymentStreamStartCommand,
  buildProposedPaymentStreamWithdrawCommand,
} from './proposedPaymentStream';
export type {
  EditPaymentStreamProposalParams,
  PaymentStreamProposalChanges,
  ProposedPaymentStreamApproveParams,
  ProposedPaymentStreamChangePartyParams,
  PartyRole as ProposedPaymentStreamPartyRole,
  ProposedPaymentStreamStartParams,
  ProposedPaymentStreamWithdrawParams,
} from './proposedPaymentStream';
