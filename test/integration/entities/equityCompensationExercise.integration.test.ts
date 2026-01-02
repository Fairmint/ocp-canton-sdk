/**
 * Integration tests for EquityCompensationExercise operations.
 *
 * Tests the full lifecycle of EquityCompensationExercise entities:
 *
 * - Create equity compensation exercise and read back as valid OCF
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
  extractContractIdOrThrow,
  generateTestId,
  setupTestEquityCompensationIssuance,
  setupTestIssuer,
  setupTestStakeholder,
  setupTestStockClass,
} from '../utils';

createIntegrationTestSuite('EquityCompensationExercise operations', (getContext) => {
  test('creates equity compensation exercise and reads it back as valid OCF', async () => {
    const ctx = getContext();

    // Setup: issuer, stakeholder, stock class, and equity compensation issuance
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
        id: generateTestId('stakeholder-for-exercise'),
        name: { legal_name: 'Exercise Employee' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassData: {
        id: generateTestId('stock-class-for-exercise'),
        name: 'Common Stock',
        class_type: 'COMMON',
        default_id_prefix: 'CS-',
        initial_shares_authorized: '10000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    // Create equity compensation issuance first
    const ecIssuanceSetup = await setupTestEquityCompensationIssuance(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stakeholderId: stakeholderSetup.stakeholderData.id,
      stockClassId: stockClassSetup.stockClassData.id,
      equityCompensationIssuanceData: {
        id: generateTestId('ec-for-exercise'),
        compensation_type: 'OPTION_ISO',
        quantity: '10000',
        exercise_price: { amount: '1.00', currency: 'USD' },
      },
    });

    // Exercise the option
    const resultingSecurityId = generateTestId('resulting-security');
    const exerciseCmd = ctx.ocp.OpenCapTable.equityCompensationExercise.buildCreateEquityCompensationExerciseCommand({
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      exerciseData: {
        id: generateTestId('exercise-ocf-test'),
        date: new Date().toISOString().split('T')[0],
        security_id: ecIssuanceSetup.equityCompensationIssuanceData.security_id,
        quantity: '2500',
        resulting_security_ids: [resultingSecurityId],
      },
    });

    const exerciseResult = await ctx.ocp.client.submitAndWaitForTransactionTree({
      commands: [exerciseCmd.command],
      actAs: [ctx.issuerParty],
      disclosedContracts: exerciseCmd.disclosedContracts,
    });

    // Extract exercise contract ID using helper (throws if not found)
    const exerciseContractId = extractContractIdOrThrow(exerciseResult, 'EquityCompensationExercise');

    const ocfResult = await ctx.ocp.OpenCapTable.equityCompensationExercise.getEquityCompensationExerciseEventAsOcf({
      contractId: exerciseContractId,
    });

    expect(ocfResult.event.object_type).toBe('TX_EQUITY_COMPENSATION_EXERCISE');
    expect(ocfResult.event.quantity).toBe('2500');

    await validateOcfObject(ocfResult.event as unknown as Record<string, unknown>);
  });

  test('archives equity compensation exercise', async () => {
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
        id: generateTestId('stakeholder-for-exercise-archive'),
        name: { legal_name: 'Archive Exercise Employee' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassData: {
        id: generateTestId('stock-class-for-exercise-archive'),
        name: 'Common Stock',
        class_type: 'COMMON',
        default_id_prefix: 'CS-',
        initial_shares_authorized: '10000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    const ecIssuanceSetup = await setupTestEquityCompensationIssuance(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stakeholderId: stakeholderSetup.stakeholderData.id,
      stockClassId: stockClassSetup.stockClassData.id,
      equityCompensationIssuanceData: {
        id: generateTestId('ec-for-exercise-archive'),
        compensation_type: 'OPTION_ISO',
        quantity: '10000',
        exercise_price: { amount: '1.00', currency: 'USD' },
      },
    });

    // Exercise the option
    const resultingSecurityId = generateTestId('resulting-security-archive');
    const exerciseCmd = ctx.ocp.OpenCapTable.equityCompensationExercise.buildCreateEquityCompensationExerciseCommand({
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      exerciseData: {
        id: generateTestId('exercise-archive-test'),
        date: new Date().toISOString().split('T')[0],
        security_id: ecIssuanceSetup.equityCompensationIssuanceData.security_id,
        quantity: '1000',
        resulting_security_ids: [resultingSecurityId],
      },
    });

    const exerciseResult = await ctx.ocp.client.submitAndWaitForTransactionTree({
      commands: [exerciseCmd.command],
      actAs: [ctx.issuerParty],
      disclosedContracts: exerciseCmd.disclosedContracts,
    });

    // Extract exercise contract ID using helper (throws if not found)
    const exerciseContractId = extractContractIdOrThrow(exerciseResult, 'EquityCompensationExercise');

    const archiveCmd =
      ctx.ocp.OpenCapTable.equityCompensationExercise.buildArchiveEquityCompensationExerciseByIssuerCommand({
        contractId: exerciseContractId,
      });

    await ctx.ocp.client.submitAndWaitForTransactionTree({
      commands: [archiveCmd],
      actAs: [ctx.issuerParty],
    });

    // Archive operation succeeded if no error thrown
  });
});
