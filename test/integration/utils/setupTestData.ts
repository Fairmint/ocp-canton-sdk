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
  OcfConvertibleIssuanceDataNative,
  OcfDocumentData,
  OcfEquityCompensationIssuanceData,
  OcfIssuerAuthorizedSharesAdjustmentTxData,
  OcfIssuerData,
  OcfStakeholderData,
  OcfStockCancellationTxData,
  OcfStockClassAuthorizedSharesAdjustmentTxData,
  OcfStockClassData,
  OcfStockIssuanceData,
  OcfStockLegendTemplateData,
  OcfStockPlanData,
  OcfStockPlanPoolAdjustmentTxData,
  OcfStockTransferTxData,
  OcfVestingTermsData,
  OcfWarrantIssuanceDataNative,
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

/** Result from setting up a test stock class authorized shares adjustment. */
export interface TestStockClassAuthorizedSharesAdjustmentSetup {
  /** The contract ID of the created adjustment */
  adjustmentContractId: string;
  /** The adjustment data used to create it */
  adjustmentData: OcfStockClassAuthorizedSharesAdjustmentTxData;
}

/** Result from setting up a test stock legend template. */
export interface TestStockLegendTemplateSetup {
  /** The contract ID of the created stock legend template */
  stockLegendTemplateContractId: string;
  /** The stock legend template data used to create it */
  stockLegendTemplateData: OcfStockLegendTemplateData;
}

/** Result from setting up a test vesting terms. */
export interface TestVestingTermsSetup {
  /** The contract ID of the created vesting terms */
  vestingTermsContractId: string;
  /** The vesting terms data used to create it */
  vestingTermsData: OcfVestingTermsData;
}

/** Result from setting up a test stock plan. */
export interface TestStockPlanSetup {
  /** The contract ID of the created stock plan */
  stockPlanContractId: string;
  /** The stock plan data used to create it */
  stockPlanData: OcfStockPlanData;
}

/** Result from setting up a test document. */
export interface TestDocumentSetup {
  /** The contract ID of the created document */
  documentContractId: string;
  /** The document data used to create it */
  documentData: OcfDocumentData;
}

/** Result from setting up a test issuer authorized shares adjustment. */
export interface TestIssuerAuthorizedSharesAdjustmentSetup {
  /** The contract ID of the created adjustment */
  adjustmentContractId: string;
  /** The adjustment data used to create it */
  adjustmentData: OcfIssuerAuthorizedSharesAdjustmentTxData;
}

/** Result from setting up a test stock plan pool adjustment. */
export interface TestStockPlanPoolAdjustmentSetup {
  /** The contract ID of the created adjustment */
  adjustmentContractId: string;
  /** The adjustment data used to create it */
  adjustmentData: OcfStockPlanPoolAdjustmentTxData;
}

/** Result from setting up a test stock cancellation. */
export interface TestStockCancellationSetup {
  /** The contract ID of the created stock cancellation */
  stockCancellationContractId: string;
  /** The stock cancellation data used to create it */
  stockCancellationData: OcfStockCancellationTxData;
}

/** Result from setting up a test equity compensation issuance. */
export interface TestEquityCompensationIssuanceSetup {
  /** The contract ID of the created equity compensation issuance */
  equityCompensationIssuanceContractId: string;
  /** The equity compensation issuance data used to create it */
  equityCompensationIssuanceData: OcfEquityCompensationIssuanceData;
}

/** Result from setting up a test warrant issuance. */
export interface TestWarrantIssuanceSetup {
  /** The contract ID of the created warrant issuance */
  warrantIssuanceContractId: string;
  /** The warrant issuance data used to create it */
  warrantIssuanceData: OcfWarrantIssuanceDataNative;
}

/** Result from setting up a test convertible issuance. */
export interface TestConvertibleIssuanceSetup {
  /** The contract ID of the created convertible issuance */
  convertibleIssuanceContractId: string;
  /** The convertible issuance data used to create it */
  convertibleIssuanceData: OcfConvertibleIssuanceDataNative;
}

