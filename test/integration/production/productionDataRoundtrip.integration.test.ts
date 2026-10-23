/**
 * Production Data Round-Trip Integration Tests
 *
 * These tests verify that OCF objects can be:
 * 1. Published to LocalNet from JSON fixtures, written through `CapTable_Apply` as the transfer agent
 * 2. Read back via contract address (`OpenCapTable.<entity>.get`)
 * 3. Returned as valid OCF JSON that matches the input
 *
 * Tests use:
 * - Production fixtures (26 types): Anonymized real-world data from Fairmint database
 * - Synthetic fixtures (23 types): Realistic generated data for types without production examples
 *
 * Together they cover every record kind the SDK writes: the final test checks that against the entity registry.
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration -- test/integration/production/
 * ```
 */

import { ENTITY_REGISTRY } from '../../../src/functions/OpenCapTable/capTable/batchTypes';
import type { OcfEntityType, OcfReadableObjectType } from '../../../src/functions/OpenCapTable/capTable/entityTypes';
import { OCF_LEDGER_WRITTEN_ENTITY_TYPES } from '../../../src/functions/OpenCapTable/capTable/entityTypes';
import { recordSplit } from '../../../src/register/checks/splits';
import type { ApplyOperation, ApplyRecordEntityType } from '../../../src/types/register';
import {
  DEFAULT_DEPRECATED_FIELDS,
  DEFAULT_INTERNAL_FIELDS,
  ocfCompare,
  stripInternalFields,
} from '../../../src/utils/ocfComparison';
import { validateOcfObject } from '../../utils/ocfSchemaValidator';
import { loadProductionFixture, loadSyntheticFixture, stripSourceMetadata } from '../../utils/productionFixtures';
import { createIntegrationTestSuite, type IntegrationTestContext } from '../setup';
import {
  applyOperations,
  createTestStakeholderData,
  createTestStockClassData,
  createTestStockIssuanceData,
  createTestStockLegendTemplateData,
  createTestStockPlanData,
  createTestVestingTermsData,
  generateTestId,
  issueConvertibleSecurities,
  issueEquityCompensationSecurities,
  issueStockSecurities,
  issueWarrantSecurities,
  setupConvertibleSecurity,
  setupEquityCompensationSecurity,
  setupPreferredStockClassWithRatioConversionRight,
  setupStakeholder,
  setupStockSecurity,
  setupTestBook,
  setupWarrantSecurity,
  TEST_VESTING_EVENT_CONDITION_ID,
  TEST_VESTING_START_CONDITION_ID,
  type TestBook,
} from '../utils';

type Fixture = Record<string, unknown>;

/** The record kinds a test round-tripped; the last test compares it with the registry. */
const covered = new Set<OcfEntityType>();

/**
 * Prepare a fixture for submission: strip the source metadata and give it a unique ID (and a unique security_id when it
 * has one), so tests never collide in one book.
 */
function prepareFixture(fixture: Fixture, idPrefix: string, overrides: Fixture = {}): Fixture {
  const cleaned = stripSourceMetadata(fixture);
  return {
    ...cleaned,
    id: generateTestId(idPrefix),
    ...(typeof cleaned.security_id === 'string' ? { security_id: generateTestId('security') } : {}),
    ...overrides,
  };
}

/** Compare fixture data with read-back data, ignoring internal fields. */
function compareOcfData(source: Fixture, readBack: Fixture, description: string): void {
  const result = ocfCompare(source, readBack, {
    ignoredFields: DEFAULT_INTERNAL_FIELDS,
    deprecatedFields: DEFAULT_DEPRECATED_FIELDS,
    reportDifferences: true,
  });

  if (!result.equal) {
    console.error(`\n${description} - Differences found:`);
    for (const diff of result.differences) {
      console.error(`   - ${diff}`);
    }
  }

  expect(result.equal).toBe(true);
}

/** A `CapTable_Apply` record operation for fixture data (typed loosely: the ledger validates it at runtime). */
function record(type: ApplyRecordEntityType, data: object): ApplyOperation {
  return { kind: 'record', type, data } as ApplyOperation;
}

/** A stock issuance dated on an event's date, for the issuances a bundled stock event writes. */
function outputIssuance(
  source: { stakeholderId: string; stockClassId: string },
  fields: { securityId: string; quantity: string; date: string }
): ReturnType<typeof createTestStockIssuanceData> {
  return createTestStockIssuanceData({
    stakeholder_id: source.stakeholderId,
    stock_class_id: source.stockClassId,
    security_id: fields.securityId,
    quantity: fields.quantity,
    date: fields.date,
  });
}

/**
 * Read a written record back as OCF, validate it against the OCF schema and compare it with the source. The source is
 * compared as the ledger returns it, so `expectedOverrides` names what differs by design.
 */
