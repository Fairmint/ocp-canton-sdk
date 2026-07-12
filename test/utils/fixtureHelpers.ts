import type { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { diagnosticPropertyPath } from '../../src/errors/diagnosticValue';

export interface TransactionTreeFixture {
  timestamp: string;
  url: string;
  request: {
    method: string;
    headers: Record<string, string>;
    data: {
      commands: Array<Record<string, unknown>>;
      actAs: string[];
      disclosedContracts: Array<Record<string, unknown>>;
      commandId?: string;
    };
  };
  response?: SubmitAndWaitForTransactionTreeResponse;
}

let currentFixture: TransactionTreeFixture | null = null;
let currentEventsFixture: Record<string, unknown> | null = null;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function requireRecord(value: unknown, fieldPath: string): Record<string, unknown> {
  const record = asRecord(value);
  if (!record) {
    throw new Error(`Invalid transaction tree at ${fieldPath}: expected an object`);
  }
  return record;
}

function requireString(value: unknown, fieldPath: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid transaction tree at ${fieldPath}: expected a string`);
  }
  return value;
}

interface CreatedTreeEventRecord {
  contractId: string;
  value: Record<string, unknown>;
  templateId: string;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isCanonicalDecimalNodeId(value: string): boolean {
  return /^(?:0|[1-9]\d*)$/.test(value);
}

/** Order ledger node IDs independently of object insertion order. */
function compareTransactionNodeIds(left: string, right: string): number {
  const leftIsDecimal = isCanonicalDecimalNodeId(left);
  const rightIsDecimal = isCanonicalDecimalNodeId(right);
  if (leftIsDecimal && rightIsDecimal) {
    return left.length - right.length || compareCodeUnits(left, right);
  }
  if (leftIsDecimal !== rightIsDecimal) return leftIsDecimal ? -1 : 1;
  return compareCodeUnits(left, right);
}

function transactionTreeEventsById(response: unknown): {
  eventsById: Record<string, unknown>;
  fieldPath: string;
} {
  const responseRecord = requireRecord(response, 'response');
  const transactionTree = requireRecord(responseRecord.transactionTree, 'transactionTree');

  if (Object.prototype.hasOwnProperty.call(transactionTree, 'eventsById')) {
    return {
      eventsById: requireRecord(transactionTree.eventsById, 'transactionTree.eventsById'),
      fieldPath: 'transactionTree.eventsById',
    };
  }

  if (Object.prototype.hasOwnProperty.call(transactionTree, 'transaction')) {
    const nestedTransaction = requireRecord(transactionTree.transaction, 'transactionTree.transaction');
    if (Object.prototype.hasOwnProperty.call(nestedTransaction, 'eventsById')) {
      return {
        eventsById: requireRecord(nestedTransaction.eventsById, 'transactionTree.transaction.eventsById'),
        fieldPath: 'transactionTree.transaction.eventsById',
      };
    }
  }

  throw new Error('No eventsById in transaction tree');
}

function createdTreeEventRecords(response: unknown): CreatedTreeEventRecord[] {
  const { eventsById, fieldPath } = transactionTreeEventsById(response);
  const createdEvents: CreatedTreeEventRecord[] = [];

  const entries = Object.entries(eventsById).sort(([leftNodeId], [rightNodeId]) =>
    compareTransactionNodeIds(leftNodeId, rightNodeId)
  );
  for (const [nodeId, event] of entries) {
    const eventPath = diagnosticPropertyPath(fieldPath, nodeId);
    const eventRecord = requireRecord(event, eventPath);
    if (!Object.prototype.hasOwnProperty.call(eventRecord, 'CreatedTreeEvent')) continue;

    const createdTreeEvent = requireRecord(eventRecord.CreatedTreeEvent, `${eventPath}.CreatedTreeEvent`);
    const value = requireRecord(createdTreeEvent.value, `${eventPath}.CreatedTreeEvent.value`);
    createdEvents.push({
      contractId: requireString(value.contractId, `${eventPath}.CreatedTreeEvent.value.contractId`),
      templateId: requireString(value.templateId, `${eventPath}.CreatedTreeEvent.value.templateId`),
      value,
    });
  }

  return createdEvents;
}

/**
 * Configure the mock with a fixture object directly (no file I/O)
 *
 * @param fixture - The fixture object to use
 */
export function setTransactionTreeFixtureData(fixture: TransactionTreeFixture): void {
  currentFixture = fixture;
}

/** Get the current fixture (used internally by mocks) */
export function getCurrentFixture(): TransactionTreeFixture | null {
  return currentFixture;
}

/**
 * Configure the mock with events fixture data for getEventsByContractId
 *
 * @param eventsData - The events response object to use
 */
export function setEventsFixtureData(eventsData: Record<string, unknown>): void {
  currentEventsFixture = eventsData;
}

/** Get the current events fixture (used internally by mocks) */
export function getCurrentEventsFixture(): Record<string, unknown> | null {
  return currentEventsFixture;
}

/**
 * Convert a transaction tree to an events response.
 *
 * When the tree contains multiple creates, the event with the greatest ledger node ID wins.
 */
export function convertTransactionTreeToEventsResponse(
  response: SubmitAndWaitForTransactionTreeResponse | Record<string, unknown>,
  synchronizerId: string
): Record<string, unknown> {
  // The result contract is the CreatedTreeEvent with the greatest ledger node ID.
  // createdTreeEventRecords sorts node IDs explicitly, so this does not depend on
  // JavaScript object insertion or integer-key enumeration order.
  const createdEvents = createdTreeEventRecords(response);
  const createdEvent = createdEvents[createdEvents.length - 1]?.value;

  if (!createdEvent) {
    throw new Error('No CreatedTreeEvent found in transaction tree');
  }

  return {
    created: {
      createdEvent,
      synchronizerId,
    },
    archived: null,
  };
}

/** Find one created contract by template name in a direct or legacy-nested transaction tree. */
export function extractContractIdFromTransactionTree(response: unknown, templateIdContains: string): string {
  for (const event of createdTreeEventRecords(response)) {
    const isMatch =
      event.templateId.includes(`:${templateIdContains}:`) || event.templateId.endsWith(`:${templateIdContains}`);
    if (isMatch) return event.contractId;
  }
  return '';
}

/**
 * Validate that an actual request matches the expected request from the fixture Performs a flexible match that ignores
 * dynamic fields and format differences
 */
export function validateRequestMatchesFixture(actualRequest: unknown): void {
  if (!currentFixture) {
    return; // No fixture configured, skip validation
  }

  const expectedRequest = currentFixture.request.data;

  try {
    expect(actualRequest).toEqual(expectedRequest);
  } catch (error) {
    console.error('Request validation failed. Expected vs Actual:');
    console.error('Expected:', JSON.stringify(expectedRequest, null, 2));
    console.error('Actual:', JSON.stringify(actualRequest, null, 2));
    throw error;
  }
}
