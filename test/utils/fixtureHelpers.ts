import path from 'path';
import fs from 'fs';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

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

/**
 * Configure the mock with a fixture object directly (no file I/O)
 * @param fixture - The fixture object to use
 */
export function setTransactionTreeFixtureData(fixture: TransactionTreeFixture): void {
  currentFixture = fixture;
}

/**
 * Clear the current fixture configuration
 */
export function clearTransactionTreeFixture(): void {
  currentFixture = null;
}

/**
 * Get the current fixture (used internally by mocks)
 */
export function getCurrentFixture(): TransactionTreeFixture | null {
  return currentFixture;
}

/**
 * Configure the mock with events fixture data for getEventsByContractId
 * @param eventsData - The events response object to use
 */
export function setEventsFixtureData(eventsData: Record<string, unknown>): void {
  currentEventsFixture = eventsData;
}

/**
 * Clear the current events fixture configuration
 */
export function clearEventsFixture(): void {
  currentEventsFixture = null;
}

/**
 * Get the current events fixture (used internally by mocks)
 */
export function getCurrentEventsFixture(): Record<string, unknown> | null {
  return currentEventsFixture;
}

/**
 * Convert transaction tree response to events response format
 * Extracts the created event from the transaction tree
 */
export function convertTransactionTreeToEventsResponse(
  response: SubmitAndWaitForTransactionTreeResponse | Record<string, unknown>,
  synchronizerId: string
): Record<string, unknown> {
  // Handle both structures: response.transactionTree.eventsById and response.transactionTree.transaction.eventsById
  const transactionTree = (response as any).transactionTree;
  const eventsById = transactionTree?.eventsById || transactionTree?.transaction?.eventsById;
  
  if (!eventsById) {
    throw new Error('No eventsById in transaction tree');
  }

  // Find the created event (usually the last event with CreatedTreeEvent)
  let createdEvent: Record<string, unknown> | null = null;
  for (const [nodeId, event] of Object.entries(eventsById)) {
    const eventData = event as Record<string, unknown>;
    if (eventData.CreatedTreeEvent) {
      createdEvent = (eventData.CreatedTreeEvent as Record<string, unknown>).value as Record<string, unknown>;
    }
  }

  if (!createdEvent) {
    throw new Error('No CreatedTreeEvent found in transaction tree');
  }

  return {
    created: {
      createdEvent,
      synchronizerId
    },
    archived: null
  };
}

/**
 * Validate that an actual request matches the expected request from the fixture
 * Performs a flexible match that ignores dynamic fields and format differences
 */
export function validateRequestMatchesFixture(actualRequest: Record<string, unknown>): void {
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
 * Configure a client instance to use fixture-based mocking
 * This spy function will validate requests and return fixture responses
 */
export function configureClientWithFixture(client: unknown): jest.SpyInstance {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientWithPrivateAccess = client as any;
  return jest.spyOn(clientWithPrivateAccess.client, 'submitAndWaitForTransactionTree');
}
