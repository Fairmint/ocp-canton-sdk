/**
 * Integration tests for ConvertibleIssuance operations.
 *
 * Tests the full lifecycle of ConvertibleIssuance entities:
 *
 * - Create convertible issuance (SAFE) and read back as valid OCF
 * - Create convertible issuance (NOTE) and read back as valid OCF
 * - Data round-trip verification
 * - Archive operation
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
  createTestConvertibleIssuanceData,
  generateTestId,
  setupTestConvertibleIssuance,
  setupTestIssuer,
  setupTestStakeholder,
} from '../utils';

createIntegrationTestSuite('ConvertibleIssuance operations', (getContext) => {
  test('creates SAFE convertible issuance and reads it back as valid OCF', async () => {
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
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stakeholderData: {
        id: generateTestId('stakeholder-for-safe'),
        name: { legal_name: 'SAFE Investor' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const convertibleSetup = await setupTestConvertibleIssuance(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stakeholderId: stakeholderSetup.stakeholderData.id,
      convertibleIssuanceData: {
        id: generateTestId('safe-ocf-test'),
        convertible_type: 'SAFE',
        investment_amount: { amount: '250000', currency: 'USD' },
        seniority: 1,
      },
    });

    const ocfResult = await ctx.ocp.OpenCapTable.convertibleIssuance.getConvertibleIssuanceAsOcf({
      contractId: convertibleSetup.convertibleIssuanceContractId,
    });

    expect(ocfResult.event.object_type).toBe('TX_CONVERTIBLE_ISSUANCE');
    expect(ocfResult.event.convertible_type).toBe('SAFE');
    expect(ocfResult.event.investment_amount.amount).toBe('250000');

    await validateOcfObject(ocfResult.event as unknown as Record<string, unknown>);
  });

  test('creates NOTE convertible issuance and reads it back as valid OCF', async () => {
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
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stakeholderData: {
        id: generateTestId('stakeholder-for-note'),
        name: { legal_name: 'Note Investor' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const convertibleSetup = await setupTestConvertibleIssuance(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stakeholderId: stakeholderSetup.stakeholderData.id,
      convertibleIssuanceData: {
        id: generateTestId('note-ocf-test'),
        convertible_type: 'NOTE',
        investment_amount: { amount: '500000', currency: 'USD' },
        seniority: 2,
      },
    });

    const ocfResult = await ctx.ocp.OpenCapTable.convertibleIssuance.getConvertibleIssuanceAsOcf({
      contractId: convertibleSetup.convertibleIssuanceContractId,
    });

    expect(ocfResult.event.object_type).toBe('TX_CONVERTIBLE_ISSUANCE');
    expect(ocfResult.event.convertible_type).toBe('NOTE');
    expect(ocfResult.event.investment_amount.amount).toBe('500000');

    await validateOcfObject(ocfResult.event as unknown as Record<string, unknown>);
  });

  test('convertible issuance data round-trips correctly', async () => {
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
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stakeholderData: {
        id: generateTestId('stakeholder-for-convertible-rt'),
        name: { legal_name: 'Roundtrip Convertible Investor' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const originalData = createTestConvertibleIssuanceData(stakeholderSetup.stakeholderData.id, {
      id: generateTestId('convertible-roundtrip'),
      convertible_type: 'SAFE',
      investment_amount: { amount: '100000', currency: 'USD' },
      seniority: 1,
      comments: ['Roundtrip test convertible'],
    });

    const convertibleSetup = await setupTestConvertibleIssuance(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stakeholderId: stakeholderSetup.stakeholderData.id,
      convertibleIssuanceData: originalData,
    });

    const ocfResult = await ctx.ocp.OpenCapTable.convertibleIssuance.getConvertibleIssuanceAsOcf({
      contractId: convertibleSetup.convertibleIssuanceContractId,
    });

    expect(ocfResult.event.id).toBe(originalData.id);
    expect(ocfResult.event.stakeholder_id).toBe(originalData.stakeholder_id);
    expect(ocfResult.event.convertible_type).toBe(originalData.convertible_type);
    expect(ocfResult.event.investment_amount.amount).toBe(originalData.investment_amount.amount);
    expect(ocfResult.event.seniority).toBe(originalData.seniority);
  });

  // TODO: Archive test requires delete command to be exposed in OcpClient
  test.skip('archives convertible issuance', async () => {
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
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stakeholderData: {
        id: generateTestId('stakeholder-for-convertible-archive'),
        name: { legal_name: 'Archive Convertible Investor' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const convertibleSetup = await setupTestConvertibleIssuance(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stakeholderId: stakeholderSetup.stakeholderData.id,
      convertibleIssuanceData: {
        id: generateTestId('convertible-archive-test'),
        convertible_type: 'SAFE',
        investment_amount: { amount: '75000', currency: 'USD' },
        seniority: 1,
      },
    });

    // Archive operation not yet exposed in OcpClient
    expect(convertibleSetup.convertibleIssuanceContractId).toBeDefined();
  });
});
