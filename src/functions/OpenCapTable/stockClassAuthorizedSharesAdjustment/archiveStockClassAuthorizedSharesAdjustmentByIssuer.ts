import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

/** @deprecated Use DeleteStockClassAuthorizedSharesAdjustmentParams and buildDeleteStockClassAuthorizedSharesAdjustmentCommand instead */
export interface ArchiveStockClassAuthorizedSharesAdjustmentByIssuerParams {
  contractId: string;
  issuerParty: string;
}

/**
 * @deprecated This function is no longer functional. Use buildDeleteStockClassAuthorizedSharesAdjustmentCommand instead.
 *
 * With the new CapTable pattern, deletion requires:
 * - capTableContractId: The CapTable contract ID
 * - featuredAppRightContractDetails: Disclosed contract details
 * - stockClassAuthorizedSharesAdjustmentId: The OCF ID of the adjustment to delete
 *
 * @throws Error Always throws - use buildDeleteStockClassAuthorizedSharesAdjustmentCommand instead
 */
export function buildArchiveStockClassAuthorizedSharesAdjustmentByIssuerCommand(_params: {
  contractId: string;
}): Command {
  throw new Error(
    'buildArchiveStockClassAuthorizedSharesAdjustmentByIssuerCommand is deprecated and no longer functional. ' +
      'Use buildDeleteStockClassAuthorizedSharesAdjustmentCommand instead, which uses the CapTable.DeleteStockClassAuthorizedSharesAdjustment choice.'
  );
}
