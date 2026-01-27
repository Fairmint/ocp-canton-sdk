/**
 * Integration tests for stock class adjustment types via batch API.
 *
 * Tests creating and reading:
 * - StockClassSplit (SKIPPED - JSON API v2 nested Numeric limitation)
 * - StockClassConversionRatioAdjustment (SKIPPED - JSON API v2 nested Numeric limitation)
 * - StockConsolidation
 * - StockReissuance
 *
 * Known Limitation: StockClassSplit and StockClassConversionRatioAdjustment use OcfRatio and
 * OcfRatioConversionMechanism types which have nested Numeric fields. The DAML JSON API v2
 * has encoding issues with nested Numeric fields (expects objects but receives strings).
 * These tests are skipped until the JSON API v2 limitation is resolved.
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration
 * ```
 */

import { createIntegrationTestSuite } from '../setup';
import { generateDateString, generateTestId, setupStockSecurity, setupTestIssuer } from '../utils';

createIntegrationTestSuite('Stock Class Adjustments', (getContext) => {
  /**
   * Test: Create a stock class split via batch API.
   *
   * Stock splits multiply existing shares by a ratio (e.g., 2-for-1 split).
   *
   * SKIPPED: StockClassSplit uses OcfRatio which has nested Numeric fields.
   * The DAML JSON API v2 has encoding issues with nested Numeric fields.
   */
  test.skip('creates stock class split', async () => {
    const ctx = getContext();

    // Create issuer
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    // Create stock class split event
    const splitId = generateTestId('stock-class-split');
    const stockClassId = generateTestId('stock-class');

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch
      .create('stockClassSplit', {
        id: splitId,
        date: generateDateString(0),
        stock_class_id: stockClassId,
        split_ratio_numerator: '2',
        split_ratio_denominator: '1',
        comments: ['2-for-1 stock split'],
      })
      .execute();

    expect(result.createdCids).toHaveLength(1);
    expect(result.updatedCapTableCid).toBeTruthy();
  });

  /**
   * Test: Create a stock class conversion ratio adjustment via batch API.
   *
   * Adjusts the conversion ratio for convertible instruments targeting a stock class.
   *
   * SKIPPED: StockClassConversionRatioAdjustment uses OcfRatioConversionMechanism which has
   * nested Numeric fields. The DAML JSON API v2 has encoding issues with nested Numeric fields.
   */
  test.skip('creates stock class conversion ratio adjustment', async () => {
    const ctx = getContext();

    // Create issuer
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    // Create conversion ratio adjustment event
    const adjustmentId = generateTestId('conversion-ratio-adj');
    const stockClassId = generateTestId('stock-class');

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch
      .create('stockClassConversionRatioAdjustment', {
        id: adjustmentId,
        date: generateDateString(0),
        stock_class_id: stockClassId,
        new_ratio_numerator: '3',
        new_ratio_denominator: '2',
        comments: ['Anti-dilution adjustment'],
      })
      .execute();

    expect(result.createdCids).toHaveLength(1);
    expect(result.updatedCapTableCid).toBeTruthy();
  });

  /**
   * Test: Create a stock consolidation via batch API.
   *
   * Combines multiple existing securities into a single new security (reverse split).
   */
  test('creates stock consolidation', async () => {
    const ctx = getContext();

    // Create issuer
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    // Create prerequisite stock securities (V30 DAML contracts validate security_ids exist)
    // Create multiple securities for consolidation
    const stockSecurity1 = await setupStockSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });

    // Get updated cap table details for next security
    let events = await ctx.ocp.client.getEventsByContractId({ contractId: stockSecurity1.capTableContractId });
    let currentCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: stockSecurity1.capTableContractId,
          createdEventBlob: events.created.createdEvent.createdEventBlob,
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    const stockSecurity2 = await setupStockSecurity(ctx.ocp, {
      issuerContractId: stockSecurity1.capTableContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: currentCapTableDetails,
    });

    events = await ctx.ocp.client.getEventsByContractId({ contractId: stockSecurity2.capTableContractId });
    currentCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: stockSecurity2.capTableContractId,
          createdEventBlob: events.created.createdEvent.createdEventBlob,
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    const stockSecurity3 = await setupStockSecurity(ctx.ocp, {
      issuerContractId: stockSecurity2.capTableContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: currentCapTableDetails,
    });

    events = await ctx.ocp.client.getEventsByContractId({ contractId: stockSecurity3.capTableContractId });
    const finalCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: stockSecurity3.capTableContractId,
          createdEventBlob: events.created.createdEvent.createdEventBlob,
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    // Create stock consolidation event
    const consolidationId = generateTestId('consolidation');

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: stockSecurity3.capTableContractId,
      capTableContractDetails: finalCapTableDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch
      .create('stockConsolidation', {
        id: consolidationId,
        date: generateDateString(0),
        security_ids: [stockSecurity1.securityId, stockSecurity2.securityId, stockSecurity3.securityId],
        resulting_security_ids: ['new-sec-001'],
        comments: ['10-for-1 reverse split consolidation'],
      })
      .execute();

    expect(result.createdCids).toHaveLength(1);
    expect(result.updatedCapTableCid).toBeTruthy();
  });

  /**
   * Test: Create a stock reissuance via batch API.
   *
   * Reissues previously cancelled or forfeited shares to a new holder.
   */
  test('creates stock reissuance', async () => {
    const ctx = getContext();

    // Create issuer
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
    const events = await ctx.ocp.client.getEventsByContractId({ contractId: stockSecurity.capTableContractId });
    const updatedCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: stockSecurity.capTableContractId,
          createdEventBlob: events.created.createdEvent.createdEventBlob,
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    // Create stock reissuance event
    const reissuanceId = generateTestId('reissuance');

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: stockSecurity.capTableContractId,
      capTableContractDetails: updatedCapTableDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch
      .create('stockReissuance', {
        id: reissuanceId,
        date: generateDateString(0),
        security_id: stockSecurity.securityId,
        resulting_security_ids: ['sec-new-001'],
        comments: ['Reissued after forfeiture period'],
      })
      .execute();

    expect(result.createdCids).toHaveLength(1);
    expect(result.updatedCapTableCid).toBeTruthy();
  });

  /**
   * Test: Create multiple stock class adjustments in a single batch.
   *
   * Demonstrates atomic batch updates with multiple adjustment types.
   * Uses stockConsolidation + stockReissuance since stockClassSplit has JSON API v2 issues.
   */
  test('creates multiple adjustments in single batch', async () => {
    const ctx = getContext();

    // Create issuer
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    // Create prerequisite stock securities (V30 DAML contracts validate security_ids exist)
    // For consolidation we need at least 2 securities, plus 1 for reissuance
    const stockSecurity1 = await setupStockSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });

    let events = await ctx.ocp.client.getEventsByContractId({ contractId: stockSecurity1.capTableContractId });
    let currentCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: stockSecurity1.capTableContractId,
          createdEventBlob: events.created.createdEvent.createdEventBlob,
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    const stockSecurity2 = await setupStockSecurity(ctx.ocp, {
      issuerContractId: stockSecurity1.capTableContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: currentCapTableDetails,
    });

    events = await ctx.ocp.client.getEventsByContractId({ contractId: stockSecurity2.capTableContractId });
    currentCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: stockSecurity2.capTableContractId,
          createdEventBlob: events.created.createdEvent.createdEventBlob,
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    const stockSecurity3 = await setupStockSecurity(ctx.ocp, {
      issuerContractId: stockSecurity2.capTableContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: currentCapTableDetails,
    });

    events = await ctx.ocp.client.getEventsByContractId({ contractId: stockSecurity3.capTableContractId });
    const finalCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: stockSecurity3.capTableContractId,
          createdEventBlob: events.created.createdEvent.createdEventBlob,
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: stockSecurity3.capTableContractId,
      capTableContractDetails: finalCapTableDetails,
      actAs: [ctx.issuerParty],
    });

    // Create a stock consolidation and reissuance in one batch
    // Note: Using stockConsolidation instead of stockClassSplit due to JSON API v2 nested Numeric issues
    const result = await batch
      .create('stockConsolidation', {
        id: generateTestId('batch-consolidation'),
        date: generateDateString(0),
        security_ids: [stockSecurity1.securityId, stockSecurity2.securityId],
        resulting_security_ids: ['batch-new-sec-001'],
        comments: ['Batch consolidation'],
      })
      .create('stockReissuance', {
        id: generateTestId('batch-reissue'),
        date: generateDateString(0),
        security_id: stockSecurity3.securityId,
        resulting_security_ids: ['batch-new-sec-002'],
        comments: ['Batch reissuance'],
      })
      .execute();

    expect(result.createdCids).toHaveLength(2);
    expect(result.updatedCapTableCid).toBeTruthy();
  });

  /**
   * Test: Create stock class split with approval dates.
   *
   * Note: The DAML StockClassSplitOcfData type does NOT have board_approval_date or
   * stockholder_approval_date fields (unlike StockClassAuthorizedSharesAdjustmentOcfData).
   * The native OCF type has these fields but they are not supported by the DAML contract.
   *
   * SKIPPED: StockClassSplit uses OcfRatio which has nested Numeric fields.
   * The DAML JSON API v2 has encoding issues with nested Numeric fields.
   */
  test.skip('creates stock class split with approval dates', async () => {
    const ctx = getContext();

    // Create issuer
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch
      .create('stockClassSplit', {
        id: generateTestId('split-with-dates'),
        date: generateDateString(0),
        stock_class_id: generateTestId('class-with-dates'),
        split_ratio_numerator: '4',
        split_ratio_denominator: '1',
        board_approval_date: generateDateString(-5),
        stockholder_approval_date: generateDateString(-2),
        comments: ['Split with full approval chain'],
      })
      .execute();

    expect(result.createdCids).toHaveLength(1);
    expect(result.updatedCapTableCid).toBeTruthy();
  });
});
