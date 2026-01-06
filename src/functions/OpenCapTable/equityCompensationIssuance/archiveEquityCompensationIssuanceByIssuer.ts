import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

/** @deprecated Use DeleteEquityCompensationIssuanceParams and buildDeleteEquityCompensationIssuanceCommand instead */
export interface ArchiveEquityCompensationIssuanceByIssuerParams {
  contractId: string;
  issuerParty: string;
}

/**
 * @deprecated This function is no longer functional. Use buildDeleteEquityCompensationIssuanceCommand instead.
 *
 * With the new CapTable pattern, deletion requires:
 * - capTableContractId: The CapTable contract ID
 * - featuredAppRightContractDetails: Disclosed contract details
 * - equityCompensationIssuanceId: The OCF ID of the equity compensation issuance to delete
 *
 * @throws Error Always throws - use buildDeleteEquityCompensationIssuanceCommand instead
 */
export function buildArchiveEquityCompensationIssuanceByIssuerCommand(_params: { contractId: string }): Command {
  throw new Error(
    'buildArchiveEquityCompensationIssuanceByIssuerCommand is deprecated and no longer functional. ' +
      'Use buildDeleteEquityCompensationIssuanceCommand instead, which uses the CapTable.DeleteEquityCompensationIssuance choice.'
  );
}
