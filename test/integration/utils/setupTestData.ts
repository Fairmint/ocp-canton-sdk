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
import {
  buildCapTableCommand,
  buildCreateStakeholderCommand,
  buildCreateStockClassCommand,
  convertibleIssuanceDataToDaml,
  documentDataToDaml,
  equityCompensationIssuanceDataToDaml,
  issuerAuthorizedSharesAdjustmentDataToDaml,
  stockCancellationDataToDaml,
  stockClassAuthorizedSharesAdjustmentDataToDaml,
  stockIssuanceDataToDaml,
  stockLegendTemplateDataToDaml,
  stockPlanDataToDaml,
  stockPlanPoolAdjustmentDataToDaml,
  stockRepurchaseDataToDaml,
  stockTransferDataToDaml,
  vestingTermsDataToDaml,
  warrantIssuanceDataToDaml,
} from '../../../src/functions/OpenCapTable';
import type {
  OcfConvertibleIssuance,
  OcfDocument,
  OcfEquityCompensationIssuance,
  OcfIssuer,
  OcfIssuerAuthorizedSharesAdjustment,
  OcfStakeholder,
  OcfStockCancellation,
  OcfStockClass,
  OcfStockClassAuthorizedSharesAdjustment,
  OcfStockIssuance,
  OcfStockLegendTemplate,
  OcfStockPlan,
  OcfStockPlanPoolAdjustment,
  OcfStockRepurchase,
  OcfStockTransfer,
  OcfVestingTerms,
  OcfWarrantIssuance,
} from '../../../src/types/native';
import { authorizeIssuerWithFactory } from '../setup/contractDeployment';

/** Result from setting up a test issuer. */
export interface TestIssuerSetup {
  /** The contract ID of the created issuer */
  issuerContractId: string;
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
}

/** Result from setting up a test stock class. */
export interface TestStockClassSetup {
  /** The contract ID of the created stock class */
  stockClassContractId: string;
  /** The stock class data used to create it */
  stockClassData: OcfStockClass;
}

/** Result from setting up a test stock issuance. */
export interface TestStockIssuanceSetup {
  /** The contract ID of the created stock issuance */
  stockIssuanceContractId: string;
  /** The stock issuance data used to create it */
  stockIssuanceData: OcfStockIssuance;
}

/** Result from setting up a test stock class authorized shares adjustment. */
export interface TestStockClassAuthorizedSharesAdjustmentSetup {
  /** The contract ID of the created adjustment */
  adjustmentContractId: string;
  /** The adjustment data used to create it */
  adjustmentData: OcfStockClassAuthorizedSharesAdjustment;
}

/** Result from setting up a test stock legend template. */
export interface TestStockLegendTemplateSetup {
  /** The contract ID of the created stock legend template */
  stockLegendTemplateContractId: string;
  /** The stock legend template data used to create it */
  stockLegendTemplateData: OcfStockLegendTemplate;
}

/** Result from setting up a test vesting terms. */
export interface TestVestingTermsSetup {
  /** The contract ID of the created vesting terms */
  vestingTermsContractId: string;
  /** The vesting terms data used to create it */
  vestingTermsData: OcfVestingTerms;
}

/** Result from setting up a test stock plan. */
export interface TestStockPlanSetup {
  /** The contract ID of the created stock plan */
  stockPlanContractId: string;
  /** The stock plan data used to create it */
  stockPlanData: OcfStockPlan;
}

/** Result from setting up a test document. */
export interface TestDocumentSetup {
  /** The contract ID of the created document */
  documentContractId: string;
  /** The document data used to create it */
  documentData: OcfDocument;
}

/** Result from setting up a test issuer authorized shares adjustment. */
export interface TestIssuerAuthorizedSharesAdjustmentSetup {
  /** The contract ID of the created adjustment */
  adjustmentContractId: string;
  /** The adjustment data used to create it */
  adjustmentData: OcfIssuerAuthorizedSharesAdjustment;
}

/** Result from setting up a test stock plan pool adjustment. */
export interface TestStockPlanPoolAdjustmentSetup {
  /** The contract ID of the created adjustment */
  adjustmentContractId: string;
  /** The adjustment data used to create it */
  adjustmentData: OcfStockPlanPoolAdjustment;
}

/** Result from setting up a test stock cancellation. */
export interface TestStockCancellationSetup {
  /** The contract ID of the created stock cancellation */
  stockCancellationContractId: string;
  /** The stock cancellation data used to create it */
  stockCancellationData: OcfStockCancellation;
}

