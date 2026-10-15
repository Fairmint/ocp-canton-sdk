/**
 * Shape checks for `getActiveContracts` rows from the JSON Ledger API v2.
 *
 * @module activeContracts
 */

import type { JsGetActiveContractsResponseItem } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/state';

/** The created event of an active contract, with the fields the SDK reads. */
export interface ActiveContractCreatedEvent {
  contractId: string;
  createArgument: Record<string, unknown>;
  templateId?: string;
  packageName?: string;
}

/**
 * Type guard to check if a contract entry is a JsActiveContract with complete structure.
 * Based on the pattern from canton-node-sdk's get-amulets-for-transfer.ts.
 *
 * Validates that:
 * - contractEntry exists and is an object
 * - JsActiveContract property exists
 * - createdEvent exists with contractId (string) and createArgument (object)
 *
 * Note: We cast to unknown first to perform defensive runtime validation,
 * as API responses may not match expected types at runtime.
 */
export function isJsActiveContractItem(
  item: JsGetActiveContractsResponseItem
): item is JsGetActiveContractsResponseItem & {
  contractEntry: {
    JsActiveContract: {
      createdEvent: ActiveContractCreatedEvent;
    };
  };
} {
  // Cast to unknown for defensive runtime validation of API responses
  const { contractEntry } = item as unknown as { contractEntry?: unknown };

  // Check contractEntry exists and is an object
  if (!contractEntry || typeof contractEntry !== 'object') {
    return false;
  }

  // Check JsActiveContract exists in the union type
  if (!('JsActiveContract' in contractEntry)) {
    return false;
  }

  // Narrow to check nested structure safely
  const jsActiveContract = (contractEntry as { JsActiveContract?: unknown }).JsActiveContract;
  if (!jsActiveContract || typeof jsActiveContract !== 'object') {
    return false;
  }

  const { createdEvent } = jsActiveContract as { createdEvent?: unknown };
  if (!createdEvent || typeof createdEvent !== 'object') {
    return false;
  }

  const { contractId, createArgument } = createdEvent as {
    contractId?: unknown;
    createArgument?: unknown;
  };

  // Validate contractId is a string
  if (typeof contractId !== 'string') {
    return false;
  }

  // Validate createArgument exists and is an object
  if (!createArgument || typeof createArgument !== 'object') {
    return false;
  }

  return true;
}