/** Result from setting up a test stock transfer. */
export interface TestStockTransferSetup {
  /** The contract ID of the created stock transfer */
  stockTransferContractId: string;
  /** The stock transfer data used to create it */
  stockTransferData: OcfStockTransferTxData;
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
 * Create default stock class authorized shares adjustment data for testing.
 *
 * @param stockClassId - The stock class being adjusted
 * @param overrides - Optional overrides for specific fields
 * @returns Complete OcfStockClassAuthorizedSharesAdjustmentTxData for testing
 */
export function createTestStockClassAuthorizedSharesAdjustmentData(
  stockClassId: string,
  overrides: Partial<OcfStockClassAuthorizedSharesAdjustmentTxData> = {}
): OcfStockClassAuthorizedSharesAdjustmentTxData {
  return {
    id: generateTestId('adjustment'),
    date: generateDateString(),
    stock_class_id: stockClassId,
    new_shares_authorized: '20000000',
    board_approval_date: generateDateString(-7), // 7 days ago
    comments: ['Integration test authorized shares adjustment'],
    ...overrides,
  };
}

/**
 * Create default stock legend template data for testing.
 *
 * @param overrides - Optional overrides for specific fields
 * @returns Complete OcfStockLegendTemplateData for testing
 */
export function createTestStockLegendTemplateData(
  overrides: Partial<OcfStockLegendTemplateData> = {}
): OcfStockLegendTemplateData {
  return {
    id: generateTestId('legend'),
    name: 'Standard Stock Legend',
    text: 'THE SECURITIES REPRESENTED BY THIS CERTIFICATE HAVE NOT BEEN REGISTERED UNDER THE SECURITIES ACT OF 1933.',
    comments: ['Integration test stock legend template'],
    ...overrides,
  };
}

/**
 * Create default vesting terms data for testing.
 *
 * @param overrides - Optional overrides for specific fields
 * @returns Complete OcfVestingTermsData for testing
 */
export function createTestVestingTermsData(overrides: Partial<OcfVestingTermsData> = {}): OcfVestingTermsData {
  return {
    id: generateTestId('vesting'),
    name: '4 Year Standard Vesting',
    description: 'Standard 4 year vesting with 1 year cliff',
    allocation_type: 'CUMULATIVE_ROUNDING',
    vesting_conditions: [
      {
        id: 'start',
        description: 'Vesting start trigger',
        trigger: { type: 'VESTING_START_DATE' } as unknown as OcfVestingTermsData['vesting_conditions'][0]['trigger'],
        next_condition_ids: ['cliff'],
      },
      {
        id: 'cliff',
        description: '1 year cliff',
        portion: { numerator: '25', denominator: '100', remainder: false },
        trigger: {
          type: 'VESTING_SCHEDULE_RELATIVE',
          period: { type: 'MONTHS', length: 12, occurrences: 1, day_of_month: '01' },
          relative_to_condition_id: 'start',
        } as unknown as OcfVestingTermsData['vesting_conditions'][0]['trigger'],
        next_condition_ids: ['monthly'],
      },
      {
        id: 'monthly',
        description: 'Monthly vesting over 36 months',
        portion: { numerator: '75', denominator: '100', remainder: true },
        trigger: {
          type: 'VESTING_SCHEDULE_RELATIVE',
          period: { type: 'MONTHS', length: 1, occurrences: 36, day_of_month: '01' },
          relative_to_condition_id: 'cliff',
        } as unknown as OcfVestingTermsData['vesting_conditions'][0]['trigger'],
        next_condition_ids: [],
      },
    ],
    comments: ['Integration test vesting terms'],
    ...overrides,
  };
}

/**
 * Create default stock plan data for testing.
 *
 * @param stockClassIds - The stock class IDs associated with this plan
 * @param overrides - Optional overrides for specific fields
 * @returns Complete OcfStockPlanData for testing
 */
export function createTestStockPlanData(
  stockClassIds: string[],
  overrides: Partial<OcfStockPlanData> = {}
): OcfStockPlanData {
  return {
    id: generateTestId('plan'),
    plan_name: '2024 Equity Incentive Plan',
    board_approval_date: generateDateString(-30),
    stockholder_approval_date: generateDateString(-14),
    initial_shares_reserved: '1000000',
    default_cancellation_behavior: 'RETURN_TO_POOL',
    stock_class_ids: stockClassIds,
    comments: ['Integration test stock plan'],
    ...overrides,
  };
}

/**
 * Create default document data for testing.
 *
 * @param overrides - Optional overrides for specific fields
 * @returns Complete OcfDocumentData for testing
 */
export function createTestDocumentData(overrides: Partial<OcfDocumentData> = {}): OcfDocumentData {
  return {
    id: generateTestId('doc'),
    path: 'documents/test-document.pdf',
    md5: 'd41d8cd98f00b204e9800998ecf8427e', // MD5 of empty string
    comments: ['Integration test document'],
    ...overrides,
  };
}

/**
 * Create default issuer authorized shares adjustment data for testing.
 *
 * @param issuerId - The issuer ID being adjusted
 * @param overrides - Optional overrides for specific fields
 * @returns Complete OcfIssuerAuthorizedSharesAdjustmentTxData for testing
 */
export function createTestIssuerAuthorizedSharesAdjustmentData(
  issuerId: string,
  overrides: Partial<OcfIssuerAuthorizedSharesAdjustmentTxData> = {}
): OcfIssuerAuthorizedSharesAdjustmentTxData {
  return {
    id: generateTestId('issuer-adj'),
    date: generateDateString(),
    issuer_id: issuerId,
    new_shares_authorized: '50000000',
    board_approval_date: generateDateString(-7),
    comments: ['Integration test issuer authorized shares adjustment'],
    ...overrides,
  };
}

/**
 * Create default stock plan pool adjustment data for testing.
 *
 * @param stockPlanId - The stock plan being adjusted
 * @param overrides - Optional overrides for specific fields
 * @returns Complete OcfStockPlanPoolAdjustmentTxData for testing
 */
export function createTestStockPlanPoolAdjustmentData(
  stockPlanId: string,
  overrides: Partial<OcfStockPlanPoolAdjustmentTxData> = {}
): OcfStockPlanPoolAdjustmentTxData {
  return {
    id: generateTestId('pool-adj'),
    date: generateDateString(),
    stock_plan_id: stockPlanId,
    board_approval_date: generateDateString(-7),
    shares_reserved: '2000000',
    comments: ['Integration test stock plan pool adjustment'],
    ...overrides,
  };
}

/**
 * Create default stock cancellation data for testing.
 *
 * @param securityId - The security being cancelled
 * @param quantity - Amount to cancel
 * @param overrides - Optional overrides for specific fields
 * @returns Complete OcfStockCancellationTxData for testing
 */
export function createTestStockCancellationData(
  securityId: string,
  quantity: string | number,
  overrides: Partial<OcfStockCancellationTxData> = {}
): OcfStockCancellationTxData {
  return {
    id: generateTestId('cancellation'),
    date: generateDateString(),
    security_id: securityId,
    quantity,
    reason_text: 'Integration test cancellation',
    comments: ['Integration test stock cancellation'],
    ...overrides,
  };
}

/**
 * Create default equity compensation issuance data for testing.
 *
 * @param stakeholderId - The stakeholder receiving the equity compensation
 * @param overrides - Optional overrides for specific fields
 * @returns Complete OcfEquityCompensationIssuanceData for testing
 */
export function createTestEquityCompensationIssuanceData(
  stakeholderId: string,
  overrides: Partial<OcfEquityCompensationIssuanceData> = {}
): OcfEquityCompensationIssuanceData {
  const securityId = generateTestId('ec-security');
  return {
    id: generateTestId('ec-issuance'),
    date: generateDateString(),
    security_id: securityId,
    custom_id: `EC-${Date.now()}`,
    stakeholder_id: stakeholderId,
    compensation_type: 'OPTION_ISO',
    quantity: '10000',
    exercise_price: { amount: '1.00', currency: 'USD' },
    expiration_date: generateDateString(365 * 10), // 10 years from now
    comments: ['Integration test equity compensation issuance'],
    ...overrides,
  };
}

/**
 * Create default warrant issuance data for testing.
 *
 * @param stakeholderId - The stakeholder receiving the warrant
 * @param overrides - Optional overrides for specific fields
 * @returns Complete OcfWarrantIssuanceDataNative for testing
 */
export function createTestWarrantIssuanceData(
  stakeholderId: string,
  overrides: Partial<OcfWarrantIssuanceDataNative> = {}
): OcfWarrantIssuanceDataNative {
  const securityId = generateTestId('warrant-security');
  return {
    id: generateTestId('warrant'),
    date: generateDateString(),
    security_id: securityId,
    custom_id: `WR-${Date.now()}`,
    stakeholder_id: stakeholderId,
    quantity: '5000',
    exercise_price: { amount: '2.00', currency: 'USD' },
    purchase_price: { amount: '0.01', currency: 'USD' },
    exercise_triggers: [],
    security_law_exemptions: [{ description: 'Rule 506(b)', jurisdiction: 'US' }],
    comments: ['Integration test warrant issuance'],
    ...overrides,
  };
}

/**
 * Create default convertible issuance data for testing.
 *
 * @param stakeholderId - The stakeholder receiving the convertible
 * @param overrides - Optional overrides for specific fields
 * @returns Complete OcfConvertibleIssuanceDataNative for testing
 */
export function createTestConvertibleIssuanceData(
  stakeholderId: string,
  overrides: Partial<OcfConvertibleIssuanceDataNative> = {}
): OcfConvertibleIssuanceDataNative {
  const securityId = generateTestId('convertible-security');
  return {
    id: generateTestId('convertible'),
    date: generateDateString(),
    security_id: securityId,
    custom_id: `CV-${Date.now()}`,
    stakeholder_id: stakeholderId,
    investment_amount: { amount: '100000', currency: 'USD' },
    convertible_type: 'SAFE',
    conversion_triggers: [],
    seniority: 1,
    security_law_exemptions: [{ description: 'Rule 506(b)', jurisdiction: 'US' }],
    comments: ['Integration test convertible issuance'],
    ...overrides,
  };
}

/**
 * Get the FeaturedAppRight contract details from the validator API.
 *
 * Note: This requires a full Canton Network setup (not just basic LocalNet/cn-quickstart). The Validator API must be
 * running and have the FeaturedAppRight contract deployed.
 *
 * @returns The FeaturedAppRight disclosed contract
 * @throws Error if the Validator API is not available or FeaturedAppRight is not deployed
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

/**
 * Check if the Validator API is available for full integration tests.
 *
 * @returns True if Validator API is reachable, false otherwise
 */
export async function isValidatorApiAvailable(): Promise<boolean> {
  try {
    const validatorClient = new ValidatorApiClient({ network: 'localnet' });
    await getFeaturedAppRightContractDetails(validatorClient);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract a contract ID from a transaction tree response.
 *
 * Handles both response structures:
 *
 * - Response.transactionTree.eventsById (direct)
 * - Response.transactionTree.transaction.eventsById (nested)
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

/**
 * Setup a test stock class authorized shares adjustment.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestStockClassAuthorizedSharesAdjustmentSetup with the created adjustment
 */
export async function setupTestStockClassAuthorizedSharesAdjustment(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** The stock class ID to adjust */
    stockClassId: string;
    /** Optional adjustment data overrides */
    adjustmentData?: Partial<OcfStockClassAuthorizedSharesAdjustmentTxData>;
  }
): Promise<TestStockClassAuthorizedSharesAdjustmentSetup> {
  const adjustmentData = createTestStockClassAuthorizedSharesAdjustmentData(
    options.stockClassId,
    options.adjustmentData
  );

  const cmd =
    ocp.OpenCapTable.stockClassAuthorizedSharesAdjustment.buildCreateStockClassAuthorizedSharesAdjustmentCommand({
      issuerContractId: options.issuerContractId,
      issuerParty: options.issuerParty,
      adjustmentData,
      featuredAppRightContractDetails: options.featuredAppRightContractDetails,
    });

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: cmd.disclosedContracts,
  });

