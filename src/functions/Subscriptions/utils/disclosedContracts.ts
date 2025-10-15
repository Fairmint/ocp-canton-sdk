/** Utilities for handling disclosed contracts in subscription workflows */

import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import subscriptionsFactoryConfig from '@fairmint/open-captable-protocol-daml-js/subscriptions-factory-contract-id.json';
import type { OcpClient } from '../../../OcpClient';
import type { FactoryContractInfo } from './factoryContractId';

/**
 * Get disclosed contracts for the factory contract Reads from the pre-generated factory contract data for the client's
 * network This allows parties that don't directly see the factory to exercise it
 */
export function getFactoryDisclosedContracts(client: OcpClient): DisclosedContract[] {
  const network = client.client.getNetwork();
  const networkData = subscriptionsFactoryConfig[network as keyof typeof subscriptionsFactoryConfig] as
    | FactoryContractInfo
    | undefined;

  if (!networkData) {
    throw new Error(
      `Factory contract data not found for network "${network}". ` +
        'Please run the factory deployment script for this network first.'
    );
  }

  if (!networkData.disclosedContract) {
    throw new Error(
      `Disclosed contract data not found for network "${network}". ` +
        'The factory contract data may be outdated. Please re-run the factory deployment script.'
    );
  }

  return [networkData.disclosedContract];
}

/**
 * Get disclosed contracts for a ProposedSubscription contract This allows parties to exercise choices on the proposal
 * when needed
 */
export async function getProposedSubscriptionDisclosedContracts(
  client: OcpClient,
  proposedSubscriptionContractId: string
): Promise<DisclosedContract[]> {
  const proposalEventsResponse = await client.client.getEventsByContractId({
    contractId: proposedSubscriptionContractId,
    readAs: [client.client.getPartyId()],
  });

  const createdEvent = proposalEventsResponse.created?.createdEvent;

  if (!createdEvent || !proposalEventsResponse.created) {
    throw new Error(`ProposedSubscription contract ${proposedSubscriptionContractId} not found`);
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
