/**
 * Test data for integration tests.
 *
 * These utilities create consistent OCF test fixtures for the LocalNet suites that write an OpenCapTable-v35 book
 * through `CapTable_Apply` / `CapTable_Restate` as the transfer agent. They hold no ledger access, so they run in unit
 * tests too; the book helpers live in `testBook.ts`.
 */

import type {
  AtMostOne,
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
  WarrantExerciseTrigger,
} from '../../../src/types/native';

/** Default issuance quantity large enough for production/synthetic fixture lifecycle events. */
export const TEST_SECURITY_ISSUANCE_QUANTITY = '10000000';

/** Past issuance date so lifecycle events and production fixtures are not rejected as predating issuance. */
export const TEST_SECURITY_ISSUANCE_DATE = '2020-01-01';

export const DEFAULT_TEST_WARRANT_TRIGGER_ID = 'test-warrant-trigger-default';

export const DEFAULT_TEST_CONVERTIBLE_TRIGGER_ID = 'test-convertible-trigger-default';

/** Condition id in the default test VestingTerms whose trigger is VESTING_START_DATE (valid VestingStart target). */
export const TEST_VESTING_START_CONDITION_ID = 'vesting-start';

/** Condition id in the default test VestingTerms whose trigger is VESTING_EVENT (valid VestingEvent target). */
export const TEST_VESTING_EVENT_CONDITION_ID = 'milestone-event';

export function createDefaultWarrantExerciseTrigger(
  triggerId = DEFAULT_TEST_WARRANT_TRIGGER_ID
): WarrantExerciseTrigger {
  return {
    type: 'ELECTIVE_AT_WILL',
    trigger_id: triggerId,
    conversion_right: {
      type: 'WARRANT_CONVERSION_RIGHT',
      conversion_mechanism: {
        type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
        converts_to_percent: '0.1',
      },
    },
  };
}

/** Generate a unique test ID with the given prefix. Uses timestamp + random string for uniqueness. */
export function generateTestId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Generate a date string in ISO format (YYYY-MM-DD), in UTC like the ledger's date.
 *
 * @param daysFromNow - Number of days from today (can be negative)
 */
export function generateDateString(daysFromNow = 0): string {
  const DAY_MS = 86_400_000;
  return new Date(Date.now() + daysFromNow * DAY_MS).toISOString().slice(0, 10);
}

type IssuerSubdivisionOverrides = AtMostOne<
  {
    country_subdivision_of_formation: string;
    country_subdivision_name_of_formation: string;
  },
  'country_subdivision_of_formation' | 'country_subdivision_name_of_formation'
>;

type TestIssuerOverrides = Omit<
  Partial<OcfIssuer>,
  'object_type' | 'country_subdivision_of_formation' | 'country_subdivision_name_of_formation'
> &
  IssuerSubdivisionOverrides;

/** Create test issuer data with optional canonical overrides. */
export function createTestIssuerData(overrides: TestIssuerOverrides = {}): OcfIssuer {
  const id = overrides.id ?? generateTestId('issuer');
  const {
    country_subdivision_of_formation: subdivisionCode,
    country_subdivision_name_of_formation: subdivisionName,
    ...rest
  } = overrides;
  const subdivision =
    subdivisionName !== undefined
      ? { country_subdivision_name_of_formation: subdivisionName }
      : { country_subdivision_of_formation: subdivisionCode ?? 'DE' };
  return {
    id,
    legal_name: `Test Company ${id}`,
    formation_date: generateDateString(-365),
    country_of_formation: 'US',
    tax_ids: [],
    ...rest,
    ...subdivision,
    object_type: 'ISSUER',
  };
}

/** Create test stakeholder data with optional overrides. */
export function createTestStakeholderData(
  overrides: Omit<Partial<OcfStakeholder>, 'object_type'> = {}
): OcfStakeholder {
  const id = overrides.id ?? generateTestId('stakeholder');
  return {
    id,
    name: {
      legal_name: `Stakeholder ${id}`,
    },
    stakeholder_type: 'INDIVIDUAL',
    ...overrides,
    object_type: 'STAKEHOLDER',
  };
}

