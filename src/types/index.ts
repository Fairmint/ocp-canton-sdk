export * from './branded';
export * from './common';
export * from './daml';
export * from './native';
export * from './output';

import type { Command, DisclosedContract } from './common';

/**
 * Return type for all buildCreate*Command functions. Contains a command and its associated disclosed contracts for
 * Canton cross-domain interactions.
 */
export interface CommandWithDisclosedContracts {
  command: Command;
  disclosedContracts: DisclosedContract[];
}
