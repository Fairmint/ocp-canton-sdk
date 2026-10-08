/**
 * Integration tests for Transfer Type operations.
 *
 * Tests the DAML→OCF converters for transfer types via the batch API:
 *
 * - StockTransfer
 * - ConvertibleTransfer
 * - EquityCompensationTransfer
 * - WarrantTransfer
 *
 * Note: These tests create transfers via the batch API and then read them back
 * using the get*AsOcf methods to verify the DAML→OCF conversion.
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration
 * ```
 */

import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { buildUpdateCapTableCommand } from '../../../src/functions/OpenCapTable';
import { validateOcfObject } from '../../utils/ocfSchemaValidator';
import { createIntegrationTestSuite } from '../setup';
import {
  createTestConvertibleTransferData,
  createTestEquityCompensationTransferData,
  createTestStockTransferData,
  createTestWarrantTransferData,
  generateTestId,
  getCapTableDetails,
  issueConvertibleSecurities,
  issueEquityCompensationSecurities,
  issueStockSecurities,
  issueWarrantSecurities,
  setupConvertibleSecurity,
  setupEquityCompensationSecurity,
  setupStockSecurity,
  setupTestIssuer,
  setupWarrantSecurity,
} from '../utils';

/** Extract a contract ID from a transaction response. */
function extractContractIdFromResponse(
  response: { transaction: { events?: unknown[] } },
  templateIdContains: string
): string | null {
  for (const event of response.transaction.events ?? []) {
    const eventData = event as Record<string, unknown>;
    if (!eventData.CreatedEvent || typeof eventData.CreatedEvent !== 'object') continue;
    const created = eventData.CreatedEvent as Record<string, unknown>;
    const templateId = created.templateId as string;
    const isMatch = templateId.includes(`:${templateIdContains}:`) || templateId.endsWith(`:${templateIdContains}`);
    if (isMatch) {
      return created.contractId as string;
    }
  }
  return null;
}