async function expectRoundTrip(
  ctx: IntegrationTestContext,
  created: ReadonlyMap<string, { entityType: OcfEntityType; contractId: string }>,
  source: Fixture,
  expectedOverrides: Fixture = {}
): Promise<Fixture> {
  const id = String(source.id);
  const ref = created.get(id);
  if (ref === undefined) {
    throw new Error(`The write created no record ${id}`);
  }
  const readBack = await ctx.ocp.OpenCapTable.getByObjectType({
    objectType: source.object_type as OcfReadableObjectType,
    contractId: ref.contractId,
    readAs: [ctx.transferAgentParty],
  });
  const data = readBack.data as unknown as Fixture;

  await validateOcfObject(data);
  compareOcfData(stripInternalFields({ ...source, ...expectedOverrides }), data, `${ref.entityType} ${id}`);
  covered.add(ref.entityType);
  return data;
}

createIntegrationTestSuite('Production Data Round-Trip Tests', (getContext) => {
  // One cap table for the suite: every test writes records under its own IDs
  let sharedBook: Promise<TestBook> | undefined;
  const getBook = async (): Promise<TestBook> => {
    sharedBook ??= setupTestBook(getContext());
    return sharedBook;
  };

  // -------------------------------------------------------------------------
  // Core Objects
  // -------------------------------------------------------------------------

  describe('Core Objects', () => {
    test('Issuer round-trips correctly', async () => {
      const ctx = getContext();

      // The issuer is created with the cap table: it is the fixture's issuer
      const fixture = loadProductionFixture<Fixture>('issuer', 'with-full-details');
      const prepared = prepareFixture(fixture, 'issuer');
      const book = await setupTestBook(ctx, prepared);

      const readBack = await ctx.ocp.OpenCapTable.issuer.get({
        contractId: book.issuerContractId,
        readAs: [ctx.transferAgentParty],
      });
      await validateOcfObject(readBack.data);
      expect(readBack.data.object_type).toBe('ISSUER');
      compareOcfData(stripInternalFields(prepared), readBack.data, 'Issuer with full details');
      covered.add('issuer');
    });

    test('Stock Class (common) round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      const prepared = prepareFixture(loadProductionFixture<Fixture>('stockClass', 'common'), 'stock-class');
      const created = await applyOperations(book, [record('stockClass', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Stock Class (preferred) round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      const prepared = prepareFixture(loadProductionFixture<Fixture>('stockClass', 'preferred'), 'stock-class');
      const created = await applyOperations(book, [record('stockClass', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Valuation round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      const stockSecurity = await setupStockSecurity(book);
      const prepared = prepareFixture(loadProductionFixture<Fixture>('valuation', '409a'), 'valuation', {
        stock_class_id: stockSecurity.stockClassId,
      });
      const created = await applyOperations(book, [record('valuation', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Stakeholder (individual) round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      const prepared = prepareFixture(
        loadProductionFixture<Fixture>('stakeholder', 'individual'),
        'stakeholder-individual'
      );
      const created = await applyOperations(book, [record('stakeholder', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Stakeholder (institution) round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      const prepared = prepareFixture(
        loadProductionFixture<Fixture>('stakeholder', 'institution'),
        'stakeholder-institution'
      );
      const created = await applyOperations(book, [record('stakeholder', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Stock Legend Template round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      const prepared = prepareFixture(loadProductionFixture<Fixture>('stockLegendTemplate', 'rule-144'), 'legend');
      const created = await applyOperations(book, [record('stockLegendTemplate', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Document round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      const prepared = prepareFixture(loadProductionFixture<Fixture>('document', 'basic'), 'document');
      const created = await applyOperations(book, [record('document', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Vesting Terms round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      const prepared = prepareFixture(
        loadProductionFixture<Fixture>('vestingTerms', 'time-based-cliff'),
        'vesting-terms'
      );
      const created = await applyOperations(book, [record('vestingTerms', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Stock Plan round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      // stock_class_ids must resolve to existing stock classes
      const stockClass = createTestStockClassData();
      const prepared = prepareFixture(loadProductionFixture<Fixture>('stockPlan', 'basic'), 'stock-plan', {
        stock_class_ids: [stockClass.id],
      });
      const created = await applyOperations(book, [record('stockClass', stockClass), record('stockPlan', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Financing round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      // issuance_ids must resolve to existing issuances
      const stockSecurity = await setupStockSecurity(book);
      const convertibleSecurity = await setupConvertibleSecurity(book);
      const prepared = prepareFixture(loadProductionFixture<Fixture>('financing', 'basic'), 'financing', {
        issuance_ids: [stockSecurity.stockIssuanceId, convertibleSecurity.issuance.id],
      });
      const created = await applyOperations(book, [record('financing', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });
  });

  // -------------------------------------------------------------------------
  // Transaction Types - Stock
  // -------------------------------------------------------------------------

  describe('Stock Transactions', () => {
    test('Stock Issuance (founders stock) round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      // stakeholder_id, stock_class_id and stock_legend_ids must resolve to existing records
      const stakeholderId = await setupStakeholder(book);
      const stockClass = createTestStockClassData({ initial_shares_authorized: '20000000' });
      const legend = createTestStockLegendTemplateData();
      const prepared = prepareFixture(
        loadProductionFixture<Fixture>('stockIssuance', 'founders-stock'),
        'stock-issuance',
        { stakeholder_id: stakeholderId, stock_class_id: stockClass.id, stock_legend_ids: [legend.id] }
      );
      const created = await applyOperations(book, [
        record('stockClass', stockClass),
        record('stockLegendTemplate', legend),
        record('stockIssuance', prepared),
      ]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Stock Issuance (with vesting terms) round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      const stakeholderId = await setupStakeholder(book);
      const stockClass = createTestStockClassData({ initial_shares_authorized: '20000000' });
      const legend = createTestStockLegendTemplateData();
      const vestingTerms = createTestVestingTermsData();
      const prepared = prepareFixture(
        loadProductionFixture<Fixture>('stockIssuance', 'with-vesting'),
        'stock-issuance',
        {
          stakeholder_id: stakeholderId,
          stock_class_id: stockClass.id,
          stock_legend_ids: [legend.id],
          vesting_terms_id: vestingTerms.id,
        }
      );
      const created = await applyOperations(book, [
        record('stockClass', stockClass),
        record('stockLegendTemplate', legend),
        record('vestingTerms', vestingTerms),
        record('stockIssuance', prepared),
      ]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Stock Cancellation round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      const stockSecurity = await setupStockSecurity(book);
      const balanceSecurityId = generateTestId('cancel-balance');
      const fixture = loadProductionFixture<Fixture>('stockCancellation');
      const prepared = prepareFixture(fixture, 'stock-cancel', {
        security_id: stockSecurity.securityId,
        balance_security_id: balanceSecurityId,
      });

      // The cancellation retires part of the lot: the shares that remain are the balance's, written with it
      const created = await applyOperations(book, [
        {
          kind: 'stockCancellation',
          cancellation: prepared as never,
          balance: outputIssuance(stockSecurity, {
            securityId: balanceSecurityId,
            quantity: String(10_000_000 - Number(prepared.quantity)),
            date: String(prepared.date),
          }),
        },
      ]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Stock Repurchase round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      const stockSecurity = await setupStockSecurity(book);
      const balanceSecurityId = generateTestId('repurchase-balance');
      const prepared = prepareFixture(loadProductionFixture<Fixture>('stockRepurchase'), 'stock-repurchase', {
        security_id: stockSecurity.securityId,
        balance_security_id: balanceSecurityId,
      });

      const created = await applyOperations(book, [
        {
          kind: 'stockRepurchase',
          repurchase: prepared as never,
          balance: outputIssuance(stockSecurity, {
            securityId: balanceSecurityId,
            quantity: String(10_000_000 - Number(prepared.quantity)),
            date: String(prepared.date),
          }),
        },
      ]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Stock Transfer round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      const stockSecurity = await setupStockSecurity(book);
      const buyer = await setupStakeholder(book);
      const fixture = loadProductionFixture<Fixture>('stockTransfer');
      const prepared = prepareFixture(fixture, 'stock-transfer', {
        security_id: stockSecurity.securityId,
        balance_security_id: generateTestId('transfer-balance'),
        resulting_security_ids: [generateTestId('transfer-result-1'), generateTestId('transfer-result-2')],
      });
      const [result1, result2] = prepared.resulting_security_ids as string[];
      const date = String(prepared.date);
      const quantity = Number(prepared.quantity);

      // The resulting securities hold exactly the transferred quantity; the balance holds what remains
      const created = await applyOperations(book, [
        {
          kind: 'stockTransfer',
          transfer: prepared as never,
          resulting: [
            outputIssuance(
              { stakeholderId: buyer, stockClassId: stockSecurity.stockClassId },
              { securityId: result1 ?? '', quantity: String(quantity * 0.6), date }
            ),
            outputIssuance(
              { stakeholderId: buyer, stockClassId: stockSecurity.stockClassId },
              { securityId: result2 ?? '', quantity: String(quantity * 0.4), date }
            ),
          ],
          balance: outputIssuance(stockSecurity, {
            securityId: String(prepared.balance_security_id),
            quantity: String(10_000_000 - quantity),
            date,
          }),
        },
      ]);
      await expectRoundTrip(ctx, created, prepared);
    });
  });

  // -------------------------------------------------------------------------
  // Transaction Types - Convertible
  // -------------------------------------------------------------------------

  describe('Convertible Transactions', () => {
    test('Convertible Issuance (SAFE) round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      const stakeholderId = await setupStakeholder(book);
      const fixture = loadProductionFixture<Fixture>('convertibleIssuance', 'safe-post-money');
      const prepared = prepareFixture(fixture, 'convertible-issuance', { stakeholder_id: stakeholderId });
      const created = await applyOperations(book, [record('convertibleIssuance', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Convertible Issuance (note) round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      const stakeholderId = await setupStakeholder(book);
      const fixture = loadProductionFixture<Fixture>('convertibleIssuance', 'convertible-note');
      const prepared = prepareFixture(fixture, 'convertible-note', { stakeholder_id: stakeholderId });
      const created = await applyOperations(book, [record('convertibleIssuance', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Convertible Cancellation round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      const convertibleSecurity = await setupConvertibleSecurity(book);
      const prepared = prepareFixture(loadProductionFixture<Fixture>('convertibleCancellation'), 'convertible-cancel', {
        security_id: convertibleSecurity.securityId,
      });
      const created = await applyOperations(book, [record('convertibleCancellation', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Convertible Conversion round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      const convertibleSecurity = await setupConvertibleSecurity(book);
      const prepared = prepareFixture(
        loadProductionFixture<Fixture>('convertibleConversion'),
        'convertible-conversion',
        {
          security_id: convertibleSecurity.securityId,
          trigger_id: convertibleSecurity.conversionTriggerId,
          resulting_security_ids: [generateTestId('converted-preferred')],
        }
      );

      // Convertible conversions resolve to stock issuances (stock class + issuance created here)
      await issueStockSecurities(book, {
        stakeholderId: convertibleSecurity.stakeholderId,
        securityIds: prepared.resulting_security_ids as string[],
        issuanceDate: String(prepared.date),
      });
      const created = await applyOperations(book, [record('convertibleConversion', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Convertible Transfer round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      const convertibleSecurity = await setupConvertibleSecurity(book);
      const prepared = prepareFixture(loadProductionFixture<Fixture>('convertibleTransfer'), 'convertible-transfer', {
        security_id: convertibleSecurity.securityId,
        resulting_security_ids: [generateTestId('transfer-result')],
      });
      await issueConvertibleSecurities(book, {
        stakeholderId: convertibleSecurity.stakeholderId,
        securityIds: prepared.resulting_security_ids as string[],
        issuanceDate: String(prepared.date),
      });
      const created = await applyOperations(book, [record('convertibleTransfer', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });
  });

  // -------------------------------------------------------------------------
  // Transaction Types - Equity Compensation
  // -------------------------------------------------------------------------

  describe('Equity Compensation Transactions', () => {
    /** Issue an equity compensation fixture (its plan, class, vesting terms and stakeholder created with it). */
    async function roundTripIssuance(variant: string): Promise<void> {
      const ctx = getContext();
      const book = await getBook();

      const stakeholderId = await setupStakeholder(book);
      const stockClass = createTestStockClassData();
      const stockPlan = createTestStockPlanData({ stock_class_ids: [stockClass.id] });
      const vestingTerms = createTestVestingTermsData();
      const prepared = prepareFixture(
        loadProductionFixture<Fixture>('equityCompensationIssuance', variant),
        `equity-comp-${variant}`,
        {
          stakeholder_id: stakeholderId,
          stock_class_id: stockClass.id,
          stock_plan_id: stockPlan.id,
          vesting_terms_id: vestingTerms.id,
        }
      );
      const created = await applyOperations(book, [
        record('stockClass', stockClass),
        record('stockPlan', stockPlan),
        record('vestingTerms', vestingTerms),
        record('equityCompensationIssuance', prepared),
      ]);
      await expectRoundTrip(ctx, created, prepared);
    }

    test('Equity Compensation Issuance (ISO) round-trips correctly', async () => roundTripIssuance('option-iso'));
    test('Equity Compensation Issuance (NSO) round-trips correctly', async () => roundTripIssuance('option-nso'));
    test('Equity Compensation Issuance (RSU) round-trips correctly', async () => roundTripIssuance('rsu'));

    test('Equity Compensation Cancellation round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      const equitySecurity = await setupEquityCompensationSecurity(book);
      const prepared = prepareFixture(
        loadProductionFixture<Fixture>('equityCompensationCancellation'),
        'equity-comp-cancel',
        { security_id: equitySecurity.securityId }
      );
      const created = await applyOperations(book, [record('equityCompensationCancellation', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Equity Compensation Exercise round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      const equitySecurity = await setupEquityCompensationSecurity(book);
      const prepared = prepareFixture(
        loadProductionFixture<Fixture>('equityCompensationExercise'),
        'equity-comp-exercise',
        {
          security_id: equitySecurity.securityId,
          resulting_security_ids: [generateTestId('exercised-shares')],
        }
      );

      // The exercised shares are stock issuances in the option's class
      await issueStockSecurities(book, {
        stakeholderId: equitySecurity.stakeholderId,
        stockClassId: equitySecurity.stockClassId,
        securityIds: prepared.resulting_security_ids as string[],
        issuanceDate: String(prepared.date),
      });
      const created = await applyOperations(book, [record('equityCompensationExercise', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });
  });

  // -------------------------------------------------------------------------
  // Transaction Types - Adjustments
  // -------------------------------------------------------------------------

  describe('Adjustment Transactions', () => {
    test('Issuer Authorized Shares Adjustment round-trips correctly', async () => {
      const ctx = getContext();
      // The issuer's ceiling covers every class: the adjustment goes to a book of its own, with nothing outstanding
      const book = await setupTestBook(ctx);

      const prepared = prepareFixture(
        loadProductionFixture<Fixture>('issuerAuthorizedSharesAdjustment'),
        'issuer-shares-adj',
        { issuer_id: book.issuerData.id }
      );
      const created = await applyOperations(book, [record('issuerAuthorizedSharesAdjustment', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Stock Class Authorized Shares Adjustment round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      const stockSecurity = await setupStockSecurity(book);
      const prepared = prepareFixture(
        loadProductionFixture<Fixture>('stockClassAuthorizedSharesAdjustment'),
        'stock-class-shares-adj',
        { stock_class_id: stockSecurity.stockClassId }
      );
      const created = await applyOperations(book, [record('stockClassAuthorizedSharesAdjustment', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Stock Plan Pool Adjustment round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      const stockClass = createTestStockClassData();
      const stockPlan = createTestStockPlanData({ stock_class_ids: [stockClass.id] });
      await applyOperations(book, [record('stockClass', stockClass), record('stockPlan', stockPlan)]);
      const prepared = prepareFixture(loadProductionFixture<Fixture>('stockPlanPoolAdjustment'), 'plan-pool-adj', {
        stock_plan_id: stockPlan.id,
      });
      const created = await applyOperations(book, [record('stockPlanPoolAdjustment', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Stock Class Split round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      // A split is recorded on a frozen class by the split procedure, after the class's records
      const stockSecurity = await setupStockSecurity(book, { issuanceOverrides: { quantity: '1000' } });
      const prepared = prepareFixture(loadProductionFixture<Fixture>('stockClassSplit'), 'stock-class-split', {
        stock_class_id: stockSecurity.stockClassId,
      });
      const { split } = await recordSplit(book.writer, prepared as never);
      await expectRoundTrip(ctx, split?.result.records ?? new Map(), prepared);
    });
  });

  // -------------------------------------------------------------------------
  // Transaction Types - Warrants and vesting
  // -------------------------------------------------------------------------

  describe('Warrant Transactions', () => {
    test('Warrant Issuance round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      const stakeholderId = await setupStakeholder(book);
      const prepared = prepareFixture(loadProductionFixture<Fixture>('warrantIssuance'), 'warrant-issuance', {
        stakeholder_id: stakeholderId,
      });
      const created = await applyOperations(book, [record('warrantIssuance', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });
  });

  describe('Vesting Transactions', () => {
    test('Vesting Start round-trips correctly', async () => {
      const ctx = getContext();
      const book = await getBook();

      // The ledger validates the security has vesting terms and the condition is a VESTING_START_DATE one in them
      const stockSecurity = await setupStockSecurity(book, { withVestingTerms: true });
      const prepared = prepareFixture(loadProductionFixture<Fixture>('vestingStart'), 'vesting-start', {
        security_id: stockSecurity.securityId,
        vesting_condition_id: TEST_VESTING_START_CONDITION_ID,
      });
      const created = await applyOperations(book, [record('vestingStart', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });
  });

  // -------------------------------------------------------------------------
  // Synthetic Fixtures - for types without production data
  // -------------------------------------------------------------------------

  describe('Synthetic Fixtures - Stock Lifecycle', () => {
    test('Stock Acceptance round-trips correctly (synthetic)', async () => {
      const ctx = getContext();
      const book = await getBook();

      const stockSecurity = await setupStockSecurity(book);
      const prepared = prepareFixture(loadSyntheticFixture<Fixture>('stockAcceptance'), 'stock-accept', {
        security_id: stockSecurity.securityId,
      });
      const created = await applyOperations(book, [record('stockAcceptance', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Stock Retraction round-trips correctly (synthetic)', async () => {
      const ctx = getContext();
      const book = await getBook();

      const stockSecurity = await setupStockSecurity(book);
      const prepared = prepareFixture(loadSyntheticFixture<Fixture>('stockRetraction'), 'stock-retract', {
        security_id: stockSecurity.securityId,
      });
      const created = await applyOperations(book, [record('stockRetraction', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Stock Conversion round-trips correctly (synthetic)', async () => {
      const ctx = getContext();
      const book = await getBook();

      const stockSecurity = await setupStockSecurity(book);
      const preferredClass = createTestStockClassData({ class_type: 'PREFERRED', default_id_prefix: 'PS' });
      await applyOperations(book, [record('stockClass', preferredClass)]);
      const prepared = prepareFixture(loadSyntheticFixture<Fixture>('stockConversion'), 'stock-conversion', {
        security_id: stockSecurity.securityId,
        balance_security_id: generateTestId('conversion-balance'),
        resulting_security_ids: [generateTestId('converted-security')],
      });
      const date = String(prepared.date);
      const converted = Number(prepared.quantity_converted);

      const created = await applyOperations(book, [
        {
          kind: 'stockConversion',
          conversion: prepared as never,
          resulting: [
            outputIssuance(
              { stakeholderId: stockSecurity.stakeholderId, stockClassId: preferredClass.id },
              { securityId: (prepared.resulting_security_ids as string[])[0] ?? '', quantity: String(converted), date }
            ),
          ],
          balance: outputIssuance(stockSecurity, {
            securityId: String(prepared.balance_security_id),
            quantity: String(10_000_000 - converted),
            date,
          }),
        },
      ]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Stock Reissuance round-trips correctly (synthetic)', async () => {
      const ctx = getContext();
      const book = await getBook();

      const stockSecurity = await setupStockSecurity(book);
      const prepared = prepareFixture(loadSyntheticFixture<Fixture>('stockReissuance'), 'stock-reissuance', {
        security_id: stockSecurity.securityId,
        resulting_security_ids: [generateTestId('replacement-security')],
      });

      // A same-class reissuance conserves the quantity of the whole security
      const created = await applyOperations(book, [
        {
          kind: 'stockReissuance',
          reissuance: prepared as never,
          resulting: [
            outputIssuance(stockSecurity, {
              securityId: (prepared.resulting_security_ids as string[])[0] ?? '',
              quantity: '10000000',
              date: String(prepared.date),
            }),
          ],
        },
      ]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Stock Consolidation round-trips correctly (synthetic)', async () => {
      const ctx = getContext();
      const book = await getBook();

      // Three lots of one stakeholder and class
      const first = await setupStockSecurity(book, { issuanceOverrides: { quantity: '50000' } });
      const shared = { stakeholderId: first.stakeholderId, stockClassId: first.stockClassId };
      const second = await setupStockSecurity(book, { ...shared, issuanceOverrides: { quantity: '50000' } });
      const third = await setupStockSecurity(book, { ...shared, issuanceOverrides: { quantity: '50000' } });
      const prepared = prepareFixture(loadSyntheticFixture<Fixture>('stockConsolidation'), 'stock-consolidation', {
        security_ids: [first.securityId, second.securityId, third.securityId],
        resulting_security_id: generateTestId('consolidated-security'),
      });

      const created = await applyOperations(book, [
        {
          kind: 'stockConsolidation',
          consolidation: prepared as never,
          resultingIssuance: outputIssuance(first, {
            securityId: String(prepared.resulting_security_id),
            quantity: '150000',
            date: String(prepared.date),
          }),
        },
      ]);
      await expectRoundTrip(ctx, created, prepared);
    });
  });

  describe('Synthetic Fixtures - Convertible Lifecycle', () => {
    test('Convertible Acceptance round-trips correctly (synthetic)', async () => {
      const ctx = getContext();
      const book = await getBook();

      const convertibleSecurity = await setupConvertibleSecurity(book);
      const prepared = prepareFixture(loadSyntheticFixture<Fixture>('convertibleAcceptance'), 'convertible-accept', {
        security_id: convertibleSecurity.securityId,
      });
      const created = await applyOperations(book, [record('convertibleAcceptance', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Convertible Retraction round-trips correctly (synthetic)', async () => {
      const ctx = getContext();
      const book = await getBook();

      const convertibleSecurity = await setupConvertibleSecurity(book);
      const prepared = prepareFixture(loadSyntheticFixture<Fixture>('convertibleRetraction'), 'convertible-retract', {
        security_id: convertibleSecurity.securityId,
      });
      const created = await applyOperations(book, [record('convertibleRetraction', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });
  });

  describe('Synthetic Fixtures - Equity Compensation Lifecycle', () => {
    test('Equity Compensation Acceptance round-trips correctly (synthetic)', async () => {
      const ctx = getContext();
      const book = await getBook();

      const equitySecurity = await setupEquityCompensationSecurity(book);
      const prepared = prepareFixture(loadSyntheticFixture<Fixture>('equityCompensationAcceptance'), 'equity-accept', {
        security_id: equitySecurity.securityId,
      });
      const created = await applyOperations(book, [record('equityCompensationAcceptance', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Equity Compensation Transfer round-trips correctly (synthetic)', async () => {
      const ctx = getContext();
      const book = await getBook();

      const equitySecurity = await setupEquityCompensationSecurity(book);
      const prepared = prepareFixture(loadSyntheticFixture<Fixture>('equityCompensationTransfer'), 'equity-transfer', {
        security_id: equitySecurity.securityId,
        resulting_security_ids: [generateTestId('option-transferred')],
      });
      await issueEquityCompensationSecurities(book, {
        stakeholderId: equitySecurity.stakeholderId,
        stockClassId: equitySecurity.stockClassId,
        securityIds: prepared.resulting_security_ids as string[],
        issuanceDate: String(prepared.date),
      });
      const created = await applyOperations(book, [record('equityCompensationTransfer', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Equity Compensation Retraction round-trips correctly (synthetic)', async () => {
      const ctx = getContext();
      const book = await getBook();

      const equitySecurity = await setupEquityCompensationSecurity(book);
      const prepared = prepareFixture(loadSyntheticFixture<Fixture>('equityCompensationRetraction'), 'equity-retract', {
        security_id: equitySecurity.securityId,
      });
      const created = await applyOperations(book, [record('equityCompensationRetraction', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Equity Compensation Release round-trips correctly (synthetic)', async () => {
      const ctx = getContext();
      const book = await getBook();

      const equitySecurity = await setupEquityCompensationSecurity(book);
      const prepared = prepareFixture(loadSyntheticFixture<Fixture>('equityCompensationRelease'), 'equity-release', {
        security_id: equitySecurity.securityId,
        resulting_security_ids: [generateTestId('released-shares')],
      });
      await issueStockSecurities(book, {
        stakeholderId: equitySecurity.stakeholderId,
        stockClassId: equitySecurity.stockClassId,
        securityIds: prepared.resulting_security_ids as string[],
        issuanceDate: String(prepared.date),
      });
      const created = await applyOperations(book, [record('equityCompensationRelease', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Equity Compensation Repricing round-trips correctly (synthetic)', async () => {
      const ctx = getContext();
      const book = await getBook();

      const equitySecurity = await setupEquityCompensationSecurity(book);
      const prepared = prepareFixture(loadSyntheticFixture<Fixture>('equityCompensationRepricing'), 'equity-reprice', {
        security_id: equitySecurity.securityId,
      });
      const created = await applyOperations(book, [record('equityCompensationRepricing', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });
  });

  describe('Synthetic Fixtures - Warrant Lifecycle', () => {
    test('Warrant Acceptance round-trips correctly (synthetic)', async () => {
      const ctx = getContext();
      const book = await getBook();

      const warrantSecurity = await setupWarrantSecurity(book);
      const prepared = prepareFixture(loadSyntheticFixture<Fixture>('warrantAcceptance'), 'warrant-accept', {
        security_id: warrantSecurity.securityId,
      });
      const created = await applyOperations(book, [record('warrantAcceptance', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Warrant Transfer round-trips correctly (synthetic)', async () => {
      const ctx = getContext();
      const book = await getBook();

      const warrantSecurity = await setupWarrantSecurity(book);
      const prepared = prepareFixture(loadSyntheticFixture<Fixture>('warrantTransfer'), 'warrant-transfer', {
        security_id: warrantSecurity.securityId,
        resulting_security_ids: [generateTestId('warrant-transferred')],
      });
      await issueWarrantSecurities(book, {
        stakeholderId: warrantSecurity.stakeholderId,
        securityIds: prepared.resulting_security_ids as string[],
        issuanceDate: String(prepared.date),
      });
      const created = await applyOperations(book, [record('warrantTransfer', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Warrant Cancellation round-trips correctly (synthetic)', async () => {
      const ctx = getContext();
      const book = await getBook();

      const warrantSecurity = await setupWarrantSecurity(book);
      const prepared = prepareFixture(loadSyntheticFixture<Fixture>('warrantCancellation'), 'warrant-cancel', {
        security_id: warrantSecurity.securityId,
      });
      const created = await applyOperations(book, [record('warrantCancellation', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Warrant Exercise round-trips correctly (synthetic)', async () => {
      const ctx = getContext();
      const book = await getBook();

      const warrantSecurity = await setupWarrantSecurity(book);
      const prepared = prepareFixture(loadSyntheticFixture<Fixture>('warrantExercise'), 'warrant-exercise', {
        security_id: warrantSecurity.securityId,
        trigger_id: warrantSecurity.exerciseTriggerId,
        resulting_security_ids: [generateTestId('warrant-shares')],
      });
      await issueStockSecurities(book, {
        stakeholderId: warrantSecurity.stakeholderId,
        securityIds: prepared.resulting_security_ids as string[],
        issuanceDate: String(prepared.date),
      });
      const created = await applyOperations(book, [record('warrantExercise', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Warrant Retraction round-trips correctly (synthetic)', async () => {
      const ctx = getContext();
      const book = await getBook();

      const warrantSecurity = await setupWarrantSecurity(book);
      const prepared = prepareFixture(loadSyntheticFixture<Fixture>('warrantRetraction'), 'warrant-retract', {
        security_id: warrantSecurity.securityId,
      });
      const created = await applyOperations(book, [record('warrantRetraction', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });
  });

  describe('Synthetic Fixtures - Vesting & Events', () => {
    test('Vesting Event round-trips correctly (synthetic)', async () => {
      const ctx = getContext();
      const book = await getBook();

      const stockSecurity = await setupStockSecurity(book, { withVestingTerms: true });
      const prepared = prepareFixture(loadSyntheticFixture<Fixture>('vestingEvent'), 'vesting-event', {
        security_id: stockSecurity.securityId,
        vesting_condition_id: TEST_VESTING_EVENT_CONDITION_ID,
      });
      const created = await applyOperations(book, [record('vestingEvent', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Vesting Acceleration round-trips correctly (synthetic)', async () => {
      const ctx = getContext();
      const book = await getBook();

      // Only a lot on vesting terms with unvested shares can be accelerated
      const stockSecurity = await setupStockSecurity(book, { withVestingTerms: true });
      const prepared = prepareFixture(loadSyntheticFixture<Fixture>('vestingAcceleration'), 'vesting-accel', {
        security_id: stockSecurity.securityId,
      });
      const created = await applyOperations(book, [record('vestingAcceleration', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Stakeholder Relationship Change Event round-trips correctly (synthetic)', async () => {
      const ctx = getContext();
      const book = await getBook();

      const stakeholder = createTestStakeholderData();
      await applyOperations(book, [record('stakeholder', stakeholder)]);
      const prepared = prepareFixture(
        loadSyntheticFixture<Fixture>('stakeholderRelationshipChangeEvent'),
        'relationship-change',
        { stakeholder_id: stakeholder.id }
      );
      const created = await applyOperations(book, [record('stakeholderRelationshipChangeEvent', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Stakeholder Status Change Event round-trips correctly (synthetic)', async () => {
      const ctx = getContext();
      const book = await getBook();

      const stakeholder = createTestStakeholderData();
      await applyOperations(book, [record('stakeholder', stakeholder)]);
      const prepared = prepareFixture(loadSyntheticFixture<Fixture>('stakeholderStatusChangeEvent'), 'status-change', {
        stakeholder_id: stakeholder.id,
      });
      const created = await applyOperations(book, [record('stakeholderStatusChangeEvent', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });

    test('Stock Plan Return to Pool round-trips correctly (synthetic)', async () => {
      const ctx = getContext();
      const book = await getBook();

      // The returned shares come from an equity compensation grant under the plan
      const stockClass = createTestStockClassData();
      const stockPlan = createTestStockPlanData({ stock_class_ids: [stockClass.id] });
      await applyOperations(book, [record('stockClass', stockClass), record('stockPlan', stockPlan)]);
      const equitySecurity = await setupEquityCompensationSecurity(book, {
        stockClassId: stockClass.id,
        issuanceOverrides: { stock_plan_id: stockPlan.id },
      });
      const prepared = prepareFixture(loadSyntheticFixture<Fixture>('stockPlanReturnToPool'), 'plan-return', {
        security_id: equitySecurity.securityId,
        stock_plan_id: stockPlan.id,
      });
      const created = await applyOperations(book, [record('stockPlanReturnToPool', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });
  });

  describe('Synthetic Fixtures - Corporate Actions', () => {
    test('Stock Class Conversion Ratio Adjustment round-trips correctly (synthetic)', async () => {
      const ctx = getContext();
      const book = await getBook();

      const stockClasses = await setupPreferredStockClassWithRatioConversionRight(book);
      const prepared = prepareFixture(
        loadSyntheticFixture<Fixture>('stockClassConversionRatioAdjustment'),
        'conversion-ratio-adj',
        { stock_class_id: stockClasses.preferredStockClassId }
      );
      const created = await applyOperations(book, [record('stockClassConversionRatioAdjustment', prepared)]);
      await expectRoundTrip(ctx, created, prepared);
    });
  });

  // -------------------------------------------------------------------------
  // Coverage
  // -------------------------------------------------------------------------

  /** Every record kind the SDK writes (all but the register's own hold records) is round-tripped above. */
  test('round-trips every writable record kind', () => {
    const writable = (Object.keys(ENTITY_REGISTRY) as OcfEntityType[]).filter(
      (entityType) => !(OCF_LEDGER_WRITTEN_ENTITY_TYPES as readonly string[]).includes(entityType)
    );
    expect(writable).toHaveLength(49);
    expect(writable.filter((entityType) => !covered.has(entityType))).toEqual([]);
  });
});
