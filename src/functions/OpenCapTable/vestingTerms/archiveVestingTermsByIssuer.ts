import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

/** @deprecated Use DeleteVestingTermsParams and buildDeleteVestingTermsCommand instead */
export interface ArchiveVestingTermsByIssuerParams {
  contractId: string;
  issuerParty: string;
}

/**
 * @deprecated This function is no longer functional. Use buildDeleteVestingTermsCommand instead.
 *
 *   With the new CapTable pattern, deletion requires:
 *
 *   - CapTableContractId: The CapTable contract ID
 *   - FeaturedAppRightContractDetails: Disclosed contract details
 *   - VestingTermsId: The OCF ID of the vesting terms to delete
 *
 * @throws Error Always throws - use buildDeleteVestingTermsCommand instead
 */
export function buildArchiveVestingTermsByIssuerCommand(_params: { contractId: string }): Command {
  throw new Error(
    'buildArchiveVestingTermsByIssuerCommand is deprecated and no longer functional. ' +
      'Use buildDeleteVestingTermsCommand instead, which uses the CapTable.DeleteVestingTerms choice.'
  );
}