createIntegrationTestSuite('Transfer Type operations', (getContext) => {
  /**
   * Test: Create StockTransfer via batch API and read back as OCF
   */
  test('creates stock transfer and reads it back as valid OCF', async () => {
    const ctx = getContext();

    // Setup issuer
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

    // Create stock transfer data
    const transferData = createTestStockTransferData({
      security_id: stockSecurity.securityId,
      quantity: '1000',
      resulting_security_ids: [generateTestId('result-1'), generateTestId('result-2')],
      balance_security_id: generateTestId('balance'),
      consideration_text: 'Transfer consideration',
    });

    // Balance and resulting securities must resolve to stock issuances in the cap table's final state.
    const resultingSecurities = await issueStockSecurities(ctx.ocp, {
      capTableContractId: stockSecurity.capTableContractId,
      capTableContractDetails: await getCapTableDetails(
        ctx.ocp,
        stockSecurity.capTableContractId,
        issuerSetup.capTableContractDetails.synchronizerId
      ),
      issuerParty: ctx.issuerParty,
      stakeholderId: stockSecurity.stakeholderId,
      stockClassId: stockSecurity.stockClassId,
      securityIds: [...transferData.resulting_security_ids, transferData.balance_security_id!],
      issuanceDate: transferData.date,
    });

    // Create transfer via batch API
    const cmd = buildUpdateCapTableCommand(
      {
        capTableContractId: resultingSecurities.capTableContractId,
        capTableContractDetails: resultingSecurities.capTableContractDetails,
      },
      { creates: [{ type: 'stockTransfer', data: transferData }] }
    );

    const validDisclosedContracts = cmd.disclosedContracts.filter(
      (dc: DisclosedContract) => dc.createdEventBlob && dc.createdEventBlob.length > 0
    );

    const result = await ctx.ocp.ledger.submitAndWaitForTransaction({
      commands: [cmd.command],
      actAs: [ctx.issuerParty],
      disclosedContracts: validDisclosedContracts,
    });

    // Extract contract ID
    const transferContractId = extractContractIdFromResponse(result, 'StockTransfer');
    expect(transferContractId).toBeTruthy();

    // Read back as OCF
    const ocfResult = await ctx.ocp.OpenCapTable.stockTransfer.get({
      contractId: transferContractId!,
    });

    // Validate structure
    expect(ocfResult.data.object_type).toBe('TX_STOCK_TRANSFER');
    expect(ocfResult.data.id).toBe(transferData.id);
    expect(ocfResult.data.security_id).toBe(transferData.security_id);
    expect(ocfResult.data.quantity).toBe(transferData.quantity);
    expect(ocfResult.data.resulting_security_ids).toEqual(transferData.resulting_security_ids);
    expect(ocfResult.data.balance_security_id).toBe(transferData.balance_security_id);

    // Validate against OCF schema
    await validateOcfObject(ocfResult.data as unknown as Record<string, unknown>);
  });

  /**
   * Test: Create ConvertibleTransfer via batch API and read back as OCF
   */
  test('creates convertible transfer and reads it back as valid OCF', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    // Create prerequisite convertible security (V30 DAML contracts validate security_id exists)
    const convertibleSecurity = await setupConvertibleSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });

    const transferData = createTestConvertibleTransferData({
      security_id: convertibleSecurity.securityId,
      amount: { amount: '75000', currency: 'USD' },
      resulting_security_ids: [generateTestId('conv-result')],
      consideration_text: 'Convertible note transfer',
    });

    // Resulting securities must resolve to convertible issuances in the cap table's final state.
    const resultingSecurities = await issueConvertibleSecurities(ctx.ocp, {
      capTableContractId: convertibleSecurity.capTableContractId,
      capTableContractDetails: await getCapTableDetails(
        ctx.ocp,
        convertibleSecurity.capTableContractId,
        issuerSetup.capTableContractDetails.synchronizerId
      ),
      issuerParty: ctx.issuerParty,
      stakeholderId: convertibleSecurity.stakeholderId,
      securityIds: transferData.resulting_security_ids,
      issuanceDate: transferData.date,
    });

    const cmd = buildUpdateCapTableCommand(
      {
        capTableContractId: resultingSecurities.capTableContractId,
        capTableContractDetails: resultingSecurities.capTableContractDetails,
      },
      { creates: [{ type: 'convertibleTransfer', data: transferData }] }
    );

    const validDisclosedContracts = cmd.disclosedContracts.filter(
      (dc: DisclosedContract) => dc.createdEventBlob && dc.createdEventBlob.length > 0
    );

    const result = await ctx.ocp.ledger.submitAndWaitForTransaction({
      commands: [cmd.command],
      actAs: [ctx.issuerParty],
      disclosedContracts: validDisclosedContracts,
    });

    const transferContractId = extractContractIdFromResponse(result, 'ConvertibleTransfer');
    expect(transferContractId).toBeTruthy();

    const ocfResult = await ctx.ocp.OpenCapTable.convertibleTransfer.get({
      contractId: transferContractId!,
    });

    expect(ocfResult.data.object_type).toBe('TX_CONVERTIBLE_TRANSFER');
    expect(ocfResult.data.id).toBe(transferData.id);
    expect(ocfResult.data.security_id).toBe(transferData.security_id);
    expect(ocfResult.data.amount.amount).toBe(transferData.amount.amount);
    expect(ocfResult.data.amount.currency).toBe(transferData.amount.currency);
    expect(ocfResult.data.resulting_security_ids).toEqual(transferData.resulting_security_ids);

    await validateOcfObject(ocfResult.data as unknown as Record<string, unknown>);
  });

  /**
   * Test: Create EquityCompensationTransfer via batch API and read back as OCF
   */
  test('creates equity compensation transfer and reads it back as valid OCF', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    // Create prerequisite equity compensation security (V30 DAML contracts validate security_id exists)
    const eqCompSecurity = await setupEquityCompensationSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });

    const transferData = createTestEquityCompensationTransferData({
      security_id: eqCompSecurity.securityId,
      quantity: '10000',
      resulting_security_ids: [generateTestId('eq-result')],
      balance_security_id: generateTestId('eq-balance'),
      consideration_text: 'Stock option transfer',
    });

    // Balance and resulting securities must resolve to equity compensation issuances in the final state.
    const resultingSecurities = await issueEquityCompensationSecurities(ctx.ocp, {
      capTableContractId: eqCompSecurity.capTableContractId,
      capTableContractDetails: await getCapTableDetails(
        ctx.ocp,
        eqCompSecurity.capTableContractId,
        issuerSetup.capTableContractDetails.synchronizerId
      ),
      issuerParty: ctx.issuerParty,
      stakeholderId: eqCompSecurity.stakeholderId,
      stockClassId: eqCompSecurity.stockClassId,
      securityIds: [...transferData.resulting_security_ids, transferData.balance_security_id!],
      issuanceDate: transferData.date,
    });

    const cmd = buildUpdateCapTableCommand(
      {
        capTableContractId: resultingSecurities.capTableContractId,
        capTableContractDetails: resultingSecurities.capTableContractDetails,
      },
      { creates: [{ type: 'equityCompensationTransfer', data: transferData }] }
    );

    const validDisclosedContracts = cmd.disclosedContracts.filter(
      (dc: DisclosedContract) => dc.createdEventBlob && dc.createdEventBlob.length > 0
    );

    const result = await ctx.ocp.ledger.submitAndWaitForTransaction({
      commands: [cmd.command],
      actAs: [ctx.issuerParty],
      disclosedContracts: validDisclosedContracts,
    });

    const transferContractId = extractContractIdFromResponse(result, 'EquityCompensationTransfer');
    expect(transferContractId).toBeTruthy();

    const ocfResult = await ctx.ocp.OpenCapTable.equityCompensationTransfer.get({
      contractId: transferContractId!,
    });

    expect(ocfResult.data.object_type).toBe('TX_EQUITY_COMPENSATION_TRANSFER');
    expect(ocfResult.data.id).toBe(transferData.id);
    expect(ocfResult.data.security_id).toBe(transferData.security_id);
    expect(ocfResult.data.quantity).toBe(transferData.quantity);
    expect(ocfResult.data.resulting_security_ids).toEqual(transferData.resulting_security_ids);
    expect(ocfResult.data.balance_security_id).toBe(transferData.balance_security_id);

    await validateOcfObject(ocfResult.data as unknown as Record<string, unknown>);
  });

  /**
   * Test: Create WarrantTransfer via batch API and read back as OCF
   */
  test('creates warrant transfer and reads it back as valid OCF', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    // Create prerequisite warrant security (V30 DAML contracts validate security_id exists)
    const warrantSecurity = await setupWarrantSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });

    const transferData = createTestWarrantTransferData({
      security_id: warrantSecurity.securityId,
      quantity: '5000',
      resulting_security_ids: [generateTestId('warrant-result-1'), generateTestId('warrant-result-2')],
      consideration_text: 'Warrant transfer to new holder',
    });

    // Resulting securities must resolve to warrant issuances in the cap table's final state.
    const resultingSecurities = await issueWarrantSecurities(ctx.ocp, {
      capTableContractId: warrantSecurity.capTableContractId,
      capTableContractDetails: await getCapTableDetails(
        ctx.ocp,
        warrantSecurity.capTableContractId,
        issuerSetup.capTableContractDetails.synchronizerId
      ),
      issuerParty: ctx.issuerParty,
      stakeholderId: warrantSecurity.stakeholderId,
      securityIds: transferData.resulting_security_ids,
      issuanceDate: transferData.date,
    });

    const cmd = buildUpdateCapTableCommand(
      {
        capTableContractId: resultingSecurities.capTableContractId,
        capTableContractDetails: resultingSecurities.capTableContractDetails,
      },
      { creates: [{ type: 'warrantTransfer', data: transferData }] }
    );

    const validDisclosedContracts = cmd.disclosedContracts.filter(
      (dc: DisclosedContract) => dc.createdEventBlob && dc.createdEventBlob.length > 0
    );

    const result = await ctx.ocp.ledger.submitAndWaitForTransaction({
      commands: [cmd.command],
      actAs: [ctx.issuerParty],
      disclosedContracts: validDisclosedContracts,
    });

    const transferContractId = extractContractIdFromResponse(result, 'WarrantTransfer');
    expect(transferContractId).toBeTruthy();

    const ocfResult = await ctx.ocp.OpenCapTable.warrantTransfer.get({
      contractId: transferContractId!,
    });

    expect(ocfResult.data.object_type).toBe('TX_WARRANT_TRANSFER');
    expect(ocfResult.data.id).toBe(transferData.id);
    expect(ocfResult.data.security_id).toBe(transferData.security_id);
    expect(ocfResult.data.quantity).toBe(transferData.quantity);
    expect(ocfResult.data.resulting_security_ids).toEqual(transferData.resulting_security_ids);

    await validateOcfObject(ocfResult.data as unknown as Record<string, unknown>);
  });
});