  // Extract adjustment contract ID
  const adjustmentContractId = extractContractIdFromResponse(result, 'StockClassAuthorizedSharesAdjustment');
  if (!adjustmentContractId) {
    throw new Error('Failed to extract stock class authorized shares adjustment contract ID from transaction result');
  }

  return {
    adjustmentContractId,
    adjustmentData,
  };
}

/**
 * Setup a test stock legend template under an existing issuer.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestStockLegendTemplateSetup with the created stock legend template
 */
export async function setupTestStockLegendTemplate(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** Optional stock legend template data overrides */
    stockLegendTemplateData?: Partial<OcfStockLegendTemplateData>;
  }
): Promise<TestStockLegendTemplateSetup> {
  const stockLegendTemplateData = createTestStockLegendTemplateData(options.stockLegendTemplateData);

  const cmd = ocp.OpenCapTable.stockLegendTemplate.buildCreateStockLegendTemplateCommand({
    issuerContractId: options.issuerContractId,
    issuerParty: options.issuerParty,
    templateData: stockLegendTemplateData,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
  });

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: cmd.disclosedContracts,
  });

  const stockLegendTemplateContractId = extractContractIdFromResponse(result, 'StockLegendTemplate');
  if (!stockLegendTemplateContractId) {
    throw new Error('Failed to extract stock legend template contract ID from transaction result');
  }

  return {
    stockLegendTemplateContractId,
    stockLegendTemplateData,
  };
}

