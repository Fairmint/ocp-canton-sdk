/**
 * Integration tests for exercise and conversion types via `CapTable_Apply`.
 *
 * Tests creating and reading:
 * - WarrantExercise and ConvertibleConversion: plain records whose resulting stock securities are issued first
 * - StockConversion: a bundled stock event that writes its resulting issuances and balance with it
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration
 * ```
 */

import { OcpValidationError } from '../../../src/errors';
import { validateOcfObject } from '../../utils/ocfSchemaValidator';
import { createIntegrationTestSuite } from '../setup';
import {
  applyOperations,
  createTestConvertibleConversionData,
  createTestStockClassData,
  createTestStockConversionData,
  createTestStockIssuanceData,
  createTestWarrantExerciseData,
  generateTestId,
  issueStockSecurities,
  readTestBook,
  setupConvertibleSecurity,
  setupStakeholder,
  setupStockSecurity,
  setupTestBook,
  setupWarrantSecurity,
} from '../utils';

createIntegrationTestSuite('Exercise and Conversion Types', (getContext) => {
  /**
   * Test: Create warrant exercise transaction.
   *
   * The ledger validates that the security_id references an existing warrant, and that its resulting securities
   * resolve to stock issuances.
   */
  test('creates warrant exercise and reads back as OCF (requires warrant issuance)', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    const warrantSecurity = await setupWarrantSecurity(book);

    // Warrant exercises resolve to stock issuances, so the resulting security needs a stock class + issuance.
    const resultingStockSecurityId = generateTestId('resulting-stock');
    const warrantExerciseData = createTestWarrantExerciseData({
      security_id: warrantSecurity.securityId,
      resulting_security_ids: [resultingStockSecurityId],
      trigger_id: warrantSecurity.exerciseTriggerId,
    });
    await issueStockSecurities(book, {
      stakeholderId: warrantSecurity.stakeholderId,
      securityIds: [resultingStockSecurityId],
      issuanceDate: warrantExerciseData.date,
    });

    const created = await applyOperations(book, [
      { kind: 'record', type: 'warrantExercise', data: warrantExerciseData },
    ]);

    // Read back as OCF
    const ocfResult = await ctx.ocp.OpenCapTable.warrantExercise.get({
      contractId: created.get(warrantExerciseData.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });

    expect(ocfResult.data.object_type).toBe('TX_WARRANT_EXERCISE');
    expect(ocfResult.data.security_id).toBe(warrantSecurity.securityId);
    expect(ocfResult.data.resulting_security_ids).toContain(resultingStockSecurityId);
    await validateOcfObject(ocfResult.data as unknown as Record<string, unknown>);
  });

  /** Test: Create convertible conversion transaction. */
  test('creates convertible conversion and reads back as OCF (requires convertible issuance)', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    const convertibleSecurity = await setupConvertibleSecurity(book);

    // Conversions resolve to stock issuances, so the resulting security needs a stock class + issuance.
    const resultingStockSecurityId = generateTestId('resulting-stock');
    const convertibleConversionData = createTestConvertibleConversionData({
      security_id: convertibleSecurity.securityId,
      resulting_security_ids: [resultingStockSecurityId],
      trigger_id: convertibleSecurity.conversionTriggerId,
    });
    await issueStockSecurities(book, {
      stakeholderId: convertibleSecurity.stakeholderId,
      securityIds: [resultingStockSecurityId],
      issuanceDate: convertibleConversionData.date,
    });

    const created = await applyOperations(book, [
      { kind: 'record', type: 'convertibleConversion', data: convertibleConversionData },
    ]);

    const ocfResult = await ctx.ocp.OpenCapTable.convertibleConversion.get({
      contractId: created.get(convertibleConversionData.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });

    expect(ocfResult.data.object_type).toBe('TX_CONVERTIBLE_CONVERSION');
    expect(ocfResult.data.security_id).toBe(convertibleSecurity.securityId);
    expect(ocfResult.data.resulting_security_ids).toContain(resultingStockSecurityId);
    await validateOcfObject(ocfResult.data as unknown as Record<string, unknown>);
  });

  /**
   * Test: Create stock conversion transaction.
   *
   * A stock conversion is a bundled event: it ends the source security's state, and writes the resulting issuances
   * (here in a preferred class) and the balance of the unconverted shares with it.
   */
  test('creates stock conversion and reads back as OCF (requires stock issuance)', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    const stockSecurity = await setupStockSecurity(book);
    const preferredClass = createTestStockClassData({ class_type: 'PREFERRED', default_id_prefix: 'PS' });
    await applyOperations(book, [{ kind: 'record', type: 'stockClass', data: preferredClass }]);

    const resultingSecurityId = generateTestId('preferred-sec');
    const balanceSecurityId = generateTestId('balance-sec');
    const stockConversionData = createTestStockConversionData({
      security_id: stockSecurity.securityId,
      quantity_converted: '1000',
      resulting_security_ids: [resultingSecurityId],
      balance_security_id: balanceSecurityId,
    });

    const created = await applyOperations(book, [
      {
        kind: 'stockConversion',
        conversion: stockConversionData,
        resulting: [
          createTestStockIssuanceData({
            stakeholder_id: stockSecurity.stakeholderId,
            stock_class_id: preferredClass.id,
            security_id: resultingSecurityId,
            quantity: '1000',
            date: stockConversionData.date,
          }),
        ],
        balance: createTestStockIssuanceData({
          stakeholder_id: stockSecurity.stakeholderId,
          stock_class_id: stockSecurity.stockClassId,
          security_id: balanceSecurityId,
          quantity: '9999000',
          date: stockConversionData.date,
        }),
      },
    ]);

    const ocfResult = await ctx.ocp.OpenCapTable.stockConversion.get({
      contractId: created.get(stockConversionData.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });

    expect(ocfResult.data.object_type).toBe('TX_STOCK_CONVERSION');
    expect(ocfResult.data.security_id).toBe(stockSecurity.securityId);
    expect(ocfResult.data.quantity_converted).toBe('1000');
    expect(ocfResult.data.resulting_security_ids).toEqual([resultingSecurityId]);
    await validateOcfObject(ocfResult.data as unknown as Record<string, unknown>);

    const index = await readTestBook(book);
    expect(index.stateOf(stockSecurity.securityId)).toBeNull();
    expect(index.stateOf(resultingSecurityId)?.state.stock_class_id).toBe(preferredClass.id);
    expect(index.stateOf(balanceSecurityId)?.state.quantity).toBe('9999000');
  });

  /** Test: Verify OcpClient methods are wired correctly. */
  test('OcpClient has exercise/conversion methods wired', () => {
    const ctx = getContext();

    expect(ctx.ocp.OpenCapTable.warrantExercise).toBeDefined();
    expect(typeof ctx.ocp.OpenCapTable.warrantExercise.get).toBe('function');

    expect(ctx.ocp.OpenCapTable.convertibleConversion).toBeDefined();
    expect(typeof ctx.ocp.OpenCapTable.convertibleConversion.get).toBe('function');

    expect(ctx.ocp.OpenCapTable.stockConversion).toBeDefined();
    expect(typeof ctx.ocp.OpenCapTable.stockConversion.get).toBe('function');
  });

  /**
   * Test: The Apply builder accepts exercise/conversion types.
   *
   * Properly structured data is accepted where it is added; execute() would fail without the prerequisite securities.
   */
  test('Apply builder validates exercise/conversion data structure', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);
    const batch = ctx.ocp.OpenCapTable.capTable.apply({
      ...book.writer.capTableAnchor(),
      transferAgent: ctx.transferAgentParty,
      index: book.writer.index,
    });

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
      resulting_security_ids: [],
    });

    expect(() => batch.create('warrantExercise', warrantExerciseData)).not.toThrow();
    expect(() => batch.create('convertibleConversion', convertibleConversionData)).not.toThrow();
    // A stock conversion is a bundled event: it has its own operation, and cannot be written as a plain record
    expect(() => batch.stockConversion({ conversion: stockConversionData, resulting: [] })).not.toThrow();
    expect(() =>
      batch.operation({ kind: 'record', type: 'stockConversion', data: stockConversionData } as never)
    ).toThrow(OcpValidationError);
    expect(batch.size).toBe(3);
  });

  /** Test: The Apply builder validates required fields for exercise/conversion types. */
  test('Apply builder rejects exercise/conversion data with missing fields', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);
    const batch = ctx.ocp.OpenCapTable.capTable.apply({
      ...book.writer.capTableAnchor(),
      transferAgent: ctx.transferAgentParty,
      index: book.writer.index,
    });

    // Warrant exercise without id should fail
    expect(() =>
      batch.create('warrantExercise', {
        id: '',
        date: '2024-01-15',
        security_id: 'warrant-sec',
        trigger_id: 'trigger-001',
        resulting_security_ids: ['stock-sec'],
        object_type: 'TX_WARRANT_EXERCISE',
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
        object_type: 'TX_CONVERTIBLE_CONVERSION',
      })
    ).toThrow('convertibleConversion.id');

    // Stock conversion without id should fail
    expect(() =>
      batch.stockConversion({
        conversion: {
          id: '',
          date: '2024-03-10',
          security_id: 'stock-sec',
          quantity_converted: '5000',
          resulting_security_ids: ['preferred-sec'],
          object_type: 'TX_STOCK_CONVERSION',
        },
        resulting: [],
      })
    ).toThrow('stockConversion.id');
  });

  /** Test: Create stock issuance (prerequisite for stock conversion). */
  test('creates stock issuance prerequisite for conversion', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);
    const owner = await setupStakeholder(book);

    const stockSecurity = await setupStockSecurity(book, { stakeholderId: owner });

    expect(stockSecurity.stockIssuanceContractId).toBeTruthy();
    expect(stockSecurity.securityId).toBeTruthy();
    expect((await readTestBook(book)).stateOf(stockSecurity.securityId)?.state.quantity).toBe('10000000');
  });
});
