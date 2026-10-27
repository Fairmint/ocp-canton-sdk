/**
 * Integration tests for comprehensive cap table workflows.
 *
 * These tests demonstrate realistic cap table scenarios using the writer, including:
 *
 * - Setting up a complete cap table (issuer → stakeholders → stock classes → stock plan → issuances)
 * - Testing complex entity relationships
 * - Validating OCF compliance for all created entities
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration
 * ```
 */

import { requireDefined } from '../../../src/utils/requireDefined';
import { validateOcfObject } from '../../utils/ocfSchemaValidator';
import { createIntegrationTestSuite } from '../setup';
import {
  applyOperations,
  createTestStakeholderData,
  createTestStockLegendTemplateData,
  createTestValuationData,
  createTestVestingTermsData,
  generateTestId,
  readTestBook,
  restateOperations,
  setupStockSecurity,
  setupTestBook,
} from '../utils';

createIntegrationTestSuite('Cap Table Workflow', (getContext) => {
  /**
   * Test: Complete founding scenario.
   *
   * This test simulates a typical company founding workflow:
   *
   * 1. Create the cap table with its issuer - done in setup
   * 2. Create founders (stakeholders)
   * 3. Create stock legend template
   * 4. Create vesting terms
   *
   * This demonstrates writing multiple entity types together.
   */
  test('creates founding entities in writes', async () => {
    const ctx = getContext();

    // Step 1: Setup the cap table
    const book = await setupTestBook(ctx, {
      id: generateTestId('workflow-issuer'),
      legal_name: 'Workflow Test Corp',
      initial_shares_authorized: '100000000',
    });

    // Step 2: Create founders and legend template in a single write
    const founder1Data = createTestStakeholderData({
      id: generateTestId('founder-1'),
      name: { legal_name: 'Alice Founder', first_name: 'Alice', last_name: 'Founder' },
      stakeholder_type: 'INDIVIDUAL',
      current_relationships: ['FOUNDER', 'BOARD_MEMBER'],
    });

    const founder2Data = createTestStakeholderData({
      id: generateTestId('founder-2'),
      name: { legal_name: 'Bob Cofounder', first_name: 'Bob', last_name: 'Cofounder' },
      stakeholder_type: 'INDIVIDUAL',
      current_relationships: ['FOUNDER', 'EMPLOYEE'],
    });

    const legendData = createTestStockLegendTemplateData({
      id: generateTestId('legend'),
      name: 'Standard Restricted Stock Legend',
      text: 'THE SHARES REPRESENTED BY THIS CERTIFICATE HAVE NOT BEEN REGISTERED UNDER THE SECURITIES ACT OF 1933...',
    });

    const created1 = await applyOperations(book, [
      { kind: 'record', type: 'stakeholder', data: founder1Data },
      { kind: 'record', type: 'stakeholder', data: founder2Data },
      { kind: 'record', type: 'stockLegendTemplate', data: legendData },
    ]);
    expect(created1.size).toBe(3);

    // Step 3: Create vesting terms in the next write
    const vestingTermsData = createTestVestingTermsData({
      id: generateTestId('vesting'),
      name: 'Standard 4-Year Vesting',
    });
    const created2 = await applyOperations(book, [{ kind: 'record', type: 'vestingTerms', data: vestingTermsData }]);
    expect(created2.size).toBe(1);

    // Verify all stakeholders can be read back as valid OCF
    const founder1Ocf = await ctx.ocp.OpenCapTable.stakeholder.get({
      contractId: requireDefined(created1.get(founder1Data.id), 'first founder record').contractId,
      readAs: [ctx.transferAgentParty],
    });
    expect(founder1Ocf.data.name.legal_name).toBe('Alice Founder');
    await validateOcfObject(founder1Ocf.data as unknown as Record<string, unknown>);

    const founder2Ocf = await ctx.ocp.OpenCapTable.stakeholder.get({
      contractId: requireDefined(created1.get(founder2Data.id), 'second founder record').contractId,
      readAs: [ctx.transferAgentParty],
    });
    expect(founder2Ocf.data.name.legal_name).toBe('Bob Cofounder');
    await validateOcfObject(founder2Ocf.data as unknown as Record<string, unknown>);
  });

  /**
   * Test: Add multiple stakeholders atomically.
   *
   * Demonstrates creating a mixed write of different stakeholder kinds.
   */
  test('creates mixed entity types in a single write', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    const employeeData = createTestStakeholderData({
      id: generateTestId('employee'),
      stakeholder_type: 'INDIVIDUAL',
      current_relationships: ['EMPLOYEE'],
    });

    const investorData = createTestStakeholderData({
      id: generateTestId('investor'),
      stakeholder_type: 'INSTITUTION',
      current_relationships: ['INVESTOR'],
    });

    const created = await applyOperations(book, [
      { kind: 'record', type: 'stakeholder', data: employeeData },
      { kind: 'record', type: 'stakeholder', data: investorData },
    ]);

    expect(created.size).toBe(2);
  });

  /**
   * Test: Sequential writes maintain state correctly.
   *
   * Demonstrates a sequence of writes where each one is made on the book as the previous one left it: the writer
   * keeps its key index current from the update stream.
   */
  test('sequential writes maintain cap table state', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    const createdStakeholders: Array<{ id: string; contractId: string }> = [];

    // Create 5 stakeholders in separate writes to test state management
    for (let i = 1; i <= 5; i++) {
      const stakeholderData = createTestStakeholderData({
        id: generateTestId(`seq-stakeholder-${i}`),
        name: { legal_name: `Sequential Stakeholder ${i}` },
      });

      const created = await applyOperations(book, [{ kind: 'record', type: 'stakeholder', data: stakeholderData }]);

      expect(created.size).toBe(1);
      createdStakeholders.push({
        id: stakeholderData.id,
        contractId: requireDefined(created.get(stakeholderData.id), 'created sequential stakeholder').contractId,
      });
      // The writer's index followed the write
      expect(book.writer.index.counts().records).toBe(1 + i);
    }

    // Verify all stakeholders exist and are readable, in the book read afresh as well
    const index = await readTestBook(book);
    for (const [i, { id, contractId }] of createdStakeholders.entries()) {
      expect(index.record(id)?.contractId).toBe(contractId);
      const ocf = await ctx.ocp.OpenCapTable.stakeholder.get({ contractId, readAs: [ctx.transferAgentParty] });
      expect(ocf.data.name.legal_name).toBe(`Sequential Stakeholder ${i + 1}`);
    }
  });

  /**
   * Test: Create valuation for a stock class.
   *
   * Demonstrates creating a 409A valuation which is required for equity compensation pricing.
   *
   * Creates a real stock security first so the valuation references an existing stock class.
   */
  test('creates valuation entity', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    // Create a real stock class first; the ledger validates stock_class_id references.
    const stockSecurity = await setupStockSecurity(book);

    const valuationData = createTestValuationData({
      id: generateTestId('valuation'),
      stock_class_id: stockSecurity.stockClassId,
      price_per_share: { amount: '2.50', currency: 'USD' },
      provider: 'Valuation Co',
      valuation_type: '409A',
    });
    const created = await applyOperations(book, [{ kind: 'record', type: 'valuation', data: valuationData }]);

    const readBack = await ctx.ocp.OpenCapTable.valuation.get({
      contractId: requireDefined(created.get(valuationData.id), 'created valuation').contractId,
      readAs: [ctx.transferAgentParty],
    });
    expect(readBack.data.provider).toBe('Valuation Co');
    expect(readBack.data.valuation_type).toBe('409A');
  });

  /**
   * Test: Create vesting terms entity.
   *
   * Vesting terms define how equity vests over time and are referenced by equity compensation issuances.
   */
  test('creates vesting terms with complex conditions', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    // A 4-year schedule with 1-year cliff
    const vestingTermsData = createTestVestingTermsData({
      id: generateTestId('vesting'),
      name: '4-Year with 1-Year Cliff',
      description: 'Standard Silicon Valley vesting: 25% after 1 year, then monthly for 3 years',
    });
    const created = await applyOperations(book, [{ kind: 'record', type: 'vestingTerms', data: vestingTermsData }]);

    const readBack = await ctx.ocp.OpenCapTable.vestingTerms.get({
      contractId: requireDefined(created.get(vestingTermsData.id), 'created vesting terms').contractId,
      readAs: [ctx.transferAgentParty],
    });
    expect(readBack.data.name).toBe('4-Year with 1-Year Cliff');
    expect(readBack.data.vesting_conditions.map((condition) => condition.id)).toEqual(
      vestingTermsData.vesting_conditions.map((condition) => condition.id)
    );
  });

  /**
   * Test: Edit and delete operations in a single restatement.
   *
   * Demonstrates combining edit and delete operations atomically.
   */
  test('performs edit and delete in a single restatement', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    // First, create two entities
    const stakeholder1Id = generateTestId('edit-stakeholder');
    const stakeholder2Id = generateTestId('delete-stakeholder');

    const created = await applyOperations(book, [
      {
        kind: 'record',
        type: 'stakeholder',
        data: createTestStakeholderData({ id: stakeholder1Id, name: { legal_name: 'To Be Edited' } }),
      },
      {
        kind: 'record',
        type: 'stakeholder',
        data: createTestStakeholderData({ id: stakeholder2Id, name: { legal_name: 'To Be Deleted' } }),
      },
    ]);
    expect(created.size).toBe(2);

    // Now edit one and delete the other in a single restatement
    const restated = await restateOperations(book, [
      {
        kind: 'edit',
        type: 'stakeholder',
        data: createTestStakeholderData({ id: stakeholder1Id, name: { legal_name: 'Successfully Edited' } }),
      },
      { kind: 'delete', objectId: stakeholder2Id },
    ]);

    // Only the edit creates a contract: the ledger archives the original and creates one with a new contract ID
    expect(restated.size).toBe(1);
    const editedOcf = await ctx.ocp.OpenCapTable.stakeholder.get({
      contractId: requireDefined(restated.get(stakeholder1Id), 'edited stakeholder record').contractId,
      readAs: [ctx.transferAgentParty],
    });
    expect(editedOcf.data.name.legal_name).toBe('Successfully Edited');
    expect((await readTestBook(book)).record(stakeholder2Id)).toBeNull();
  });
});
