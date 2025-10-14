/**
 * Utilities for retrieving subscription factory contract IDs
 */

import subscriptionsFactoryConfig from '@fairmint/open-captable-protocol-daml-js/subscriptions-factory-contract-id.json';

export type Network = 'devnet' | 'mainnet';

export interface FactoryContractInfo {
  subscriptionsFactoryContractId: string;
  templateId: string;
}

/**
 * Get the subscription factory contract ID for a given network
 * @param network - The network to get the factory contract ID for ('devnet' or 'mainnet')
 * @returns The factory contract information including contract ID and template ID
 * @throws Error if the network is not found in the configuration
 */
export function getFactoryContractId(network: Network): FactoryContractInfo {
  const config = subscriptionsFactoryConfig[network];
  
  if (!config) {
    throw new Error(`Subscription factory contract ID not found for network: ${network}`);
  }
  
  return config;
}

