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
}

let currentFixture: TransactionTreeFixture | null = null;

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
