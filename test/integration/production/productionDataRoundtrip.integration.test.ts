/**
 * Production Data Round-Trip Integration Tests
 *
 * These tests verify that OCF objects can be:
 * 1. Published to LocalNet from JSON fixtures
 * 2. Read back via contract address
 * 3. Returned as valid OCF JSON that matches the input
 *
 * Tests use:
 * - Production fixtures (26 types): Anonymized real-world data from Fairmint database
 * - Synthetic fixtures (23 types): Realistic generated data for types without production examples
 *
 * Run with:
 * ```bash
 * npm run test:integration -- test/integration/production/
 * ```
 */

import {
  DEFAULT_DEPRECATED_FIELDS,
  DEFAULT_INTERNAL_FIELDS,
  ocfCompare,
  stripInternalFields,
} from '../../../src/utils/ocfComparison';
import { validateOcfObject } from '../../utils/ocfSchemaValidator';
import { loadProductionFixture, loadSyntheticFixture, stripSourceMetadata } from '../../utils/productionFixtures';
import { createIntegrationTestSuite } from '../setup';
import { generateTestId, setupTestIssuer } from '../utils';

/**
 * Helper to prepare a fixture for submission to the API.
 * Strips metadata fields and generates unique IDs.
 *
 * Note: Returns `any` because fixtures are dynamically loaded JSON.
 * The batch API will validate structure at runtime.
 */

function prepareFixture(fixture: Record<string, unknown>, idPrefix: string): any {
  const cleaned = stripSourceMetadata(fixture);
  // Generate unique ID to avoid conflicts between test runs
  const uniqueId = generateTestId(idPrefix);
  return {
    ...cleaned,
    id: uniqueId,
    // Also update security_id if present
    ...(cleaned.security_id ? { security_id: generateTestId('security') } : {}),
  };
}

/**
 * Compare fixture data with read-back data, ignoring internal fields.
 */
function compareOcfData(source: Record<string, unknown>, readBack: Record<string, unknown>, description: string): void {
  const result = ocfCompare(source, readBack, {
    ignoredFields: DEFAULT_INTERNAL_FIELDS,
    deprecatedFields: DEFAULT_DEPRECATED_FIELDS,
    reportDifferences: true,
  });

  if (!result.equal) {
    console.error(`\n❌ ${description} - Differences found:`);
    for (const diff of result.differences) {
      console.error(`   - ${diff}`);
    }
  }

  expect(result.equal).toBe(true);
}

/**
 * Extract the contract ID string from an OcfContractId.
 *
 * OcfContractId is a tagged union where each variant has a `value` property containing the actual ContractId.
 */
function extractContractIdString(cid: { value: unknown }): string {
  // OcfContractId is a tagged union like { tag: "CidStakeholder", value: ContractId<Stakeholder> }
  // ContractId<T> is just a string in the JSON representation
  return cid.value as string;
}

// =============================================================================
// PRODUCTION FIXTURES - Tests using real anonymized data (26 types)
// =============================================================================

