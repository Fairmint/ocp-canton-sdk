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
  response: SubmitAndWaitForTransactionTreeResponse;
}

let currentFixture: TransactionTreeFixture | null = null;

/**
 * Configure the mock to use a specific transaction tree fixture for testing.
 * This sets up both request validation and response mocking.
 * 
 * @param fixtureName - Name of the fixture file (without .json extension)
 * @example
 * setTransactionTreeFixture('createDocument');
 */
export function setTransactionTreeFixture(fixtureName: string): void {
  const fixturePath = path.join(
    __dirname,
    '..',
    'fixtures',
    'ocpClient',
    `${fixtureName}.json`
  );

  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Fixture not found: ${fixturePath}`);
  }

  const fileContent = fs.readFileSync(fixturePath, 'utf-8');
  try {
    currentFixture = JSON.parse(fileContent) as TransactionTreeFixture;
  } catch (error) {
    throw new Error(`Invalid JSON in fixture ${fixturePath}: ${(error as Error).message}`);
  }
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
 * Normalize a request object for comparison by removing dynamic fields
 * and normalizing templateId formats
 */
function unwrapOptionalTypes(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(unwrapOptionalTypes);
  }
  
  if (typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    
    // Unwrap Optional type: { tag: "Some", value: X } => X
    if (record.tag === 'Some' && 'value' in record) {
      return unwrapOptionalTypes(record.value);
    }
    
    // Unwrap None: { tag: "None" } => null
    if (record.tag === 'None') {
      return null;
    }
    
    // Recursively unwrap all nested objects
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      result[key] = unwrapOptionalTypes(value);
    }
    return result;
  }
  
  return obj;
}

function normalizeRequest(request: Record<string, unknown>): Record<string, unknown> {
  const normalized = JSON.parse(JSON.stringify(request));
  delete normalized.commandId;
  
  // Normalize templateId format (SDK uses "pkg:..." while fixtures may use "#PackageName:...")
  // Also normalize dots vs colons in template paths
  if (Array.isArray(normalized.commands)) {
    for (const command of normalized.commands) {
      if (command.ExerciseCommand?.templateId) {
        const templateId = command.ExerciseCommand.templateId as string;
        // Keep only the module and template name parts, ignore package prefix format differences
        const match = templateId.match(/(?:#[^:]+:|pkg:)?(.+)/);
        if (match) {
          // Normalize all separators to dots for consistent comparison
          command.ExerciseCommand.templateId = match[1].replace(/:/g, '.');
        }
      }
      
      // Unwrap Optional types in choiceArgument to match fixture format
      if (command.ExerciseCommand?.choiceArgument) {
        command.ExerciseCommand.choiceArgument = unwrapOptionalTypes(command.ExerciseCommand.choiceArgument);
      }
    }
  }
  
  // Also normalize templateId in disclosedContracts
  if (Array.isArray(normalized.disclosedContracts)) {
    for (const contract of normalized.disclosedContracts) {
      if (contract.templateId) {
        // These are already in hash:module:template format, keep as-is
        // No normalization needed for disclosed contracts
      }
    }
  }
  
  return normalized;
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
  const normalizedActual = normalizeRequest(actualRequest);
  const normalizedExpected = normalizeRequest(expectedRequest);

  try {
    expect(normalizedActual).toEqual(normalizedExpected);
  } catch (error) {
    console.error('Request validation failed. Expected vs Actual:');
    console.error('Expected:', JSON.stringify(normalizedExpected, null, 2));
    console.error('Actual:', JSON.stringify(normalizedActual, null, 2));
    throw error;
  }
}

/**
 * Get the mock response from the current fixture
 */
export function getFixtureResponse(): SubmitAndWaitForTransactionTreeResponse | null {
  return currentFixture?.response ?? null;
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
