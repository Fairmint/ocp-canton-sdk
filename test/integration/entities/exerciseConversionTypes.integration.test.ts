/**
 * Integration tests for Exercise and Conversion type operations.
 *
 * Tests DAML → OCF conversion for:
 *
 * - WarrantExercise
 * - ConvertibleConversion
 * - StockConversion
 *
 * Note: These transaction types require underlying securities to exist first.
 * A warrant exercise requires an issued warrant, a convertible conversion requires
 * an issued convertible, and a stock conversion requires issued stock.
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration
 * ```
 */

import { createIntegrationTestSuite } from '../setup';
import {
  createTestConvertibleConversionData,
  createTestStakeholderData,
  createTestStockConversionData,
  createTestStockIssuanceData,
  createTestWarrantExerciseData,
  generateTestId,
  setupTestIssuer,
} from '../utils';

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

createIntegrationTestSuite('Exercise and Conversion Types', (getContext) => {
  /**
   * Test: Create warrant exercise transaction via batch API.
   *
   * Note: This test requires an existing warrant issuance. The DAML contract validates
   * that the security_id references an existing warrant. Without setting up a full
   * warrant issuance lifecycle first, this will fail with COMMAND_PREPROCESSING_FAILED.
   */
  test.skip('creates warrant exercise and reads back as OCF (requires warrant issuance)', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    // Create stakeholder first
    const stakeholderData = createTestStakeholderData({
      id: generateTestId('warrant-holder'),
    });

    const stakeholderBatch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const stakeholderResult = await stakeholderBatch.create('stakeholder', stakeholderData).execute();
    const newCapTableCid = stakeholderResult.updatedCapTableCid;

    // Get updated cap table details
    const capTableEvents = await ctx.ocp.client.getEventsByContractId({ contractId: newCapTableCid });
    if (!capTableEvents.created?.createdEvent) {
      throw new Error('Failed to get CapTable created event');
    }
    const newCapTableDetails = {
      templateId: capTableEvents.created.createdEvent.templateId,
      contractId: newCapTableCid,
      createdEventBlob: capTableEvents.created.createdEvent.createdEventBlob,
      synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
    };

    // TODO: First need to issue a warrant with:
    // - warrantIssuance (requires stakeholder_id, stock_class_id or stock_plan_id)
    // Then exercise it with warrantExercise

    const warrantSecurityId = generateTestId('warrant-security');
    const resultingStockSecurityId = generateTestId('resulting-stock');

    const warrantExerciseData = createTestWarrantExerciseData({
      security_id: warrantSecurityId,
      resulting_security_ids: [resultingStockSecurityId],
      quantity: '1000',
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: newCapTableCid,
      capTableContractDetails: newCapTableDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('warrantExercise', warrantExerciseData).execute();
    expect(result.createdCids).toHaveLength(1);

    // Read back as OCF
    const ocfResult = await ctx.ocp.OpenCapTable.warrantExercise.getWarrantExerciseAsOcf({
      contractId: extractContractIdString(result.createdCids[0]),
    });

    expect(ocfResult.event.object_type).toBe('TX_WARRANT_EXERCISE');
    expect(ocfResult.event.security_id).toBe(warrantSecurityId);
    expect(ocfResult.event.quantity).toBe('1000');
    expect(ocfResult.event.resulting_security_ids).toContain(resultingStockSecurityId);
  });

  /**
   * Test: Create convertible conversion transaction via batch API.
   *
   * Note: This test requires an existing convertible issuance. The DAML contract validates
   * that the security_id references an existing convertible. Without setting up a full
   * convertible issuance lifecycle first, this will fail with COMMAND_PREPROCESSING_FAILED.
   */
  test.skip('creates convertible conversion and reads back as OCF (requires convertible issuance)', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    // TODO: First need to issue a convertible with:
    // - convertibleIssuance (requires stakeholder_id, investment_amount, etc.)
    // Then convert it with convertibleConversion

    const convertibleSecurityId = generateTestId('convertible-security');
    const resultingStockSecurityId = generateTestId('resulting-stock');

    const convertibleConversionData = createTestConvertibleConversionData({
      security_id: convertibleSecurityId,
      resulting_security_ids: [resultingStockSecurityId],
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('convertibleConversion', convertibleConversionData).execute();
    expect(result.createdCids).toHaveLength(1);

    // Read back as OCF
    const ocfResult = await ctx.ocp.OpenCapTable.convertibleConversion.getConvertibleConversionAsOcf({
      contractId: extractContractIdString(result.createdCids[0]),
    });

    expect(ocfResult.event.object_type).toBe('TX_CONVERTIBLE_CONVERSION');
    expect(ocfResult.event.security_id).toBe(convertibleSecurityId);
    expect(ocfResult.event.resulting_security_ids).toContain(resultingStockSecurityId);
  });

  /**
   * Test: Create stock conversion transaction via batch API.
   *
   * Note: This test requires an existing stock issuance. The DAML contract validates
   * that the security_id references an existing stock. Without setting up a full
   * stock issuance lifecycle first, this will fail with COMMAND_PREPROCESSING_FAILED.
   */
  test.skip('creates stock conversion and reads back as OCF (requires stock issuance)', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    // TODO: First need to issue stock with:
    // - stockClass (has numeric encoding issues)
    // - stakeholder
    // - stockIssuance
    // Then convert it with stockConversion

    const stockSecurityId = generateTestId('stock-security');
    const resultingSecurityId = generateTestId('resulting-preferred');

    const stockConversionData = createTestStockConversionData({
      security_id: stockSecurityId,
      resulting_security_ids: [resultingSecurityId],
      quantity: '5000',
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('stockConversion', stockConversionData).execute();
    expect(result.createdCids).toHaveLength(1);

    // Read back as OCF
    const ocfResult = await ctx.ocp.OpenCapTable.stockConversion.getStockConversionAsOcf({
      contractId: extractContractIdString(result.createdCids[0]),
    });

    expect(ocfResult.event.object_type).toBe('TX_STOCK_CONVERSION');
    expect(ocfResult.event.security_id).toBe(stockSecurityId);
    expect(ocfResult.event.quantity).toBe('5000');
    expect(ocfResult.event.resulting_security_ids).toContain(resultingSecurityId);
  });

  /**
   * Test: Verify OcpClient methods are wired correctly.
   *
   * This test verifies that the OcpClient has the get*EventAsOcf methods available
   * for the three exercise/conversion types.
   */
  test('OcpClient has exercise/conversion methods wired', () => {
    const ctx = getContext();

    // Verify methods exist on OcpClient
    expect(ctx.ocp.OpenCapTable.warrantExercise).toBeDefined();
    expect(typeof ctx.ocp.OpenCapTable.warrantExercise.getWarrantExerciseAsOcf).toBe('function');

    expect(ctx.ocp.OpenCapTable.convertibleConversion).toBeDefined();
    expect(typeof ctx.ocp.OpenCapTable.convertibleConversion.getConvertibleConversionAsOcf).toBe('function');

    expect(ctx.ocp.OpenCapTable.stockConversion).toBeDefined();
    expect(typeof ctx.ocp.OpenCapTable.stockConversion.getStockConversionAsOcf).toBe('function');
  });

  /**
   * Test: Batch API accepts exercise/conversion types.
   *
   * This test verifies that the batch API methods accept the exercise/conversion types
   * without throwing validation errors for properly structured data.
   */
  test('batch API validates exercise/conversion data structure', async () => {
    const ctx = getContext();

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

    // Verify batch accepts properly structured data (doesn't throw on create)
    // Note: We're not calling execute() because that would fail without prerequisite securities
    const warrantExerciseData = createTestWarrantExerciseData({
      security_id: generateTestId('warrant-sec'),
      resulting_security_ids: [generateTestId('stock-sec')],
    });

    const convertibleConversionData = createTestConvertibleConversionData({
      security_id: generateTestId('convertible-sec'),
      resulting_security_ids: [generateTestId('stock-sec-2')],
    });

    const stockConversionData = createTestStockConversionData({
      security_id: generateTestId('stock-sec'),
      resulting_security_ids: [generateTestId('preferred-sec')],
    });

    // These should not throw - validates the data structure
    expect(() => batch.create('warrantExercise', warrantExerciseData)).not.toThrow();
    expect(() => batch.create('convertibleConversion', convertibleConversionData)).not.toThrow();
    expect(() => batch.create('stockConversion', stockConversionData)).not.toThrow();
  });

  /**
   * Test: Batch API validates required fields for exercise/conversion types.
   */
  test('batch API rejects exercise/conversion data with missing fields', async () => {
    const ctx = getContext();

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

    // Warrant exercise without id should fail
    expect(() =>
      batch.create('warrantExercise', {
        id: '',
        date: '2024-01-15',
        security_id: 'warrant-sec',
        quantity: '1000',
        resulting_security_ids: ['stock-sec'],
      })
    ).toThrow("'warrantExercise.id'");

    // Convertible conversion without id should fail
    expect(() =>
      batch.create('convertibleConversion', {
        id: '',
        date: '2024-02-20',
        security_id: 'convertible-sec',
        resulting_security_ids: ['stock-sec'],
      })
    ).toThrow("'convertibleConversion.id'");

    // Stock conversion without id should fail
    expect(() =>
      batch.create('stockConversion', {
        id: '',
        date: '2024-03-10',
        security_id: 'stock-sec',
        quantity: '5000',
        resulting_security_ids: ['preferred-sec'],
      })
    ).toThrow("'stockConversion.id'");
  });

  /**
   * Test: Create stock issuance (prerequisite for stock conversion).
   *
   * This test attempts to create a stock issuance which is a prerequisite
   * for stock conversion tests.
   *
   * Note: This requires a stock class, which has numeric encoding issues.
   */
  test.skip('creates stock issuance prerequisite for conversion', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    // Create stakeholder
    const stakeholderData = createTestStakeholderData({
      id: generateTestId('stock-holder'),
    });

    const stakeholderBatch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const stakeholderResult = await stakeholderBatch.create('stakeholder', stakeholderData).execute();
    const newCapTableCid = stakeholderResult.updatedCapTableCid;

    // Get updated cap table details
    const capTableEvents = await ctx.ocp.client.getEventsByContractId({ contractId: newCapTableCid });
    if (!capTableEvents.created?.createdEvent) {
      throw new Error('Failed to get CapTable created event');
    }
    const newCapTableDetails = {
      templateId: capTableEvents.created.createdEvent.templateId,
      contractId: newCapTableCid,
      createdEventBlob: capTableEvents.created.createdEvent.createdEventBlob,
      synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
    };

    // Create stock issuance
    const stockClassId = generateTestId('stock-class');
    const stockIssuanceData = createTestStockIssuanceData({
      stakeholder_id: stakeholderData.id,
      stock_class_id: stockClassId,
      quantity: '10000',
    });

    const issuanceBatch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: newCapTableCid,
      capTableContractDetails: newCapTableDetails,
      actAs: [ctx.issuerParty],
    });

    // Note: This will likely fail due to missing stock class
    const result = await issuanceBatch.create('stockIssuance', stockIssuanceData).execute();
    expect(result.createdCids).toHaveLength(1);
  });
});
