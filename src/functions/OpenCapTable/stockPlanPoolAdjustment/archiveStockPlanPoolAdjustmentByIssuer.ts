import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

/** @deprecated Use DeleteStockPlanPoolAdjustmentParams and buildDeleteStockPlanPoolAdjustmentCommand instead */
export interface ArchiveStockPlanPoolAdjustmentByIssuerParams {
  contractId: string;
  issuerParty: string;
}

/**
 * @deprecated This function is no longer functional. Use buildDeleteStockPlanPoolAdjustmentCommand instead.
 *
 *   With the new CapTable pattern, deletion requires:
 *
 *   - CapTableContractId: The CapTable contract ID
 *   - FeaturedAppRightContractDetails: Disclosed contract details
 *   - StockPlanPoolAdjustmentId: The OCF ID of the adjustment to delete
 *
 * @throws Error Always throws - use buildDeleteStockPlanPoolAdjustmentCommand instead
 */
export function buildArchiveStockPlanPoolAdjustmentByIssuerCommand(_params: { contractId: string }): Command {
  throw new Error(
    'buildArchiveStockPlanPoolAdjustmentByIssuerCommand is deprecated and no longer functional. ' +
      'Use buildDeleteStockPlanPoolAdjustmentCommand instead, which uses the CapTable.DeleteStockPlanPoolAdjustment choice.'
  );
}
