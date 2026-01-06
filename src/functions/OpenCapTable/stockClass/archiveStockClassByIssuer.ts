import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

/** @deprecated Use DeleteStockClassParams and buildDeleteStockClassCommand instead */
export interface ArchiveStockClassByIssuerParams {
  contractId: string;
  issuerParty: string;
}

/**
 * @deprecated This function is no longer functional. Use buildDeleteStockClassCommand instead.
 *
 * With the new CapTable pattern, deletion requires:
 * - capTableContractId: The CapTable contract ID
 * - featuredAppRightContractDetails: Disclosed contract details
 * - stockClassId: The OCF ID of the stock class to delete
 *
 * @throws Error Always throws - use buildDeleteStockClassCommand instead
 */
export function buildArchiveStockClassByIssuerCommand(_params: { contractId: string }): Command {
  throw new Error(
    'buildArchiveStockClassByIssuerCommand is deprecated and no longer functional. ' +
      'Use buildDeleteStockClassCommand instead, which uses the CapTable.DeleteStockClass choice.'
  );
}