/**
 * Setup a test vesting terms under an existing issuer.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestVestingTermsSetup with the created vesting terms
 */
export async function setupTestVestingTerms(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** Optional vesting terms data overrides */
    vestingTermsData?: Partial<OcfVestingTermsData>;
  }
): Promise<TestVestingTermsSetup> {
  const vestingTermsData = createTestVestingTermsData(options.vestingTermsData);

  const cmd = ocp.OpenCapTable.vestingTerms.buildCreateVestingTermsCommand({
    issuerContractId: options.issuerContractId,
    issuerParty: options.issuerParty,
    vestingTermsData,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
  });

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: cmd.disclosedContracts,
  });

  const vestingTermsContractId = extractContractIdFromResponse(result, 'VestingTerms');
  if (!vestingTermsContractId) {
    throw new Error('Failed to extract vesting terms contract ID from transaction result');
  }

  return {
    vestingTermsContractId,
    vestingTermsData,
  };
}

/**
 * Setup a test stock plan under an existing issuer.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestStockPlanSetup with the created stock plan
 */
export async function setupTestStockPlan(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** Stock class IDs for this plan */
    stockClassIds: string[];
    /** Optional stock plan data overrides */
    stockPlanData?: Partial<OcfStockPlanData>;
  }
): Promise<TestStockPlanSetup> {
  const stockPlanData = createTestStockPlanData(options.stockClassIds, options.stockPlanData);

  const cmd = ocp.OpenCapTable.stockPlan.buildCreateStockPlanCommand({
    issuerContractId: options.issuerContractId,
    issuerParty: options.issuerParty,
    planData: stockPlanData,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
  });

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: cmd.disclosedContracts,
  });

  const stockPlanContractId = extractContractIdFromResponse(result, 'StockPlan');
  if (!stockPlanContractId) {
    throw new Error('Failed to extract stock plan contract ID from transaction result');
  }

  return {
    stockPlanContractId,
    stockPlanData,
  };
}