/** Create a preferred stock class with a ratio conversion right (required for conversion ratio adjustments). */
export function createTestStockClassWithRatioConversionRight(
  overrides: Omit<Partial<OcfStockClass>, 'object_type'> & { converts_to_stock_class_id?: string } = {}
): OcfStockClass {
  const { converts_to_stock_class_id, ...rest } = overrides;
  const convertsToStockClassId = converts_to_stock_class_id ?? generateTestId('common-stock-class');
  return createTestStockClassData({
    class_type: 'PREFERRED',
    default_id_prefix: 'PS',
    conversion_rights: [
      {
        type: 'STOCK_CLASS_CONVERSION_RIGHT',
        converts_to_stock_class_id: convertsToStockClassId,
        conversion_mechanism: {
          type: 'RATIO_CONVERSION',
          rounding_type: 'NORMAL',
          conversion_price: { amount: '1.00', currency: 'USD' },
          ratio: { numerator: '1', denominator: '1' },
        },
      },
    ],
    ...rest,
  });
}

/** Create test stock class data with optional overrides. */
export function createTestStockClassData(overrides: Omit<Partial<OcfStockClass>, 'object_type'> = {}): OcfStockClass {
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
    object_type: 'STOCK_CLASS',
  };
}

/** Create test stock legend template data with optional overrides. */
export function createTestStockLegendTemplateData(
  overrides: Omit<Partial<OcfStockLegendTemplate>, 'object_type'> = {}
): OcfStockLegendTemplate {
  const id = overrides.id ?? generateTestId('legend');
  return {
    id,
    name: `Legend Template ${id}`,
    text: 'This is a test stock legend template text.',
    ...overrides,
    object_type: 'STOCK_LEGEND_TEMPLATE',
  };
}

type TestDocumentOverrides = Omit<Partial<OcfDocument>, 'object_type' | 'path' | 'uri'> &
  AtMostOne<{ path: string; uri: string }, 'path' | 'uri'>;

/** Create test document data with optional canonical overrides. */
export function createTestDocumentData(overrides: TestDocumentOverrides = {}): OcfDocument {
  const id = overrides.id ?? generateTestId('document');
  const { path, uri, ...rest } = overrides;
  const location = uri !== undefined ? { uri } : { path: path ?? `/documents/${id}.pdf` };
  return {
    id,
    md5: '00000000000000000000000000000000', // Placeholder MD5 hash
    ...rest,
    ...location,
    object_type: 'DOCUMENT',
  };
}

/** Create test valuation data with optional overrides. */
export function createTestValuationData(
  overrides: Omit<Partial<OcfValuation>, 'object_type'> & { stock_class_id: string }
): OcfValuation {
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
    object_type: 'VALUATION',
  };
}

/** Create test vesting start data with optional overrides. */
export function createTestVestingStartData(
  overrides: Omit<Partial<OcfVestingStart>, 'object_type'> & { security_id: string; vesting_condition_id: string }
): OcfVestingStart {
  const id = overrides.id ?? generateTestId('vesting-start');
  const { security_id, vesting_condition_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    vesting_condition_id,
    ...rest,
    object_type: 'TX_VESTING_START',
  };
}

/** Create test vesting event data with optional overrides. */
export function createTestVestingEventData(
  overrides: Omit<Partial<OcfVestingEvent>, 'object_type'> & { security_id: string; vesting_condition_id: string }
): OcfVestingEvent {
  const id = overrides.id ?? generateTestId('vesting-event');
  const { security_id, vesting_condition_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    vesting_condition_id,
    ...rest,
    object_type: 'TX_VESTING_EVENT',
  };
}

/** Create test vesting acceleration data with optional overrides. */
export function createTestVestingAccelerationData(
  overrides: Omit<Partial<OcfVestingAcceleration>, 'object_type'> & { security_id: string }
): OcfVestingAcceleration {
  const id = overrides.id ?? generateTestId('vesting-acceleration');
  const { security_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    quantity: TEST_SECURITY_ISSUANCE_QUANTITY,
    reason_text: 'Company acquisition - single-trigger acceleration',
    ...rest,
    object_type: 'TX_VESTING_ACCELERATION',
  };
}

