/**
 * Prerequisite chains for integration tests: the stakeholders, classes and issuances a lifecycle event refers to,
 * written to a test book through `CapTable_Apply` as the transfer agent.
 *
 * Stock events (transfers, cancellations, conversions, reissuances, consolidations) are written as the bundled
 * operations that create their output issuances; every other instrument's events are plain records whose resulting
 * securities must be issued first (`issue*Securities`).
 */

import type {
  OcfConvertibleIssuance,
  OcfEquityCompensationIssuance,
  OcfStockClass,
  OcfStockIssuance,
  OcfWarrantIssuance,
} from '../../../src/types/native';
import type { ApplyOperation } from '../../../src/types/register';
import {
  createTestConvertibleIssuanceData,
  createTestEquityCompensationIssuanceData,
  createTestStakeholderData,
  createTestStockClassData,
  createTestStockClassWithRatioConversionRight,
  createTestStockIssuanceData,
  createTestVestingTermsData,
  createTestWarrantIssuanceData,
  DEFAULT_TEST_CONVERTIBLE_TRIGGER_ID,
  DEFAULT_TEST_WARRANT_TRIGGER_ID,
} from './setupTestData';
import { applyOperations, type TestBook } from './testBook';

/** Result from setting up a stock security. */
export interface StockSecuritySetup {
  /** The security_id that can be used in subsequent stock transactions */
  securityId: string;
  /** The OCF ID of the created StockIssuance */
  stockIssuanceId: string;
  /** The contract ID of the created StockIssuance */
  stockIssuanceContractId: string;
  /** The stakeholder_id used for the issuance */
  stakeholderId: string;
  /** The stock_class_id used for the issuance */
  stockClassId: string;
  /** The vesting_terms_id attached to the issuance, when `withVestingTerms` was requested */
  vestingTermsId?: string;
  /** The issuance as written */
  issuance: OcfStockIssuance;
}

/** Result from setting up a warrant security. */
export interface WarrantSecuritySetup {
  /** The security_id that can be used in subsequent warrant transactions */
  securityId: string;
  /** The contract ID of the created WarrantIssuance */
  warrantIssuanceContractId: string;
  /** The stakeholder_id used for the issuance */
  stakeholderId: string;
  /** Trigger id from the warrant issuance exercise_triggers */
  exerciseTriggerId: string;
  /** The issuance as written */
  issuance: OcfWarrantIssuance;
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
  /** The issuance as written */
  issuance: OcfEquityCompensationIssuance;
}

/** Result from setting up a convertible security. */
export interface ConvertibleSecuritySetup {
  /** The security_id that can be used in subsequent convertible transactions */
  securityId: string;
  /** The contract ID of the created ConvertibleIssuance */
  convertibleIssuanceContractId: string;
  /** The stakeholder_id used for the issuance */
  stakeholderId: string;
  /** Trigger id from the convertible issuance conversion_triggers */
  conversionTriggerId: string;
  /** The issuance as written */
  issuance: OcfConvertibleIssuance;
}

/** The contract ID `CapTable_Apply` returned for a record it created. */
function createdContractId(created: ReadonlyMap<string, { contractId: string }>, objectId: string): string {
  const ref = created.get(objectId);
  if (ref === undefined) {
    throw new Error(`CapTable_Apply created no record ${objectId}`);
  }
  return ref.contractId;
}

/** Create a stakeholder and return its OCF ID. */
export async function setupStakeholder(book: TestBook): Promise<string> {
  const stakeholder = createTestStakeholderData();
  await applyOperations(book, [{ kind: 'record', type: 'stakeholder', data: stakeholder }]);
  return stakeholder.id;
}

/**
 * Set up a complete stock security chain (stakeholder, stock class, issuance). Required before creating stock events
 * (cancellation, transfer, conversion, ...) that name a security_id.
 */
