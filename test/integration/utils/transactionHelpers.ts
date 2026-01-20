/**
 * Helper functions for working with Canton transaction trees in tests.
 *
 * These utilities provide type-safe ways to extract contract IDs and other data from transaction responses without
 * using `any` types.
 */

import type { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

/**
 * Minimal type for CreatedTreeEvent used in contract ID extraction. This is a subset of the full type that contains
 * only what we need.
 */
interface CreatedTreeEventData {
  CreatedTreeEvent: {
    value: {
      contractId: string;
      templateId: string;
    };
  };
}

/** Type guard to check if an event has CreatedTreeEvent structure. */
function hasCreatedTreeEvent(event: unknown): event is CreatedTreeEventData {
  if (typeof event !== 'object' || event === null) return false;
  if (!('CreatedTreeEvent' in event)) return false;

  const created = (event as Record<string, unknown>).CreatedTreeEvent;
  if (typeof created !== 'object' || created === null) return false;
  if (!('value' in created)) return false;

  const { value } = created as Record<string, unknown>;
  if (typeof value !== 'object' || value === null) return false;

  return 'contractId' in value && 'templateId' in value;
}

/**
 * Extract a contract ID from a transaction tree response by template ID pattern.
 *
 * @example
 *   ```typescript
 *
 *
 *   const result = await client.submitAndWaitForTransactionTree({ ... });
 *   const contractId = extractContractIdByTemplatePattern(result, 'EquityCompensationExercise');
 *   if (contractId) {
 *     // Use the contract ID
 *   }
 *   ```;
 *
 * @param response - The transaction tree response from submitAndWaitForTransactionTree
 * @param templateIdPattern - A string that the template ID should contain (e.g., 'Issuer', 'StockClass')
 * @returns The contract ID if found, or null if not found
 */
export function extractContractIdByTemplatePattern(
  response: SubmitAndWaitForTransactionTreeResponse,
  templateIdPattern: string
): string | null {
  const { eventsById } = response.transactionTree;

  for (const event of Object.values(eventsById)) {
    if (hasCreatedTreeEvent(event)) {
      const { templateId, contractId } = event.CreatedTreeEvent.value;
      if (templateId.includes(templateIdPattern)) {
        return contractId;
      }
    }
  }

  return null;
}

/**
 * Extract a contract ID from a transaction tree response, throwing if not found.
 *
 * @example
 *   ```typescript
 *
 *
 *   const result = await client.submitAndWaitForTransactionTree({ ... });
 *   const contractId = extractContractIdOrThrow(result, 'StockIssuance');
 *   // contractId is guaranteed to be a valid string
 *   ```;
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
  const { eventsById } = response.transactionTree;
  const contracts: Array<{ contractId: string; templateId: string }> = [];

  for (const event of Object.values(eventsById)) {
    if (hasCreatedTreeEvent(event)) {
      const { templateId, contractId } = event.CreatedTreeEvent.value;
      contracts.push({ contractId, templateId });
    }
  }

  return contracts;
}