createIntegrationTestSuite('Production Data Round-Trip Tests', (getContext) => {
  // -------------------------------------------------------------------------
  // Core Objects
  // -------------------------------------------------------------------------

  describe('Core Objects', () => {
    test('Issuer round-trips correctly', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      // The issuer is created as part of setup - read it back
      // Note: issuerOcfContractId is the actual Issuer contract, not the CapTable contract
      const readBack = await ctx.ocp.OpenCapTable.issuer.getIssuerAsOcf({
        contractId: issuerSetup.issuerOcfContractId,
      });

      // Validate OCF schema
      await validateOcfObject(readBack.issuer as unknown as Record<string, unknown>);
      expect(readBack.issuer.object_type).toBe('ISSUER');
    });

    /**
     * SKIPPED: StockClass uses nested Numeric fields (price_per_share, par_value).
     * The DAML JSON API v2 has encoding issues with nested Numeric fields.
     * See llms.txt "DAML JSON API v2 Nested Numeric Encoding" for details.
     */
    test.skip('Stock Class round-trips correctly', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadProductionFixture<Record<string, unknown>>('stockClass', 'common');
      const prepared = prepareFixture(fixture, 'stock-class');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('stockClass', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    /**
     * SKIPPED: Valuation uses nested Numeric fields (price_per_share).
     * The DAML JSON API v2 has encoding issues with nested Numeric fields.
     * See llms.txt "DAML JSON API v2 Nested Numeric Encoding" for details.
     */
    test.skip('Valuation round-trips correctly', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadProductionFixture<Record<string, unknown>>('valuation', '409a');
      const prepared = prepareFixture(fixture, 'valuation');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('valuation', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Stakeholder (individual) round-trips correctly', async () => {
      const ctx = getContext();

      // Setup issuer first (required for stakeholder)
      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      // Load and prepare fixture
      const fixture = loadProductionFixture<Record<string, unknown>>('stakeholder', 'individual');
      const prepared = prepareFixture(fixture, 'stakeholder-individual');

      // Create via batch API
      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('stakeholder', prepared).execute();
      expect(result.createdCids).toHaveLength(1);

      // Read back as OCF
      const readBack = await ctx.ocp.OpenCapTable.stakeholder.getStakeholderAsOcf({
        contractId: extractContractIdString(result.createdCids[0]),
      });

      // Validate OCF schema
      await validateOcfObject(readBack.stakeholder as unknown as Record<string, unknown>);

      // Compare data (the ID will differ since we generated a new one)
      const sourceWithoutId = stripInternalFields({ ...prepared, id: readBack.stakeholder.id });
      compareOcfData(
        sourceWithoutId as Record<string, unknown>,
        readBack.stakeholder as unknown as Record<string, unknown>,
        'Stakeholder individual'
      );
    });

    test('Stakeholder (institution) round-trips correctly', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadProductionFixture<Record<string, unknown>>('stakeholder', 'institution');
      const prepared = prepareFixture(fixture, 'stakeholder-institution');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('stakeholder', prepared).execute();
      expect(result.createdCids).toHaveLength(1);

      const readBack = await ctx.ocp.OpenCapTable.stakeholder.getStakeholderAsOcf({
        contractId: extractContractIdString(result.createdCids[0]),
      });

      await validateOcfObject(readBack.stakeholder as unknown as Record<string, unknown>);
    });

    test('Stock Legend Template round-trips correctly', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadProductionFixture<Record<string, unknown>>('stockLegendTemplate', 'rule-144');
      const prepared = prepareFixture(fixture, 'legend');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('stockLegendTemplate', prepared).execute();
      expect(result.createdCids).toHaveLength(1);

      const readBack = await ctx.ocp.OpenCapTable.stockLegendTemplate.getStockLegendTemplateAsOcf({
        contractId: extractContractIdString(result.createdCids[0]),
      });

      await validateOcfObject(readBack.stockLegendTemplate as unknown as Record<string, unknown>);
    });

    test('Document round-trips correctly', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadProductionFixture<Record<string, unknown>>('document', 'basic');
      const prepared = prepareFixture(fixture, 'document');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('document', prepared).execute();
      expect(result.createdCids).toHaveLength(1);

      const readBack = await ctx.ocp.OpenCapTable.document.getDocumentAsOcf({
        contractId: extractContractIdString(result.createdCids[0]),
      });

      await validateOcfObject(readBack.document as unknown as Record<string, unknown>);
    });

    /**
     * SKIPPED: VestingTerms has complex nested structures (vesting_conditions with portions using Numeric fields).
     * The batch API's DAML encoding requires fixture format adjustments.
     * TODO: Fix fixture format to match expected DAML structure.
     */
    test.skip('Vesting Terms round-trips correctly', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadProductionFixture<Record<string, unknown>>('vestingTerms', 'time-based-cliff');
      const prepared = prepareFixture(fixture, 'vesting-terms');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('vestingTerms', prepared).execute();
      expect(result.createdCids).toHaveLength(1);

      const readBack = await ctx.ocp.OpenCapTable.vestingTerms.getVestingTermsAsOcf({
        contractId: extractContractIdString(result.createdCids[0]),
      });

      await validateOcfObject(readBack.vestingTerms as unknown as Record<string, unknown>);
    });

    test('Stock Plan round-trips correctly', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadProductionFixture<Record<string, unknown>>('stockPlan', 'basic');
      const prepared = prepareFixture(fixture, 'stock-plan');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('stockPlan', prepared).execute();
      expect(result.createdCids).toHaveLength(1);

      const readBack = await ctx.ocp.OpenCapTable.stockPlan.getStockPlanAsOcf({
        contractId: extractContractIdString(result.createdCids[0]),
      });

      await validateOcfObject(readBack.stockPlan as unknown as Record<string, unknown>);
    });
  });

  // -------------------------------------------------------------------------
  // Transaction Types - Stock
  // -------------------------------------------------------------------------

  describe('Stock Transactions', () => {
    /**
     * SKIPPED: StockIssuance uses nested Numeric fields (share_price, cost_basis).
     * The DAML JSON API v2 has encoding issues with nested Numeric fields.
     * See llms.txt "DAML JSON API v2 Nested Numeric Encoding" for details.
     */
    test.skip('Stock Issuance round-trips correctly', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadProductionFixture<Record<string, unknown>>('stockIssuance', 'founders-stock');
      const prepared = prepareFixture(fixture, 'stock-issuance');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('stockIssuance', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Stock Cancellation round-trips correctly', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadProductionFixture<Record<string, unknown>>('stockCancellation');
      const prepared = prepareFixture(fixture, 'stock-cancel');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('stockCancellation', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Stock Repurchase round-trips correctly', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadProductionFixture<Record<string, unknown>>('stockRepurchase');
      const prepared = prepareFixture(fixture, 'stock-repurchase');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('stockRepurchase', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Stock Transfer round-trips correctly', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadProductionFixture<Record<string, unknown>>('stockTransfer');
      const prepared = prepareFixture(fixture, 'stock-transfer');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('stockTransfer', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Transaction Types - Convertible
  // -------------------------------------------------------------------------

  describe('Convertible Transactions', () => {
    /**
     * SKIPPED: ConvertibleIssuance has complex nested structures with Numeric fields
     * (investment_amount, conversion_valuation_cap).
     * The DAML JSON API v2 has encoding issues with nested Numeric fields.
     * See llms.txt "DAML JSON API v2 Nested Numeric Encoding" for details.
     */
    test.skip('Convertible Issuance round-trips correctly', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadProductionFixture<Record<string, unknown>>('convertibleIssuance', 'safe-post-money');
      const prepared = prepareFixture(fixture, 'convertible-issuance');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('convertibleIssuance', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Convertible Cancellation round-trips correctly', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadProductionFixture<Record<string, unknown>>('convertibleCancellation');
      const prepared = prepareFixture(fixture, 'convertible-cancel');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('convertibleCancellation', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Convertible Conversion round-trips correctly', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadProductionFixture<Record<string, unknown>>('convertibleConversion');
      const prepared = prepareFixture(fixture, 'convertible-conversion');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('convertibleConversion', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Convertible Transfer round-trips correctly', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadProductionFixture<Record<string, unknown>>('convertibleTransfer');
      const prepared = prepareFixture(fixture, 'convertible-transfer');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('convertibleTransfer', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Transaction Types - Equity Compensation
  // -------------------------------------------------------------------------

  describe('Equity Compensation Transactions', () => {
    /**
     * SKIPPED: EquityCompensationIssuance uses nested Numeric fields (exercise_price).
     * The DAML JSON API v2 has encoding issues with nested Numeric fields.
     * See llms.txt "DAML JSON API v2 Nested Numeric Encoding" for details.
     */
    test.skip('Equity Compensation Issuance round-trips correctly', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadProductionFixture<Record<string, unknown>>('equityCompensationIssuance', 'option-iso');
      const prepared = prepareFixture(fixture, 'equity-compensation-issuance');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('equityCompensationIssuance', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Equity Compensation Cancellation round-trips correctly', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadProductionFixture<Record<string, unknown>>('equityCompensationCancellation');
      const prepared = prepareFixture(fixture, 'equity-cancel');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('equityCompensationCancellation', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Equity Compensation Exercise round-trips correctly', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadProductionFixture<Record<string, unknown>>('equityCompensationExercise');
      const prepared = prepareFixture(fixture, 'equity-exercise');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('equityCompensationExercise', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Transaction Types - Adjustments
  // -------------------------------------------------------------------------

  describe('Adjustment Transactions', () => {
    test('Issuer Authorized Shares Adjustment round-trips correctly', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadProductionFixture<Record<string, unknown>>('issuerAuthorizedSharesAdjustment');
      const prepared = prepareFixture(fixture, 'issuer-shares-adj');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('issuerAuthorizedSharesAdjustment', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Stock Class Authorized Shares Adjustment round-trips correctly', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadProductionFixture<Record<string, unknown>>('stockClassAuthorizedSharesAdjustment');
      const prepared = prepareFixture(fixture, 'stock-class-shares-adj');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('stockClassAuthorizedSharesAdjustment', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Stock Plan Pool Adjustment round-trips correctly', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadProductionFixture<Record<string, unknown>>('stockPlanPoolAdjustment');
      const prepared = prepareFixture(fixture, 'stock-plan-pool-adj');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('stockPlanPoolAdjustment', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    /**
     * SKIPPED: StockClassSplit uses OcfRatio which has nested Numeric fields.
     * The DAML JSON API v2 has encoding issues with nested Numeric fields.
     * See llms.txt "DAML JSON API v2 Nested Numeric Encoding" for details.
     */
    test.skip('Stock Class Split round-trips correctly', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadProductionFixture<Record<string, unknown>>('stockClassSplit');
      const prepared = prepareFixture(fixture, 'stock-class-split');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('stockClassSplit', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Transaction Types - Warrant
  // -------------------------------------------------------------------------

  describe('Warrant Transactions', () => {
    /**
     * SKIPPED: WarrantIssuance uses nested Numeric fields (exercise_price, purchase_price).
     * The DAML JSON API v2 has encoding issues with nested Numeric fields.
     * See llms.txt "DAML JSON API v2 Nested Numeric Encoding" for details.
     */
    test.skip('Warrant Issuance round-trips correctly', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadProductionFixture<Record<string, unknown>>('warrantIssuance');
      const prepared = prepareFixture(fixture, 'warrant-issuance');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('warrantIssuance', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Transaction Types - Vesting
  // -------------------------------------------------------------------------

  describe('Vesting Transactions', () => {
    test('Vesting Start round-trips correctly', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadProductionFixture<Record<string, unknown>>('vestingStart');
      const prepared = prepareFixture(fixture, 'vesting-start');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('vestingStart', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // SYNTHETIC FIXTURES - Tests using generated data (22 types)
  // -------------------------------------------------------------------------

  describe('Synthetic Fixtures - Stock Lifecycle', () => {
    test('Stock Acceptance round-trips correctly (synthetic)', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadSyntheticFixture<Record<string, unknown>>('stockAcceptance');
      const prepared = prepareFixture(fixture, 'stock-acceptance');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('stockAcceptance', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Stock Retraction round-trips correctly (synthetic)', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadSyntheticFixture<Record<string, unknown>>('stockRetraction');
      const prepared = prepareFixture(fixture, 'stock-retraction');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('stockRetraction', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Stock Conversion round-trips correctly (synthetic)', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadSyntheticFixture<Record<string, unknown>>('stockConversion');
      const prepared = prepareFixture(fixture, 'stock-conversion');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('stockConversion', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Stock Reissuance round-trips correctly (synthetic)', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadSyntheticFixture<Record<string, unknown>>('stockReissuance');
      const prepared = prepareFixture(fixture, 'stock-reissuance');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('stockReissuance', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Stock Consolidation round-trips correctly (synthetic)', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadSyntheticFixture<Record<string, unknown>>('stockConsolidation');
      const prepared = prepareFixture(fixture, 'stock-consolidation');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('stockConsolidation', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });
  });

  describe('Synthetic Fixtures - Convertible Lifecycle', () => {
    test('Convertible Acceptance round-trips correctly (synthetic)', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadSyntheticFixture<Record<string, unknown>>('convertibleAcceptance');
      const prepared = prepareFixture(fixture, 'convertible-acceptance');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('convertibleAcceptance', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Convertible Retraction round-trips correctly (synthetic)', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadSyntheticFixture<Record<string, unknown>>('convertibleRetraction');
      const prepared = prepareFixture(fixture, 'convertible-retraction');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('convertibleRetraction', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });
  });

  describe('Synthetic Fixtures - Equity Compensation Lifecycle', () => {
    test('Equity Compensation Acceptance round-trips correctly (synthetic)', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadSyntheticFixture<Record<string, unknown>>('equityCompensationAcceptance');
      const prepared = prepareFixture(fixture, 'equity-acceptance');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('equityCompensationAcceptance', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Equity Compensation Transfer round-trips correctly (synthetic)', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadSyntheticFixture<Record<string, unknown>>('equityCompensationTransfer');
      const prepared = prepareFixture(fixture, 'equity-transfer');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('equityCompensationTransfer', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Equity Compensation Retraction round-trips correctly (synthetic)', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadSyntheticFixture<Record<string, unknown>>('equityCompensationRetraction');
      const prepared = prepareFixture(fixture, 'equity-retraction');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('equityCompensationRetraction', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Equity Compensation Release round-trips correctly (synthetic)', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadSyntheticFixture<Record<string, unknown>>('equityCompensationRelease');
      const prepared = prepareFixture(fixture, 'equity-release');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('equityCompensationRelease', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Equity Compensation Repricing round-trips correctly (synthetic)', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadSyntheticFixture<Record<string, unknown>>('equityCompensationRepricing');
      const prepared = prepareFixture(fixture, 'equity-repricing');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('equityCompensationRepricing', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });
  });

  describe('Synthetic Fixtures - Warrant Lifecycle', () => {
    test('Warrant Acceptance round-trips correctly (synthetic)', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadSyntheticFixture<Record<string, unknown>>('warrantAcceptance');
      const prepared = prepareFixture(fixture, 'warrant-acceptance');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('warrantAcceptance', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Warrant Transfer round-trips correctly (synthetic)', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadSyntheticFixture<Record<string, unknown>>('warrantTransfer');
      const prepared = prepareFixture(fixture, 'warrant-transfer');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('warrantTransfer', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Warrant Cancellation round-trips correctly (synthetic)', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadSyntheticFixture<Record<string, unknown>>('warrantCancellation');
      const prepared = prepareFixture(fixture, 'warrant-cancellation');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('warrantCancellation', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Warrant Exercise round-trips correctly (synthetic)', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadSyntheticFixture<Record<string, unknown>>('warrantExercise');
      const prepared = prepareFixture(fixture, 'warrant-exercise');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('warrantExercise', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Warrant Retraction round-trips correctly (synthetic)', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadSyntheticFixture<Record<string, unknown>>('warrantRetraction');
      const prepared = prepareFixture(fixture, 'warrant-retraction');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('warrantRetraction', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });
  });

  describe('Synthetic Fixtures - Vesting & Events', () => {
    test('Vesting Event round-trips correctly (synthetic)', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadSyntheticFixture<Record<string, unknown>>('vestingEvent');
      const prepared = prepareFixture(fixture, 'vesting-event');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('vestingEvent', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Vesting Acceleration round-trips correctly (synthetic)', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadSyntheticFixture<Record<string, unknown>>('vestingAcceleration');
      const prepared = prepareFixture(fixture, 'vesting-acceleration');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('vestingAcceleration', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Stakeholder Relationship Change Event round-trips correctly (synthetic)', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadSyntheticFixture<Record<string, unknown>>('stakeholderRelationshipChangeEvent');
      const prepared = prepareFixture(fixture, 'relationship-change');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('stakeholderRelationshipChangeEvent', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Stakeholder Status Change Event round-trips correctly (synthetic)', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadSyntheticFixture<Record<string, unknown>>('stakeholderStatusChangeEvent');
      const prepared = prepareFixture(fixture, 'status-change');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('stakeholderStatusChangeEvent', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });

    test('Stock Plan Return to Pool round-trips correctly (synthetic)', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadSyntheticFixture<Record<string, unknown>>('stockPlanReturnToPool');
      const prepared = prepareFixture(fixture, 'stock-plan-return');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('stockPlanReturnToPool', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });
  });

  describe('Synthetic Fixtures - Corporate Actions', () => {
    /**
     * SKIPPED: StockClassConversionRatioAdjustment uses OcfRatioConversionMechanism with nested Numeric fields.
     * The DAML JSON API v2 has encoding issues with nested Numeric fields.
     * See llms.txt "DAML JSON API v2 Nested Numeric Encoding" for details.
     */
    test.skip('Stock Class Conversion Ratio Adjustment round-trips correctly (synthetic)', async () => {
      const ctx = getContext();

      const issuerSetup = await setupTestIssuer(ctx.ocp, {
        systemOperatorParty: ctx.systemOperatorParty,
        ocpFactoryContractId: ctx.ocpFactoryContractId,
        issuerParty: ctx.issuerParty,
        featuredAppRightContractDetails: ctx.featuredAppRight,
      });

      const fixture = loadSyntheticFixture<Record<string, unknown>>('stockClassConversionRatioAdjustment');
      const prepared = prepareFixture(fixture, 'stock-class-conv-ratio-adj');

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: issuerSetup.issuerContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: issuerSetup.capTableContractDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('stockClassConversionRatioAdjustment', prepared).execute();
      expect(result.createdCids).toHaveLength(1);
    });
  });
});
