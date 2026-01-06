import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

/** @deprecated Use DeleteConvertibleIssuanceParams and buildDeleteConvertibleIssuanceCommand instead */
export interface ArchiveConvertibleIssuanceByIssuerParams {
  contractId: string;
  issuerParty: string;
}

/**
 * @deprecated This function is no longer functional. Use buildDeleteConvertibleIssuanceCommand instead.
 *
 * With the new CapTable pattern, deletion requires:
 * - capTableContractId: The CapTable contract ID
 * - featuredAppRightContractDetails: Disclosed contract details
 * - convertibleIssuanceId: The OCF ID of the convertible issuance to delete
 *
 * @throws Error Always throws - use buildDeleteConvertibleIssuanceCommand instead
 */
export function buildArchiveConvertibleIssuanceByIssuerCommand(_params: { contractId: string }): Command {
  throw new Error(
    'buildArchiveConvertibleIssuanceByIssuerCommand is deprecated and no longer functional. ' +
      'Use buildDeleteConvertibleIssuanceCommand instead, which uses the CapTable.DeleteConvertibleIssuance choice.'
  );
}