/**
 * Setup a test document under an existing issuer.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestDocumentSetup with the created document
 */
export async function setupTestDocument(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** Optional document data overrides */
    documentData?: Partial<OcfDocumentData>;
  }
): Promise<TestDocumentSetup> {
  const documentData = createTestDocumentData(options.documentData);

  const cmd = ocp.OpenCapTable.document.buildCreateDocumentCommand({
    issuerContractId: options.issuerContractId,
    issuerParty: options.issuerParty,
    documentData,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
  });

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: cmd.disclosedContracts,
  });

  const documentContractId = extractContractIdFromResponse(result, 'Document');
  if (!documentContractId) {
    throw new Error('Failed to extract document contract ID from transaction result');
  }

  return {
    documentContractId,
    documentData,
  };
}

/**
 * Setup a test issuer authorized shares adjustment.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestIssuerAuthorizedSharesAdjustmentSetup with the created adjustment
 */
export async function setupTestIssuerAuthorizedSharesAdjustment(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** The issuer ID for the adjustment data */
    issuerId: string;
    /** Optional adjustment data overrides */
    adjustmentData?: Partial<OcfIssuerAuthorizedSharesAdjustmentTxData>;
  }
): Promise<TestIssuerAuthorizedSharesAdjustmentSetup> {
  const adjustmentData = createTestIssuerAuthorizedSharesAdjustmentData(options.issuerId, options.adjustmentData);

  const cmd = ocp.OpenCapTable.issuerAuthorizedSharesAdjustment.buildCreateIssuerAuthorizedSharesAdjustmentCommand({
    issuerContractId: options.issuerContractId,
    issuerParty: options.issuerParty,
    adjustmentData,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
  });

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: cmd.disclosedContracts,
  });

  const adjustmentContractId = extractContractIdFromResponse(result, 'IssuerAuthorizedSharesAdjustment');
  if (!adjustmentContractId) {
    throw new Error('Failed to extract issuer authorized shares adjustment contract ID from transaction result');
  }

  return {
    adjustmentContractId,
    adjustmentData,
  };
}