/** Create test vesting terms data with optional overrides. */
export function createTestVestingTermsData(
  overrides: Omit<Partial<OcfVestingTerms>, 'object_type'> = {}
): OcfVestingTerms {
  const id = overrides.id ?? generateTestId('vesting-terms');
  return {
    id,
    name: overrides.name ?? `Vesting Terms ${id}`,
    description: overrides.description ?? '4-year vesting with 1-year cliff',
    allocation_type: overrides.allocation_type ?? 'CUMULATIVE_ROUNDING',
    vesting_conditions: overrides.vesting_conditions ?? [
      {
        id: TEST_VESTING_START_CONDITION_ID,
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
      // Standalone event-triggered root so VestingEvent transactions have a valid condition to reference.
      // Zero quantity keeps the schedule at 100% (cliff + monthly already allocate the full grant).
      {
        id: TEST_VESTING_EVENT_CONDITION_ID,
        description: 'Milestone-based vesting event',
        quantity: '0',
        trigger: { type: 'VESTING_EVENT' },
        next_condition_ids: [],
      },
    ],
    ...overrides,
    object_type: 'VESTING_TERMS',
  };
}

/** Create test stock plan data with optional overrides. */
export function createTestStockPlanData(
  overrides: Omit<Partial<OcfStockPlan>, 'object_type'> & { stock_class_ids: string[] }
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
    object_type: 'STOCK_PLAN',
  };
}

/** Create test stock issuance data with optional overrides. */
export function createTestStockIssuanceData(
  overrides: Omit<Partial<OcfStockIssuance>, 'object_type'> & {
    stakeholder_id: string;
    stock_class_id: string;
  }
): OcfStockIssuance {
  const id = overrides.id ?? generateTestId('stock-issuance');
  const securityId = overrides.security_id ?? generateTestId('security');
  const { stakeholder_id, stock_class_id, ...rest } = overrides;
  return {
    id,
    date: TEST_SECURITY_ISSUANCE_DATE,
    security_id: securityId,
    custom_id: `CS-${securityId.substring(0, 8)}`,
    stakeholder_id,
    stock_class_id,
    quantity: TEST_SECURITY_ISSUANCE_QUANTITY,
    share_price: { amount: '1.00', currency: 'USD' },
    security_law_exemptions: [],
    stock_legend_ids: [],
    ...rest,
    object_type: 'TX_STOCK_ISSUANCE',
  };
}

/** Create test equity compensation issuance data with optional overrides. */
export function createTestEquityCompensationIssuanceData(
  overrides: Omit<Partial<OcfEquityCompensationIssuance>, 'object_type'> & {
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
    date: TEST_SECURITY_ISSUANCE_DATE,
    security_id: securityId,
    custom_id: `OPT-${securityId.substring(0, 8)}`,
    stakeholder_id,
    ...(stock_plan_id !== undefined ? { stock_plan_id } : {}),
    ...(stock_class_id !== undefined ? { stock_class_id } : {}),
    compensation_type: 'OPTION_ISO',
    quantity: '50000',
    exercise_price: { amount: '0.50', currency: 'USD' },
    expiration_date: generateDateString(365 * 10), // 10 years
    security_law_exemptions: [],
    termination_exercise_windows: [],
    ...rest,
    object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
  };
}

// ===== Exercise & Conversion Type Test Data Factories =====

/** Create test warrant exercise data with optional overrides. */
export function createTestWarrantExerciseData(
  overrides: Omit<Partial<OcfWarrantExercise>, 'object_type'> & {
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
    trigger_id: trigger_id ?? DEFAULT_TEST_WARRANT_TRIGGER_ID,
    resulting_security_ids,
    ...rest,
    object_type: 'TX_WARRANT_EXERCISE',
  };
}

/** Create test convertible conversion data with optional overrides. */
export function createTestConvertibleConversionData(
  overrides: Omit<Partial<OcfConvertibleConversion>, 'object_type'> & {
    security_id: string;
    resulting_security_ids: string[];
  }
): OcfConvertibleConversion {
  const id = overrides.id ?? generateTestId('convertible-conversion');
  const { security_id, resulting_security_ids, trigger_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    reason_text: 'Automatic conversion at financing',
    security_id,
    trigger_id: trigger_id ?? DEFAULT_TEST_CONVERTIBLE_TRIGGER_ID,
    resulting_security_ids,
    ...rest,
    object_type: 'TX_CONVERTIBLE_CONVERSION',
  };
}

