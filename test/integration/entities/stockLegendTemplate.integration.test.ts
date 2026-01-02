/**
 * Integration tests for StockLegendTemplate operations.
 *
 * Tests the full lifecycle of StockLegendTemplate entities:
 *
 * - Create stock legend template and read back as valid OCF
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
import { createIntegrationTestSuite } from '../setup';
import {
  createTestStockLegendTemplateData,
  generateTestId,
  setupTestIssuer,
  setupTestStockLegendTemplate,
} from '../utils';

createIntegrationTestSuite('StockLegendTemplate operations', (getContext) => {
  test('creates stock legend template and reads it back as valid OCF', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const legendSetup = await setupTestStockLegendTemplate(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockLegendTemplateData: {
        id: generateTestId('legend-ocf-test'),
        name: 'Test Legend Template',
        text: 'THE SECURITIES REPRESENTED HEREBY HAVE NOT BEEN REGISTERED.',
      },
    });

    const ocfResult = await ctx.ocp.OpenCapTable.stockLegendTemplate.getStockLegendTemplateAsOcf({
      contractId: legendSetup.stockLegendTemplateContractId,
    });

    expect(ocfResult.stockLegendTemplate.object_type).toBe('STOCK_LEGEND_TEMPLATE');
    expect(ocfResult.stockLegendTemplate.name).toBe('Test Legend Template');

    await validateOcfObject(ocfResult.stockLegendTemplate as unknown as Record<string, unknown>);
  });

  test('stock legend template data round-trips correctly', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const originalData = createTestStockLegendTemplateData({
      id: generateTestId('legend-roundtrip'),
      name: 'Roundtrip Legend',
      text: 'This is a test legend for roundtrip verification.',
      comments: ['Test comment 1', 'Test comment 2'],
    });

    const legendSetup = await setupTestStockLegendTemplate(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockLegendTemplateData: originalData,
    });

    const ocfResult = await ctx.ocp.OpenCapTable.stockLegendTemplate.getStockLegendTemplateAsOcf({
      contractId: legendSetup.stockLegendTemplateContractId,
    });

    expect(ocfResult.stockLegendTemplate.id).toBe(originalData.id);
    expect(ocfResult.stockLegendTemplate.name).toBe(originalData.name);
    expect(ocfResult.stockLegendTemplate.text).toBe(originalData.text);
  });

  test('archives stock legend template', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const legendSetup = await setupTestStockLegendTemplate(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockLegendTemplateData: {
        id: generateTestId('legend-archive-test'),
        name: 'Legend To Archive',
        text: 'This legend will be archived.',
      },
    });

    const archiveCmd = ctx.ocp.OpenCapTable.stockLegendTemplate.buildArchiveStockLegendTemplateByIssuerCommand({
      contractId: legendSetup.stockLegendTemplateContractId,
    });

    await ctx.ocp.client.submitAndWaitForTransactionTree({
      commands: [archiveCmd],
      actAs: [ctx.issuerParty],
    });

    // Archive operation succeeded if no error thrown
  });
});

