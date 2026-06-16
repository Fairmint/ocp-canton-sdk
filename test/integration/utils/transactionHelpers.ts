/**
 * Helper functions for working with Canton transaction trees in tests.
 *
 * These utilities provide type-safe ways to extract contract IDs and other data from transaction responses without
 * using `any` types.
 */

import { extractEventsFromTransaction } from '@fairmint/canton-node-sdk';
import type { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export function requireCreatedEventBlob(
  createdEvent: { createdEventBlob?: string },
  context = 'created event'
): string {
  const blob = createdEvent.createdEventBlob;
  if (typeof blob !== 'string' || blob.length === 0) {
    throw new Error(`Expected ${context} to include createdEventBlob`);
  }
  return blob;
}

/**
 * Extract a contract ID from a transaction tree response by template ID pattern.
 *
 * @param response - The transaction tree response from submitAndWaitForTransactionTree
 * @param templateIdPattern - A string that the template ID should contain (e.g., 'Issuer', 'StockClass')
 * @returns The contract ID if found, or null if not found
 */
export function extractContractIdByTemplatePattern(
  response: SubmitAndWaitForTransactionTreeResponse,
  templateIdPattern: string
): string | null {
  for (const event of extractEventsFromTransaction(response).created) {
    if (event.templateId.includes(templateIdPattern)) {
      return event.contractId;
    }
  }

  return null;
}

/**
 * Extract a contract ID from a transaction tree response, throwing if not found.
 *
 * @param response - The transaction tree response from submitAndWaitForTransactionTree
 * @param templateIdPattern - A string that the template ID should contain
 * @returns The contract ID
 * @throws Error if no matching contract is found
 */
export function extractContractIdOrThrow(
  response: SubmitAndWaitForTransactionTreeResponse,
  templateIdPattern: string
): string {
  const contractId = extractContractIdByTemplatePattern(response, templateIdPattern);

  if (!contractId) {
    throw new Error(
      `Failed to find contract matching template pattern '${templateIdPattern}' in transaction response. ` +
        `Check that the transaction succeeded and the template name is correct.`
    );
  }

  return contractId;
}

/**
 * Extract all created contract IDs from a transaction tree response.
 *
 * @param response - The transaction tree response
 * @returns Array of { contractId, templateId } for all created contracts
 */
export function extractAllCreatedContracts(
  response: SubmitAndWaitForTransactionTreeResponse
): Array<{ contractId: string; templateId: string }> {
  return extractEventsFromTransaction(response).created.map(({ contractId, templateId }) => ({
    contractId,
    templateId,
  }));
}
