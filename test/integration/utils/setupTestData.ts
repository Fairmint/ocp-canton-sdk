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
  OcfConvertibleIssuance,
  OcfConvertibleRetraction,
  OcfConvertibleTransfer,
  OcfDocument,
  OcfEquityCompensationIssuance,
  OcfEquityCompensationRelease,
  OcfEquityCompensationRepricing,
  OcfEquityCompensationRetraction,
  OcfEquityCompensationTransfer,
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
  OcfStockTransfer,
  OcfValuation,
  OcfVestingAcceleration,
  OcfVestingEvent,
  OcfVestingStart,
  OcfVestingTerms,
  OcfWarrantExercise,
  OcfWarrantIssuance,
  OcfWarrantRetraction,
  OcfWarrantTransfer,
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

/** Create test vesting start data with optional overrides. */
export function createTestVestingStartData(
  overrides: Partial<OcfVestingStart> & { security_id: string; vesting_condition_id: string }
): OcfVestingStart {
  const id = overrides.id ?? generateTestId('vesting-start');
  const { security_id, vesting_condition_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    vesting_condition_id,
    ...rest,
  };
}

/** Create test vesting event data with optional overrides. */
export function createTestVestingEventData(
  overrides: Partial<OcfVestingEvent> & { security_id: string; vesting_condition_id: string }
): OcfVestingEvent {
  const id = overrides.id ?? generateTestId('vesting-event');
  const { security_id, vesting_condition_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    vesting_condition_id,
    ...rest,
  };
}

