/**
 * Integration tests for acceptance type operations via batch API.
 *
 * Tests creating acceptance transactions for different security types:
 * - Stock Acceptance
 * - Warrant Acceptance
 * - Convertible Acceptance
 * - Equity Compensation Acceptance
 *
 * These tests verify that acceptance transactions can be created via the batch API
 * and that the data is correctly converted between OCF and DAML formats.
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration
 * ```
 */

import type {
  OcfConvertibleAcceptance,
  OcfEquityCompensationAcceptance,
  OcfStockAcceptance,
  OcfWarrantAcceptance,
} from '../../../src/types';
import { createIntegrationTestSuite } from '../setup';
import { generateDateString, generateTestId, setupTestIssuer } from '../utils';

/**
 * Create test stock acceptance data with optional overrides.
 */
function createTestStockAcceptanceData(overrides: Partial<OcfStockAcceptance> = {}): OcfStockAcceptance {
  const id = overrides.id ?? generateTestId('stock-accept');
  return {
    id,
    date: generateDateString(0),
    security_id: overrides.security_id ?? generateTestId('stock-security'),
    ...overrides,
  };
}

/**
 * Create test warrant acceptance data with optional overrides.
 */
function createTestWarrantAcceptanceData(overrides: Partial<OcfWarrantAcceptance> = {}): OcfWarrantAcceptance {
  const id = overrides.id ?? generateTestId('warrant-accept');
  return {
    id,
    date: generateDateString(0),
    security_id: overrides.security_id ?? generateTestId('warrant-security'),
    ...overrides,
  };
}

/**
 * Create test convertible acceptance data with optional overrides.
 */
function createTestConvertibleAcceptanceData(
  overrides: Partial<OcfConvertibleAcceptance> = {}
): OcfConvertibleAcceptance {
  const id = overrides.id ?? generateTestId('conv-accept');
  return {
    id,
    date: generateDateString(0),
    security_id: overrides.security_id ?? generateTestId('convertible-security'),
    ...overrides,
  };
}

/**
 * Create test equity compensation acceptance data with optional overrides.
 */
function createTestEquityCompensationAcceptanceData(
  overrides: Partial<OcfEquityCompensationAcceptance> = {}
): OcfEquityCompensationAcceptance {
  const id = overrides.id ?? generateTestId('equity-accept');
  return {
    id,
    date: generateDateString(0),
    security_id: overrides.security_id ?? generateTestId('equity-security'),
    ...overrides,
  };
}