export async function setupStockSecurity(
  book: TestBook,
  options: {
    /** Optional: provide specific security_id to use */
    securityId?: string;
    /** Optional: reuse existing stakeholder_id */
    stakeholderId?: string;
    /** Optional: reuse existing stock_class_id */
    stockClassId?: string;
    /** Optional: full stock class payload (e.g. preferred with conversion_rights) */
    stockClassData?: OcfStockClass;
    /**
     * Optional: also create default VestingTerms and attach them to the issuance. Required before VestingStart /
     * VestingEvent transactions, which the ledger validates against the security's VestingTerms conditions.
     */
    withVestingTerms?: boolean;
    /** Optional: override issuance fields */
    issuanceOverrides?: Partial<OcfStockIssuance>;
  } = {}
): Promise<StockSecuritySetup> {
  const operations: ApplyOperation[] = [];

  let { stakeholderId } = options;
  if (stakeholderId === undefined) {
    const stakeholder = createTestStakeholderData();
    stakeholderId = stakeholder.id;
    operations.push({ kind: 'record', type: 'stakeholder', data: stakeholder });
  }

  let { stockClassId } = options;
  if (stockClassId === undefined) {
    const stockClass = options.stockClassData ?? createTestStockClassData();
    stockClassId = stockClass.id;
    operations.push({ kind: 'record', type: 'stockClass', data: stockClass });
  }

  const vestingTerms = options.withVestingTerms === true ? createTestVestingTermsData() : undefined;
  if (vestingTerms !== undefined) {
    operations.push({ kind: 'record', type: 'vestingTerms', data: vestingTerms });
  }

  const issuance = createTestStockIssuanceData({
    stakeholder_id: stakeholderId,
    stock_class_id: stockClassId,
    ...(options.securityId !== undefined ? { security_id: options.securityId } : {}),
    ...(vestingTerms !== undefined ? { vesting_terms_id: vestingTerms.id } : {}),
    ...options.issuanceOverrides,
  });
  operations.push({ kind: 'record', type: 'stockIssuance', data: issuance });

  const created = await applyOperations(book, operations);
  return {
    securityId: issuance.security_id,
    stockIssuanceId: issuance.id,
    stockIssuanceContractId: createdContractId(created, issuance.id),
    stakeholderId,
    stockClassId,
    ...(vestingTerms !== undefined ? { vestingTermsId: vestingTerms.id } : {}),
    issuance,
  };
}

/** Set up a complete warrant security chain (stakeholder, warrant issuance). */
export async function setupWarrantSecurity(
  book: TestBook,
  options: {
    securityId?: string;
    stakeholderId?: string;
    /** Optional: override warrant issuance fields (e.g. exercise_triggers) */
    warrantIssuanceOverrides?: Partial<OcfWarrantIssuance>;
  } = {}
): Promise<WarrantSecuritySetup> {
  const operations: ApplyOperation[] = [];

  let { stakeholderId } = options;
  if (stakeholderId === undefined) {
    const stakeholder = createTestStakeholderData();
    stakeholderId = stakeholder.id;
    operations.push({ kind: 'record', type: 'stakeholder', data: stakeholder });
  }

  const issuance = createTestWarrantIssuanceData({
    stakeholder_id: stakeholderId,
    ...(options.securityId !== undefined ? { security_id: options.securityId } : {}),
    ...options.warrantIssuanceOverrides,
  });
  operations.push({ kind: 'record', type: 'warrantIssuance', data: issuance });

  const created = await applyOperations(book, operations);
  return {
    securityId: issuance.security_id,
    warrantIssuanceContractId: createdContractId(created, issuance.id),
    stakeholderId,
    exerciseTriggerId: issuance.exercise_triggers[0]?.trigger_id ?? DEFAULT_TEST_WARRANT_TRIGGER_ID,
    issuance,
  };
}

/** Set up a complete equity compensation security chain (stakeholder, stock class, equity compensation issuance). */
export async function setupEquityCompensationSecurity(
  book: TestBook,
  options: {
    securityId?: string;
    stakeholderId?: string;
    stockClassId?: string;
    /** Optional: override equity compensation issuance fields */
    issuanceOverrides?: Partial<OcfEquityCompensationIssuance>;
  } = {}
): Promise<EquityCompensationSecuritySetup> {
  const operations: ApplyOperation[] = [];

  let { stakeholderId } = options;
  if (stakeholderId === undefined) {
    const stakeholder = createTestStakeholderData();
    stakeholderId = stakeholder.id;
    operations.push({ kind: 'record', type: 'stakeholder', data: stakeholder });
  }

  let { stockClassId } = options;
  if (stockClassId === undefined) {
    const stockClass = createTestStockClassData();
    stockClassId = stockClass.id;
    operations.push({ kind: 'record', type: 'stockClass', data: stockClass });
  }

  const issuance = createTestEquityCompensationIssuanceData({
    stakeholder_id: stakeholderId,
    stock_class_id: stockClassId,
    ...(options.securityId !== undefined ? { security_id: options.securityId } : {}),
    ...options.issuanceOverrides,
  });
  operations.push({ kind: 'record', type: 'equityCompensationIssuance', data: issuance });

  const created = await applyOperations(book, operations);
  return {
    securityId: issuance.security_id,
    equityCompensationIssuanceContractId: createdContractId(created, issuance.id),
    stakeholderId,
    stockClassId,
    issuance,
  };
}

