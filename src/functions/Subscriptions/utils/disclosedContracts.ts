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
  const factoryEventsResponse = await client.client.getEventsByContractId({
    contractId: factoryContractId,
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

