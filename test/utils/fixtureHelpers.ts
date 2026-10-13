import type { SubmitAndWaitForTransactionResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface TransactionFixture {
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
  response?: SubmitAndWaitForTransactionResponse;
}

let currentFixture: TransactionFixture | null = null;
let currentEventsFixture: Record<string, unknown> | null = null;

/**
 * Configure the mock with a fixture object directly (no file I/O)
 *
 * @param fixture - The fixture object to use
 */
export function setTransactionFixtureData(fixture: TransactionFixture): void {
  currentFixture = fixture;
}

/** Clear the current fixture configuration */
export function clearTransactionFixture(): void {
  currentFixture = null;
}

/** Get the current fixture (used internally by mocks) */
export function getCurrentFixture(): TransactionFixture | null {
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

/** Convert a transaction response to events response format. Extracts the last created event. */
export function convertTransactionToEventsResponse(
  response: SubmitAndWaitForTransactionResponse | Record<string, unknown>,
  synchronizerId: string
): Record<string, unknown> {
  const transaction =
    'transaction' in response && response.transaction && typeof response.transaction === 'object'
      ? (response.transaction as { events?: unknown[] })
      : undefined;
  const events = Array.isArray(transaction?.events) ? transaction.events : undefined;

  if (!events) {
    throw new Error('No events in transaction');
  }

  let createdEvent: Record<string, unknown> | null = null;
  for (const event of events) {
    const eventData = event as Record<string, unknown>;
    if (eventData.CreatedEvent) {
      createdEvent = eventData.CreatedEvent as Record<string, unknown>;
    }
  }

  if (!createdEvent) {
    throw new Error('No CreatedEvent found in transaction');
  }

  return {
    created: {
      createdEvent,
      synchronizerId,
    },
    archived: null,
  };
}

/**
 * Validate that an actual request matches the expected request from the fixture Performs a flexible match that ignores
 * dynamic fields and format differences
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
 * Configure a client instance to use fixture-based mocking This spy function will validate requests and return fixture
 * responses
 */
export function configureClientWithFixture(client: unknown): jest.SpyInstance {
  const clientWithPrivateAccess = client as any;
  return jest.spyOn(clientWithPrivateAccess.ledger, 'submitAndWaitForTransaction');
}