/** Create test stock conversion data with optional overrides. */
export function createTestStockConversionData(
  overrides: Omit<Partial<OcfStockConversion>, 'object_type'> & {
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
    quantity_converted: '1000',
    resulting_security_ids,
    ...rest,
    object_type: 'TX_STOCK_CONVERSION',
  };
}

// ===== Remaining OCF Type Test Data Factories =====

/** Create test stock retraction data with optional overrides. */
export function createTestStockRetractionData(
  overrides: Omit<Partial<OcfStockRetraction>, 'object_type'> & { security_id: string }
): OcfStockRetraction {
  const id = overrides.id ?? generateTestId('stock-retraction');
  const { security_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    reason_text: 'Issued in error',
    ...rest,
    object_type: 'TX_STOCK_RETRACTION',
  };
}

/** Create test warrant retraction data with optional overrides. */
export function createTestWarrantRetractionData(
  overrides: Omit<Partial<OcfWarrantRetraction>, 'object_type'> & { security_id: string }
): OcfWarrantRetraction {
  const id = overrides.id ?? generateTestId('warrant-retraction');
  const { security_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    reason_text: 'Warrant voided',
    ...rest,
    object_type: 'TX_WARRANT_RETRACTION',
  };
}

/** Create test convertible retraction data with optional overrides. */
export function createTestConvertibleRetractionData(
  overrides: Omit<Partial<OcfConvertibleRetraction>, 'object_type'> & { security_id: string }
): OcfConvertibleRetraction {
  const id = overrides.id ?? generateTestId('convertible-retraction');
  const { security_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    reason_text: 'Terms renegotiated',
    ...rest,
    object_type: 'TX_CONVERTIBLE_RETRACTION',
  };
}

/** Create test equity compensation retraction data with optional overrides. */
export function createTestEquityCompensationRetractionData(
  overrides: Omit<Partial<OcfEquityCompensationRetraction>, 'object_type'> & { security_id: string }
): OcfEquityCompensationRetraction {
  const id = overrides.id ?? generateTestId('equity-comp-retraction');
  const { security_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    reason_text: 'Grant voided due to termination',
    ...rest,
    object_type: 'TX_EQUITY_COMPENSATION_RETRACTION',
  };
}

/** Create test equity compensation release data with optional overrides. */
export function createTestEquityCompensationReleaseData(
  overrides: Omit<Partial<OcfEquityCompensationRelease>, 'object_type'> & { security_id: string }
): OcfEquityCompensationRelease {
  const id = overrides.id ?? generateTestId('equity-comp-release');
  const { security_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    settlement_date: generateDateString(2),
    release_price: { amount: '0.00', currency: 'USD' },
    quantity: '1000',
    resulting_security_ids: [generateTestId('resulting-security')],
    ...rest,
    object_type: 'TX_EQUITY_COMPENSATION_RELEASE',
  };
}

/** Create test equity compensation repricing data with optional overrides. */
export function createTestEquityCompensationRepricingData(
  overrides: Omit<Partial<OcfEquityCompensationRepricing>, 'object_type'> & { security_id: string }
): OcfEquityCompensationRepricing {
  const id = overrides.id ?? generateTestId('equity-comp-repricing');
  const { security_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    new_exercise_price: { amount: '0.25', currency: 'USD' },
    ...rest,
    object_type: 'TX_EQUITY_COMPENSATION_REPRICING',
  };
}

/** Create test stock plan return to pool data with optional overrides. */
export function createTestStockPlanReturnToPoolData(
  overrides: Omit<Partial<OcfStockPlanReturnToPool>, 'object_type'> & { stock_plan_id: string; security_id: string }
): OcfStockPlanReturnToPool {
  const id = overrides.id ?? generateTestId('stock-plan-return');
  const { stock_plan_id, security_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    security_id,
    stock_plan_id,
    quantity: '5000',
    reason_text: 'Employee termination - unvested shares returned',
    ...rest,
    object_type: 'TX_STOCK_PLAN_RETURN_TO_POOL',
  };
}

/** Create test stakeholder relationship change event data with optional overrides. */
export function createTestStakeholderRelationshipChangeData(
  overrides: Omit<Partial<OcfStakeholderRelationshipChangeEvent>, 'object_type'> & { stakeholder_id: string }
): OcfStakeholderRelationshipChangeEvent {
  const id = overrides.id ?? generateTestId('relationship-change');
  const { stakeholder_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    stakeholder_id,
    relationship_started: 'EMPLOYEE',
    ...rest,
    object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
  };
}

