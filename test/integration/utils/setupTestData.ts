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
  OcfConvertibleConversion,
  OcfConvertibleRetraction,
  OcfDocument,
  OcfEquityCompensationIssuance,
  OcfEquityCompensationRelease,
  OcfEquityCompensationRepricing,
  OcfEquityCompensationRetraction,
  OcfIssuer,
  OcfStakeholder,
  OcfStakeholderRelationshipChangeEvent,
  OcfStakeholderStatusChangeEvent,
  OcfStockClass,
  OcfStockConversion,
  OcfStockIssuance,
  OcfStockLegendTemplate,
  OcfStockPlan,
  OcfStockPlanReturnToPool,
  OcfStockRetraction,
  OcfValuation,
  OcfVestingTerms,
  OcfWarrantExercise,
  OcfWarrantRetraction,
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
    path: `/documents/${id}.pdf`, // Default path (required: document must have path or uri)
    ...overrides,
  };
}

/** Create test valuation data with optional overrides. */
export function createTestValuationData(overrides: Partial<OcfValuation> & { stock_class_id: string }): OcfValuation {
  const id = overrides.id ?? generateTestId('valuation');
  const { stock_class_id, ...rest } = overrides;
  return {
    id,
    stock_class_id,
    effective_date: generateDateString(-30),
    valuation_type: '409A',
    price_per_share: { amount: '1.50', currency: 'USD' },
    provider: 'Test Valuation Provider',
    board_approval_date: generateDateString(-35),
    ...rest,
  };
}

/** Create test vesting terms data with optional overrides. */
export function createTestVestingTermsData(overrides: Partial<OcfVestingTerms> = {}): OcfVestingTerms {
  const id = overrides.id ?? generateTestId('vesting-terms');
  // Note: The vesting trigger format uses 'type' (e.g., 'VESTING_START_DATE') for actual OCF JSON format,
  // which is what the SDK's vestingTriggerToDaml function expects. The TypeScript VestingTrigger type
  // uses 'kind' which is a simplified version. We cast here to satisfy TypeScript while using the
  // correct runtime format.
  return {
    id,
    name: overrides.name ?? `Vesting Terms ${id}`,
    description: overrides.description ?? '4-year vesting with 1-year cliff',
    allocation_type: overrides.allocation_type ?? 'CUMULATIVE_ROUNDING',
    vesting_conditions:
      overrides.vesting_conditions ??
      ([
        {
          id: 'vesting-start',
          description: 'Vesting start condition',
          quantity: '0',
          trigger: { type: 'VESTING_START_DATE' },
          next_condition_ids: ['cliff'],
        },
        {
          id: 'cliff',
          description: '1-year cliff (25%)',
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
          },
          next_condition_ids: ['monthly'],
        },
        {
          id: 'monthly',
          description: 'Monthly vesting (1/48 each month)',
          portion: { numerator: '1', denominator: '48', remainder: false },
          trigger: {
            type: 'VESTING_SCHEDULE_RELATIVE',
            period: {
              type: 'MONTHS',
              length: 1,
              occurrences: 36,
              day_of_month: 'VESTING_START_DAY_OR_LAST_DAY_OF_MONTH',
            },
            relative_to_condition_id: 'cliff',
          },
          next_condition_ids: [],
        },
      ] as unknown as OcfVestingTerms['vesting_conditions']),
    ...overrides,
  };
}

/** Create test stock plan data with optional overrides. */
export function createTestStockPlanData(
  overrides: Partial<OcfStockPlan> & { stock_class_ids: string[] }
): OcfStockPlan {
  const id = overrides.id ?? generateTestId('stock-plan');
  const { stock_class_ids, ...rest } = overrides;
  return {
    id,
    plan_name: `Stock Plan ${id}`,
    initial_shares_reserved: '1000000',
    stock_class_ids,
    default_cancellation_behavior: 'RETURN_TO_POOL',
    board_approval_date: generateDateString(-90),
    ...rest,
  };
}

/** Create test stock issuance data with optional overrides. */
export function createTestStockIssuanceData(
  overrides: Partial<OcfStockIssuance> & {
    stakeholder_id: string;
    stock_class_id: string;
  }
): OcfStockIssuance {
  const id = overrides.id ?? generateTestId('stock-issuance');
  const securityId = overrides.security_id ?? generateTestId('security');
  const { stakeholder_id, stock_class_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id: securityId,
    custom_id: `CS-${securityId.substring(0, 8)}`,
    stakeholder_id,
    stock_class_id,
    quantity: '10000',
    share_price: { amount: '1.00', currency: 'USD' },
    ...rest,
  };
}

/** Create test equity compensation issuance data with optional overrides. */
export function createTestEquityCompensationIssuanceData(
  overrides: Partial<OcfEquityCompensationIssuance> & {
    stakeholder_id: string;
    stock_plan_id?: string;
    stock_class_id?: string;
  }
): OcfEquityCompensationIssuance {
  const id = overrides.id ?? generateTestId('equity-comp-issuance');
  const securityId = overrides.security_id ?? generateTestId('eq-security');
  const { stakeholder_id, stock_plan_id, stock_class_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id: securityId,
    custom_id: `OPT-${securityId.substring(0, 8)}`,
    stakeholder_id,
    stock_plan_id,
    stock_class_id,
    compensation_type: 'OPTION_ISO',
    quantity: '50000',
    exercise_price: { amount: '0.50', currency: 'USD' },
    expiration_date: generateDateString(365 * 10), // 10 years
    ...rest,
  };
}