/**
 * Setup a test stock plan pool adjustment.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestStockPlanPoolAdjustmentSetup with the created adjustment
 */
export async function setupTestStockPlanPoolAdjustment(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** The stock plan ID being adjusted */
    stockPlanId: string;
    /** Optional adjustment data overrides */
    adjustmentData?: Partial<OcfStockPlanPoolAdjustmentTxData>;
  }
): Promise<TestStockPlanPoolAdjustmentSetup> {
  const adjustmentData = createTestStockPlanPoolAdjustmentData(options.stockPlanId, options.adjustmentData);

  const cmd = ocp.OpenCapTable.stockPlanPoolAdjustment.buildCreateStockPlanPoolAdjustmentCommand({
    issuerContractId: options.issuerContractId,
    issuerParty: options.issuerParty,
    adjustmentData,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
  });

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: cmd.disclosedContracts,
  });

  const adjustmentContractId = extractContractIdFromResponse(result, 'StockPlanPoolAdjustment');
  if (!adjustmentContractId) {
    throw new Error('Failed to extract stock plan pool adjustment contract ID from transaction result');
  }

  return {
    adjustmentContractId,
    adjustmentData,
  };
}

/**
 * Setup a test stock issuance.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestStockIssuanceSetup with the created stock issuance
 */
export async function setupTestStockIssuance(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** The stakeholder ID receiving the issuance */
    stakeholderId: string;
    /** The stock class ID for the issuance */
    stockClassId: string;
    /** Optional stock issuance data overrides */
    stockIssuanceData?: Partial<OcfStockIssuanceData>;
  }
): Promise<TestStockIssuanceSetup> {
  const stockIssuanceData = createTestStockIssuanceData(
    options.stakeholderId,
    options.stockClassId,
    options.stockIssuanceData
  );

  const cmd = ocp.OpenCapTable.stockIssuance.buildCreateStockIssuanceCommand({
    issuerContractId: options.issuerContractId,
    issuerParty: options.issuerParty,
    issuanceData: stockIssuanceData,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
  });

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: cmd.disclosedContracts,
  });

  const stockIssuanceContractId = extractContractIdFromResponse(result, 'StockIssuance');
  if (!stockIssuanceContractId) {
    throw new Error('Failed to extract stock issuance contract ID from transaction result');
  }

  return {
    stockIssuanceContractId,
    stockIssuanceData,
  };
}

/**
 * Setup a test stock transfer.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestStockTransferSetup with the created stock transfer
 */
export async function setupTestStockTransfer(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** The security ID being transferred */
    securityId: string;
    /** The quantity being transferred */
    quantity: string | number;
    /** Optional stock transfer data overrides */
    stockTransferData?: Partial<OcfStockTransferTxData>;
  }
): Promise<TestStockTransferSetup> {
  const stockTransferData = createTestStockTransferData(
    options.securityId,
    options.quantity,
    options.stockTransferData
  );

  const cmd = ocp.OpenCapTable.stockTransfer.buildCreateStockTransferCommand({
    issuerContractId: options.issuerContractId,
    issuerParty: options.issuerParty,
    transferData: stockTransferData,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
  });

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: cmd.disclosedContracts,
  });

  const stockTransferContractId = extractContractIdFromResponse(result, 'StockTransfer');
  if (!stockTransferContractId) {
    throw new Error('Failed to extract stock transfer contract ID from transaction result');
  }

  return {
    stockTransferContractId,
    stockTransferData,
  };
}

/**
 * Setup a test stock cancellation.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestStockCancellationSetup with the created stock cancellation
 */
export async function setupTestStockCancellation(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** The security ID being cancelled */
    securityId: string;
    /** The quantity being cancelled */
    quantity: string | number;
    /** Optional stock cancellation data overrides */
    stockCancellationData?: Partial<OcfStockCancellationTxData>;
  }
): Promise<TestStockCancellationSetup> {
  const stockCancellationData = createTestStockCancellationData(
    options.securityId,
    options.quantity,
    options.stockCancellationData
  );

  const cmd = ocp.OpenCapTable.stockCancellation.buildCreateStockCancellationCommand({
    issuerContractId: options.issuerContractId,
    issuerParty: options.issuerParty,
    cancellationData: stockCancellationData,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
  });

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: cmd.disclosedContracts,
  });

  const stockCancellationContractId = extractContractIdFromResponse(result, 'StockCancellation');
  if (!stockCancellationContractId) {
    throw new Error('Failed to extract stock cancellation contract ID from transaction result');
  }

  return {
    stockCancellationContractId,
    stockCancellationData,
  };
}

