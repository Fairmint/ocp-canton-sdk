import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

export interface ArchiveIssuerByIssuerParams {
  contractId: string;
  issuerParty: string;
}

/**
 * @deprecated This function is no longer functional with the CapTable pattern.
 *
 * The CapTable contract has 2 signatories (issuer and system operator), so the standard
 * Archive choice cannot be exercised by a single party. Archiving a CapTable requires
 * coordination between both signatories.
 *
 * For deleting individual entities within a cap table, use the appropriate delete function
 * (e.g., buildDeleteStakeholderCommand, buildDeleteStockClassCommand, etc.) which use
 * the CapTable's Delete* choices.
 *
 * @throws Error Always throws - archiving the entire CapTable is not supported through this API
 */
export function buildArchiveIssuerByIssuerCommand(_params: { contractId: string }): Command {
  throw new Error(
    'buildArchiveIssuerByIssuerCommand is deprecated and no longer functional. ' +
      'The CapTable contract has 2 signatories and cannot be archived by a single party. ' +
      'To delete individual entities, use the appropriate buildDelete*Command functions.'
  );
}

/**
 * @deprecated Archiving a CapTable contract is not supported through this API.
 *
 * The CapTable contract has 2 signatories (issuer and system operator), so the standard
 * Archive choice cannot be exercised by a single party.
 *
 * @throws Error Always throws - archiving the entire CapTable is not supported through this API
 */
export function buildArchiveCapTableCommand(_params: { capTableContractId: string }): Command {
  throw new Error(
    'buildArchiveCapTableCommand is not supported. ' +
      'The CapTable contract has 2 signatories and cannot be archived by a single party. ' +
      'To delete individual entities, use the appropriate buildDelete*Command functions.'
  );
}
