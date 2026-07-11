import type { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

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

  for (const [nodeId, event] of Object.entries(eventsById)) {
    const eventPath = `${fieldPath}.${nodeId}`;
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

/** Clear the current fixture configuration */
export function clearTransactionTreeFixture(): void {
  currentFixture = null;
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

/** Clear the current events fixture configuration */
export function clearEventsFixture(): void {
  currentEventsFixture = null;
}

/** Get the current events fixture (used internally by mocks) */
export function getCurrentEventsFixture(): Record<string, unknown> | null {
  return currentEventsFixture;
}

/** Convert transaction tree response to events response format Extracts the created event from the transaction tree */
export function convertTransactionTreeToEventsResponse(
  response: SubmitAndWaitForTransactionTreeResponse | Record<string, unknown>,
  synchronizerId: string
): Record<string, unknown> {
  // Find the created event (usually the last event with CreatedTreeEvent)
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

/**
 * Configure a client instance to use fixture-based mocking This spy function will validate requests and return fixture
 * responses
 */
export function configureClientWithFixture(client: unknown): jest.SpyInstance {
  const clientWithPrivateAccess = client as {
    ledger: { submitAndWaitForTransactionTree: (...args: unknown[]) => unknown };
  };
  return jest.spyOn(clientWithPrivateAccess.ledger, 'submitAndWaitForTransactionTree');
}
