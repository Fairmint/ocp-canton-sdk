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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Whether a row is a `JsActiveContract` entry whose created event has a string `contractId` and an object
 * `createArgument`. Checked at run time: API responses may not match their declared types.
 */
export function isJsActiveContractItem(
  item: JsGetActiveContractsResponseItem
): item is JsGetActiveContractsResponseItem & {
  contractEntry: { JsActiveContract: { createdEvent: ActiveContractCreatedEvent } };
} {
  const { contractEntry } = item as unknown as { contractEntry?: unknown };
  const activeContract = isObject(contractEntry) ? contractEntry.JsActiveContract : undefined;
  const createdEvent = isObject(activeContract) ? activeContract.createdEvent : undefined;
  return isObject(createdEvent) && typeof createdEvent.contractId === 'string' && isObject(createdEvent.createArgument);
}
