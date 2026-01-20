export * from './context';
export * from './native';

import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

/**
 * Return type for all buildCreate*Command functions. Contains a command and its associated disclosed contracts for
 * Canton cross-domain interactions.
 */
export interface CommandWithDisclosedContracts {
  command: Command;
  disclosedContracts: DisclosedContract[];
}
