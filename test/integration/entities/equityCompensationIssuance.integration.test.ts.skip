/**
 * Integration tests for EquityCompensationIssuance operations.
 *
 * Tests the full lifecycle of EquityCompensationIssuance entities:
 *
 * - Create equity compensation issuance and read back as valid OCF
 * - Data round-trip verification
 * - Archive operation
 * - Different compensation types (OPTION_ISO, OPTION_NSO, RSU)
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration
 * ```
 */

import { validateOcfObject } from '../../utils/ocfSchemaValidator';
import { createIntegrationTestSuite } from '../setup';
import {
  createTestEquityCompensationIssuanceData,
  generateTestId,
  setupTestEquityCompensationIssuance,
  setupTestIssuer,
  setupTestStakeholder,
  setupTestStockClass,
  setupTestStockPlan,
} from '../utils';

createIntegrationTestSuite('EquityCompensationIssuance operations', (getContext) => {
  test('creates equity compensation issuance and reads it back as valid OCF', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const stakeholderSetup = await setupTestStakeholder(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stakeholderData: {
        id: generateTestId('stakeholder-for-ec'),
        name: { legal_name: 'Employee One' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassData: {
        id: generateTestId('stock-class-for-ec'),
        name: 'Common Stock',
        class_type: 'COMMON',
        default_id_prefix: 'CS-',
        initial_shares_authorized: '10000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    const planSetup = await setupTestStockPlan(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassIds: [stockClassSetup.stockClassData.id],
      stockPlanData: {
        id: generateTestId('plan-for-ec'),
        plan_name: 'Equity Plan',
        initial_shares_reserved: '1000000',
      },
    });

    const ecSetup = await setupTestEquityCompensationIssuance(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stakeholderId: stakeholderSetup.stakeholderData.id,
      stockPlanId: planSetup.stockPlanData.id,
      stockClassId: stockClassSetup.stockClassData.id,
      equityCompensationIssuanceData: {
        id: generateTestId('ec-ocf-test'),
        compensation_type: 'OPTION_ISO',
        quantity: '5000',
        exercise_price: { amount: '1.50', currency: 'USD' },
      },
    });

    const ocfResult = await ctx.ocp.OpenCapTable.equityCompensationIssuance.getEquityCompensationIssuanceEventAsOcf({
      contractId: ecSetup.equityCompensationIssuanceContractId,
    });

    expect(ocfResult.event.object_type).toBe('TX_EQUITY_COMPENSATION_ISSUANCE');
    expect(ocfResult.event.compensation_type).toBe('OPTION_ISO');
    expect(ocfResult.event.quantity).toBe('5000');

    await validateOcfObject(ocfResult.event as unknown as Record<string, unknown>);
  });

  test('equity compensation issuance data round-trips correctly', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const stakeholderSetup = await setupTestStakeholder(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stakeholderData: {
        id: generateTestId('stakeholder-for-ec-rt'),
        name: { legal_name: 'Employee Two' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const originalData = createTestEquityCompensationIssuanceData(stakeholderSetup.stakeholderData.id, {
      id: generateTestId('ec-roundtrip'),
      compensation_type: 'OPTION_NSO',
      quantity: '7500',
      exercise_price: { amount: '2.00', currency: 'USD' },
      comments: ['Roundtrip test issuance'],
    });

    const ecSetup = await setupTestEquityCompensationIssuance(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stakeholderId: stakeholderSetup.stakeholderData.id,
      equityCompensationIssuanceData: originalData,
    });

    const ocfResult = await ctx.ocp.OpenCapTable.equityCompensationIssuance.getEquityCompensationIssuanceEventAsOcf({
      contractId: ecSetup.equityCompensationIssuanceContractId,
    });

    expect(ocfResult.event.id).toBe(originalData.id);
    expect(ocfResult.event.stakeholder_id).toBe(originalData.stakeholder_id);
    expect(ocfResult.event.compensation_type).toBe(originalData.compensation_type);
    expect(ocfResult.event.quantity).toBe(originalData.quantity);
  });

  test('creates RSU compensation', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const stakeholderSetup = await setupTestStakeholder(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stakeholderData: {
        id: generateTestId('stakeholder-for-rsu'),
        name: { legal_name: 'Employee Three' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const ecSetup = await setupTestEquityCompensationIssuance(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stakeholderId: stakeholderSetup.stakeholderData.id,
      equityCompensationIssuanceData: {
        id: generateTestId('rsu-test'),
        compensation_type: 'RSU',
        quantity: '2500',
        // RSUs typically don't have exercise price
      },
    });

    const ocfResult = await ctx.ocp.OpenCapTable.equityCompensationIssuance.getEquityCompensationIssuanceEventAsOcf({
      contractId: ecSetup.equityCompensationIssuanceContractId,
    });

    expect(ocfResult.event.compensation_type).toBe('RSU');
    await validateOcfObject(ocfResult.event as unknown as Record<string, unknown>);
  });

  test('archives equity compensation issuance', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const stakeholderSetup = await setupTestStakeholder(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stakeholderData: {
        id: generateTestId('stakeholder-for-ec-archive'),
        name: { legal_name: 'Employee Archive' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const ecSetup = await setupTestEquityCompensationIssuance(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stakeholderId: stakeholderSetup.stakeholderData.id,
      equityCompensationIssuanceData: {
        id: generateTestId('ec-archive-test'),
        compensation_type: 'OPTION_ISO',
        quantity: '3000',
      },
    });

    const archiveCmd =
      ctx.ocp.OpenCapTable.equityCompensationIssuance.buildArchiveEquityCompensationIssuanceByIssuerCommand({
        contractId: ecSetup.equityCompensationIssuanceContractId,
      });

    await ctx.ocp.client.submitAndWaitForTransactionTree({
      commands: [archiveCmd],
      actAs: [ctx.issuerParty],
    });

    // Archive operation succeeded if no error thrown
  });
});
