/**
 * PaymentStreams extension for OcpClient.
 *
 * Provides recurring payment stream management operations.
 * Loaded as a plugin to avoid circular dependencies and reduce bundle size.
 */
import type { ValidatorApiClient } from '@fairmint/canton-node-sdk';
import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api';
import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import paymentStreamsFactoryConfig from '@fairmint/open-captable-protocol-daml-js/paymentStreams-factory-contract-id.json';
import {
  buildActivePaymentStreamChangePartyCommand,
  buildArchiveInactivePaymentStreamCommand,
  buildCancelPaymentStreamCommand,
  buildProcessFreeTrialCommand,
  buildProcessPaymentCommand,
  buildProposeChangesCommand,
  buildRefundPaymentStreamCommand,
  type ActivePaymentStreamChangePartyParams,
  type ArchiveInactivePaymentStreamParams,
  type CancelPaymentStreamParams,
  type ProcessFreeTrialParams,
  type ProcessPaymentParams,
  type ProposeChangesParams,
  type RefundPaymentStreamParams,
} from '../functions/PaymentStreams/activePaymentStream';
import {
  buildMigrateActivePaymentStreamCommand,
  buildMigrateProposedPaymentStreamCommand,
  buildPartyMigrationProposalApproveCommand,
  buildPartyMigrationProposalArchiveCommand,
  type MigrateActivePaymentStreamParams,
  type MigrateProposedPaymentStreamParams,
  type PartyMigrationProposalApproveParams,
  type PartyMigrationProposalArchiveParams,
} from '../functions/PaymentStreams/partyMigrationProposal';
import {
  buildPaymentStreamChangeProposalApplyCommand,
  buildPaymentStreamChangeProposalApproveCommand,
  buildPaymentStreamChangeProposalRejectCommand,
  type PaymentStreamChangeProposalApplyParams,
  type PaymentStreamChangeProposalApproveParams,
  type PaymentStreamChangeProposalRejectParams,
} from '../functions/PaymentStreams/paymentStreamChangeProposal';
import {
  buildCreatePaymentStreamProposalCommand,
  type CreatePaymentStreamProposalParams,
} from '../functions/PaymentStreams/paymentStreamFactory';
import {
  buildEditPaymentStreamProposalCommand,
  buildProposedPaymentStreamApproveCommand,
  buildProposedPaymentStreamChangePartyCommand,
  buildProposedPaymentStreamStartCommand,
  buildProposedPaymentStreamWithdrawCommand,
  type EditPaymentStreamProposalParams,
  type ProposedPaymentStreamApproveParams,
  type ProposedPaymentStreamChangePartyParams,
  type ProposedPaymentStreamStartParams,
  type ProposedPaymentStreamWithdrawParams,
} from '../functions/PaymentStreams/proposedPaymentStream';
import type { FactoryContractInfo } from '../functions/PaymentStreams/utils/factoryContractId';
import {
  buildPaymentContext,
  buildPaymentContextWithAmulets,
  type PaymentContextWithAmuletsAndDisclosed,
  type PaymentContextWithDisclosedContracts,
} from '../functions/PaymentStreams/utils/paymentContext';
import type { CommandWithDisclosedContracts } from '../types';
import { OcpContractError, OcpValidationError, OcpErrorCodes } from '../errors';

/** PaymentStreams extension interface */
export interface PaymentStreamsMethods {
  paymentStreamFactory: {
    buildCreatePaymentStreamProposalCommand: (
      params: CreatePaymentStreamProposalParams
    ) => CommandWithDisclosedContracts;
  };
  proposedPaymentStream: {
    buildApproveCommand: (params: ProposedPaymentStreamApproveParams) => CommandWithDisclosedContracts;
    buildStartPaymentStreamCommand: (params: ProposedPaymentStreamStartParams) => CommandWithDisclosedContracts;
    buildEditPaymentStreamProposalCommand: (params: EditPaymentStreamProposalParams) => Command;
    buildWithdrawCommand: (params: ProposedPaymentStreamWithdrawParams) => Command;
    buildChangePartyCommand: (params: ProposedPaymentStreamChangePartyParams) => Command;
  };
  activePaymentStream: {
    buildProcessPaymentCommand: (params: ProcessPaymentParams) => CommandWithDisclosedContracts;
    buildProcessFreeTrialCommand: (params: ProcessFreeTrialParams) => Command;
    buildCancelCommand: (params: CancelPaymentStreamParams) => Command;
    buildProposeChangesCommand: (params: ProposeChangesParams) => Command;
    buildRefundCommand: (params: RefundPaymentStreamParams) => Command;
    buildArchiveInactivePaymentStreamCommand: (params: ArchiveInactivePaymentStreamParams) => Command;
    buildChangePartyCommand: (params: ActivePaymentStreamChangePartyParams) => Command;
  };
  paymentStreamChangeProposal: {
    buildApproveCommand: (params: PaymentStreamChangeProposalApproveParams) => Command;
    buildApplyCommand: (params: PaymentStreamChangeProposalApplyParams) => Command;
    buildRejectCommand: (params: PaymentStreamChangeProposalRejectParams) => Command;
  };
  partyMigrationProposal: {
    buildApproveCommand: (params: PartyMigrationProposalApproveParams) => Command;
    buildMigrateActivePaymentStreamCommand: (params: MigrateActivePaymentStreamParams) => Command;
    buildMigrateProposedPaymentStreamCommand: (params: MigrateProposedPaymentStreamParams) => Command;
    buildArchiveCommand: (params: PartyMigrationProposalArchiveParams) => Command;
  };
  utils: {
    getFactoryDisclosedContracts: (ledgerClient: LedgerJsonApiClient) => DisclosedContract[];
    getProposedPaymentStreamDisclosedContracts: (
      ledgerClient: LedgerJsonApiClient,
      proposedPaymentStreamContractId: string,
      readAs?: string[]
    ) => Promise<DisclosedContract[]>;
    buildPaymentContext: (
      validatorClient: ValidatorApiClient,
      provider: string
    ) => Promise<PaymentContextWithDisclosedContracts>;
    buildPaymentContextWithAmulets: (
      validatorClient: ValidatorApiClient,
      payerParty: string,
      requestedAmount: string,
      provider: string
    ) => Promise<PaymentContextWithAmuletsAndDisclosed>;
  };
}

