/**
 * Integration tests for Valuation and Vesting types via batch API.
 *
 * Tests the batch API for:
 * - Valuation (409A valuations) - Previously skipped: requires existing stock class
 * - VestingStart (when vesting schedule begins)
 * - VestingEvent (milestone-based vesting events)
 * - VestingAcceleration (accelerated vesting due to M&A, etc.)
 *
 * Valuation tests create a real stock class prerequisite before submitting valuation payloads,
 * because DAML validates stock_class_id references.
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration -- test/integration/entities/valuationVesting.integration.test.ts
 * ```
 */

import { createIntegrationTestSuite } from '../setup';
import {
  createTestValuationData,
  createTestVestingAccelerationData,
  createTestVestingEventData,
  createTestVestingStartData,
  generateTestId,
  getCapTableDetails,
  requireCreatedEventBlob,
  setupStockSecurity,
  setupTestIssuer,
} from '../utils';

function extractContractIdString(cid: { value: unknown }): string {
  if (typeof cid.value !== 'string') {
    throw new Error(`Expected contractId.value to be a string, got ${typeof cid.value}`);
  }
  return cid.value;
}

createIntegrationTestSuite('Valuation and Vesting types via batch API', (getContext) => {
  /**
   * Test: Create a valuation (409A) via batch API.
   *
   * Valuations require a valid stock_class_id that exists in the DAML contract.
   */
  test('creates valuation entity via batch API', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    const stockSecurity = await setupStockSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });
    const capTableContractDetails = await getCapTableDetails(
      ctx.ocp,
      stockSecurity.capTableContractId,
      issuerSetup.capTableContractDetails.synchronizerId
    );

    const valuationData = createTestValuationData({
      id: generateTestId('valuation'),
      stock_class_id: stockSecurity.stockClassId,
      price_per_share: { amount: '2.50', currency: 'USD' },
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: stockSecurity.capTableContractId,
      capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('valuation', valuationData).execute();

    expect(result.createdCids).toHaveLength(1);
    expect(result.updatedCapTableCid).toBeTruthy();

    const ocfResult = await ctx.ocp.OpenCapTable.valuation.get({
      contractId: extractContractIdString(result.createdCids[0]),
    });
    expect(ocfResult.data.object_type).toBe('VALUATION');
    expect(ocfResult.data.stock_class_id).toBe(valuationData.stock_class_id);
    expect(Number(ocfResult.data.price_per_share.amount)).toBe(Number(valuationData.price_per_share.amount));
    expect(ocfResult.data.price_per_share.currency).toBe(valuationData.price_per_share.currency);
  });

  /**
   * Test: Create multiple valuations in a single batch.
   *
   * Valuations require valid stock class references.
   */
  test('creates multiple valuations in batch', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    const stockSecurity = await setupStockSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });
    const capTableContractDetails = await getCapTableDetails(
      ctx.ocp,
      stockSecurity.capTableContractId,
      issuerSetup.capTableContractDetails.synchronizerId
    );

    const valuation1 = createTestValuationData({
      id: generateTestId('valuation-1'),
      stock_class_id: stockSecurity.stockClassId,
      price_per_share: { amount: '1.50', currency: 'USD' },
      effective_date: '2024-01-01',
    });
    const valuation2 = createTestValuationData({
      id: generateTestId('valuation-2'),
      stock_class_id: stockSecurity.stockClassId,
      price_per_share: { amount: '2.25', currency: 'USD' },
      effective_date: '2024-06-01',
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: stockSecurity.capTableContractId,
      capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('valuation', valuation1).create('valuation', valuation2).execute();

    expect(result.createdCids).toHaveLength(2);
    expect(result.updatedCapTableCid).toBeTruthy();

    const ocfResults = await Promise.all(
      result.createdCids.map(async (cid) =>
        ctx.ocp.OpenCapTable.valuation.get({
          contractId: extractContractIdString(cid),
        })
      )
    );
    expect(ocfResults.map((ocf) => ocf.data.id)).toEqual([valuation1.id, valuation2.id]);
  });

  /**
   * Test: Create a vesting start transaction via batch API.
   *
   * VestingStart marks when a vesting schedule begins for a security.
   */
  test('creates vesting start transaction via batch API', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    // Create prerequisite stock security (V30 DAML contracts validate security_id exists)
    const stockSecurity = await setupStockSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });

    // Get updated cap table contract details
    const events = await ctx.ocp.ledger.getEventsByContractId({ contractId: stockSecurity.capTableContractId });
    const updatedCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: stockSecurity.capTableContractId,
          createdEventBlob: requireCreatedEventBlob(events.created.createdEvent),
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    const vestingConditionId = 'vesting-start'; // Matches condition ID in vesting terms

    const vestingStartData = createTestVestingStartData({
      id: generateTestId('vesting-start-tx'),
      security_id: stockSecurity.securityId,
      vesting_condition_id: vestingConditionId,
      date: '2024-01-15',
      comments: ['Employee hire date vesting start'],
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: stockSecurity.capTableContractId,
      capTableContractDetails: updatedCapTableDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('vestingStart', vestingStartData).execute();

    expect(result.createdCids).toHaveLength(1);
    expect(result.updatedCapTableCid).toBeTruthy();

    const ocfResult = await ctx.ocp.OpenCapTable.vestingStart.get({
      contractId: extractContractIdString(result.createdCids[0]),
    });
    expect(ocfResult.data.object_type).toBe('TX_VESTING_START');
    expect(ocfResult.data.security_id).toBe(vestingStartData.security_id);
    expect(ocfResult.data.vesting_condition_id).toBe(vestingStartData.vesting_condition_id);
  });

  /**
   * Test: Create a vesting event transaction via batch API.
   *
   * VestingEvent records when a milestone-based vesting condition is satisfied.
   */
  test('creates vesting event transaction via batch API', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    // Create prerequisite stock security (V30 DAML contracts validate security_id exists)
    const stockSecurity = await setupStockSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });

    // Get updated cap table contract details
    const events = await ctx.ocp.ledger.getEventsByContractId({ contractId: stockSecurity.capTableContractId });
    const updatedCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: stockSecurity.capTableContractId,
          createdEventBlob: requireCreatedEventBlob(events.created.createdEvent),
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    const vestingConditionId = 'milestone-ipo'; // Hypothetical milestone condition

    const vestingEventData = createTestVestingEventData({
      id: generateTestId('vesting-event-tx'),
      security_id: stockSecurity.securityId,
      vesting_condition_id: vestingConditionId,
      date: '2024-06-15',
      comments: ['IPO milestone achieved'],
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: stockSecurity.capTableContractId,
      capTableContractDetails: updatedCapTableDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('vestingEvent', vestingEventData).execute();

    expect(result.createdCids).toHaveLength(1);
    expect(result.updatedCapTableCid).toBeTruthy();

    const ocfResult = await ctx.ocp.OpenCapTable.vestingEvent.get({
      contractId: extractContractIdString(result.createdCids[0]),
    });
    expect(ocfResult.data.object_type).toBe('TX_VESTING_EVENT');
    expect(ocfResult.data.security_id).toBe(vestingEventData.security_id);
    expect(ocfResult.data.vesting_condition_id).toBe(vestingEventData.vesting_condition_id);
  });

  /**
   * Test: Create a vesting acceleration transaction via batch API.
   *
   * VestingAcceleration records when vesting is accelerated (e.g., due to M&A, termination).
   */
  test('creates vesting acceleration transaction via batch API', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    // Create prerequisite stock security (V30 DAML contracts validate security_id exists)
    const stockSecurity = await setupStockSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });

    // Get updated cap table contract details
    const events = await ctx.ocp.ledger.getEventsByContractId({ contractId: stockSecurity.capTableContractId });
    const updatedCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: stockSecurity.capTableContractId,
          createdEventBlob: requireCreatedEventBlob(events.created.createdEvent),
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    const vestingAccelerationData = createTestVestingAccelerationData({
      id: generateTestId('vesting-accel-tx'),
      security_id: stockSecurity.securityId,
      quantity: '50000',
      reason_text: 'Single-trigger acceleration upon company acquisition',
      date: '2024-12-01',
      comments: ['100% acceleration per employment agreement section 5.2', 'Acquisition by Acquirer Inc.'],
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: stockSecurity.capTableContractId,
      capTableContractDetails: updatedCapTableDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('vestingAcceleration', vestingAccelerationData).execute();

    expect(result.createdCids).toHaveLength(1);
    expect(result.updatedCapTableCid).toBeTruthy();

    const ocfResult = await ctx.ocp.OpenCapTable.vestingAcceleration.get({
      contractId: extractContractIdString(result.createdCids[0]),
    });
    expect(ocfResult.data.object_type).toBe('TX_VESTING_ACCELERATION');
    expect(ocfResult.data.security_id).toBe(vestingAccelerationData.security_id);
    expect(ocfResult.data.reason_text).toBe(vestingAccelerationData.reason_text);
  });

  /**
   * Test: Create all vesting types in a single batch.
   *
   * This tests creating multiple vesting-related transactions atomically.
   */
  test('creates multiple vesting transactions in a single batch', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    // Create prerequisite stock securities (V30 DAML contracts validate security_ids exist)
    const stockSecurity1 = await setupStockSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });

    let events = await ctx.ocp.ledger.getEventsByContractId({ contractId: stockSecurity1.capTableContractId });
    const currentCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: stockSecurity1.capTableContractId,
          createdEventBlob: requireCreatedEventBlob(events.created.createdEvent),
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    const stockSecurity2 = await setupStockSecurity(ctx.ocp, {
      issuerContractId: stockSecurity1.capTableContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: currentCapTableDetails,
    });

    events = await ctx.ocp.ledger.getEventsByContractId({ contractId: stockSecurity2.capTableContractId });
    const finalCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: stockSecurity2.capTableContractId,
          createdEventBlob: requireCreatedEventBlob(events.created.createdEvent),
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: stockSecurity2.capTableContractId,
      capTableContractDetails: finalCapTableDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch
      .create(
        'vestingStart',
        createTestVestingStartData({
          id: generateTestId('vs-1'),
          security_id: stockSecurity1.securityId,
          vesting_condition_id: 'start-condition',
        })
      )
      .create(
        'vestingEvent',
        createTestVestingEventData({
          id: generateTestId('ve-1'),
          security_id: stockSecurity1.securityId,
          vesting_condition_id: 'milestone-condition',
        })
      )
      .create(
        'vestingAcceleration',
        createTestVestingAccelerationData({
          id: generateTestId('va-1'),
          security_id: stockSecurity2.securityId,
          quantity: '25000',
          reason_text: 'Termination without cause - partial acceleration',
        })
      )
      .execute();

    expect(result.createdCids).toHaveLength(3);
    expect(result.updatedCapTableCid).toBeTruthy();
  });

  /**
   * Test: Create valuation and vesting types together in a batch.
   *
   * This test includes valuation, which requires valid stock class references.
   */
  test('creates valuation and vesting types together in batch', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    const stockSecurity = await setupStockSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });
    const capTableContractDetails = await getCapTableDetails(
      ctx.ocp,
      stockSecurity.capTableContractId,
      issuerSetup.capTableContractDetails.synchronizerId
    );

    const valuationData = createTestValuationData({
      id: generateTestId('valuation-combined'),
      stock_class_id: stockSecurity.stockClassId,
      price_per_share: { amount: '3.00', currency: 'USD' },
    });
    const vestingStartData = createTestVestingStartData({
      id: generateTestId('vesting-start-combined'),
      security_id: stockSecurity.securityId,
      vesting_condition_id: 'combined-start-condition',
    });
    const vestingAccelerationData = createTestVestingAccelerationData({
      id: generateTestId('vesting-accel-combined'),
      security_id: stockSecurity.securityId,
      quantity: '10000',
      reason_text: 'Combined batch acceleration test',
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: stockSecurity.capTableContractId,
      capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch
      .create('valuation', valuationData)
      .create('vestingStart', vestingStartData)
      .create('vestingAcceleration', vestingAccelerationData)
      .execute();

    expect(result.createdCids).toHaveLength(3);
    expect(result.updatedCapTableCid).toBeTruthy();

    const valuationResult = await ctx.ocp.OpenCapTable.valuation.get({
      contractId: extractContractIdString(result.createdCids[0]),
    });
    expect(valuationResult.data.object_type).toBe('VALUATION');
    expect(valuationResult.data.stock_class_id).toBe(stockSecurity.stockClassId);
  });
});
