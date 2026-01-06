import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

/** @deprecated Use DeleteWarrantIssuanceParams and buildDeleteWarrantIssuanceCommand instead */
export interface ArchiveWarrantIssuanceByIssuerParams {
  contractId: string;
  issuerParty: string;
}

/**
 * @deprecated This function is no longer functional. Use buildDeleteWarrantIssuanceCommand instead.
 *
 *   With the new CapTable pattern, deletion requires:
 *
 *   - CapTableContractId: The CapTable contract ID
 *   - FeaturedAppRightContractDetails: Disclosed contract details
 *   - WarrantIssuanceId: The OCF ID of the warrant issuance to delete
 *
 * @throws Error Always throws - use buildDeleteWarrantIssuanceCommand instead
 */
export function buildArchiveWarrantIssuanceByIssuerCommand(_params: { contractId: string }): Command {
  throw new Error(
    'buildArchiveWarrantIssuanceByIssuerCommand is deprecated and no longer functional. ' +
      'Use buildDeleteWarrantIssuanceCommand instead, which uses the CapTable.DeleteWarrantIssuance choice.'
  );
}
