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
import {
  generateDateString,
  generateTestId,
  setupConvertibleSecurity,
  setupEquityCompensationSecurity,
  setupStockSecurity,
  setupTestIssuer,
  setupWarrantSecurity,
} from '../utils';

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

    // Create prerequisite stock security (V30 DAML contracts validate security_id exists)
    const stockSecurity = await setupStockSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });

    // Get updated cap table contract details
    const events = await ctx.ocp.client.getEventsByContractId({ contractId: stockSecurity.capTableContractId });
    const updatedCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: stockSecurity.capTableContractId,
          createdEventBlob: events.created.createdEvent.createdEventBlob,
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    const stockAcceptanceData = createTestStockAcceptanceData({
      id: generateTestId('batch-stock-accept'),
      security_id: stockSecurity.securityId,
      comments: ['Stock acceptance created via batch API'],
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: stockSecurity.capTableContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: updatedCapTableDetails,
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

    // Create prerequisite warrant security (V30 DAML contracts validate security_id exists)
    const warrantSecurity = await setupWarrantSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });

    // Get updated cap table contract details
    const events = await ctx.ocp.client.getEventsByContractId({ contractId: warrantSecurity.capTableContractId });
    const updatedCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: warrantSecurity.capTableContractId,
          createdEventBlob: events.created.createdEvent.createdEventBlob,
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    const warrantAcceptanceData = createTestWarrantAcceptanceData({
      id: generateTestId('batch-warrant-accept'),
      security_id: warrantSecurity.securityId,
      comments: ['Warrant acceptance created via batch API'],
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: warrantSecurity.capTableContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: updatedCapTableDetails,
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

    // Create prerequisite convertible security (V30 DAML contracts validate security_id exists)
    const convertibleSecurity = await setupConvertibleSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });

    // Get updated cap table contract details
    const events = await ctx.ocp.client.getEventsByContractId({
      contractId: convertibleSecurity.capTableContractId,
    });
    const updatedCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: convertibleSecurity.capTableContractId,
          createdEventBlob: events.created.createdEvent.createdEventBlob,
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    const convertibleAcceptanceData = createTestConvertibleAcceptanceData({
      id: generateTestId('batch-conv-accept'),
      security_id: convertibleSecurity.securityId,
      comments: ['Convertible acceptance created via batch API'],
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: convertibleSecurity.capTableContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: updatedCapTableDetails,
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

    // Create prerequisite equity compensation security (V30 DAML contracts validate security_id exists)
    const eqCompSecurity = await setupEquityCompensationSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });

    // Get updated cap table contract details
    const events = await ctx.ocp.client.getEventsByContractId({ contractId: eqCompSecurity.capTableContractId });
    const updatedCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: eqCompSecurity.capTableContractId,
          createdEventBlob: events.created.createdEvent.createdEventBlob,
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    const equityAcceptanceData = createTestEquityCompensationAcceptanceData({
      id: generateTestId('batch-equity-accept'),
      security_id: eqCompSecurity.securityId,
      comments: ['Equity compensation acceptance created via batch API'],
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: eqCompSecurity.capTableContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: updatedCapTableDetails,
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

    // Create prerequisite securities for each acceptance type (V30 DAML contracts validate security_id exists)
    // We need to chain these to properly update the cap table contract after each

    // 1. Create stock security
    const stockSecurity = await setupStockSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });

    // Get updated cap table details after stock security
    let events = await ctx.ocp.client.getEventsByContractId({ contractId: stockSecurity.capTableContractId });
    let currentCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: stockSecurity.capTableContractId,
          createdEventBlob: events.created.createdEvent.createdEventBlob,
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    // 2. Create warrant security
    const warrantSecurity = await setupWarrantSecurity(ctx.ocp, {
      issuerContractId: stockSecurity.capTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: currentCapTableDetails,
    });

    events = await ctx.ocp.client.getEventsByContractId({ contractId: warrantSecurity.capTableContractId });
    currentCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: warrantSecurity.capTableContractId,
          createdEventBlob: events.created.createdEvent.createdEventBlob,
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    // 3. Create convertible security
    const convertibleSecurity = await setupConvertibleSecurity(ctx.ocp, {
      issuerContractId: warrantSecurity.capTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: currentCapTableDetails,
    });

    events = await ctx.ocp.client.getEventsByContractId({ contractId: convertibleSecurity.capTableContractId });
    currentCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: convertibleSecurity.capTableContractId,
          createdEventBlob: events.created.createdEvent.createdEventBlob,
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    // 4. Create equity compensation security
    const eqCompSecurity = await setupEquityCompensationSecurity(ctx.ocp, {
      issuerContractId: convertibleSecurity.capTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: currentCapTableDetails,
    });

    events = await ctx.ocp.client.getEventsByContractId({ contractId: eqCompSecurity.capTableContractId });
    const finalCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: eqCompSecurity.capTableContractId,
          createdEventBlob: events.created.createdEvent.createdEventBlob,
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    const stockAcceptance = createTestStockAcceptanceData({
      id: generateTestId('multi-stock-accept'),
      security_id: stockSecurity.securityId,
    });
    const warrantAcceptance = createTestWarrantAcceptanceData({
      id: generateTestId('multi-warrant-accept'),
      security_id: warrantSecurity.securityId,
    });
    const convertibleAcceptance = createTestConvertibleAcceptanceData({
      id: generateTestId('multi-conv-accept'),
      security_id: convertibleSecurity.securityId,
    });
    const equityAcceptance = createTestEquityCompensationAcceptanceData({
      id: generateTestId('multi-equity-accept'),
      security_id: eqCompSecurity.securityId,
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: eqCompSecurity.capTableContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: finalCapTableDetails,
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

    // Create prerequisite stock security (V30 DAML contracts validate security_id exists)
    const stockSecurity = await setupStockSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });

    // Get updated cap table contract details
    const events = await ctx.ocp.client.getEventsByContractId({ contractId: stockSecurity.capTableContractId });
    const updatedCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: stockSecurity.capTableContractId,
          createdEventBlob: events.created.createdEvent.createdEventBlob,
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    // Create acceptance data without comments
    const stockAcceptanceData: OcfStockAcceptance = {
      id: generateTestId('no-comments-accept'),
      date: generateDateString(0),
      security_id: stockSecurity.securityId,
    };

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: stockSecurity.capTableContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: updatedCapTableDetails,
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

    // Create prerequisite stock security (V30 DAML contracts validate security_id exists)
    const stockSecurity = await setupStockSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });

    // Get updated cap table contract details after security setup
    let events = await ctx.ocp.client.getEventsByContractId({ contractId: stockSecurity.capTableContractId });
    const currentCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: stockSecurity.capTableContractId,
          createdEventBlob: events.created.createdEvent.createdEventBlob,
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    const acceptanceId = generateTestId('edit-stock-accept');
    const stockAcceptanceData = createTestStockAcceptanceData({
      id: acceptanceId,
      security_id: stockSecurity.securityId,
      comments: ['Original comment'],
    });

    // Create the acceptance first
    const createBatch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: stockSecurity.capTableContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: currentCapTableDetails,
      actAs: [ctx.issuerParty],
    });

    const createResult = await createBatch.create('stockAcceptance', stockAcceptanceData).execute();
    expect(createResult.createdCids).toHaveLength(1);

    // Get updated CapTable contract details for the edit operation
    const newCapTableContractId = createResult.updatedCapTableCid;
    events = await ctx.ocp.client.getEventsByContractId({
      contractId: newCapTableContractId,
    });
    if (!events.created?.createdEvent) {
      throw new Error('Failed to get CapTable created event');
    }
    const newCapTableContractDetails = {
      templateId: events.created.createdEvent.templateId,
      contractId: newCapTableContractId,
      createdEventBlob: events.created.createdEvent.createdEventBlob,
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

    // Create prerequisite stock security (V30 DAML contracts validate security_id exists)
    const stockSecurity = await setupStockSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });

    // Get updated cap table contract details after security setup
    let events = await ctx.ocp.client.getEventsByContractId({ contractId: stockSecurity.capTableContractId });
    const currentCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: stockSecurity.capTableContractId,
          createdEventBlob: events.created.createdEvent.createdEventBlob,
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    const acceptanceId = generateTestId('delete-stock-accept');
    const stockAcceptanceData = createTestStockAcceptanceData({
      id: acceptanceId,
      security_id: stockSecurity.securityId,
    });

    // Create the acceptance first
    const createBatch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: stockSecurity.capTableContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: currentCapTableDetails,
      actAs: [ctx.issuerParty],
    });

    const createResult = await createBatch.create('stockAcceptance', stockAcceptanceData).execute();
    expect(createResult.createdCids).toHaveLength(1);

    // Get updated CapTable contract details for the delete operation
    const newCapTableContractId = createResult.updatedCapTableCid;
    events = await ctx.ocp.client.getEventsByContractId({
      contractId: newCapTableContractId,
    });
    if (!events.created?.createdEvent) {
      throw new Error('Failed to get CapTable created event');
    }
    const newCapTableContractDetails = {
      templateId: events.created.createdEvent.templateId,
      contractId: newCapTableContractId,
      createdEventBlob: events.created.createdEvent.createdEventBlob,
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