/**
 * Setup a test equity compensation issuance.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestEquityCompensationIssuanceSetup with the created equity compensation issuance
 */
export async function setupTestEquityCompensationIssuance(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** The stakeholder ID receiving the equity compensation */
    stakeholderId: string;
    /** Optional stock plan ID */
    stockPlanId?: string;
    /** Optional stock class ID */
    stockClassId?: string;
    /** Optional equity compensation issuance data overrides */
    equityCompensationIssuanceData?: Partial<OcfEquityCompensationIssuanceData>;
  }
): Promise<TestEquityCompensationIssuanceSetup> {
  const equityCompensationIssuanceData = createTestEquityCompensationIssuanceData(options.stakeholderId, {
    stock_plan_id: options.stockPlanId,
    stock_class_id: options.stockClassId,
    ...options.equityCompensationIssuanceData,
  });

  const cmd = ocp.OpenCapTable.equityCompensationIssuance.buildCreateEquityCompensationIssuanceCommand({
    issuerContractId: options.issuerContractId,
    issuerParty: options.issuerParty,
    issuanceData: equityCompensationIssuanceData,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
  });

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: cmd.disclosedContracts,
  });

  const equityCompensationIssuanceContractId = extractContractIdFromResponse(result, 'EquityCompensationIssuance');
  if (!equityCompensationIssuanceContractId) {
    throw new Error('Failed to extract equity compensation issuance contract ID from transaction result');
  }

  return {
    equityCompensationIssuanceContractId,
    equityCompensationIssuanceData,
  };
}

/**
 * Setup a test warrant issuance.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestWarrantIssuanceSetup with the created warrant issuance
 */
export async function setupTestWarrantIssuance(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** The stakeholder ID receiving the warrant */
    stakeholderId: string;
    /** Optional warrant issuance data overrides */
    warrantIssuanceData?: Partial<OcfWarrantIssuanceDataNative>;
  }
): Promise<TestWarrantIssuanceSetup> {
  const warrantIssuanceData = createTestWarrantIssuanceData(options.stakeholderId, options.warrantIssuanceData);

  const cmd = ocp.OpenCapTable.warrantIssuance.buildCreateWarrantIssuanceCommand({
    issuerContractId: options.issuerContractId,
    issuerParty: options.issuerParty,
    issuanceData: warrantIssuanceData,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
  });

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: cmd.disclosedContracts,
  });

  const warrantIssuanceContractId = extractContractIdFromResponse(result, 'WarrantIssuance');
  if (!warrantIssuanceContractId) {
    throw new Error('Failed to extract warrant issuance contract ID from transaction result');
  }

  return {
    warrantIssuanceContractId,
    warrantIssuanceData,
  };
}

/**
 * Setup a test convertible issuance.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestConvertibleIssuanceSetup with the created convertible issuance
 */
export async function setupTestConvertibleIssuance(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** The stakeholder ID receiving the convertible */
    stakeholderId: string;
    /** Optional convertible issuance data overrides */
    convertibleIssuanceData?: Partial<OcfConvertibleIssuanceDataNative>;
  }
): Promise<TestConvertibleIssuanceSetup> {
  const convertibleIssuanceData = createTestConvertibleIssuanceData(
    options.stakeholderId,
    options.convertibleIssuanceData
  );

  const cmd = ocp.OpenCapTable.convertibleIssuance.buildCreateConvertibleIssuanceCommand({
    issuerContractId: options.issuerContractId,
    issuerParty: options.issuerParty,
    issuanceData: convertibleIssuanceData,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
  });

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: cmd.disclosedContracts,
  });

  const convertibleIssuanceContractId = extractContractIdFromResponse(result, 'ConvertibleIssuance');
  if (!convertibleIssuanceContractId) {
    throw new Error('Failed to extract convertible issuance contract ID from transaction result');
  }

  return {
    convertibleIssuanceContractId,
    convertibleIssuanceData,
  };
}
