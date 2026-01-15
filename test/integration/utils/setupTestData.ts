/**
 * Test data setup utilities for integration tests.
 *
 * These utilities help create consistent test fixtures for testing the batch cap table API against a running Canton
 * LocalNet environment.
 */

import { getFeaturedAppRightContractDetails, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import type { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type { OcpClient } from '../../../src/OcpClient';
import { buildUpdateCapTableCommand } from '../../../src/functions/OpenCapTable';
import type {
  OcfDocument,
  OcfIssuer,
  OcfStakeholder,
  OcfStockClass,
  OcfStockLegendTemplate,
} from '../../../src/types/native';
import { authorizeIssuerWithFactory } from '../setup/contractDeployment';

/** Result from setting up a test issuer. */
export interface TestIssuerSetup {
  /** The contract ID of the created CapTable contract (for exercising choices) */
  issuerContractId: string;
  /** The contract ID of the actual Issuer contract (for getIssuerAsOcf) */
  issuerOcfContractId: string;
  /** The issuer data used to create it */
  issuerData: OcfIssuer;
  /** The issuer authorization contract details (needed for subsequent operations) */
  issuerAuthorizationContractDetails: DisclosedContract;
  /** The featured app right contract details */
  featuredAppRightContractDetails: DisclosedContract;
  /** The CapTable contract details (needed for disclosed contracts when exercising choices) */
  capTableContractDetails: DisclosedContract;
}

/** Result from setting up a test stakeholder. */
export interface TestStakeholderSetup {
  /** The contract ID of the created stakeholder */
  stakeholderContractId: string;
  /** The stakeholder data used to create it */
  stakeholderData: OcfStakeholder;
  /** The new CapTable contract ID (after this operation consumed the old one) */
  newCapTableContractId: string;
  /** The new CapTable contract details (for subsequent operations) */
  newCapTableContractDetails: DisclosedContract;
}

/** Generate a unique test ID with the given prefix. Uses timestamp + random string for uniqueness. */
export function generateTestId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Generate a date string in ISO format (YYYY-MM-DD).
 *
 * @param daysFromNow - Number of days from today (can be negative)
 */
export function generateDateString(daysFromNow = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}

/** Create test issuer data with optional overrides. */
export function createTestIssuerData(overrides: Partial<OcfIssuer> = {}): OcfIssuer {
  const id = overrides.id ?? generateTestId('issuer');
  return {
    id,
    legal_name: `Test Company ${id}`,
    formation_date: generateDateString(-365),
    country_of_formation: 'US',
    country_subdivision_of_formation: 'DE',
    tax_ids: [],
    ...overrides,
  };
}

/** Create test stakeholder data with optional overrides. */
export function createTestStakeholderData(overrides: Partial<OcfStakeholder> = {}): OcfStakeholder {
  const id = overrides.id ?? generateTestId('stakeholder');
  return {
    id,
    name: {
      legal_name: `Stakeholder ${id}`,
    },
    stakeholder_type: 'INDIVIDUAL',
    ...overrides,
  };
}

/** Create test stock class data with optional overrides. */
export function createTestStockClassData(overrides: Partial<OcfStockClass> = {}): OcfStockClass {
  const id = overrides.id ?? generateTestId('stock-class');
  return {
    id,
    name: `Class ${id}`,
    class_type: 'COMMON',
    default_id_prefix: 'CS',
    initial_shares_authorized: '10000000',
    seniority: '1',
    votes_per_share: '1',
    price_per_share: { amount: '1.00', currency: 'USD' },
    ...overrides,
  };
}

/** Create test stock legend template data with optional overrides. */
export function createTestStockLegendTemplateData(
  overrides: Partial<OcfStockLegendTemplate> = {}
): OcfStockLegendTemplate {
  const id = overrides.id ?? generateTestId('legend');
  return {
    id,
    name: `Legend Template ${id}`,
    text: 'This is a test stock legend template text.',
    ...overrides,
  };
}

/** Create test document data with optional overrides. */
export function createTestDocumentData(overrides: Partial<OcfDocument> = {}): OcfDocument {
  const id = overrides.id ?? generateTestId('document');
  return {
    id,
    md5: '00000000000000000000000000000000', // Placeholder MD5 hash
    ...overrides,
  };
}

/**
 * Get the FeaturedAppRight contract details from the Validator API. This is required for many OCP operations on the
 * Canton Network.
 */
export async function getFeaturedAppRightDetails(): Promise<DisclosedContract> {
  const validatorClient = new ValidatorApiClient({ network: 'localnet' });
  try {
    const details = await getFeaturedAppRightContractDetails(validatorClient);
    return {
      templateId: details.templateId,
      contractId: details.contractId,
      createdEventBlob: details.createdEventBlob,
      synchronizerId: details.synchronizerId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to get FeaturedAppRight contract details: ${message}. ` +
        'This requires a full Canton Network setup with Validator API running. ' +
        'Basic LocalNet (cn-quickstart) does not include the Validator API.'
    );
  }
}

/** Extract a contract ID from a transaction tree response. */
function extractContractIdFromResponse(
  response: SubmitAndWaitForTransactionTreeResponse,
  templateIdContains: string
): string {
  const tree = response.transactionTree;
  const treeAny = tree as any;
  const eventsById: Record<string, unknown> = treeAny.eventsById ?? treeAny.transaction?.eventsById ?? {};

  for (const event of Object.values(eventsById)) {
    const eventData = event as Record<string, unknown>;
    if (eventData.CreatedTreeEvent) {
      const created = (eventData.CreatedTreeEvent as Record<string, unknown>).value as Record<string, unknown>;
      const templateId = created.templateId as string;
      const isMatch = templateId.includes(`:${templateIdContains}:`) || templateId.endsWith(`:${templateIdContains}`);
      if (isMatch) {
        return created.contractId as string;
      }
    }
  }
  return '';
}

/** Extract the new CapTable contract details from a transaction result. */
async function extractNewCapTableDetails(
  ocp: OcpClient,
  result: SubmitAndWaitForTransactionTreeResponse
): Promise<{ contractId: string; contractDetails: DisclosedContract }> {
  const contractId = extractContractIdFromResponse(result, 'CapTable');
  if (!contractId) {
    throw new Error('Failed to extract new CapTable contract ID from transaction result');
  }

  const events = await ocp.client.getEventsByContractId({ contractId });
  if (!events.created?.createdEvent) {
    throw new Error('Failed to get new CapTable contract created event');
  }

  const contractDetails: DisclosedContract = {
    templateId: events.created.createdEvent.templateId,
    contractId,
    createdEventBlob: events.created.createdEvent.createdEventBlob,
    synchronizerId: result.transactionTree.synchronizerId,
  };

  return { contractId, contractDetails };
}

/** Get or create issuer authorization. */
async function getOrCreateIssuerAuthorization(
  ocp: OcpClient,
  options: {
    issuerParty: string;
    issuerAuthorizationContractDetails?: DisclosedContract;
    systemOperatorParty?: string;
    ocpFactoryContractId?: string;
  }
): Promise<DisclosedContract> {
  if (options.issuerAuthorizationContractDetails) {
    return options.issuerAuthorizationContractDetails;
  }

  if (options.ocpFactoryContractId && options.systemOperatorParty) {
    const authResult = await authorizeIssuerWithFactory(
      ocp.client,
      options.ocpFactoryContractId,
      options.systemOperatorParty,
      options.issuerParty
    );
    return {
      templateId: authResult.templateId,
      contractId: authResult.contractId,
      createdEventBlob: authResult.createdEventBlob,
      synchronizerId: authResult.synchronizerId,
    };
  }

  const authResult = await ocp.OpenCapTable.issuerAuthorization.authorizeIssuer({
    issuer: options.issuerParty,
  });
  return {
    templateId: authResult.templateId,
    contractId: authResult.contractId,
    createdEventBlob: authResult.createdEventBlob,
    synchronizerId: authResult.synchronizerId,
  };
}

/** Setup a test issuer with all required dependencies. Uses the OcpFactory to authorize and create the issuer. */
export async function setupTestIssuer(
  ocp: OcpClient,
  options: {
    issuerParty: string;
    featuredAppRightContractDetails: DisclosedContract;
    capTableContractDetails?: DisclosedContract;
    issuerData?: Partial<OcfIssuer>;
    issuerAuthorizationContractDetails?: DisclosedContract;
    systemOperatorParty?: string;
    ocpFactoryContractId?: string;
  }
): Promise<TestIssuerSetup> {
  const { featuredAppRightContractDetails } = options;

  const issuerAuthorizationContractDetails = await getOrCreateIssuerAuthorization(ocp, options);
  const issuerData = createTestIssuerData(options.issuerData);

  const createIssuerCmd = ocp.OpenCapTable.issuer.buildCreateIssuerCommand({
    issuerAuthorizationContractDetails,
    featuredAppRightContractDetails,
    issuerParty: options.issuerParty,
    issuerData,
  });

  const validDisclosedContracts = createIssuerCmd.disclosedContracts.filter(
    (dc) => dc.createdEventBlob && dc.createdEventBlob.length > 0
  );

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [createIssuerCmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: validDisclosedContracts,
  });

  const issuerOcfContractId = extractContractIdFromResponse(result, 'Issuer');
  if (!issuerOcfContractId) {
    throw new Error('Failed to extract Issuer contract ID from transaction result');
  }

  const capTableContractId = extractContractIdFromResponse(result, 'CapTable');
  if (!capTableContractId) {
    throw new Error('Failed to extract CapTable contract ID from transaction result');
  }

  const capTableEvents = await ocp.client.getEventsByContractId({ contractId: capTableContractId });
  if (!capTableEvents.created?.createdEvent) {
    throw new Error('Failed to get CapTable contract created event');
  }

  const capTableSynchronizerId = result.transactionTree.synchronizerId;

  const capTableContractDetails: DisclosedContract = {
    templateId: capTableEvents.created.createdEvent.templateId,
    contractId: capTableContractId,
    createdEventBlob: capTableEvents.created.createdEvent.createdEventBlob,
    synchronizerId: capTableSynchronizerId,
  };

  return {
    issuerContractId: capTableContractId,
    issuerOcfContractId,
    issuerData,
    issuerAuthorizationContractDetails,
    featuredAppRightContractDetails,
    capTableContractDetails,
  };
}

/** Setup a test stakeholder under an existing issuer using the batch API. */
export async function setupTestStakeholder(
  ocp: OcpClient,
  options: {
    issuerContractId: string;
    issuerParty: string;
    featuredAppRightContractDetails: DisclosedContract;
    capTableContractDetails?: DisclosedContract;
    stakeholderData?: Partial<OcfStakeholder>;
  }
): Promise<TestStakeholderSetup> {
  const stakeholderData = createTestStakeholderData(options.stakeholderData);

  const cmd = buildUpdateCapTableCommand(
    {
      capTableContractId: options.issuerContractId,
      featuredAppRightContractDetails: options.featuredAppRightContractDetails,
      capTableContractDetails: options.capTableContractDetails,
    },
    { creates: [{ type: 'stakeholder', data: stakeholderData }] }
  );

  const validDisclosedContracts = cmd.disclosedContracts.filter(
    (dc) => dc.createdEventBlob && dc.createdEventBlob.length > 0
  );

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: validDisclosedContracts,
  });

  const stakeholderContractId = extractContractIdFromResponse(result, 'Stakeholder');
  if (!stakeholderContractId) {
    throw new Error('Failed to extract Stakeholder contract ID from transaction result');
  }

  const newCapTable = await extractNewCapTableDetails(ocp, result);

  return {
    stakeholderContractId,
    stakeholderData,
    newCapTableContractId: newCapTable.contractId,
    newCapTableContractDetails: newCapTable.contractDetails,
  };
}
