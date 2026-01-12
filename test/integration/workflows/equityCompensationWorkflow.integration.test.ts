/**
 * Integration tests for equity compensation workflows.
 *
 * These tests exercise end-to-end equity compensation operations including:
 *
 * - Stock plan creation and option grants
 * - Option issuance with vesting terms
 * - RSU grants
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
  generateTestId,
  setupTestEquityCompensationIssuance,
  setupTestIssuer,
  setupTestStakeholder,
  setupTestStockClass,
  setupTestStockPlan,
  setupTestVestingTerms,
} from '../utils';

createIntegrationTestSuite('Equity compensation workflow', (getContext) => {
  /**
   * Test: Full equity compensation workflow
   *
   * This test verifies the complete equity compensation lifecycle:
   *
   * 1. Create issuer
   * 2. Create stock class (for the option pool)
   * 3. Create vesting terms (4-year with cliff)
   * 4. Create stock plan
   * 5. Create employee stakeholder
   * 6. Grant options to employee
   * 7. Read back and validate all entities
   */
  test('complete stock option grant workflow', async () => {
    const ctx = getContext();

    // Step 1: Create issuer
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      issuerData: {
        id: generateTestId('ec-workflow-issuer'),
        legal_name: 'Option Grant Corp',
        formation_date: '2024-01-01',
        country_of_formation: 'US',
      },
    });

    // Step 2: Create stock class
    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stockClassData: {
        id: generateTestId('ec-common-stock'),
        name: 'Common Stock',
        class_type: 'COMMON',
        default_id_prefix: 'EC-',
        initial_shares_authorized: '10000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    // Step 3: Create vesting terms
    const vestingTermsSetup = await setupTestVestingTerms(ctx.ocp, {
      issuerContractId: stockClassSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stockClassSetup.newCapTableContractDetails,
      vestingTermsData: {
        id: generateTestId('ec-vesting'),
        name: '4 Year Standard',
        description: '4-year vesting with 1-year cliff',
        allocation_type: 'CUMULATIVE_ROUNDING',
      },
    });

    // Step 4: Create stock plan
    const stockPlanSetup = await setupTestStockPlan(ctx.ocp, {
      issuerContractId: vestingTermsSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: vestingTermsSetup.newCapTableContractDetails,
      stockClassIds: [stockClassSetup.stockClassData.id],
      stockPlanData: {
        id: generateTestId('ec-plan'),
        plan_name: '2024 Equity Incentive Plan',
        initial_shares_reserved: '1000000',
        default_cancellation_behavior: 'RETURN_TO_POOL',
      },
    });

    // Step 5: Create employee stakeholder
    const employeeSetup = await setupTestStakeholder(ctx.ocp, {
      issuerContractId: stockPlanSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stockPlanSetup.newCapTableContractDetails,
      stakeholderData: {
        id: generateTestId('ec-employee'),
        name: { legal_name: 'New Employee', first_name: 'New', last_name: 'Employee' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationships: ['EMPLOYEE'],
      },
    });

    // Step 6: Grant ISO options to employee
    const optionGrantSetup = await setupTestEquityCompensationIssuance(ctx.ocp, {
      issuerContractId: employeeSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: employeeSetup.newCapTableContractDetails,
      stakeholderId: employeeSetup.stakeholderData.id,
      stockPlanId: stockPlanSetup.stockPlanData.id,
      stockClassId: stockClassSetup.stockClassData.id,
      equityCompensationIssuanceData: {
        id: generateTestId('ec-grant'),
        compensation_type: 'OPTION_ISO',
        quantity: '50000',
        exercise_price: { amount: '1.00', currency: 'USD' },
        vesting_terms_id: vestingTermsSetup.vestingTermsData.id,
      },
    });

    // Step 7: Validate all created entities
    const issuerOcf = await ctx.ocp.OpenCapTable.issuer.getIssuerAsOcf({
      contractId: issuerSetup.issuerOcfContractId,
    });
    expect(issuerOcf.issuer.legal_name).toBe('Option Grant Corp');
    await validateOcfObject(issuerOcf.issuer as unknown as Record<string, unknown>);

    const stockClassOcf = await ctx.ocp.OpenCapTable.stockClass.getStockClassAsOcf({
      contractId: stockClassSetup.stockClassContractId,
    });
    expect(stockClassOcf.stockClass.name).toBe('Common Stock');
    await validateOcfObject(stockClassOcf.stockClass as unknown as Record<string, unknown>);

    const vestingTermsOcf = await ctx.ocp.OpenCapTable.vestingTerms.getVestingTermsAsOcf({
      contractId: vestingTermsSetup.vestingTermsContractId,
    });
    expect(vestingTermsOcf.vestingTerms.name).toBe('4 Year Standard');
    await validateOcfObject(vestingTermsOcf.vestingTerms as unknown as Record<string, unknown>);

    const stockPlanOcf = await ctx.ocp.OpenCapTable.stockPlan.getStockPlanAsOcf({
      contractId: stockPlanSetup.stockPlanContractId,
    });
    expect(stockPlanOcf.stockPlan.plan_name).toBe('2024 Equity Incentive Plan');
    await validateOcfObject(stockPlanOcf.stockPlan as unknown as Record<string, unknown>);

    const employeeOcf = await ctx.ocp.OpenCapTable.stakeholder.getStakeholderAsOcf({
      contractId: employeeSetup.stakeholderContractId,
    });
    expect(employeeOcf.stakeholder.name.legal_name).toBe('New Employee');
    await validateOcfObject(employeeOcf.stakeholder as unknown as Record<string, unknown>);

    const grantOcf = await ctx.ocp.OpenCapTable.equityCompensationIssuance.getEquityCompensationIssuanceEventAsOcf({
      contractId: optionGrantSetup.equityCompensationIssuanceContractId,
    });
    expect(grantOcf.event.object_type).toBe('TX_EQUITY_COMPENSATION_ISSUANCE');
    expect(grantOcf.event.compensation_type).toBe('OPTION_ISO');
    expect(grantOcf.event.quantity).toBe('50000');
    expect(grantOcf.event.stakeholder_id).toBe(employeeSetup.stakeholderData.id);
    await validateOcfObject(grantOcf.event as unknown as Record<string, unknown>);
  });

  /**
   * Test: RSU grant workflow
   *
   * This test verifies RSU (Restricted Stock Unit) grants:
   *
   * 1. Setup cap table with stock plan
   * 2. Grant RSUs to employee
   * 3. Validate the RSU grant
   */
  test('RSU grant workflow', async () => {
    const ctx = getContext();

    // Setup cap table with stock plan
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      issuerData: {
        id: generateTestId('rsu-issuer'),
        legal_name: 'RSU Grant Corp',
      },
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stockClassData: {
        id: generateTestId('rsu-stock-class'),
        name: 'Common Stock',
        class_type: 'COMMON',
        default_id_prefix: 'RSU-',
        initial_shares_authorized: '10000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    const stockPlanSetup = await setupTestStockPlan(ctx.ocp, {
      issuerContractId: stockClassSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stockClassSetup.newCapTableContractDetails,
      stockClassIds: [stockClassSetup.stockClassData.id],
      stockPlanData: {
        id: generateTestId('rsu-plan'),
        plan_name: 'RSU Plan',
        initial_shares_reserved: '500000',
      },
    });

    const employeeSetup = await setupTestStakeholder(ctx.ocp, {
      issuerContractId: stockPlanSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stockPlanSetup.newCapTableContractDetails,
      stakeholderData: {
        id: generateTestId('rsu-employee'),
        name: { legal_name: 'RSU Recipient' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationships: ['EMPLOYEE'],
      },
    });

    // Grant RSUs
    const rsuGrantSetup = await setupTestEquityCompensationIssuance(ctx.ocp, {
      issuerContractId: employeeSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: employeeSetup.newCapTableContractDetails,
      stakeholderId: employeeSetup.stakeholderData.id,
      stockPlanId: stockPlanSetup.stockPlanData.id,
      stockClassId: stockClassSetup.stockClassData.id,
      equityCompensationIssuanceData: {
        id: generateTestId('rsu-grant'),
        compensation_type: 'RSU',
        quantity: '10000',
        // RSUs don't have exercise price - they're granted at $0
      },
    });

    // Validate RSU grant
    const grantOcf = await ctx.ocp.OpenCapTable.equityCompensationIssuance.getEquityCompensationIssuanceEventAsOcf({
      contractId: rsuGrantSetup.equityCompensationIssuanceContractId,
    });

    expect(grantOcf.event.object_type).toBe('TX_EQUITY_COMPENSATION_ISSUANCE');
    expect(grantOcf.event.compensation_type).toBe('RSU');
    expect(grantOcf.event.quantity).toBe('10000');
    expect(grantOcf.event.stock_plan_id).toBe(stockPlanSetup.stockPlanData.id);

    await validateOcfObject(grantOcf.event as unknown as Record<string, unknown>);
  });

  /**
   * Test: NSO option grant workflow
   *
   * This test verifies Non-Qualified Stock Option (NSO) grants:
   *
   * 1. Setup cap table
   * 2. Grant NSO to advisor
   * 3. Validate the grant
   */
  test('NSO option grant to advisor workflow', async () => {
    const ctx = getContext();

    // Setup cap table
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      issuerData: {
        id: generateTestId('nso-issuer'),
        legal_name: 'NSO Grant Corp',
      },
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stockClassData: {
        id: generateTestId('nso-stock-class'),
        name: 'Common Stock',
        class_type: 'COMMON',
        default_id_prefix: 'NSO-',
        initial_shares_authorized: '10000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    const stockPlanSetup = await setupTestStockPlan(ctx.ocp, {
      issuerContractId: stockClassSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stockClassSetup.newCapTableContractDetails,
      stockClassIds: [stockClassSetup.stockClassData.id],
      stockPlanData: {
        id: generateTestId('nso-plan'),
        plan_name: 'Advisor Options Plan',
        initial_shares_reserved: '200000',
      },
    });

    // Create advisor stakeholder
    const advisorSetup = await setupTestStakeholder(ctx.ocp, {
      issuerContractId: stockPlanSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stockPlanSetup.newCapTableContractDetails,
      stakeholderData: {
        id: generateTestId('nso-advisor'),
        name: { legal_name: 'Technical Advisor' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationships: ['ADVISOR'],
      },
    });

    // Grant NSO options to advisor (NSOs are for non-employees like advisors)
    const nsoGrantSetup = await setupTestEquityCompensationIssuance(ctx.ocp, {
      issuerContractId: advisorSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: advisorSetup.newCapTableContractDetails,
      stakeholderId: advisorSetup.stakeholderData.id,
      stockPlanId: stockPlanSetup.stockPlanData.id,
      stockClassId: stockClassSetup.stockClassData.id,
      equityCompensationIssuanceData: {
        id: generateTestId('nso-grant'),
        compensation_type: 'OPTION_NSO',
        quantity: '25000',
        exercise_price: { amount: '2.00', currency: 'USD' },
      },
    });

    // Validate NSO grant
    const grantOcf = await ctx.ocp.OpenCapTable.equityCompensationIssuance.getEquityCompensationIssuanceEventAsOcf({
      contractId: nsoGrantSetup.equityCompensationIssuanceContractId,
    });

    expect(grantOcf.event.object_type).toBe('TX_EQUITY_COMPENSATION_ISSUANCE');
    expect(grantOcf.event.compensation_type).toBe('OPTION_NSO');
    expect(grantOcf.event.quantity).toBe('25000');
    expect(grantOcf.event.exercise_price?.amount).toBe('2');
    expect(grantOcf.event.stakeholder_id).toBe(advisorSetup.stakeholderData.id);

    await validateOcfObject(grantOcf.event as unknown as Record<string, unknown>);
  });
});
