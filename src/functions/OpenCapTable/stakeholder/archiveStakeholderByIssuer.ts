import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

/** @deprecated Use DeleteStakeholderParams and buildDeleteStakeholderCommand instead */
export interface ArchiveStakeholderByIssuerParams {
  contractId: string;
  issuerParty: string;
}

/**
 * @deprecated This function is no longer functional. Use buildDeleteStakeholderCommand instead.
 *
 * With the new CapTable pattern, deletion requires:
 * - capTableContractId: The CapTable contract ID
 * - featuredAppRightContractDetails: Disclosed contract details
 * - stakeholderId: The OCF ID of the stakeholder to delete
 *
 * @throws Error Always throws - use buildDeleteStakeholderCommand instead
 */
export function buildArchiveStakeholderByIssuerCommand(_params: { contractId: string }): Command {
  throw new Error(
    'buildArchiveStakeholderByIssuerCommand is deprecated and no longer functional. ' +
      'Use buildDeleteStakeholderCommand from deleteStakeholder.ts instead, which uses the CapTable.DeleteStakeholder choice.'
  );
}
