/** Utilities for handling disclosed contracts in paymentStream workflows */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import paymentStreamsFactoryConfig from '@fairmint/open-captable-protocol-daml-js/paymentStreams-factory-contract-id.json';
import { OcpContractError, OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { FactoryContractInfo } from './factoryContractId';

/**
 * Get disclosed contracts for the factory contract Reads from the pre-generated factory contract data for the client's
 * network This allows parties that don't directly see the factory to exercise it
 */
export function getFactoryDisclosedContracts(ledgerClient: LedgerJsonApiClient): DisclosedContract[] {
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
}

/**
 * Get disclosed contracts for a ProposedPaymentStream contract This allows parties to exercise choices on the proposal
 * when needed
 */
export async function getProposedPaymentStreamDisclosedContracts(
  ledgerClient: LedgerJsonApiClient,
  proposedPaymentStreamContractId: string,
  readAs?: string[]
): Promise<DisclosedContract[]> {
  const proposalEventsResponse = await ledgerClient.getEventsByContractId({
    contractId: proposedPaymentStreamContractId,
    readAs: readAs ?? [ledgerClient.getPartyId()],
  });

  const createdEvent = proposalEventsResponse.created?.createdEvent;

  if (!createdEvent || !proposalEventsResponse.created) {
    throw new OcpContractError(`ProposedPaymentStream contract ${proposedPaymentStreamContractId} not found`, {
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
}
