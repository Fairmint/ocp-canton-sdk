import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

/** @deprecated Use DeleteStockRepurchaseParams and buildDeleteStockRepurchaseCommand instead */
export interface ArchiveStockRepurchaseByIssuerParams {
  contractId: string;
  issuerParty: string;
}

/**
 * @deprecated This function is no longer functional. Use buildDeleteStockRepurchaseCommand instead.
 *
 * With the new CapTable pattern, deletion requires:
 * - capTableContractId: The CapTable contract ID
 * - featuredAppRightContractDetails: Disclosed contract details
 * - stockRepurchaseId: The OCF ID of the stock repurchase to delete
 *
 * @throws Error Always throws - use buildDeleteStockRepurchaseCommand instead
 */
export function buildArchiveStockRepurchaseByIssuerCommand(_params: { contractId: string }): Command {
  throw new Error(
    'buildArchiveStockRepurchaseByIssuerCommand is deprecated and no longer functional. ' +
      'Use buildDeleteStockRepurchaseCommand instead, which uses the CapTable.DeleteStockRepurchase choice.'
  );
}