/** Create test vesting acceleration data with optional overrides. */
export function createTestVestingAccelerationData(
  overrides: Partial<OcfVestingAcceleration> & { security_id: string }
): OcfVestingAcceleration {
  const id = overrides.id ?? generateTestId('vesting-acceleration');
  const { security_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    quantity: '10000',
    reason_text: 'Company acquisition - single-trigger acceleration',
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
  const { security_id, resulting_security_ids, trigger_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    trigger_id: trigger_id ?? generateTestId('trigger'),
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

  const authResult = await ocp.OpenCapTable.issuerAuthorization.authorize({
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
    capTableContractDetails?: DisclosedContract;
    issuerData?: Partial<OcfIssuer>;
    issuerAuthorizationContractDetails?: DisclosedContract;
    systemOperatorParty?: string;
    ocpFactoryContractId?: string;
  }
): Promise<TestIssuerSetup> {
  const issuerAuthorizationContractDetails = await getOrCreateIssuerAuthorization(ocp, options);
  const issuerData = createTestIssuerData(options.issuerData);

  const createIssuerCmd = ocp.OpenCapTable.issuer.buildCreate({
    issuerAuthorizationContractDetails,
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
    capTableContractDetails,
  };
}

/** Setup a test stakeholder under an existing issuer using the batch API. */
export async function setupTestStakeholder(
  ocp: OcpClient,
  options: {
    issuerContractId: string;
    issuerParty: string;
    capTableContractDetails?: DisclosedContract;
    stakeholderData?: Partial<OcfStakeholder>;
  }
): Promise<TestStakeholderSetup> {
  const stakeholderData = createTestStakeholderData(options.stakeholderData);

  const cmd = buildUpdateCapTableCommand(
    {
      capTableContractId: options.issuerContractId,
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

// ===== Transfer Type Test Data Factories =====

/** Create test stock transfer data with optional overrides. */
export function createTestStockTransferData(
  overrides: Partial<OcfStockTransfer> & { security_id: string }
): OcfStockTransfer {
  const id = overrides.id ?? generateTestId('stock-transfer');
  const { security_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    quantity: rest.quantity ?? '1000',
    resulting_security_ids: rest.resulting_security_ids ?? [generateTestId('result-security')],
    ...rest,
  };
}

/** Create test convertible transfer data with optional overrides. */
export function createTestConvertibleTransferData(
  overrides: Partial<OcfConvertibleTransfer> & { security_id: string }
): OcfConvertibleTransfer {
  const id = overrides.id ?? generateTestId('convertible-transfer');
  const { security_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    amount: rest.amount ?? { amount: '50000', currency: 'USD' },
    resulting_security_ids: rest.resulting_security_ids ?? [generateTestId('result-security')],
    ...rest,
  };
}

/** Create test equity compensation transfer data with optional overrides. */
export function createTestEquityCompensationTransferData(
  overrides: Partial<OcfEquityCompensationTransfer> & { security_id: string }
): OcfEquityCompensationTransfer {
  const id = overrides.id ?? generateTestId('equity-comp-transfer');
  const { security_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    quantity: rest.quantity ?? '5000',
    resulting_security_ids: rest.resulting_security_ids ?? [generateTestId('result-security')],
    ...rest,
  };
}

/** Create test warrant transfer data with optional overrides. */
export function createTestWarrantTransferData(
  overrides: Partial<OcfWarrantTransfer> & { security_id: string }
): OcfWarrantTransfer {
  const id = overrides.id ?? generateTestId('warrant-transfer');
  const { security_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    quantity: rest.quantity ?? '2500',
    resulting_security_ids: rest.resulting_security_ids ?? [generateTestId('result-security')],
    ...rest,
  };
}

// ===== Security Setup Helpers =====
// These helpers create the full prerequisite chain needed before creating transactions
// that reference a security_id (e.g., StockCancellation needs a StockIssuance to exist first)

/** Result from setting up a stock security. */
export interface StockSecuritySetup {
  /** The security_id that can be used in subsequent stock transactions */
  securityId: string;
  /** The contract ID of the created StockIssuance */
  stockIssuanceContractId: string;
  /** The stakeholder_id used for the issuance */
  stakeholderId: string;
  /** The stock_class_id used for the issuance */
  stockClassId: string;
  /** The updated CapTable contract ID (for subsequent batch operations) */
  capTableContractId: string;
}

/** Result from setting up a warrant security. */
export interface WarrantSecuritySetup {
  /** The security_id that can be used in subsequent warrant transactions */
  securityId: string;
  /** The contract ID of the created WarrantIssuance */
  warrantIssuanceContractId: string;
  /** The stakeholder_id used for the issuance */
  stakeholderId: string;
  /** The updated CapTable contract ID (for subsequent batch operations) */
  capTableContractId: string;
}

/** Result from setting up an equity compensation security. */
export interface EquityCompensationSecuritySetup {
  /** The security_id that can be used in subsequent equity compensation transactions */
  securityId: string;
  /** The contract ID of the created EquityCompensationIssuance */
  equityCompensationIssuanceContractId: string;
  /** The stakeholder_id used for the issuance */
  stakeholderId: string;
  /** The stock_class_id used (equity comp can reference a stock class directly) */
  stockClassId: string;
  /** The updated CapTable contract ID (for subsequent batch operations) */
  capTableContractId: string;
}

/** Result from setting up a convertible security. */
export interface ConvertibleSecuritySetup {
  /** The security_id that can be used in subsequent convertible transactions */
  securityId: string;
  /** The contract ID of the created ConvertibleIssuance */
  convertibleIssuanceContractId: string;
  /** The stakeholder_id used for the issuance */
  stakeholderId: string;
  /** The updated CapTable contract ID (for subsequent batch operations) */
  capTableContractId: string;
}

/** Create test warrant issuance data with optional overrides. */
export function createTestWarrantIssuanceData(
  overrides: Partial<OcfWarrantIssuance> & { stakeholder_id: string }
): OcfWarrantIssuance {
  const id = overrides.id ?? generateTestId('warrant-issuance');
  const securityId = overrides.security_id ?? generateTestId('warrant-security');
  const { stakeholder_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id: securityId,
    custom_id: `W-${securityId.substring(0, 8)}`,
    stakeholder_id,
    quantity: '10000',
    purchase_price: { amount: '1000', currency: 'USD' },
    warrant_expiration_date: generateDateString(365 * 5), // 5 years from now
    exercise_triggers: [],
    security_law_exemptions: [],
    ...rest,
  };
}

/** Create test convertible issuance data with optional overrides. */
export function createTestConvertibleIssuanceData(
  overrides: Partial<OcfConvertibleIssuance> & { stakeholder_id: string }
): OcfConvertibleIssuance {
  const id = overrides.id ?? generateTestId('convertible-issuance');
  const securityId = overrides.security_id ?? generateTestId('convertible-security');
  const { stakeholder_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id: securityId,
    custom_id: `CONV-${securityId.substring(0, 8)}`,
    stakeholder_id,
    investment_amount: { amount: '100000', currency: 'USD' },
    convertible_type: 'NOTE',
    security_law_exemptions: [],
    // V30 DAML requires at least one conversion trigger (not null d.conversion_triggers)
    conversion_triggers: [
      {
        type: 'ELECTIVE_AT_WILL',
        trigger_id: `trigger-${id.substring(0, 8)}`,
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
    ...rest,
  };
}

/** Helper to extract a contract ID from a createdCids array by type tag. */
function extractCreatedCid(createdCids: Array<Record<string, string>>, tagPrefix: string): string {
  for (const cid of createdCids) {
    for (const [key, value] of Object.entries(cid)) {
      if (key.startsWith(tagPrefix)) {
        return value;
      }
    }
  }
  return '';
}

/**
 * Set up a complete stock security chain (stakeholder, stock class, issuance).
 * Required before creating stock transactions (StockCancellation, StockTransfer, etc.)
 * that reference a security_id.
 */
export async function setupStockSecurity(
  ocp: OcpClient,
  options: {
    issuerContractId: string;
    issuerParty: string;
    capTableContractDetails?: DisclosedContract;
    /** Optional: provide specific security_id to use */
    securityId?: string;
    /** Optional: reuse existing stakeholder_id */
    stakeholderId?: string;
    /** Optional: reuse existing stock_class_id */
    stockClassId?: string;
  }
): Promise<StockSecuritySetup> {
  const securityId = options.securityId ?? generateTestId('stock-security');
  let capTableContractId = options.issuerContractId;
  let { capTableContractDetails } = options;

  // Step 1: Create stakeholder if not provided
  let { stakeholderId } = options;
  if (!stakeholderId) {
    const stakeholderData = createTestStakeholderData();
    stakeholderId = stakeholderData.id;

    const batch1 = ocp.OpenCapTable.capTable.update({
      capTableContractId,
      capTableContractDetails,
      actAs: [options.issuerParty],
    });
    const result1 = await batch1.create('stakeholder', stakeholderData).execute();
    capTableContractId = result1.updatedCapTableCid;

    // Get updated cap table contract details
    const events1 = await ocp.client.getEventsByContractId({ contractId: capTableContractId });
    if (events1.created?.createdEvent) {
      capTableContractDetails = {
        templateId: events1.created.createdEvent.templateId,
        contractId: capTableContractId,
        createdEventBlob: events1.created.createdEvent.createdEventBlob,
        synchronizerId: capTableContractDetails?.synchronizerId ?? '',
      };
    }
  }

  // Step 2: Create stock class if not provided
  let { stockClassId } = options;
  if (!stockClassId) {
    const stockClassData = createTestStockClassData();
    stockClassId = stockClassData.id;

    const batch2 = ocp.OpenCapTable.capTable.update({
      capTableContractId,
      capTableContractDetails,
      actAs: [options.issuerParty],
    });
    const result2 = await batch2.create('stockClass', stockClassData).execute();
    capTableContractId = result2.updatedCapTableCid;

    // Get updated cap table contract details
    const events2 = await ocp.client.getEventsByContractId({ contractId: capTableContractId });
    if (events2.created?.createdEvent) {
      capTableContractDetails = {
        templateId: events2.created.createdEvent.templateId,
        contractId: capTableContractId,
        createdEventBlob: events2.created.createdEvent.createdEventBlob,
        synchronizerId: capTableContractDetails?.synchronizerId ?? '',
      };
    }
  }

  // Step 3: Create stock issuance with the security_id
  const stockIssuanceData = createTestStockIssuanceData({
    stakeholder_id: stakeholderId,
    stock_class_id: stockClassId,
    security_id: securityId,
  });

  const batch3 = ocp.OpenCapTable.capTable.update({
    capTableContractId,
    capTableContractDetails,
    actAs: [options.issuerParty],
  });
  const result3 = await batch3.create('stockIssuance', stockIssuanceData).execute();

  // Extract the stock issuance contract ID from the result
  const stockIssuanceContractId = extractCreatedCid(
    result3.createdCids as unknown as Array<Record<string, string>>,
    'CidStockIssuance'
  );

  return {
    securityId,
    stockIssuanceContractId,
    stakeholderId,
    stockClassId,
    capTableContractId: result3.updatedCapTableCid,
  };
}

/**
 * Set up a complete warrant security chain (stakeholder, warrant issuance).
 * Required before creating warrant transactions (WarrantCancellation, WarrantTransfer, etc.)
 */
export async function setupWarrantSecurity(
  ocp: OcpClient,
  options: {
    issuerContractId: string;
    issuerParty: string;
    capTableContractDetails?: DisclosedContract;
    /** Optional: provide specific security_id to use */
    securityId?: string;
    /** Optional: reuse existing stakeholder_id */
    stakeholderId?: string;
  }
): Promise<WarrantSecuritySetup> {
  const securityId = options.securityId ?? generateTestId('warrant-security');
  let capTableContractId = options.issuerContractId;
  let { capTableContractDetails } = options;

  // Step 1: Create stakeholder if not provided
  let { stakeholderId } = options;
  if (!stakeholderId) {
    const stakeholderData = createTestStakeholderData();
    stakeholderId = stakeholderData.id;

    const batch1 = ocp.OpenCapTable.capTable.update({
      capTableContractId,
      capTableContractDetails,
      actAs: [options.issuerParty],
    });
    const result1 = await batch1.create('stakeholder', stakeholderData).execute();
    capTableContractId = result1.updatedCapTableCid;

    // Get updated cap table contract details
    const events1 = await ocp.client.getEventsByContractId({ contractId: capTableContractId });
    if (events1.created?.createdEvent) {
      capTableContractDetails = {
        templateId: events1.created.createdEvent.templateId,
        contractId: capTableContractId,
        createdEventBlob: events1.created.createdEvent.createdEventBlob,
        synchronizerId: capTableContractDetails?.synchronizerId ?? '',
      };
    }
  }

  // Step 2: Create warrant issuance with the security_id
  const warrantIssuanceData = createTestWarrantIssuanceData({
    stakeholder_id: stakeholderId,
    security_id: securityId,
  });

  const batch2 = ocp.OpenCapTable.capTable.update({
    capTableContractId,
    capTableContractDetails,
    actAs: [options.issuerParty],
  });
  const result2 = await batch2.create('warrantIssuance', warrantIssuanceData).execute();

  // Extract the warrant issuance contract ID from the result
  const warrantIssuanceContractId = extractCreatedCid(
    result2.createdCids as unknown as Array<Record<string, string>>,
    'CidWarrantIssuance'
  );

  return {
    securityId,
    warrantIssuanceContractId,
    stakeholderId,
    capTableContractId: result2.updatedCapTableCid,
  };
}

/**
 * Set up a complete equity compensation security chain (stakeholder, stock class, equity compensation issuance).
 * Required before creating equity compensation transactions.
 */
export async function setupEquityCompensationSecurity(
  ocp: OcpClient,
  options: {
    issuerContractId: string;
    issuerParty: string;
    capTableContractDetails?: DisclosedContract;
    /** Optional: provide specific security_id to use */
    securityId?: string;
    /** Optional: reuse existing stakeholder_id */
    stakeholderId?: string;
    /** Optional: reuse existing stock_class_id */
    stockClassId?: string;
  }
): Promise<EquityCompensationSecuritySetup> {
  const securityId = options.securityId ?? generateTestId('eq-comp-security');
  let capTableContractId = options.issuerContractId;
  let { capTableContractDetails } = options;

  // Step 1: Create stakeholder if not provided
  let { stakeholderId } = options;
  if (!stakeholderId) {
    const stakeholderData = createTestStakeholderData();
    stakeholderId = stakeholderData.id;

    const batch1 = ocp.OpenCapTable.capTable.update({
      capTableContractId,
      capTableContractDetails,
      actAs: [options.issuerParty],
    });
    const result1 = await batch1.create('stakeholder', stakeholderData).execute();
    capTableContractId = result1.updatedCapTableCid;

    // Get updated cap table contract details
    const events1 = await ocp.client.getEventsByContractId({ contractId: capTableContractId });
    if (events1.created?.createdEvent) {
      capTableContractDetails = {
        templateId: events1.created.createdEvent.templateId,
        contractId: capTableContractId,
        createdEventBlob: events1.created.createdEvent.createdEventBlob,
        synchronizerId: capTableContractDetails?.synchronizerId ?? '',
      };
    }
  }

  // Step 2: Create stock class if not provided (equity compensation needs a stock class)
  let { stockClassId } = options;
  if (!stockClassId) {
    const stockClassData = createTestStockClassData();
    stockClassId = stockClassData.id;

    const batch2 = ocp.OpenCapTable.capTable.update({
      capTableContractId,
      capTableContractDetails,
      actAs: [options.issuerParty],
    });
    const result2 = await batch2.create('stockClass', stockClassData).execute();
    capTableContractId = result2.updatedCapTableCid;

    // Get updated cap table contract details
    const events2 = await ocp.client.getEventsByContractId({ contractId: capTableContractId });
    if (events2.created?.createdEvent) {
      capTableContractDetails = {
        templateId: events2.created.createdEvent.templateId,
        contractId: capTableContractId,
        createdEventBlob: events2.created.createdEvent.createdEventBlob,
        synchronizerId: capTableContractDetails?.synchronizerId ?? '',
      };
    }
  }

  // Step 3: Create equity compensation issuance with the security_id
  const eqCompIssuanceData = createTestEquityCompensationIssuanceData({
    stakeholder_id: stakeholderId,
    stock_class_id: stockClassId,
    security_id: securityId,
  });

  const batch3 = ocp.OpenCapTable.capTable.update({
    capTableContractId,
    capTableContractDetails,
    actAs: [options.issuerParty],
  });
  const result3 = await batch3.create('equityCompensationIssuance', eqCompIssuanceData).execute();

  // Extract the equity compensation issuance contract ID from the result
  const equityCompensationIssuanceContractId = extractCreatedCid(
    result3.createdCids as unknown as Array<Record<string, string>>,
    'CidEquityCompensationIssuance'
  );

  return {
    securityId,
    equityCompensationIssuanceContractId,
    stakeholderId,
    stockClassId,
    capTableContractId: result3.updatedCapTableCid,
  };
}

/**
 * Set up a complete convertible security chain (stakeholder, convertible issuance).
 * Required before creating convertible transactions.
 *
 * Note: ConvertibleIssuance has nested Numeric fields which may cause issues with
 * the DAML JSON API v2. Use with caution.
 */
export async function setupConvertibleSecurity(
  ocp: OcpClient,
  options: {
    issuerContractId: string;
    issuerParty: string;
    capTableContractDetails?: DisclosedContract;
    /** Optional: provide specific security_id to use */
    securityId?: string;
    /** Optional: reuse existing stakeholder_id */
    stakeholderId?: string;
  }
): Promise<ConvertibleSecuritySetup> {
  const securityId = options.securityId ?? generateTestId('convertible-security');
  let capTableContractId = options.issuerContractId;
  let { capTableContractDetails } = options;

  // Step 1: Create stakeholder if not provided
  let { stakeholderId } = options;
  if (!stakeholderId) {
    const stakeholderData = createTestStakeholderData();
    stakeholderId = stakeholderData.id;

    const batch1 = ocp.OpenCapTable.capTable.update({
      capTableContractId,
      capTableContractDetails,
      actAs: [options.issuerParty],
    });
    const result1 = await batch1.create('stakeholder', stakeholderData).execute();
    capTableContractId = result1.updatedCapTableCid;

    // Get updated cap table contract details
    const events1 = await ocp.client.getEventsByContractId({ contractId: capTableContractId });
    if (events1.created?.createdEvent) {
      capTableContractDetails = {
        templateId: events1.created.createdEvent.templateId,
        contractId: capTableContractId,
        createdEventBlob: events1.created.createdEvent.createdEventBlob,
        synchronizerId: capTableContractDetails?.synchronizerId ?? '',
      };
    }
  }

  // Step 2: Create convertible issuance with the security_id
  const convertibleIssuanceData = createTestConvertibleIssuanceData({
    stakeholder_id: stakeholderId,
    security_id: securityId,
  });

  const batch2 = ocp.OpenCapTable.capTable.update({
    capTableContractId,
    capTableContractDetails,
    actAs: [options.issuerParty],
  });
  const result2 = await batch2.create('convertibleIssuance', convertibleIssuanceData).execute();

  // Extract the convertible issuance contract ID from the result
  const convertibleIssuanceContractId = extractCreatedCid(
    result2.createdCids as unknown as Array<Record<string, string>>,
    'CidConvertibleIssuance'
  );

  return {
    securityId,
    convertibleIssuanceContractId,
    stakeholderId,
    capTableContractId: result2.updatedCapTableCid,
  };
}
