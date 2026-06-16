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

import { createIntegrationTestSuite, type IntegrationTestContext } from '../setup';
import {
  createTestConvertibleConversionData,
  createTestStockConversionData,
  createTestWarrantExerciseData,
  generateTestId,
  requireCreatedEventBlob,
  setupConvertibleSecurity,
  setupStockSecurity,
  setupTestIssuer,
  setupWarrantSecurity,
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

async function getCapTableDetails(ctx: IntegrationTestContext, contractId: string, synchronizerId: string) {
  const events = await ctx.ocp.ledger.getEventsByContractId({ contractId });
  if (!events.created?.createdEvent) {
    throw new Error('Failed to get CapTable created event');
  }
  return {
    templateId: events.created.createdEvent.templateId,
    contractId,
    createdEventBlob: requireCreatedEventBlob(events.created.createdEvent),
    synchronizerId,
  };
}

createIntegrationTestSuite('Exercise and Conversion Types', (getContext) => {
  /**
   * Test: Create warrant exercise transaction via batch API.
   *
   * Note: This test requires an existing warrant issuance. The DAML contract validates
   * that the security_id references an existing warrant. Without setting up a full
   * warrant issuance lifecycle first, this will fail with COMMAND_PREPROCESSING_FAILED.
   */
  test('creates warrant exercise and reads back as OCF (requires warrant issuance)', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    const warrantSecurity = await setupWarrantSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });
    const capTableDetails = await getCapTableDetails(
      ctx,
      warrantSecurity.capTableContractId,
      issuerSetup.capTableContractDetails.synchronizerId
    );

    const resultingStockSecurityId = generateTestId('resulting-stock');

    const warrantExerciseData = createTestWarrantExerciseData({
      security_id: warrantSecurity.securityId,
      resulting_security_ids: [resultingStockSecurityId],
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: warrantSecurity.capTableContractId,
      capTableContractDetails: capTableDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('warrantExercise', warrantExerciseData).execute();
    expect(result.createdCids).toHaveLength(1);

    // Read back as OCF
    const ocfResult = await ctx.ocp.OpenCapTable.warrantExercise.get({
      contractId: extractContractIdString(result.createdCids[0]),
    });

    expect(ocfResult.data.object_type).toBe('TX_WARRANT_EXERCISE');
    expect(ocfResult.data.security_id).toBe(warrantSecurity.securityId);
    expect(ocfResult.data.resulting_security_ids).toContain(resultingStockSecurityId);
  });

  /**
   * Test: Create convertible conversion transaction via batch API.
   *
   * Note: This test requires an existing convertible issuance. The DAML contract validates
   * that the security_id references an existing convertible. Without setting up a full
   * convertible issuance lifecycle first, this will fail with COMMAND_PREPROCESSING_FAILED.
   */
  test('creates convertible conversion and reads back as OCF (requires convertible issuance)', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    const convertibleSecurity = await setupConvertibleSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });
    const capTableDetails = await getCapTableDetails(
      ctx,
      convertibleSecurity.capTableContractId,
      issuerSetup.capTableContractDetails.synchronizerId
    );

    const resultingStockSecurityId = generateTestId('resulting-stock');

    const convertibleConversionData = createTestConvertibleConversionData({
      security_id: convertibleSecurity.securityId,
      resulting_security_ids: [resultingStockSecurityId],
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: convertibleSecurity.capTableContractId,
      capTableContractDetails: capTableDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('convertibleConversion', convertibleConversionData).execute();
    expect(result.createdCids).toHaveLength(1);

    // Read back as OCF
    const ocfResult = await ctx.ocp.OpenCapTable.convertibleConversion.get({
      contractId: extractContractIdString(result.createdCids[0]),
    });

    expect(ocfResult.data.object_type).toBe('TX_CONVERTIBLE_CONVERSION');
    expect(ocfResult.data.security_id).toBe(convertibleSecurity.securityId);
    expect(ocfResult.data.resulting_security_ids).toContain(resultingStockSecurityId);
  });

  /**
   * Test: Create stock conversion transaction via batch API.
   *
   * Note: This test requires an existing stock issuance. The DAML contract validates
   * that the security_id references an existing stock. Without setting up a full
   * stock issuance lifecycle first, this will fail with COMMAND_PREPROCESSING_FAILED.
   */
  test('creates stock conversion and reads back as OCF (requires stock issuance)', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    const stockSecurity = await setupStockSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });
    const capTableDetails = await getCapTableDetails(
      ctx,
      stockSecurity.capTableContractId,
      issuerSetup.capTableContractDetails.synchronizerId
    );

    const resultingSecurityId = generateTestId('resulting-preferred');

    const stockConversionData = createTestStockConversionData({
      security_id: stockSecurity.securityId,
      resulting_security_ids: [resultingSecurityId],
      quantity_converted: '5000',
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: stockSecurity.capTableContractId,
      capTableContractDetails: capTableDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('stockConversion', stockConversionData).execute();
    expect(result.createdCids).toHaveLength(1);

    // Read back as OCF
    const ocfResult = await ctx.ocp.OpenCapTable.stockConversion.get({
      contractId: extractContractIdString(result.createdCids[0]),
    });

    expect(ocfResult.data.object_type).toBe('TX_STOCK_CONVERSION');
    expect(ocfResult.data.security_id).toBe(stockSecurity.securityId);
    expect(ocfResult.data.quantity_converted).toBe('5000');
    expect(ocfResult.data.resulting_security_ids).toContain(resultingSecurityId);
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
    expect(typeof ctx.ocp.OpenCapTable.warrantExercise.get).toBe('function');

    expect(ctx.ocp.OpenCapTable.convertibleConversion).toBeDefined();
    expect(typeof ctx.ocp.OpenCapTable.convertibleConversion.get).toBe('function');

    expect(ctx.ocp.OpenCapTable.stockConversion).toBeDefined();
    expect(typeof ctx.ocp.OpenCapTable.stockConversion.get).toBe('function');
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
        trigger_id: 'trigger-001',
        resulting_security_ids: ['stock-sec'],
      })
    ).toThrow('warrantExercise.id');

    // Convertible conversion without id should fail
    expect(() =>
      batch.create('convertibleConversion', {
        id: '',
        date: '2024-02-20',
        reason_text: 'Automatic conversion',
        security_id: 'convertible-sec',
        trigger_id: 'trigger-002',
        resulting_security_ids: ['stock-sec'],
      })
    ).toThrow('convertibleConversion.id');

    // Stock conversion without id should fail
    expect(() =>
      batch.create('stockConversion', {
        id: '',
        date: '2024-03-10',
        security_id: 'stock-sec',
        quantity_converted: '5000',
        resulting_security_ids: ['preferred-sec'],
      })
    ).toThrow('stockConversion.id');
  });

  /**
   * Test: Create stock issuance (prerequisite for stock conversion).
   *
   * This test attempts to create a stock issuance which is a prerequisite
   * for stock conversion tests.
   *
   * Note: This requires a stock class, which has numeric encoding issues.
   */
  test('creates stock issuance prerequisite for conversion', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    const stockSecurity = await setupStockSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });

    expect(stockSecurity.stockIssuanceContractId).toBeTruthy();
    expect(stockSecurity.securityId).toBeTruthy();
  });
});