/** Set up a complete convertible security chain (stakeholder, convertible issuance). */
export async function setupConvertibleSecurity(
  book: TestBook,
  options: {
    securityId?: string;
    stakeholderId?: string;
    /** Optional: override convertible issuance fields (e.g. conversion_triggers) */
    convertibleIssuanceOverrides?: Partial<OcfConvertibleIssuance>;
  } = {}
): Promise<ConvertibleSecuritySetup> {
  const operations: ApplyOperation[] = [];

  let { stakeholderId } = options;
  if (stakeholderId === undefined) {
    const stakeholder = createTestStakeholderData();
    stakeholderId = stakeholder.id;
    operations.push({ kind: 'record', type: 'stakeholder', data: stakeholder });
  }

  const issuance = createTestConvertibleIssuanceData({
    stakeholder_id: stakeholderId,
    ...(options.securityId !== undefined ? { security_id: options.securityId } : {}),
    ...options.convertibleIssuanceOverrides,
  });
  operations.push({ kind: 'record', type: 'convertibleIssuance', data: issuance });

  const created = await applyOperations(book, operations);
  return {
    securityId: issuance.security_id,
    convertibleIssuanceContractId: createdContractId(created, issuance.id),
    stakeholderId,
    conversionTriggerId: issuance.conversion_triggers[0]?.trigger_id ?? DEFAULT_TEST_CONVERTIBLE_TRIGGER_ID,
    issuance,
  };
}

/** Set up a common stock class and a preferred one with a ratio conversion right to it (for ratio adjustments). */
export async function setupPreferredStockClassWithRatioConversionRight(
  book: TestBook
): Promise<{ commonStockClassId: string; preferredStockClassId: string }> {
  const commonStockClass = createTestStockClassData({ name: 'Common for conversion' });
  const preferredStockClass = createTestStockClassWithRatioConversionRight({
    converts_to_stock_class_id: commonStockClass.id,
  });
  await applyOperations(book, [
    { kind: 'record', type: 'stockClass', data: commonStockClass },
    { kind: 'record', type: 'stockClass', data: preferredStockClass },
  ]);
  return { commonStockClassId: commonStockClass.id, preferredStockClassId: preferredStockClass.id };
}

/**
 * Companion (resulting/balance) issuances should share the parent lifecycle transaction's date: the extractor sorts by
 * day before applying its re-papered-issuance ordering, so an earlier-dated companion would be processed as an
 * ordinary mint.
 */
interface CompanionIssuanceOptions {
  issuanceDate?: string;
}

/**
 * Issue stock securities with the given security_ids so plain records can name them as resulting securities. Creates a
 * stock class in the same write when `stockClassId` is not provided.
 */
export async function issueStockSecurities(
  book: TestBook,
  options: CompanionIssuanceOptions & { stakeholderId: string; stockClassId?: string; securityIds: string[] }
): Promise<{ stockClassId: string }> {
  const operations: ApplyOperation[] = [];
  let { stockClassId } = options;
  if (stockClassId === undefined) {
    const stockClass = createTestStockClassData();
    stockClassId = stockClass.id;
    operations.push({ kind: 'record', type: 'stockClass', data: stockClass });
  }
  for (const securityId of options.securityIds) {
    operations.push({
      kind: 'record',
      type: 'stockIssuance',
      data: createTestStockIssuanceData({
        stakeholder_id: options.stakeholderId,
        stock_class_id: stockClassId,
        security_id: securityId,
        ...(options.issuanceDate !== undefined ? { date: options.issuanceDate } : {}),
      }),
    });
  }
  await applyOperations(book, operations);
  return { stockClassId };
}

/** Issue warrant securities with the given security_ids (resulting securities for warrant transfers). */
export async function issueWarrantSecurities(
  book: TestBook,
  options: CompanionIssuanceOptions & { stakeholderId: string; securityIds: string[] }
): Promise<void> {
  await applyOperations(
    book,
    options.securityIds.map((securityId): ApplyOperation => ({
      kind: 'record',
      type: 'warrantIssuance',
      data: createTestWarrantIssuanceData({
        stakeholder_id: options.stakeholderId,
        security_id: securityId,
        ...(options.issuanceDate !== undefined ? { date: options.issuanceDate } : {}),
      }),
    }))
  );
}

/** Issue convertible securities with the given security_ids (resulting securities for convertible transfers). */
export async function issueConvertibleSecurities(
  book: TestBook,
  options: CompanionIssuanceOptions & { stakeholderId: string; securityIds: string[] }
): Promise<void> {
  await applyOperations(
    book,
    options.securityIds.map((securityId): ApplyOperation => ({
      kind: 'record',
      type: 'convertibleIssuance',
      data: createTestConvertibleIssuanceData({
        stakeholder_id: options.stakeholderId,
        security_id: securityId,
        ...(options.issuanceDate !== undefined ? { date: options.issuanceDate } : {}),
      }),
    }))
  );
}

/** Issue equity compensation securities with the given security_ids (resulting securities for its transfers). */
export async function issueEquityCompensationSecurities(
  book: TestBook,
  options: CompanionIssuanceOptions & { stakeholderId: string; stockClassId: string; securityIds: string[] }
): Promise<void> {
  await applyOperations(
    book,
    options.securityIds.map((securityId): ApplyOperation => ({
      kind: 'record',
      type: 'equityCompensationIssuance',
      data: createTestEquityCompensationIssuanceData({
        stakeholder_id: options.stakeholderId,
        stock_class_id: options.stockClassId,
        security_id: securityId,
        ...(options.issuanceDate !== undefined ? { date: options.issuanceDate } : {}),
      }),
    }))
  );
}