// ===== Exercise & Conversion Type Test Data Factories =====

/** Create test warrant exercise data with optional overrides. */
export function createTestWarrantExerciseData(
  overrides: Partial<OcfWarrantExercise> & {
    security_id: string;
    resulting_security_ids: string[];
  }
): OcfWarrantExercise {
  const id = overrides.id ?? generateTestId('warrant-exercise');
  const { security_id, resulting_security_ids, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    quantity: '1000',
    resulting_security_ids,
    ...rest,
  };
}

/** Create test convertible conversion data with optional overrides. */
export function createTestConvertibleConversionData(
  overrides: Partial<OcfConvertibleConversion> & {
    security_id: string;
    resulting_security_ids: string[];
  }
): OcfConvertibleConversion {
  const id = overrides.id ?? generateTestId('convertible-conversion');
  const { security_id, resulting_security_ids, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    resulting_security_ids,
    ...rest,
  };
}

/** Create test stock conversion data with optional overrides. */
export function createTestStockConversionData(
  overrides: Partial<OcfStockConversion> & {
    security_id: string;
    resulting_security_ids: string[];
  }
): OcfStockConversion {
  const id = overrides.id ?? generateTestId('stock-conversion');
  const { security_id, resulting_security_ids, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    quantity: '1000',
    resulting_security_ids,
    ...rest,
  };
}

// ===== Remaining OCF Type Test Data Factories =====

/** Create test stock retraction data with optional overrides. */
export function createTestStockRetractionData(
  overrides: Partial<OcfStockRetraction> & { security_id: string }
): OcfStockRetraction {
  const id = overrides.id ?? generateTestId('stock-retraction');
  const { security_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    reason_text: 'Issued in error',
    ...rest,
  };
}

/** Create test warrant retraction data with optional overrides. */
export function createTestWarrantRetractionData(
  overrides: Partial<OcfWarrantRetraction> & { security_id: string }
): OcfWarrantRetraction {
  const id = overrides.id ?? generateTestId('warrant-retraction');
  const { security_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    reason_text: 'Warrant voided',
    ...rest,
  };
}

/** Create test convertible retraction data with optional overrides. */
export function createTestConvertibleRetractionData(
  overrides: Partial<OcfConvertibleRetraction> & { security_id: string }
): OcfConvertibleRetraction {
  const id = overrides.id ?? generateTestId('convertible-retraction');
  const { security_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    reason_text: 'Terms renegotiated',
    ...rest,
  };
}

/** Create test equity compensation retraction data with optional overrides. */
export function createTestEquityCompensationRetractionData(
  overrides: Partial<OcfEquityCompensationRetraction> & { security_id: string }
): OcfEquityCompensationRetraction {
  const id = overrides.id ?? generateTestId('equity-comp-retraction');
  const { security_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    reason_text: 'Grant voided due to termination',
    ...rest,
  };
}

/** Create test equity compensation release data with optional overrides. */
export function createTestEquityCompensationReleaseData(
  overrides: Partial<OcfEquityCompensationRelease> & { security_id: string }
): OcfEquityCompensationRelease {
  const id = overrides.id ?? generateTestId('equity-comp-release');
  const { security_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    quantity: '1000',
    resulting_security_ids: [generateTestId('resulting-security')],
    ...rest,
  };
}

/** Create test equity compensation repricing data with optional overrides. */
export function createTestEquityCompensationRepricingData(
  overrides: Partial<OcfEquityCompensationRepricing> & { security_id: string }
): OcfEquityCompensationRepricing {
  const id = overrides.id ?? generateTestId('equity-comp-repricing');
  const { security_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    resulting_security_ids: [generateTestId('repriced-security')],
    ...rest,
  };
}

/** Create test stock plan return to pool data with optional overrides. */
export function createTestStockPlanReturnToPoolData(
  overrides: Partial<OcfStockPlanReturnToPool> & { stock_plan_id: string }
): OcfStockPlanReturnToPool {
  const id = overrides.id ?? generateTestId('stock-plan-return');
  const { stock_plan_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    stock_plan_id,
    quantity: '5000',
    reason_text: 'Employee termination - unvested shares returned',
    ...rest,
  };
}

/** Create test stakeholder relationship change event data with optional overrides. */
export function createTestStakeholderRelationshipChangeData(
  overrides: Partial<OcfStakeholderRelationshipChangeEvent> & { stakeholder_id: string }
): OcfStakeholderRelationshipChangeEvent {
  const id = overrides.id ?? generateTestId('relationship-change');
  const { stakeholder_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    stakeholder_id,
    new_relationships: ['EMPLOYEE'],
    ...rest,
  };
}

/** Create test stakeholder status change event data with optional overrides. */
export function createTestStakeholderStatusChangeData(
  overrides: Partial<OcfStakeholderStatusChangeEvent> & { stakeholder_id: string }
): OcfStakeholderStatusChangeEvent {
  const id = overrides.id ?? generateTestId('status-change');
  const { stakeholder_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    stakeholder_id,
    new_status: 'ACTIVE',
    ...rest,
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
