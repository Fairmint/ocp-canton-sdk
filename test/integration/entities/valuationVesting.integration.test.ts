/**
 * Integration tests for Valuation and Vesting types via batch API.
 *
 * Tests the batch API for:
 * - Valuation (409A valuations) - SKIPPED: requires existing stock class
 * - VestingStart (when vesting schedule begins)
 * - VestingEvent (milestone-based vesting events)
 * - VestingAcceleration (accelerated vesting due to M&A, etc.)
 *
 * Note: Valuation tests are skipped because they require a valid stock_class_id that exists
 * in the DAML contract. Stock class creation via batch API has numeric encoding issues
 * (see capTableBatch.integration.test.ts comments), so we cannot easily create the
 * prerequisite stock class.
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration -- test/integration/entities/valuationVesting.integration.test.ts
 * ```
 */

import { createIntegrationTestSuite } from '../setup';
import {
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
   * SKIPPED: Valuations require a valid stock_class_id that exists in the DAML contract.
   * Stock class creation via batch API has numeric encoding issues, so we cannot easily
   * create the prerequisite stock class needed for this test.
   */
  test.skip('creates valuation entity via batch API', async () => {
    // This test requires a valid stock_class_id. Stock class creation via batch API
    // has numeric encoding issues (JSON API expects Numeric as objects but receives strings).
    // See capTableBatch.integration.test.ts for details on this limitation.
  });

  /**
   * Test: Create multiple valuations in a single batch.
   *
   * SKIPPED: See above - valuations require valid stock class references.
   */
  test.skip('creates multiple valuations in batch', async () => {
    // This test requires valid stock_class_ids for each valuation.
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
   * SKIPPED: This test includes valuation which requires valid stock class references.
   */
  test.skip('creates valuation and vesting types together in batch', async () => {
    // This test includes valuation which requires a valid stock_class_id.
  });
});
