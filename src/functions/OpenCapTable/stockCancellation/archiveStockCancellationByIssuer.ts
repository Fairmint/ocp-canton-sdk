import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

/** @deprecated Use DeleteStockCancellationParams and buildDeleteStockCancellationCommand instead */
export interface ArchiveStockCancellationByIssuerParams {
  contractId: string;
  issuerParty: string;
}

/**
 * @deprecated This function is no longer functional. Use buildDeleteStockCancellationCommand instead.
 *
 *   With the new CapTable pattern, deletion requires:
 *
 *   - CapTableContractId: The CapTable contract ID
 *   - FeaturedAppRightContractDetails: Disclosed contract details
 *   - StockCancellationId: The OCF ID of the stock cancellation to delete
 *
 * @throws Error Always throws - use buildDeleteStockCancellationCommand instead
 */
export function buildArchiveStockCancellationByIssuerCommand(_params: { contractId: string }): Command {
  throw new Error(
    'buildArchiveStockCancellationByIssuerCommand is deprecated and no longer functional. ' +
      'Use buildDeleteStockCancellationCommand instead, which uses the CapTable.DeleteStockCancellation choice.'
  );
}
