/**
 * Utilities for handling disclosed contracts in subscription workflows
 */

import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type { OcpClient } from '../../../OcpClient';

/**
 * Get disclosed contracts for a factory contract
 * This allows parties that don't directly see the factory to exercise it
 */
export async function getFactoryDisclosedContracts(
  client: OcpClient,
  factoryContractId: string
): Promise<DisclosedContract[]> {
  console.log('Getting factory disclosed contracts for party:', client.client.getPartyId());
  const factoryEventsResponse = await client.client.getEventsByContractId({
    contractId: factoryContractId,
    readAs: [client.client.getPartyId()],
  });

  const createdEvent = factoryEventsResponse.created?.createdEvent;

  if (!createdEvent) {
    throw new Error(`Factory contract ${factoryContractId} not found`);
  }

  return [
    {
      templateId: createdEvent.templateId,
      contractId: createdEvent.contractId,
      createdEventBlob: createdEvent.createdEventBlob,
      synchronizerId: factoryEventsResponse.created!.synchronizerId,
    },
  ];
}

/**
 * Get disclosed contracts for a ProposedSubscription contract
 * This allows parties to exercise choices on the proposal when needed
 */
export async function getProposedSubscriptionDisclosedContracts(
  client: OcpClient,
  proposedSubscriptionContractId: string
): Promise<DisclosedContract[]> {
  console.log('Getting ProposedSubscription disclosed contracts for party:', client.client.getPartyId());
  const proposalEventsResponse = await client.client.getEventsByContractId({
    contractId: proposedSubscriptionContractId,
    readAs: [client.client.getPartyId()],
  });

  const createdEvent = proposalEventsResponse.created?.createdEvent;

  if (!createdEvent) {
    throw new Error(`ProposedSubscription contract ${proposedSubscriptionContractId} not found`);
  }

  return [
    {
      templateId: createdEvent.templateId,
      contractId: createdEvent.contractId,
      createdEventBlob: createdEvent.createdEventBlob,
      synchronizerId: proposalEventsResponse.created!.synchronizerId,
    },
  ];
}

