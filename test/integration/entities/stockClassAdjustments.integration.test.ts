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
import {
  generateDateString,
  generateTestId,
  getCapTableDetails,
  issueStockSecurities,
  requireCreatedEventBlob,
  setupPreferredStockClassWithRatioConversionRight,
  setupStockSecurity,
  setupTestIssuer,
} from '../utils';

createIntegrationTestSuite('Stock Class Adjustments', (getContext) => {
  /**
   * Test: Create a stock class split via batch API.
   *
   * Stock splits multiply existing shares by a ratio (e.g., 2-for-1 split).
   *
   * Previously skipped: StockClassSplit uses OcfRatio which has nested Numeric fields.
   * The DAML JSON API v2 has encoding issues with nested Numeric fields.
   */
  test('creates stock class split', async () => {
    const ctx = getContext();

    // Create issuer
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    // Create a real stock class first; DAML validates stock_class_id references.
    const stockSecurity = await setupStockSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });
    const capTableContractDetails = await getCapTableDetails(
      ctx.ocp,
      stockSecurity.capTableContractId,
      issuerSetup.capTableContractDetails.synchronizerId
    );

    const splitId = generateTestId('stock-class-split');

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: stockSecurity.capTableContractId,
      capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch
      .create('stockClassSplit', {
        id: splitId,
        date: generateDateString(0),
        stock_class_id: stockSecurity.stockClassId,
        split_ratio: { numerator: '2', denominator: '1' },
        comments: ['2-for-1 stock split'],
        object_type: 'TX_STOCK_CLASS_SPLIT',
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
   * Skipped: OcfRatioConversionMechanism nested Numeric + DAML 0.3.33 ratio-right validation
   * (JSON API v2 does not persist stock class conversion_rights reliably for LocalNet batch tests).
   */
  test.skip('creates stock class conversion ratio adjustment', async () => {
    const ctx = getContext();

    // Create issuer
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    // Create a preferred stock class with a ratio conversion right for adjustment validation.
    const stockClasses = await setupPreferredStockClassWithRatioConversionRight(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });
    const { capTableContractDetails } = stockClasses;

    const adjustmentId = generateTestId('conversion-ratio-adj');

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: stockClasses.capTableContractId,
      capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch
      .create('stockClassConversionRatioAdjustment', {
        id: adjustmentId,
        date: generateDateString(1),
        stock_class_id: stockClasses.preferredStockClassId,
        new_ratio_conversion_mechanism: {
          type: 'RATIO_CONVERSION',
          conversion_price: { amount: '0', currency: 'USD' },
          ratio: { numerator: '3', denominator: '2' },
          rounding_type: 'NORMAL',
        },
        comments: ['Anti-dilution adjustment'],
        object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
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
    let events = await ctx.ocp.ledger.getEventsByContractId({ contractId: stockSecurity1.capTableContractId });
    let currentCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: stockSecurity1.capTableContractId,
          createdEventBlob: requireCreatedEventBlob(events.created.createdEvent),
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    const stockSecurity2 = await setupStockSecurity(ctx.ocp, {
      issuerContractId: stockSecurity1.capTableContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: currentCapTableDetails,
    });

    events = await ctx.ocp.ledger.getEventsByContractId({ contractId: stockSecurity2.capTableContractId });
    currentCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: stockSecurity2.capTableContractId,
          createdEventBlob: requireCreatedEventBlob(events.created.createdEvent),
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    const stockSecurity3 = await setupStockSecurity(ctx.ocp, {
      issuerContractId: stockSecurity2.capTableContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: currentCapTableDetails,
    });

    // The resulting security must resolve to an existing stock issuance in the cap table's final state.
    const resultingSecurityId = generateTestId('consolidated-security');
    const consolidationDate = generateDateString(0);
    const resultingSecurity = await issueStockSecurities(ctx.ocp, {
      capTableContractId: stockSecurity3.capTableContractId,
      capTableContractDetails: await getCapTableDetails(
        ctx.ocp,
        stockSecurity3.capTableContractId,
        issuerSetup.capTableContractDetails.synchronizerId
      ),
      issuerParty: ctx.issuerParty,
      stakeholderId: stockSecurity1.stakeholderId,
      stockClassId: stockSecurity1.stockClassId,
      securityIds: [resultingSecurityId],
      issuanceDate: consolidationDate,
    });

    // Create stock consolidation event
    const consolidationId = generateTestId('consolidation');

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: resultingSecurity.capTableContractId,
      capTableContractDetails: resultingSecurity.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch
      .create('stockConsolidation', {
        id: consolidationId,
        date: consolidationDate,
        security_ids: [stockSecurity1.securityId, stockSecurity2.securityId, stockSecurity3.securityId],
        resulting_security_id: resultingSecurityId,
        comments: ['10-for-1 reverse split consolidation'],
        object_type: 'TX_STOCK_CONSOLIDATION',
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

    // The resulting security must resolve to an existing stock issuance in the cap table's final state.
    const resultingSecurityId = generateTestId('reissued-security');
    const reissuanceDate = generateDateString(0);
    const resultingSecurity = await issueStockSecurities(ctx.ocp, {
      capTableContractId: stockSecurity.capTableContractId,
      capTableContractDetails: await getCapTableDetails(
        ctx.ocp,
        stockSecurity.capTableContractId,
        issuerSetup.capTableContractDetails.synchronizerId
      ),
      issuerParty: ctx.issuerParty,
      stakeholderId: stockSecurity.stakeholderId,
      stockClassId: stockSecurity.stockClassId,
      securityIds: [resultingSecurityId],
      issuanceDate: reissuanceDate,
    });

    // Create stock reissuance event
    const reissuanceId = generateTestId('reissuance');

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: resultingSecurity.capTableContractId,
      capTableContractDetails: resultingSecurity.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch
      .create('stockReissuance', {
        id: reissuanceId,
        date: reissuanceDate,
        security_id: stockSecurity.securityId,
        resulting_security_ids: [resultingSecurityId],
        comments: ['Reissued after forfeiture period'],
        object_type: 'TX_STOCK_REISSUANCE',
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

    let events = await ctx.ocp.ledger.getEventsByContractId({ contractId: stockSecurity1.capTableContractId });
    let currentCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: stockSecurity1.capTableContractId,
          createdEventBlob: requireCreatedEventBlob(events.created.createdEvent),
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    const stockSecurity2 = await setupStockSecurity(ctx.ocp, {
      issuerContractId: stockSecurity1.capTableContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: currentCapTableDetails,
    });

    events = await ctx.ocp.ledger.getEventsByContractId({ contractId: stockSecurity2.capTableContractId });
    currentCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: stockSecurity2.capTableContractId,
          createdEventBlob: requireCreatedEventBlob(events.created.createdEvent),
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    const stockSecurity3 = await setupStockSecurity(ctx.ocp, {
      issuerContractId: stockSecurity2.capTableContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: currentCapTableDetails,
    });

    // Resulting securities must resolve to existing stock issuances in the cap table's final state.
    const consolidatedSecurityId = generateTestId('batch-consolidated-security');
    const reissuedSecurityId = generateTestId('batch-reissued-security');
    const batchDate = generateDateString(0);
    const resultingSecurities = await issueStockSecurities(ctx.ocp, {
      capTableContractId: stockSecurity3.capTableContractId,
      capTableContractDetails: await getCapTableDetails(
        ctx.ocp,
        stockSecurity3.capTableContractId,
        issuerSetup.capTableContractDetails.synchronizerId
      ),
      issuerParty: ctx.issuerParty,
      stakeholderId: stockSecurity1.stakeholderId,
      stockClassId: stockSecurity1.stockClassId,
      securityIds: [consolidatedSecurityId, reissuedSecurityId],
      issuanceDate: batchDate,
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: resultingSecurities.capTableContractId,
      capTableContractDetails: resultingSecurities.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    // Create a stock consolidation and reissuance in one batch
    // Note: Using stockConsolidation instead of stockClassSplit due to JSON API v2 nested Numeric issues
    const result = await batch
      .create('stockConsolidation', {
        id: generateTestId('batch-consolidation'),
        date: batchDate,
        security_ids: [stockSecurity1.securityId, stockSecurity2.securityId],
        resulting_security_id: consolidatedSecurityId,
        comments: ['Batch consolidation'],
        object_type: 'TX_STOCK_CONSOLIDATION',
      })
      .create('stockReissuance', {
        id: generateTestId('batch-reissue'),
        date: batchDate,
        security_id: stockSecurity3.securityId,
        resulting_security_ids: [reissuedSecurityId],
        comments: ['Batch reissuance'],
        object_type: 'TX_STOCK_REISSUANCE',
      })
      .execute();

    expect(result.createdCids).toHaveLength(2);
    expect(result.updatedCapTableCid).toBeTruthy();
  });

  /**
   * Test: Create stock class split with approval dates.
   *
   * Note: board_approval_date and stockholder_approval_date are internal SDK extensions,
   * not OCF StockClassSplit schema fields, and the DAML contract does not support them.
   *
   * Previously skipped: StockClassSplit uses OcfRatio which has nested Numeric fields.
   * The DAML JSON API v2 has encoding issues with nested Numeric fields.
   */
  test('rejects stock class split approval dates not supported by the OCF schema', async () => {
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

    expect(() =>
      batch.create('stockClassSplit', {
        id: generateTestId('split-with-dates'),
        date: generateDateString(0),
        stock_class_id: generateTestId('class-with-dates'),
        split_ratio: { numerator: '4', denominator: '1' },
        board_approval_date: generateDateString(-5),
        stockholder_approval_date: generateDateString(-2),
        comments: ['Split with full approval chain'],
        object_type: 'TX_STOCK_CLASS_SPLIT',
      })
    ).toThrow('board_approval_date');
  });
});
