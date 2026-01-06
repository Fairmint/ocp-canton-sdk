import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

/** @deprecated Use DeleteStockLegendTemplateParams and buildDeleteStockLegendTemplateCommand instead */
export interface ArchiveStockLegendTemplateByIssuerParams {
  contractId: string;
  issuerParty: string;
}

/**
 * @deprecated This function is no longer functional. Use buildDeleteStockLegendTemplateCommand instead.
 *
 *   With the new CapTable pattern, deletion requires:
 *
 *   - CapTableContractId: The CapTable contract ID
 *   - FeaturedAppRightContractDetails: Disclosed contract details
 *   - StockLegendTemplateId: The OCF ID of the stock legend template to delete
 *
 * @throws Error Always throws - use buildDeleteStockLegendTemplateCommand instead
 */
export function buildArchiveStockLegendTemplateByIssuerCommand(_params: { contractId: string }): Command {
  throw new Error(
    'buildArchiveStockLegendTemplateByIssuerCommand is deprecated and no longer functional. ' +
      'Use buildDeleteStockLegendTemplateCommand instead, which uses the CapTable.DeleteStockLegendTemplate choice.'
  );
}