createIntegrationTestSuite('Acceptance Type operations', (getContext) => {
  /**
   * Test: Create stock acceptance via batch API.
   *
   * Verifies that a stock acceptance transaction can be created atomically.
   */
  test('creates stock acceptance via batch API', async () => {
    const ctx = getContext();

    // Setup issuer
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const stockAcceptanceData = createTestStockAcceptanceData({
      id: generateTestId('batch-stock-accept'),
      comments: ['Stock acceptance created via batch API'],
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('stockAcceptance', stockAcceptanceData).execute();

    expect(result.createdCids).toHaveLength(1);
    expect(result.updatedCapTableCid).toBeTruthy();
  });

  /**
   * Test: Create warrant acceptance via batch API.
   */
  test('creates warrant acceptance via batch API', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const warrantAcceptanceData = createTestWarrantAcceptanceData({
      id: generateTestId('batch-warrant-accept'),
      comments: ['Warrant acceptance created via batch API'],
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('warrantAcceptance', warrantAcceptanceData).execute();

    expect(result.createdCids).toHaveLength(1);
    expect(result.updatedCapTableCid).toBeTruthy();
  });

  /**
   * Test: Create convertible acceptance via batch API.
   */
  test('creates convertible acceptance via batch API', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const convertibleAcceptanceData = createTestConvertibleAcceptanceData({
      id: generateTestId('batch-conv-accept'),
      comments: ['Convertible acceptance created via batch API'],
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('convertibleAcceptance', convertibleAcceptanceData).execute();

    expect(result.createdCids).toHaveLength(1);
    expect(result.updatedCapTableCid).toBeTruthy();
  });

  /**
   * Test: Create equity compensation acceptance via batch API.
   */
  test('creates equity compensation acceptance via batch API', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const equityAcceptanceData = createTestEquityCompensationAcceptanceData({
      id: generateTestId('batch-equity-accept'),
      comments: ['Equity compensation acceptance created via batch API'],
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('equityCompensationAcceptance', equityAcceptanceData).execute();

    expect(result.createdCids).toHaveLength(1);
    expect(result.updatedCapTableCid).toBeTruthy();
  });

  /**
   * Test: Create multiple acceptance types in a single batch.
   *
   * Verifies that different acceptance types can be created atomically in one batch transaction.
   */
  test('creates multiple acceptance types in single batch', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const stockAcceptance = createTestStockAcceptanceData({
      id: generateTestId('multi-stock-accept'),
    });
    const warrantAcceptance = createTestWarrantAcceptanceData({
      id: generateTestId('multi-warrant-accept'),
    });
    const convertibleAcceptance = createTestConvertibleAcceptanceData({
      id: generateTestId('multi-conv-accept'),
    });
    const equityAcceptance = createTestEquityCompensationAcceptanceData({
      id: generateTestId('multi-equity-accept'),
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch
      .create('stockAcceptance', stockAcceptance)
      .create('warrantAcceptance', warrantAcceptance)
      .create('convertibleAcceptance', convertibleAcceptance)
      .create('equityCompensationAcceptance', equityAcceptance)
      .execute();

    expect(result.createdCids).toHaveLength(4);
    expect(result.updatedCapTableCid).toBeTruthy();
  });

  /**
   * Test: Acceptance without comments.
   *
   * Verifies that acceptance transactions work without optional comments.
   */
  test('creates acceptance without optional comments', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    // Create acceptance data without comments
    const stockAcceptanceData: OcfStockAcceptance = {
      id: generateTestId('no-comments-accept'),
      date: generateDateString(0),
      security_id: generateTestId('no-comments-security'),
    };

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('stockAcceptance', stockAcceptanceData).execute();

    expect(result.createdCids).toHaveLength(1);
    expect(result.updatedCapTableCid).toBeTruthy();
  });

  /**
   * Test: Edit stock acceptance via batch API.
   *
   * Verifies that an existing stock acceptance can be edited via the batch API.
   */
  test('edits stock acceptance via batch API', async () => {
    const ctx = getContext();

    // Setup issuer
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const acceptanceId = generateTestId('edit-stock-accept');
    const stockAcceptanceData = createTestStockAcceptanceData({
      id: acceptanceId,
      comments: ['Original comment'],
    });

    // Create the acceptance first
    const createBatch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const createResult = await createBatch.create('stockAcceptance', stockAcceptanceData).execute();
    expect(createResult.createdCids).toHaveLength(1);

    // Get updated CapTable contract details for the edit operation
    const newCapTableContractId = createResult.updatedCapTableCid;
    const capTableEvents = await ctx.ocp.client.getEventsByContractId({
      contractId: newCapTableContractId,
    });
    if (!capTableEvents.created?.createdEvent) {
      throw new Error('Failed to get CapTable created event');
    }
    const newCapTableContractDetails = {
      templateId: capTableEvents.created.createdEvent.templateId,
      contractId: newCapTableContractId,
      createdEventBlob: capTableEvents.created.createdEvent.createdEventBlob,
      synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
    };

    // Edit the acceptance with updated comments
    const updatedAcceptanceData: OcfStockAcceptance = {
      ...stockAcceptanceData,
      comments: ['Updated comment after edit'],
    };

    const editBatch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: newCapTableContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: newCapTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const editResult = await editBatch.edit('stockAcceptance', updatedAcceptanceData).execute();

    expect(editResult.editedCids).toHaveLength(1);
    expect(editResult.updatedCapTableCid).toBeTruthy();
  });

  /**
   * Test: Delete stock acceptance via batch API.
   *
   * Verifies that an existing stock acceptance can be deleted via the batch API.
   */
  test('deletes stock acceptance via batch API', async () => {
    const ctx = getContext();

    // Setup issuer
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const acceptanceId = generateTestId('delete-stock-accept');
    const stockAcceptanceData = createTestStockAcceptanceData({
      id: acceptanceId,
    });

    // Create the acceptance first
    const createBatch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const createResult = await createBatch.create('stockAcceptance', stockAcceptanceData).execute();
    expect(createResult.createdCids).toHaveLength(1);

    // Get updated CapTable contract details for the delete operation
    const newCapTableContractId = createResult.updatedCapTableCid;
    const capTableEvents = await ctx.ocp.client.getEventsByContractId({
      contractId: newCapTableContractId,
    });
    if (!capTableEvents.created?.createdEvent) {
      throw new Error('Failed to get CapTable created event');
    }
    const newCapTableContractDetails = {
      templateId: capTableEvents.created.createdEvent.templateId,
      contractId: newCapTableContractId,
      createdEventBlob: capTableEvents.created.createdEvent.createdEventBlob,
      synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
    };

    // Delete the acceptance
    const deleteBatch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: newCapTableContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: newCapTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    // Delete operation should not throw
    await deleteBatch.delete('stockAcceptance', acceptanceId).execute();
  });
});
