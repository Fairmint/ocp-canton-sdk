import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

/** @deprecated Use DeleteDocumentParams and buildDeleteDocumentCommand instead */
export interface ArchiveDocumentByIssuerParams {
  contractId: string;
  issuerParty: string;
}

/**
 * @deprecated This function is no longer functional. Use buildDeleteDocumentCommand instead.
 *
 * With the new CapTable pattern, deletion requires:
 * - capTableContractId: The CapTable contract ID
 * - featuredAppRightContractDetails: Disclosed contract details
 * - documentId: The OCF ID of the document to delete
 *
 * @throws Error Always throws - use buildDeleteDocumentCommand instead
 */
export function buildArchiveDocumentByIssuerCommand(_params: { contractId: string }): Command {
  throw new Error(
    'buildArchiveDocumentByIssuerCommand is deprecated and no longer functional. ' +
      'Use buildDeleteDocumentCommand instead, which uses the CapTable.DeleteDocument choice.'
  );
}
