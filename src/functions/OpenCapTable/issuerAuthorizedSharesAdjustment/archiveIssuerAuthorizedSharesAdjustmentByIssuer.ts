import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

/** @deprecated Use DeleteIssuerAuthorizedSharesAdjustmentParams and buildDeleteIssuerAuthorizedSharesAdjustmentCommand instead */
export interface ArchiveIssuerAuthorizedSharesAdjustmentByIssuerParams {
  contractId: string;
  issuerParty: string;
}

/**
 * @deprecated This function is no longer functional. Use buildDeleteIssuerAuthorizedSharesAdjustmentCommand instead.
 *
 * With the new CapTable pattern, deletion requires:
 * - capTableContractId: The CapTable contract ID
 * - featuredAppRightContractDetails: Disclosed contract details
 * - issuerAuthorizedSharesAdjustmentId: The OCF ID of the adjustment to delete
 *
 * @throws Error Always throws - use buildDeleteIssuerAuthorizedSharesAdjustmentCommand instead
 */
export function buildArchiveIssuerAuthorizedSharesAdjustmentByIssuerCommand(_params: { contractId: string }): Command {
  throw new Error(
    'buildArchiveIssuerAuthorizedSharesAdjustmentByIssuerCommand is deprecated and no longer functional. ' +
      'Use buildDeleteIssuerAuthorizedSharesAdjustmentCommand instead, which uses the CapTable.DeleteIssuerAuthorizedSharesAdjustment choice.'
  );
}
