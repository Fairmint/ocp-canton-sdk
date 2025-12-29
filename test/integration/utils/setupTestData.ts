/**
 * Test data setup utilities for integration tests.
 *
 * These utilities help create consistent test fixtures for testing SDK functions against a running Canton LocalNet
 * environment.
 *
 * @example
 *   Creating a test issuer
 *   ```typescript
 *   const ocp = new OcpClient({ network: 'localnet' });
 *   const testIssuer = await setupTestIssuer(ocp, {
 *   issuerParty: 'alice::...',
 *   });
 *   console.log('Created issuer:', testIssuer.contractId);
 *   ```
 */

import { getFeaturedAppRightContractDetails, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import type { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type { OcpClient } from '../../../src/OcpClient';
import type {
  OcfIssuerData,
  OcfStakeholderData,
  OcfStockClassData,
  OcfStockIssuanceData,
  OcfStockTransferTxData,
} from '../../../src/types/native';

/** Result from setting up a test issuer. */
export interface TestIssuerSetup {
  /** The contract ID of the created issuer */
  issuerContractId: string;
  /** The issuer data used to create it */
  issuerData: OcfIssuerData;
  /** The issuer authorization contract details (needed for subsequent operations) */
  issuerAuthorizationContractDetails: DisclosedContract;
  /** The featured app right contract details */
  featuredAppRightContractDetails: DisclosedContract;
}

/** Result from setting up a test stakeholder. */
export interface TestStakeholderSetup {
  /** The contract ID of the created stakeholder */
  stakeholderContractId: string;
  /** The stakeholder data used to create it */
  stakeholderData: OcfStakeholderData;
}

/** Result from setting up a test stock class. */
export interface TestStockClassSetup {
  /** The contract ID of the created stock class */
  stockClassContractId: string;
  /** The stock class data used to create it */
  stockClassData: OcfStockClassData;
}

/** Result from setting up a test stock issuance. */
export interface TestStockIssuanceSetup {
  /** The contract ID of the created stock issuance */
  stockIssuanceContractId: string;
  /** The stock issuance data used to create it */
  stockIssuanceData: OcfStockIssuanceData;
}

/** Result from setting up a complete cap table for testing. */
export interface TestCapTableSetup {
  issuer: TestIssuerSetup;
  stakeholders: TestStakeholderSetup[];
  stockClasses: TestStockClassSetup[];
  stockIssuances: TestStockIssuanceSetup[];
}

/**
 * Generate a unique test ID with timestamp. Useful for creating unique IDs across test runs.
 *
 * @param prefix - Prefix for the ID (e.g., 'issuer', 'stakeholder')
 * @returns A unique ID string
 */
export function generateTestId(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-test-${timestamp}-${random}`;
}

/**
 * Generate a date string in YYYY-MM-DD format using UTC to ensure consistency across timezones.
 *
 * @param daysFromNow - Number of days from today (negative for past, positive for future)
 * @returns Date string in YYYY-MM-DD format
 */
export function generateDateString(daysFromNow = 0): string {
  const date = new Date();
  // Use UTC to ensure consistent results across different timezones (CI, local dev, etc.)
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Create default issuer data for testing.
 *
 * @param overrides - Optional overrides for specific fields
 * @returns Complete OcfIssuerData for testing
 */
export function createTestIssuerData(overrides: Partial<OcfIssuerData> = {}): OcfIssuerData {
  return {
    id: generateTestId('issuer'),
    legal_name: 'Test Integration Corp',
    formation_date: '2024-01-01',
    country_of_formation: 'US',
    country_subdivision_of_formation: 'DE',
    tax_ids: [{ country: 'US', tax_id: '12-3456789' }],
    comments: ['Integration test issuer'],
    ...overrides,
  };
}

/**
 * Create default stakeholder data for testing.
 *
 * @param overrides - Optional overrides for specific fields
 * @returns Complete OcfStakeholderData for testing
 */
export function createTestStakeholderData(overrides: Partial<OcfStakeholderData> = {}): OcfStakeholderData {
  return {
    id: generateTestId('stakeholder'),
    name: {
      legal_name: 'Test Stakeholder',
      first_name: 'Test',
      last_name: 'User',
    },
    stakeholder_type: 'INDIVIDUAL',
    comments: ['Integration test stakeholder'],
    ...overrides,
  };
}

/**
 * Create default stock class data for testing.
 *
 * @param overrides - Optional overrides for specific fields
 * @returns Complete OcfStockClassData for testing
 */
export function createTestStockClassData(overrides: Partial<OcfStockClassData> = {}): OcfStockClassData {
  return {
    id: generateTestId('stock-class'),
    name: 'Common Stock',
    class_type: 'COMMON',
    default_id_prefix: 'CS-',
    initial_shares_authorized: '10000000',
    votes_per_share: '1',
    seniority: '1',
    comments: ['Integration test stock class'],
    ...overrides,
  };
}

/**
 * Create default stock issuance data for testing.
 *
 * @param stakeholderId - The stakeholder receiving the shares
 * @param stockClassId - The stock class being issued
 * @param overrides - Optional overrides for specific fields
 * @returns Complete OcfStockIssuanceData for testing
 */
export function createTestStockIssuanceData(
  stakeholderId: string,
  stockClassId: string,
  overrides: Partial<OcfStockIssuanceData> = {}
): OcfStockIssuanceData {
  const securityId = generateTestId('security');
  return {
    id: generateTestId('issuance'),
    date: generateDateString(),
    security_id: securityId,
    custom_id: `CS-${Date.now()}`,
    stakeholder_id: stakeholderId,
    stock_class_id: stockClassId,
    quantity: '1000',
    share_price: { amount: '1.00', currency: 'USD' },
    comments: ['Integration test stock issuance'],
    ...overrides,
  };
}

/**
 * Create default stock transfer data for testing.
 *
 * @param securityId - The security being transferred
 * @param quantity - Amount to transfer
 * @param overrides - Optional overrides for specific fields
 * @returns Complete OcfStockTransferTxData for testing
 */
export function createTestStockTransferData(
  securityId: string,
  quantity: string | number,
  overrides: Partial<OcfStockTransferTxData> = {}
): OcfStockTransferTxData {
  return {
    id: generateTestId('transfer'),
    date: generateDateString(),
    security_id: securityId,
    quantity,
    resulting_security_ids: [generateTestId('security')],
    comments: ['Integration test stock transfer'],
    ...overrides,
  };
}

/**
 * Get the FeaturedAppRight contract details from the validator API.
 *
 * @returns The FeaturedAppRight disclosed contract
 */
export async function getFeaturedAppRightDetails(): Promise<DisclosedContract> {
  const validatorClient = new ValidatorApiClient({ network: 'localnet' });
  const details = await getFeaturedAppRightContractDetails(validatorClient);
  return {
    templateId: details.templateId,
    contractId: details.contractId,
    createdEventBlob: details.createdEventBlob,
    synchronizerId: details.synchronizerId,
  };
}

/**
 * Extract a contract ID from a transaction tree response.
 *
 * Handles both response structures:
 * - response.transactionTree.eventsById (direct)
 * - response.transactionTree.transaction.eventsById (nested)
 *
 * @param response - The transaction tree response
 * @param templateIdContains - Substring to match in the template ID
 * @returns The contract ID, or empty string if not found
 */
function extractContractIdFromResponse(
  response: SubmitAndWaitForTransactionTreeResponse,
  templateIdContains: string
): string {
  // Handle both response structures (eventsById directly or under transaction)
  // The response structure varies between Canton versions
  const tree = response.transactionTree;
  const treeAny = tree as any;
  const eventsById: Record<string, unknown> = treeAny.eventsById ?? treeAny.transaction?.eventsById ?? {};

  for (const event of Object.values(eventsById)) {
    const eventData = event as Record<string, unknown>;
    if (eventData.CreatedTreeEvent) {
      const created = (eventData.CreatedTreeEvent as Record<string, unknown>).value as Record<string, unknown>;
      const templateId = created.templateId as string;
      if (templateId.includes(templateIdContains)) {
        return created.contractId as string;
      }
    }
  }
  return '';
}

/**
 * Setup a test issuer with all required dependencies.
 *
 * This function:
 *
 * 1. Gets the FeaturedAppRight contract from the validator
 * 2. Authorizes the issuer using the OCP Factory
 * 3. Creates the issuer
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestIssuerSetup with all created artifacts
 */
export async function setupTestIssuer(
  ocp: OcpClient,
  options: {
    /** The issuer party ID (usually alice's party in LocalNet) */
    issuerParty: string;
    /** Optional issuer data overrides */
    issuerData?: Partial<OcfIssuerData>;
    /** Pre-fetched featured app right (for reuse across tests) */
    featuredAppRightContractDetails?: DisclosedContract;
    /** Pre-existing issuer authorization (if already authorized) */
    issuerAuthorizationContractDetails?: DisclosedContract;
  }
): Promise<TestIssuerSetup> {
  const featuredAppRightContractDetails =
    options.featuredAppRightContractDetails ?? (await getFeaturedAppRightDetails());

  // Get or create issuer authorization
  let { issuerAuthorizationContractDetails } = options;
  if (!issuerAuthorizationContractDetails) {
    // Authorize the issuer using the OCP Factory
    const authResult = await ocp.OpenCapTable.issuerAuthorization.authorizeIssuer({
      issuer: options.issuerParty,
    });
    issuerAuthorizationContractDetails = {
      templateId: authResult.templateId,
      contractId: authResult.contractId,
      createdEventBlob: authResult.createdEventBlob,
      synchronizerId: authResult.synchronizerId,
    };
  }

  const issuerData = createTestIssuerData(options.issuerData);

  // Create the issuer using the underlying client for full response
  const createIssuerCmd = ocp.OpenCapTable.issuer.buildCreateIssuerCommand({
    issuerAuthorizationContractDetails,
    featuredAppRightContractDetails,
    issuerParty: options.issuerParty,
    issuerData,
  });

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [createIssuerCmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: createIssuerCmd.disclosedContracts,
  });

  // Extract the issuer contract ID from the result
  const issuerContractId = extractContractIdFromResponse(result, 'Issuer');
  if (!issuerContractId) {
    throw new Error('Failed to extract issuer contract ID from transaction result');
  }

  return {
    issuerContractId,
    issuerData,
    issuerAuthorizationContractDetails,
    featuredAppRightContractDetails,
  };
}

/**
 * Setup a test stakeholder under an existing issuer.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestStakeholderSetup with the created stakeholder
 */
export async function setupTestStakeholder(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** Optional stakeholder data overrides */
    stakeholderData?: Partial<OcfStakeholderData>;
  }
): Promise<TestStakeholderSetup> {
  const stakeholderData = createTestStakeholderData(options.stakeholderData);

  const cmd = ocp.OpenCapTable.stakeholder.buildCreateStakeholderCommand({
    issuerContractId: options.issuerContractId,
    issuerParty: options.issuerParty,
    stakeholderData,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
  });

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: cmd.disclosedContracts,
  });

  // Extract stakeholder contract ID
  const stakeholderContractId = extractContractIdFromResponse(result, 'Stakeholder');
  if (!stakeholderContractId) {
    throw new Error('Failed to extract stakeholder contract ID from transaction result');
  }

  return {
    stakeholderContractId,
    stakeholderData,
  };
}

/**
 * Setup a test stock class under an existing issuer.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestStockClassSetup with the created stock class
 */
export async function setupTestStockClass(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** Optional stock class data overrides */
    stockClassData?: Partial<OcfStockClassData>;
  }
): Promise<TestStockClassSetup> {
  const stockClassData = createTestStockClassData(options.stockClassData);

  const cmd = ocp.OpenCapTable.stockClass.buildCreateStockClassCommand({
    issuerContractId: options.issuerContractId,
    issuerParty: options.issuerParty,
    stockClassData,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
  });

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: cmd.disclosedContracts,
  });

  // Extract stock class contract ID
  const stockClassContractId = extractContractIdFromResponse(result, 'StockClass');
  if (!stockClassContractId) {
    throw new Error('Failed to extract stock class contract ID from transaction result');
  }

  return {
    stockClassContractId,
    stockClassData,
  };
}
