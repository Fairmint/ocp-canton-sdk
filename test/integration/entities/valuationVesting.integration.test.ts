/**
 * Integration tests for Valuation and Vesting types via batch API.
 *
 * Tests the batch API for:
 * - Valuation (409A valuations)
 * - VestingStart (when vesting schedule begins)
 * - VestingEvent (milestone-based vesting events)
 * - VestingAcceleration (accelerated vesting due to M&A, etc.)
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
  setupTestIssuer,
} from '../utils';

createIntegrationTestSuite('Valuation and Vesting types via batch API', (getContext) => {
  /**
   * Test: Create a valuation (409A) via batch API.
   *
   * Valuations track company valuations, typically 409A valuations used for equity compensation pricing.
   */
  test('creates valuation entity via batch API', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    // Create a stock class ID (placeholder since stockClass creation has numeric encoding issues)
    const stockClassId = generateTestId('stock-class-for-valuation');

    const valuationData = createTestValuationData({
      id: generateTestId('valuation'),
      stock_class_id: stockClassId,
      price_per_share: { amount: '2.50', currency: 'USD' },
      provider: '409A Valuation Services',
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('valuation', valuationData).execute();

    expect(result.createdCids).toHaveLength(1);
    expect(result.updatedCapTableCid).toBeTruthy();
  });

  /**
   * Test: Create multiple valuations in a single batch.
   *
   * A company may have multiple 409A valuations over time.
   */
  test('creates multiple valuations in batch', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const stockClassId = generateTestId('stock-class-for-valuations');

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    // Create multiple valuations with different dates and prices
    const result = await batch
      .create(
        'valuation',
        createTestValuationData({
          id: generateTestId('valuation-q1'),
          stock_class_id: stockClassId,
          price_per_share: { amount: '1.00', currency: 'USD' },
          effective_date: '2024-01-15',
        })
      )
      .create(
        'valuation',
        createTestValuationData({
          id: generateTestId('valuation-q2'),
          stock_class_id: stockClassId,
          price_per_share: { amount: '1.50', currency: 'USD' },
          effective_date: '2024-04-15',
        })
      )
      .create(
        'valuation',
        createTestValuationData({
          id: generateTestId('valuation-q3'),
          stock_class_id: stockClassId,
          price_per_share: { amount: '2.00', currency: 'USD' },
          effective_date: '2024-07-15',
        })
      )
      .execute();

    expect(result.createdCids).toHaveLength(3);
    expect(result.updatedCapTableCid).toBeTruthy();
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
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    // Placeholder security and condition IDs (these would reference existing entities)
    const securityId = generateTestId('equity-security');
    const vestingConditionId = 'vesting-start'; // Matches condition ID in vesting terms

    const vestingStartData = createTestVestingStartData({
      id: generateTestId('vesting-start-tx'),
      security_id: securityId,
      vesting_condition_id: vestingConditionId,
      date: '2024-01-15',
      comments: ['Employee hire date vesting start'],
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('vestingStart', vestingStartData).execute();

    expect(result.createdCids).toHaveLength(1);
    expect(result.updatedCapTableCid).toBeTruthy();
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
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const securityId = generateTestId('equity-security-milestone');
    const vestingConditionId = 'milestone-ipo'; // Hypothetical milestone condition

    const vestingEventData = createTestVestingEventData({
      id: generateTestId('vesting-event-tx'),
      security_id: securityId,
      vesting_condition_id: vestingConditionId,
      date: '2024-06-15',
      comments: ['IPO milestone achieved'],
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('vestingEvent', vestingEventData).execute();

    expect(result.createdCids).toHaveLength(1);
    expect(result.updatedCapTableCid).toBeTruthy();
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
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const securityId = generateTestId('equity-security-accel');

    const vestingAccelerationData = createTestVestingAccelerationData({
      id: generateTestId('vesting-accel-tx'),
      security_id: securityId,
      quantity: '50000',
      reason_text: 'Single-trigger acceleration upon company acquisition',
      date: '2024-12-01',
      comments: ['100% acceleration per employment agreement section 5.2', 'Acquisition by Acquirer Inc.'],
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('vestingAcceleration', vestingAccelerationData).execute();

    expect(result.createdCids).toHaveLength(1);
    expect(result.updatedCapTableCid).toBeTruthy();
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
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const securityId1 = generateTestId('security-1');
    const securityId2 = generateTestId('security-2');

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch
      .create(
        'vestingStart',
        createTestVestingStartData({
          id: generateTestId('vs-1'),
          security_id: securityId1,
          vesting_condition_id: 'start-condition',
        })
      )
      .create(
        'vestingEvent',
        createTestVestingEventData({
          id: generateTestId('ve-1'),
          security_id: securityId1,
          vesting_condition_id: 'milestone-condition',
        })
      )
      .create(
        'vestingAcceleration',
        createTestVestingAccelerationData({
          id: generateTestId('va-1'),
          security_id: securityId2,
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
   * This tests creating different OCF types together atomically.
   */
  test('creates valuation and vesting types together in batch', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const stockClassId = generateTestId('stock-class');
    const securityId = generateTestId('security');

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch
      .create(
        'valuation',
        createTestValuationData({
          id: generateTestId('val'),
          stock_class_id: stockClassId,
        })
      )
      .create(
        'vestingStart',
        createTestVestingStartData({
          id: generateTestId('vs'),
          security_id: securityId,
          vesting_condition_id: 'start',
        })
      )
      .execute();

    expect(result.createdCids).toHaveLength(2);
    expect(result.updatedCapTableCid).toBeTruthy();
  });
});
