/**
 * Integration tests for IssuerAuthorizedSharesAdjustment operations.
 *
 * Tests the full lifecycle of IssuerAuthorizedSharesAdjustment entities:
 *
 * - Create adjustment and read back as valid OCF
 * - Data round-trip verification
 * - Archive operation
 *
 * Run with:
 *
 * ```bash
 * OCP_TEST_USE_CN_QUICKSTART_DEFAULTS=true npm run test:integration
 * ```
 */

import { validateOcfObject } from '../../utils/ocfSchemaValidator';
import { createIntegrationTestSuite, skipIfValidatorUnavailable } from '../setup';
import {
  createTestIssuerAuthorizedSharesAdjustmentData,
  generateTestId,
  setupTestIssuer,
  setupTestIssuerAuthorizedSharesAdjustment,
} from '../utils';

createIntegrationTestSuite('IssuerAuthorizedSharesAdjustment operations', (getContext) => {
  test('creates issuer authorized shares adjustment and reads it back as valid OCF', async () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const adjustmentSetup = await setupTestIssuerAuthorizedSharesAdjustment(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      issuerId: issuerSetup.issuerData.id,
      adjustmentData: {
        id: generateTestId('issuer-adj-ocf-test'),
        new_shares_authorized: '100000000',
      },
    });

    const ocfResult =
      await ctx.ocp.OpenCapTable.issuerAuthorizedSharesAdjustment.getIssuerAuthorizedSharesAdjustmentEventAsOcf({
        contractId: adjustmentSetup.adjustmentContractId,
      });

    expect(ocfResult.event.object_type).toBe('TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT');
    expect(ocfResult.event.new_shares_authorized).toBe('100000000');

    await validateOcfObject(ocfResult.event as unknown as Record<string, unknown>);
  });

  test('issuer authorized shares adjustment data round-trips correctly', async () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const originalData = createTestIssuerAuthorizedSharesAdjustmentData(issuerSetup.issuerData.id, {
      id: generateTestId('issuer-adj-roundtrip'),
      new_shares_authorized: '75000000',
      comments: ['Roundtrip test adjustment'],
    });

    const adjustmentSetup = await setupTestIssuerAuthorizedSharesAdjustment(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      issuerId: issuerSetup.issuerData.id,
      adjustmentData: originalData,
    });

    const ocfResult =
      await ctx.ocp.OpenCapTable.issuerAuthorizedSharesAdjustment.getIssuerAuthorizedSharesAdjustmentEventAsOcf({
        contractId: adjustmentSetup.adjustmentContractId,
      });

    expect(ocfResult.event.id).toBe(originalData.id);
    expect(ocfResult.event.issuer_id).toBe(originalData.issuer_id);
    expect(ocfResult.event.new_shares_authorized).toBe(originalData.new_shares_authorized);
  });

  test('archives issuer authorized shares adjustment', async () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const adjustmentSetup = await setupTestIssuerAuthorizedSharesAdjustment(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      issuerId: issuerSetup.issuerData.id,
      adjustmentData: {
        id: generateTestId('issuer-adj-archive-test'),
        new_shares_authorized: '60000000',
      },
    });

    const archiveCmd =
      ctx.ocp.OpenCapTable.issuerAuthorizedSharesAdjustment.buildArchiveIssuerAuthorizedSharesAdjustmentByIssuerCommand(
        {
          contractId: adjustmentSetup.adjustmentContractId,
        }
      );

    await ctx.ocp.client.submitAndWaitForTransactionTree({
      commands: [archiveCmd],
      actAs: [ctx.issuerParty],
    });

    // Archive operation succeeded if no error thrown
  });
});
