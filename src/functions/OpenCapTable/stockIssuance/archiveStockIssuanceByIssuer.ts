import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

/** @deprecated Use DeleteStockIssuanceParams and buildDeleteStockIssuanceCommand instead */
export interface ArchiveStockIssuanceByIssuerParams {
  contractId: string;
  issuerParty: string;
}

/**
 * @deprecated This function is no longer functional. Use buildDeleteStockIssuanceCommand instead.
 *
 * With the new CapTable pattern, deletion requires:
 * - capTableContractId: The CapTable contract ID
 * - featuredAppRightContractDetails: Disclosed contract details
 * - stockIssuanceId: The OCF ID of the stock issuance to delete
 *
 * @throws Error Always throws - use buildDeleteStockIssuanceCommand instead
 */
export function buildArchiveStockIssuanceByIssuerCommand(_params: { contractId: string }): Command {
  throw new Error(
    'buildArchiveStockIssuanceByIssuerCommand is deprecated and no longer functional. ' +
      'Use buildDeleteStockIssuanceCommand instead, which uses the CapTable.DeleteStockIssuance choice.'
  );
}