/** Creates the PaymentStreams extension methods */
export function createPaymentStreamsExtension(): PaymentStreamsMethods {
  return {
    paymentStreamFactory: {
      buildCreatePaymentStreamProposalCommand,
    },
    proposedPaymentStream: {
      buildApproveCommand: buildProposedPaymentStreamApproveCommand,
      buildStartPaymentStreamCommand: buildProposedPaymentStreamStartCommand,
      buildEditPaymentStreamProposalCommand,
      buildWithdrawCommand: buildProposedPaymentStreamWithdrawCommand,
      buildChangePartyCommand: buildProposedPaymentStreamChangePartyCommand,
    },
    activePaymentStream: {
      buildProcessPaymentCommand,
      buildProcessFreeTrialCommand,
      buildCancelCommand: buildCancelPaymentStreamCommand,
      buildProposeChangesCommand,
      buildRefundCommand: buildRefundPaymentStreamCommand,
      buildArchiveInactivePaymentStreamCommand,
      buildChangePartyCommand: buildActivePaymentStreamChangePartyCommand,
    },
    paymentStreamChangeProposal: {
      buildApproveCommand: buildPaymentStreamChangeProposalApproveCommand,
      buildApplyCommand: buildPaymentStreamChangeProposalApplyCommand,
      buildRejectCommand: buildPaymentStreamChangeProposalRejectCommand,
    },
    partyMigrationProposal: {
      buildApproveCommand: buildPartyMigrationProposalApproveCommand,
      buildMigrateActivePaymentStreamCommand,
      buildMigrateProposedPaymentStreamCommand,
      buildArchiveCommand: buildPartyMigrationProposalArchiveCommand,
    },
    utils: {
      getFactoryDisclosedContracts: (ledgerClient: LedgerJsonApiClient): DisclosedContract[] => {
        const network = ledgerClient.getNetwork();
        const networkData = paymentStreamsFactoryConfig[network as keyof typeof paymentStreamsFactoryConfig] as
          | FactoryContractInfo
          | undefined;

        if (!networkData) {
          throw new OcpValidationError(
            'network',
            `Factory contract data not found for network "${network}". ` +
              'Please run the factory deployment script for this network first.',
            { code: OcpErrorCodes.INVALID_FORMAT, receivedValue: network }
          );
        }

        if (!networkData.disclosedContract) {
          throw new OcpValidationError(
            'network.disclosedContract',
            `Disclosed contract data not found for network "${network}". ` +
              'The factory contract data may be outdated. Please re-run the factory deployment script.',
            { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
          );
        }

        return [networkData.disclosedContract];
      },
      getProposedPaymentStreamDisclosedContracts: async (
        ledgerClient: LedgerJsonApiClient,
        proposedPaymentStreamContractId: string,
        readAs?: string[]
      ): Promise<DisclosedContract[]> => {
        const proposalEventsResponse = await ledgerClient.getEventsByContractId({
          contractId: proposedPaymentStreamContractId,
          readAs: readAs ?? [ledgerClient.getPartyId()],
        });

        const createdEvent = proposalEventsResponse.created?.createdEvent;

        if (!createdEvent || !proposalEventsResponse.created) {
          throw new OcpContractError(`ProposedPaymentStream contract not found`, {
            contractId: proposedPaymentStreamContractId,
            code: OcpErrorCodes.CONTRACT_NOT_FOUND,
          });
        }

        return [
          {
            templateId: createdEvent.templateId,
            contractId: createdEvent.contractId,
            createdEventBlob: createdEvent.createdEventBlob,
            synchronizerId: proposalEventsResponse.created.synchronizerId,
          },
        ];
      },
      buildPaymentContext,
      buildPaymentContextWithAmulets,
    },
  };
}
