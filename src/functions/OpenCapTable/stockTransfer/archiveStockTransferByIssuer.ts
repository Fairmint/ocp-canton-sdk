import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

/** @deprecated Use DeleteStockTransferParams and buildDeleteStockTransferCommand instead */
export interface ArchiveStockTransferByIssuerParams {
  contractId: string;
  issuerParty: string;
}

/**
 * @deprecated This function is no longer functional. Use buildDeleteStockTransferCommand instead.
 *
 *   With the new CapTable pattern, deletion requires:
 *
 *   - CapTableContractId: The CapTable contract ID
 *   - FeaturedAppRightContractDetails: Disclosed contract details
 *   - StockTransferId: The OCF ID of the stock transfer to delete
 *
 * @throws Error Always throws - use buildDeleteStockTransferCommand instead
 */
export function buildArchiveStockTransferByIssuerCommand(_params: { contractId: string }): Command {
  throw new Error(
    'buildArchiveStockTransferByIssuerCommand is deprecated and no longer functional. ' +
      'Use buildDeleteStockTransferCommand instead, which uses the CapTable.DeleteStockTransfer choice.'
  );
}
