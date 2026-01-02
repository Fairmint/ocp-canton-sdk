/**
 * Integration tests for complete cap table workflows.
 *
 * These tests exercise multi-entity operations that span issuer, stakeholders, and stock classes to validate the full
 * cap table creation workflow.
 *
 * Run with:
 *
 * ```bash
 * OCP_TEST_USE_CN_QUICKSTART_DEFAULTS=true npm run test:integration
 * ```
 */

import { validateOcfObject } from '../../utils/ocfSchemaValidator';
import { createIntegrationTestSuite } from '../setup';
import { generateTestId, setupTestIssuer, setupTestStakeholder, setupTestStockClass } from '../utils';

createIntegrationTestSuite('Full cap table workflow', (getContext) => {
  test('creates complete cap table with issuer, stakeholders, stock class', async () => {
    const ctx = getContext();

    // 1. Create issuer
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      issuerData: {
        id: generateTestId('full-workflow-issuer'),
        legal_name: 'Full Workflow Corp',
      },
    });

    // 2. Create stock class
    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassData: {
        id: generateTestId('full-workflow-stock'),
        name: 'Common Stock',
        class_type: 'COMMON',
        default_id_prefix: 'FW-',
        initial_shares_authorized: '50000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    // 3. Create stakeholders
    const founderSetup = await setupTestStakeholder(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stakeholderData: {
        id: generateTestId('founder-1'),
        name: { legal_name: 'Jane Founder', first_name: 'Jane', last_name: 'Founder' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationships: ['FOUNDER', 'EMPLOYEE'],
      },
    });

    const investorSetup = await setupTestStakeholder(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stakeholderData: {
        id: generateTestId('investor-1'),
        name: { legal_name: 'Angel Investor LLC' },
        stakeholder_type: 'INSTITUTION',
      },
    });

    // Verify all entities were created
    const issuerOcf = await ctx.ocp.OpenCapTable.issuer.getIssuerAsOcf({
      contractId: issuerSetup.issuerContractId,
    });
    expect(issuerOcf.issuer.legal_name).toBe('Full Workflow Corp');

    const stockClassOcf = await ctx.ocp.OpenCapTable.stockClass.getStockClassAsOcf({
      contractId: stockClassSetup.stockClassContractId,
    });
    expect(stockClassOcf.stockClass.name).toBe('Common Stock');

    const founderOcf = await ctx.ocp.OpenCapTable.stakeholder.getStakeholderAsOcf({
      contractId: founderSetup.stakeholderContractId,
    });
    expect(founderOcf.stakeholder.name.legal_name).toBe('Jane Founder');

    const investorOcf = await ctx.ocp.OpenCapTable.stakeholder.getStakeholderAsOcf({
      contractId: investorSetup.stakeholderContractId,
    });
    expect(investorOcf.stakeholder.name.legal_name).toBe('Angel Investor LLC');

    // Validate all against OCF schemas
    await validateOcfObject(issuerOcf.issuer as unknown as Record<string, unknown>);
    await validateOcfObject(stockClassOcf.stockClass as unknown as Record<string, unknown>);
    await validateOcfObject(founderOcf.stakeholder as unknown as Record<string, unknown>);
    await validateOcfObject(investorOcf.stakeholder as unknown as Record<string, unknown>);
  });
});