/** Result from setting up a test equity compensation issuance. */
export interface TestEquityCompensationIssuanceSetup {
  /** The contract ID of the created equity compensation issuance */
  equityCompensationIssuanceContractId: string;
  /** The equity compensation issuance data used to create it */
  equityCompensationIssuanceData: OcfEquityCompensationIssuance;
}

/** Result from setting up a test warrant issuance. */
export interface TestWarrantIssuanceSetup {
  /** The contract ID of the created warrant issuance */
  warrantIssuanceContractId: string;
  /** The warrant issuance data used to create it */
  warrantIssuanceData: OcfWarrantIssuance;
}

/** Result from setting up a test convertible issuance. */
export interface TestConvertibleIssuanceSetup {
  /** The contract ID of the created convertible issuance */
  convertibleIssuanceContractId: string;
  /** The convertible issuance data used to create it */
  convertibleIssuanceData: OcfConvertibleIssuance;
}

/** Result from setting up a test stock transfer. */
export interface TestStockTransferSetup {
  /** The contract ID of the created stock transfer */
  stockTransferContractId: string;
  /** The stock transfer data used to create it */
  stockTransferData: OcfStockTransfer;
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
 * @returns Complete OcfIssuer for testing
 */
export function createTestIssuerData(overrides: Partial<OcfIssuer> = {}): OcfIssuer {
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
 * @returns Complete OcfStakeholder for testing
 */
export function createTestStakeholderData(overrides: Partial<OcfStakeholder> = {}): OcfStakeholder {
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
 * @returns Complete OcfStockClass for testing
 */
export function createTestStockClassData(overrides: Partial<OcfStockClass> = {}): OcfStockClass {
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
 * @returns Complete OcfStockIssuance for testing
 */
export function createTestStockIssuanceData(
  stakeholderId: string,
  stockClassId: string,
  overrides: Partial<OcfStockIssuance> = {}
): OcfStockIssuance {
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
 * @returns Complete OcfStockTransfer for testing
 */
export function createTestStockTransferData(
  securityId: string,
  quantity: string | number,
  overrides: Partial<OcfStockTransfer> = {}
): OcfStockTransfer {
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
 * @returns Complete OcfStockClassAuthorizedSharesAdjustment for testing
 */
export function createTestStockClassAuthorizedSharesAdjustmentData(
  stockClassId: string,
  overrides: Partial<OcfStockClassAuthorizedSharesAdjustment> = {}
): OcfStockClassAuthorizedSharesAdjustment {
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
 * @returns Complete OcfStockLegendTemplate for testing
 */
export function createTestStockLegendTemplateData(
  overrides: Partial<OcfStockLegendTemplate> = {}
): OcfStockLegendTemplate {
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
 * @returns Complete OcfVestingTerms for testing
 */
export function createTestVestingTermsData(overrides: Partial<OcfVestingTerms> = {}): OcfVestingTerms {
  return {
    id: generateTestId('vesting'),
    name: '4 Year Standard Vesting',
    description: 'Standard 4 year vesting with 1 year cliff',
    allocation_type: 'CUMULATIVE_ROUNDING',
    // OCF schema requires exactly one of portion or quantity for each vesting condition
    // Even start triggers need quantity: "0" per OCF samples
    vesting_conditions: [
      {
        id: 'vesting-start',
        quantity: '0', // Required even for start trigger per OCF schema oneOf
        trigger: { type: 'VESTING_START_DATE' } as unknown as OcfVestingTerms['vesting_conditions'][0]['trigger'],
        next_condition_ids: ['cliff'],
      },
      {
        id: 'cliff',
        description: '25% payout at 1 year',
        portion: { numerator: '12', denominator: '48', remainder: false },
        trigger: {
          type: 'VESTING_SCHEDULE_RELATIVE',
          period: {
            type: 'MONTHS',
            length: 12,
            occurrences: 1,
            day_of_month: 'VESTING_START_DAY_OR_LAST_DAY_OF_MONTH',
          },
          relative_to_condition_id: 'vesting-start',
        } as unknown as OcfVestingTerms['vesting_conditions'][0]['trigger'],
        next_condition_ids: ['monthly-thereafter'],
      },
      {
        id: 'monthly-thereafter',
        description: '1/48th payout each month thereafter',
        portion: { numerator: '1', denominator: '48', remainder: true },
        trigger: {
          type: 'VESTING_SCHEDULE_RELATIVE',
          period: {
            type: 'MONTHS',
            length: 1,
            occurrences: 36,
            day_of_month: 'VESTING_START_DAY_OR_LAST_DAY_OF_MONTH',
          },
          relative_to_condition_id: 'cliff',
        } as unknown as OcfVestingTerms['vesting_conditions'][0]['trigger'],
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
 * @returns Complete OcfStockPlan for testing
 */
export function createTestStockPlanData(stockClassIds: string[], overrides: Partial<OcfStockPlan> = {}): OcfStockPlan {
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
 * @returns Complete OcfDocument for testing
 */
export function createTestDocumentData(overrides: Partial<OcfDocument> = {}): OcfDocument {
  // OCF schema requires exactly one of path or uri (oneOf)
  // If uri is provided in overrides, don't include default path
  const hasUri = 'uri' in overrides && overrides.uri;
  return {
    id: generateTestId('doc'),
    ...(hasUri ? {} : { path: 'documents/test-document.pdf' }),
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
 * @returns Complete OcfIssuerAuthorizedSharesAdjustment for testing
 */
export function createTestIssuerAuthorizedSharesAdjustmentData(
  issuerId: string,
  overrides: Partial<OcfIssuerAuthorizedSharesAdjustment> = {}
): OcfIssuerAuthorizedSharesAdjustment {
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
 * @returns Complete OcfStockPlanPoolAdjustment for testing
 */
export function createTestStockPlanPoolAdjustmentData(
  stockPlanId: string,
  overrides: Partial<OcfStockPlanPoolAdjustment> = {}
): OcfStockPlanPoolAdjustment {
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
 * @returns Complete OcfStockCancellation for testing
 */
export function createTestStockCancellationData(
  securityId: string,
  quantity: string | number,
  overrides: Partial<OcfStockCancellation> = {}
): OcfStockCancellation {
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
 * @returns Complete OcfEquityCompensationIssuance for testing
 */
export function createTestEquityCompensationIssuanceData(
  stakeholderId: string,
  overrides: Partial<OcfEquityCompensationIssuance> = {}
): OcfEquityCompensationIssuance {
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
 * @returns Complete OcfWarrantIssuance for testing
 */
export function createTestWarrantIssuanceData(
  stakeholderId: string,
  overrides: Partial<OcfWarrantIssuance> = {}
): OcfWarrantIssuance {
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
    // OCF schema allows empty exercise_triggers (no minItems: 1) - unlike convertible_triggers
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
 * @returns Complete OcfConvertibleIssuance for testing
 */
export function createTestConvertibleIssuanceData(
  stakeholderId: string,
  overrides: Partial<OcfConvertibleIssuance> = {}
): OcfConvertibleIssuance {
  const securityId = generateTestId('convertible-security');
  const triggerId = generateTestId('trigger');
  return {
    id: generateTestId('convertible'),
    date: generateDateString(),
    security_id: securityId,
    custom_id: `CV-${Date.now()}`,
    stakeholder_id: stakeholderId,
    investment_amount: { amount: '100000', currency: 'USD' },
    convertible_type: 'SAFE',
    // OCF schema requires minItems: 1 for conversion_triggers (ConvertibleIssuance.schema.json)
    // A convertible must define how/when it converts - empty triggers would be invalid
    conversion_triggers: [
      {
        type: 'ELECTIVE_AT_WILL',
        trigger_id: triggerId,
        nickname: 'Standard Conversion',
        trigger_description: 'Convert at holder election',
        conversion_right: {
          type: 'CONVERTIBLE_CONVERSION_RIGHT',
          conversion_mechanism: {
            type: 'SAFE_CONVERSION',
            conversion_mfn: false,
          },
          converts_to_future_round: true,
        },
      },
    ],
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
 * Get or create issuer authorization.
 *
 * If issuerAuthorizationContractDetails is provided in options, returns it directly. Otherwise, creates a new
 * authorization using either:
 *
 * - AuthorizeIssuerWithFactory (for LocalNet with factory)
 * - SDK's authorizeIssuer (for devnet/mainnet)
 */
async function getOrCreateIssuerAuthorization(
  ocp: OcpClient,
  options: {
    issuerParty: string;
    issuerAuthorizationContractDetails?: DisclosedContract;
    systemOperatorParty?: string;
    ocpFactoryContractId?: string;
  }
): Promise<DisclosedContract> {
  // If already provided, use it
  if (options.issuerAuthorizationContractDetails) {
    return options.issuerAuthorizationContractDetails;
  }

  // For LocalNet with factory, use the factory directly
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

  // For devnet/mainnet, use the SDK's built-in authorizeIssuer
  // which reads from the pre-generated factory contract ID JSON
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
    /** Pre-fetched featured app right (for reuse across tests) */
    featuredAppRightContractDetails: DisclosedContract;
    /** Optional issuer data overrides */
    issuerData?: Partial<OcfIssuer>;
    /** Pre-existing issuer authorization (if already authorized) */
    issuerAuthorizationContractDetails?: DisclosedContract;
    /** The system operator party (owner of the OcpFactory). Required for LocalNet when ocpFactoryContractId is provided. */
    systemOperatorParty?: string;
    /**
     * The OcpFactory contract ID. When provided (for LocalNet), uses authorizeIssuerWithFactory. When not provided (for
     * devnet/mainnet), uses SDK's built-in authorizeIssuer.
     */
    ocpFactoryContractId?: string;
  }
): Promise<TestIssuerSetup> {
  const { featuredAppRightContractDetails } = options;

  // Get or create issuer authorization
  const issuerAuthorizationContractDetails = await getOrCreateIssuerAuthorization(ocp, options);

  const issuerData = createTestIssuerData(options.issuerData);

  // Create the issuer using the underlying client for full response
  const createIssuerCmd = ocp.OpenCapTable.issuer.buildCreateIssuerCommand({
    issuerAuthorizationContractDetails,
    featuredAppRightContractDetails,
    issuerParty: options.issuerParty,
    issuerData,
  });

  // Filter out disclosed contracts with empty createdEventBlob
  // (empty blobs cause MISSING_FIELD errors, but signatories don't need disclosed contracts)
  const validDisclosedContracts = createIssuerCmd.disclosedContracts.filter(
    (dc) => dc.createdEventBlob && dc.createdEventBlob.length > 0
  );

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [createIssuerCmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: validDisclosedContracts,
  });

  // Extract the issuer contract ID from the result
  // Note: CreateCapTable creates a CapTable contract (which contains issuer_data)
  const issuerContractId = extractContractIdFromResponse(result, 'CapTable');
  if (!issuerContractId) {
    throw new Error('Failed to extract issuer contract ID from transaction result');
  }

  // Get the CapTable contract's createdEventBlob for use in disclosed contracts
  // This is needed when exercising choices on the CapTable
  const capTableEvents = await ocp.client.getEventsByContractId({ contractId: issuerContractId });
  if (!capTableEvents.created?.createdEvent) {
    throw new Error('Failed to get CapTable contract created event');
  }

  const capTableContractDetails: DisclosedContract = {
    templateId: capTableEvents.created.createdEvent.templateId,
    contractId: issuerContractId,
    createdEventBlob: capTableEvents.created.createdEvent.createdEventBlob,
    synchronizerId: featuredAppRightContractDetails.synchronizerId,
  };

  return {
    issuerContractId,
    issuerData,
    issuerAuthorizationContractDetails,
    featuredAppRightContractDetails,
    capTableContractDetails,
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
    /** The issuer contract ID (which is also the CapTable contract ID) */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** CapTable contract details (for disclosed contracts) - optional for backward compatibility */
    capTableContractDetails?: DisclosedContract;
    /** Optional stakeholder data overrides */
    stakeholderData?: Partial<OcfStakeholder>;
  }
): Promise<TestStakeholderSetup> {
  const stakeholderData = createTestStakeholderData(options.stakeholderData);

  const cmd = buildCreateStakeholderCommand({
    capTableContractId: options.issuerContractId,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
    capTableContractDetails: options.capTableContractDetails,
    stakeholderData,
  });

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
    /** The issuer contract ID (which is also the CapTable contract ID) */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** Optional stock class data overrides */
    stockClassData?: Partial<OcfStockClass>;
  }
): Promise<TestStockClassSetup> {
  const stockClassData = createTestStockClassData(options.stockClassData);

  const cmd = buildCreateStockClassCommand({
    capTableContractId: options.issuerContractId,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
    stockClassData,
  });

  const validDisclosedContracts = cmd.disclosedContracts.filter(
    (dc) => dc.createdEventBlob && dc.createdEventBlob.length > 0
  );

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: validDisclosedContracts,
  });

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
 * Setup a test stock issuance under an existing issuer.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestStockIssuanceSetup with the created stock issuance
 */
export async function setupTestStockIssuance(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID (which is also the CapTable contract ID) */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** The stakeholder receiving the shares */
    stakeholderId: string;
    /** The stock class being issued */
    stockClassId: string;
    /** Optional stock issuance data overrides */
    stockIssuanceData?: Partial<OcfStockIssuance>;
  }
): Promise<TestStockIssuanceSetup> {
  const stockIssuanceData = createTestStockIssuanceData(
    options.stakeholderId,
    options.stockClassId,
    options.stockIssuanceData
  );

  const cmd = buildCapTableCommand({
    capTableContractId: options.issuerContractId,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
    choice: 'CreateStockIssuance',
    choiceArgument: {
      issuance_data: stockIssuanceDataToDaml(stockIssuanceData),
    },
  });

  const validDisclosedContracts = cmd.disclosedContracts.filter(
    (dc) => dc.createdEventBlob && dc.createdEventBlob.length > 0
  );

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: validDisclosedContracts,
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
 * Setup a test stock transfer under an existing issuer.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestStockTransferSetup with the created stock transfer
 */
export async function setupTestStockTransfer(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID (which is also the CapTable contract ID) */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** The security being transferred */
    securityId: string;
    /** Amount to transfer */
    quantity: string | number;
    /** Optional stock transfer data overrides */
    stockTransferData?: Partial<OcfStockTransfer>;
  }
): Promise<TestStockTransferSetup> {
  const stockTransferData = createTestStockTransferData(
    options.securityId,
    options.quantity,
    options.stockTransferData
  );

  const cmd = buildCapTableCommand({
    capTableContractId: options.issuerContractId,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
    choice: 'CreateStockTransfer',
    choiceArgument: {
      transfer_data: stockTransferDataToDaml(stockTransferData),
    },
  });

  const validDisclosedContracts = cmd.disclosedContracts.filter(
    (dc) => dc.createdEventBlob && dc.createdEventBlob.length > 0
  );

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: validDisclosedContracts,
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
 * Setup a test stock class authorized shares adjustment.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestStockClassAuthorizedSharesAdjustmentSetup with the created adjustment
 */
export async function setupTestStockClassAuthorizedSharesAdjustment(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID (which is also the CapTable contract ID) */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** The stock class being adjusted */
    stockClassId: string;
    /** Optional adjustment data overrides */
    adjustmentData?: Partial<OcfStockClassAuthorizedSharesAdjustment>;
  }
): Promise<TestStockClassAuthorizedSharesAdjustmentSetup> {
  const adjustmentData = createTestStockClassAuthorizedSharesAdjustmentData(
    options.stockClassId,
    options.adjustmentData
  );

  const cmd = buildCapTableCommand({
    capTableContractId: options.issuerContractId,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
    choice: 'CreateStockClassAuthorizedSharesAdjustment',
    choiceArgument: {
      adjustment_data: stockClassAuthorizedSharesAdjustmentDataToDaml(adjustmentData),
    },
  });

  const validDisclosedContracts = cmd.disclosedContracts.filter(
    (dc) => dc.createdEventBlob && dc.createdEventBlob.length > 0
  );

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: validDisclosedContracts,
  });

  const adjustmentContractId = extractContractIdFromResponse(result, 'StockClassAuthorizedSharesAdjustment');
  if (!adjustmentContractId) {
    throw new Error('Failed to extract adjustment contract ID from transaction result');
  }

  return {
    adjustmentContractId,
    adjustmentData,
  };
}

/**
 * Create default stock repurchase data for testing.
 *
 * @param securityId - The security being repurchased
 * @param quantity - Amount to repurchase
 * @param overrides - Optional overrides for specific fields
 * @returns Complete OcfStockRepurchase for testing
 */
export function createTestStockRepurchaseData(
  securityId: string,
  quantity: string | number,
  overrides: Partial<OcfStockRepurchase> = {}
): OcfStockRepurchase {
  return {
    id: generateTestId('repurchase'),
    date: generateDateString(),
    security_id: securityId,
    quantity,
    price: { amount: '1.00', currency: 'USD' },
    comments: ['Integration test stock repurchase'],
    ...overrides,
  };
}

/**
 * Setup a test stock repurchase.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestStockRepurchaseSetup with the created repurchase
 */
export async function setupTestStockRepurchase(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID (which is also the CapTable contract ID) */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** The security being repurchased */
    securityId: string;
    /** Amount to repurchase */
    quantity: string | number;
    /** Optional stock repurchase data overrides */
    stockRepurchaseData?: Partial<OcfStockRepurchase>;
  }
): Promise<{ stockRepurchaseContractId: string; stockRepurchaseData: OcfStockRepurchase }> {
  const stockRepurchaseData = createTestStockRepurchaseData(
    options.securityId,
    options.quantity,
    options.stockRepurchaseData
  );

  const cmd = buildCapTableCommand({
    capTableContractId: options.issuerContractId,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
    choice: 'CreateStockRepurchase',
    choiceArgument: {
      repurchase_data: stockRepurchaseDataToDaml(stockRepurchaseData),
    },
  });

  const validDisclosedContracts = cmd.disclosedContracts.filter(
    (dc) => dc.createdEventBlob && dc.createdEventBlob.length > 0
  );

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: validDisclosedContracts,
  });

  const stockRepurchaseContractId = extractContractIdFromResponse(result, 'StockRepurchase');
  if (!stockRepurchaseContractId) {
    throw new Error('Failed to extract stock repurchase contract ID from transaction result');
  }

  return {
    stockRepurchaseContractId,
    stockRepurchaseData,
  };
}

/**
 * Setup a test stock cancellation.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestStockCancellationSetup with the created cancellation
 */
export async function setupTestStockCancellation(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID (which is also the CapTable contract ID) */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** The security being cancelled */
    securityId: string;
    /** Amount to cancel */
    quantity: string | number;
    /** Optional stock cancellation data overrides */
    stockCancellationData?: Partial<OcfStockCancellation>;
  }
): Promise<TestStockCancellationSetup> {
  const stockCancellationData = createTestStockCancellationData(
    options.securityId,
    options.quantity,
    options.stockCancellationData
  );

  const cmd = buildCapTableCommand({
    capTableContractId: options.issuerContractId,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
    choice: 'CreateStockCancellation',
    choiceArgument: {
      cancellation_data: stockCancellationDataToDaml(stockCancellationData),
    },
  });

  const validDisclosedContracts = cmd.disclosedContracts.filter(
    (dc) => dc.createdEventBlob && dc.createdEventBlob.length > 0
  );

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: validDisclosedContracts,
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
 * Setup a test document.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestDocumentSetup with the created document
 */
export async function setupTestDocument(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID (which is also the CapTable contract ID) */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** Optional document data overrides */
    documentData?: Partial<OcfDocument>;
  }
): Promise<TestDocumentSetup> {
  const documentData = createTestDocumentData(options.documentData);

  const cmd = buildCapTableCommand({
    capTableContractId: options.issuerContractId,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
    choice: 'CreateDocument',
    choiceArgument: {
      document_data: documentDataToDaml(documentData),
    },
  });

  const validDisclosedContracts = cmd.disclosedContracts.filter(
    (dc) => dc.createdEventBlob && dc.createdEventBlob.length > 0
  );

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: validDisclosedContracts,
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
 * Setup a test stock legend template.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestStockLegendTemplateSetup with the created template
 */
export async function setupTestStockLegendTemplate(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID (which is also the CapTable contract ID) */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** Optional stock legend template data overrides */
    stockLegendTemplateData?: Partial<OcfStockLegendTemplate>;
  }
): Promise<TestStockLegendTemplateSetup> {
  const stockLegendTemplateData = createTestStockLegendTemplateData(options.stockLegendTemplateData);

  const cmd = buildCapTableCommand({
    capTableContractId: options.issuerContractId,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
    choice: 'CreateStockLegendTemplate',
    choiceArgument: {
      legend_template_data: stockLegendTemplateDataToDaml(stockLegendTemplateData),
    },
  });

  const validDisclosedContracts = cmd.disclosedContracts.filter(
    (dc) => dc.createdEventBlob && dc.createdEventBlob.length > 0
  );

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: validDisclosedContracts,
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
 * Setup test vesting terms.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestVestingTermsSetup with the created vesting terms
 */
export async function setupTestVestingTerms(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID (which is also the CapTable contract ID) */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** Optional vesting terms data overrides */
    vestingTermsData?: Partial<OcfVestingTerms>;
  }
): Promise<TestVestingTermsSetup> {
  const vestingTermsData = createTestVestingTermsData(options.vestingTermsData);

  const cmd = buildCapTableCommand({
    capTableContractId: options.issuerContractId,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
    choice: 'CreateVestingTerms',
    choiceArgument: {
      vesting_terms_data: vestingTermsDataToDaml(vestingTermsData),
    },
  });

  const validDisclosedContracts = cmd.disclosedContracts.filter(
    (dc) => dc.createdEventBlob && dc.createdEventBlob.length > 0
  );

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: validDisclosedContracts,
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
 * Setup a test stock plan.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestStockPlanSetup with the created stock plan
 */
export async function setupTestStockPlan(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID (which is also the CapTable contract ID) */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** The stock class IDs associated with this plan */
    stockClassIds: string[];
    /** Optional stock plan data overrides */
    stockPlanData?: Partial<OcfStockPlan>;
  }
): Promise<TestStockPlanSetup> {
  const stockPlanData = createTestStockPlanData(options.stockClassIds, options.stockPlanData);

  const cmd = buildCapTableCommand({
    capTableContractId: options.issuerContractId,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
    choice: 'CreateStockPlan',
    choiceArgument: {
      stock_plan_data: stockPlanDataToDaml(stockPlanData),
    },
  });

  const validDisclosedContracts = cmd.disclosedContracts.filter(
    (dc) => dc.createdEventBlob && dc.createdEventBlob.length > 0
  );

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: validDisclosedContracts,
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
 * Setup a test issuer authorized shares adjustment.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestIssuerAuthorizedSharesAdjustmentSetup with the created adjustment
 */
export async function setupTestIssuerAuthorizedSharesAdjustment(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID (which is also the CapTable contract ID) */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** The issuer ID being adjusted */
    issuerId: string;
    /** Optional adjustment data overrides */
    adjustmentData?: Partial<OcfIssuerAuthorizedSharesAdjustment>;
  }
): Promise<TestIssuerAuthorizedSharesAdjustmentSetup> {
  const adjustmentData = createTestIssuerAuthorizedSharesAdjustmentData(options.issuerId, options.adjustmentData);

  const cmd = buildCapTableCommand({
    capTableContractId: options.issuerContractId,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
    choice: 'CreateIssuerAuthorizedSharesAdjustment',
    choiceArgument: {
      adjustment_data: issuerAuthorizedSharesAdjustmentDataToDaml(adjustmentData),
    },
  });

  const validDisclosedContracts = cmd.disclosedContracts.filter(
    (dc) => dc.createdEventBlob && dc.createdEventBlob.length > 0
  );

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: validDisclosedContracts,
  });

  const adjustmentContractId = extractContractIdFromResponse(result, 'IssuerAuthorizedSharesAdjustment');
  if (!adjustmentContractId) {
    throw new Error('Failed to extract adjustment contract ID from transaction result');
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
    /** The issuer contract ID (which is also the CapTable contract ID) */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** The stock plan ID being adjusted */
    stockPlanId: string;
    /** Optional adjustment data overrides */
    adjustmentData?: Partial<OcfStockPlanPoolAdjustment>;
  }
): Promise<TestStockPlanPoolAdjustmentSetup> {
  const adjustmentData = createTestStockPlanPoolAdjustmentData(options.stockPlanId, options.adjustmentData);

  const cmd = buildCapTableCommand({
    capTableContractId: options.issuerContractId,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
    choice: 'CreateStockPlanPoolAdjustment',
    choiceArgument: {
      adjustment_data: stockPlanPoolAdjustmentDataToDaml(adjustmentData),
    },
  });

  const validDisclosedContracts = cmd.disclosedContracts.filter(
    (dc) => dc.createdEventBlob && dc.createdEventBlob.length > 0
  );

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: validDisclosedContracts,
  });

  const adjustmentContractId = extractContractIdFromResponse(result, 'StockPlanPoolAdjustment');
  if (!adjustmentContractId) {
    throw new Error('Failed to extract adjustment contract ID from transaction result');
  }

  return {
    adjustmentContractId,
    adjustmentData,
  };
}

/**
 * Setup a test convertible issuance.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestConvertibleIssuanceSetup with the created issuance
 */
export async function setupTestConvertibleIssuance(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID (which is also the CapTable contract ID) */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** The stakeholder receiving the convertible */
    stakeholderId: string;
    /** Optional convertible issuance data overrides */
    convertibleIssuanceData?: Partial<OcfConvertibleIssuance>;
  }
): Promise<TestConvertibleIssuanceSetup> {
  const convertibleIssuanceData = createTestConvertibleIssuanceData(
    options.stakeholderId,
    options.convertibleIssuanceData
  );

  const cmd = buildCapTableCommand({
    capTableContractId: options.issuerContractId,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
    choice: 'CreateConvertibleIssuance',
    choiceArgument: {
      // Type assertion needed because OcfConvertibleIssuance has a broader type for conversion_triggers
      // than what the DAML converter expects. The test data generator creates valid data.
      issuance_data: convertibleIssuanceDataToDaml(
        convertibleIssuanceData as unknown as Parameters<typeof convertibleIssuanceDataToDaml>[0]
      ),
    },
  });

  const validDisclosedContracts = cmd.disclosedContracts.filter(
    (dc) => dc.createdEventBlob && dc.createdEventBlob.length > 0
  );

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: validDisclosedContracts,
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

/**
 * Setup a test warrant issuance.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestWarrantIssuanceSetup with the created issuance
 */
export async function setupTestWarrantIssuance(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID (which is also the CapTable contract ID) */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** The stakeholder receiving the warrant */
    stakeholderId: string;
    /** Optional warrant issuance data overrides */
    warrantIssuanceData?: Partial<OcfWarrantIssuance>;
  }
): Promise<TestWarrantIssuanceSetup> {
  const warrantIssuanceData = createTestWarrantIssuanceData(options.stakeholderId, options.warrantIssuanceData);

  const cmd = buildCapTableCommand({
    capTableContractId: options.issuerContractId,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
    choice: 'CreateWarrantIssuance',
    choiceArgument: {
      // Type assertion needed because OcfWarrantIssuance has a broader type for exercise_triggers
      // than what the DAML converter expects. The test data generator creates valid data.
      issuance_data: warrantIssuanceDataToDaml(
        warrantIssuanceData as unknown as Parameters<typeof warrantIssuanceDataToDaml>[0]
      ),
    },
  });

  const validDisclosedContracts = cmd.disclosedContracts.filter(
    (dc) => dc.createdEventBlob && dc.createdEventBlob.length > 0
  );

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: validDisclosedContracts,
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
 * Setup a test equity compensation issuance.
 *
 * @param ocp - The OcpClient instance
 * @param options - Setup options
 * @returns TestEquityCompensationIssuanceSetup with the created issuance
 */
export async function setupTestEquityCompensationIssuance(
  ocp: OcpClient,
  options: {
    /** The issuer contract ID (which is also the CapTable contract ID) */
    issuerContractId: string;
    /** The issuer party ID */
    issuerParty: string;
    /** Featured app right contract details */
    featuredAppRightContractDetails: DisclosedContract;
    /** The stakeholder receiving the equity compensation */
    stakeholderId: string;
    /** Optional stock plan ID (for plan-based equity compensation) */
    stockPlanId?: string;
    /** Optional stock class ID (for stock class-based equity compensation) */
    stockClassId?: string;
    /** Optional equity compensation issuance data overrides */
    equityCompensationIssuanceData?: Partial<OcfEquityCompensationIssuance>;
  }
): Promise<TestEquityCompensationIssuanceSetup> {
  const equityCompensationIssuanceData = createTestEquityCompensationIssuanceData(options.stakeholderId, {
    stock_plan_id: options.stockPlanId,
    stock_class_id: options.stockClassId,
    ...options.equityCompensationIssuanceData,
  });

  const cmd = buildCapTableCommand({
    capTableContractId: options.issuerContractId,
    featuredAppRightContractDetails: options.featuredAppRightContractDetails,
    choice: 'CreateEquityCompensationIssuance',
    choiceArgument: {
      issuance_data: equityCompensationIssuanceDataToDaml(equityCompensationIssuanceData),
    },
  });

  const validDisclosedContracts = cmd.disclosedContracts.filter(
    (dc) => dc.createdEventBlob && dc.createdEventBlob.length > 0
  );

  const result = await ocp.client.submitAndWaitForTransactionTree({
    commands: [cmd.command],
    actAs: [options.issuerParty],
    disclosedContracts: validDisclosedContracts,
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
