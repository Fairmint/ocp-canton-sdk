/** Utilities for retrieving paymentStream factory contract IDs */

import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import paymentStreamsFactoryConfig from '@fairmint/open-captable-protocol-daml-js/paymentStreams-factory-contract-id.json';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';

export type Network = 'devnet' | 'mainnet';

export interface FactoryContractInfo {
  paymentStreamsFactoryContractId: string;
  templateId: string;
  disclosedContract?: DisclosedContract;
}

/**
 * Get the paymentStream factory contract ID for a given network
 *
 * @param network - The network to get the factory contract ID for ('devnet' or 'mainnet')
 * @returns The factory contract information including contract ID and template ID
 * @throws Error if the network is not found in the configuration
 */
export function getFactoryContractId(network: Network): FactoryContractInfo {
  const config = paymentStreamsFactoryConfig[network] as FactoryContractInfo | undefined;

  if (!config) {
    throw new OcpValidationError('network', `PaymentStream factory contract ID not found for network: ${network}`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      receivedValue: network,
    });
  }

  return config;
}