/** Create test stakeholder status change event data with optional overrides. */
export function createTestStakeholderStatusChangeData(
  overrides: Omit<Partial<OcfStakeholderStatusChangeEvent>, 'object_type'> & { stakeholder_id: string }
): OcfStakeholderStatusChangeEvent {
  const id = overrides.id ?? generateTestId('status-change');
  const { stakeholder_id, ...rest } = overrides;
  return {
    id,
    date: generateDateString(0),
    stakeholder_id,
    new_status: 'ACTIVE',
    ...rest,
    object_type: 'CE_STAKEHOLDER_STATUS',
  };
}

// ===== Transfer Type Test Data Factories =====

/** Create test stock transfer data with optional overrides. */
export function createTestStockTransferData(
  overrides: Omit<Partial<OcfStockTransfer>, 'object_type'> & { security_id: string }
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
    object_type: 'TX_STOCK_TRANSFER',
  };
}

/** Create test convertible transfer data with optional overrides. */
export function createTestConvertibleTransferData(
  overrides: Omit<Partial<OcfConvertibleTransfer>, 'object_type'> & { security_id: string }
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
    object_type: 'TX_CONVERTIBLE_TRANSFER',
  };
}

/** Create test equity compensation transfer data with optional overrides. */
export function createTestEquityCompensationTransferData(
  overrides: Omit<Partial<OcfEquityCompensationTransfer>, 'object_type'> & { security_id: string }
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
    object_type: 'TX_EQUITY_COMPENSATION_TRANSFER',
  };
}

/** Create test warrant transfer data with optional overrides. */
export function createTestWarrantTransferData(
  overrides: Omit<Partial<OcfWarrantTransfer>, 'object_type'> & { security_id: string }
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
    object_type: 'TX_WARRANT_TRANSFER',
  };
}

/** Create test warrant issuance data with optional overrides. */
export function createTestWarrantIssuanceData(
  overrides: Omit<Partial<OcfWarrantIssuance>, 'object_type'> & { stakeholder_id: string }
): OcfWarrantIssuance {
  const id = overrides.id ?? generateTestId('warrant-issuance');
  const securityId = overrides.security_id ?? generateTestId('warrant-security');
  const { stakeholder_id, exercise_triggers, ...rest } = overrides;
  return {
    id,
    date: TEST_SECURITY_ISSUANCE_DATE,
    security_id: securityId,
    custom_id: `W-${securityId.substring(0, 8)}`,
    stakeholder_id,
    quantity: TEST_SECURITY_ISSUANCE_QUANTITY,
    purchase_price: { amount: '1000', currency: 'USD' },
    warrant_expiration_date: generateDateString(365 * 5), // 5 years from now
    exercise_triggers: exercise_triggers ?? [createDefaultWarrantExerciseTrigger()],
    security_law_exemptions: [],
    ...rest,
    object_type: 'TX_WARRANT_ISSUANCE',
  };
}

/** Create test convertible issuance data with optional overrides. */
export function createTestConvertibleIssuanceData(
  overrides: Omit<Partial<OcfConvertibleIssuance>, 'object_type'> & { stakeholder_id: string }
): OcfConvertibleIssuance {
  const id = overrides.id ?? generateTestId('convertible-issuance');
  const securityId = overrides.security_id ?? generateTestId('convertible-security');
  const { stakeholder_id, conversion_triggers, ...rest } = overrides;
  return {
    id,
    date: TEST_SECURITY_ISSUANCE_DATE,
    security_id: securityId,
    custom_id: `CONV-${securityId.substring(0, 8)}`,
    stakeholder_id,
    investment_amount: { amount: '100000', currency: 'USD' },
    convertible_type: 'NOTE',
    security_law_exemptions: [],
    // The ledger requires at least one conversion trigger
    conversion_triggers: conversion_triggers ?? [
      {
        type: 'ELECTIVE_AT_WILL',
        trigger_id: DEFAULT_TEST_CONVERTIBLE_TRIGGER_ID,
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
    object_type: 'TX_CONVERTIBLE_ISSUANCE',
  };
}
