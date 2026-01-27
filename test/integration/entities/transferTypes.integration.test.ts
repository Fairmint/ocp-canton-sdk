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
  setupConvertibleSecurity,
  setupEquityCompensationSecurity,
  setupStockSecurity,
  setupTestIssuer,
  setupWarrantSecurity,
} from '../utils';

/** Extract a contract ID from a transaction tree response. */
function extractContractIdFromResponse(
  response: { transactionTree: Record<string, unknown> },
  templateIdContains: string
): string | null {
  const tree = response.transactionTree;
  const treeAny = tree as {
    eventsById?: Record<string, unknown>;
    transaction?: { eventsById?: Record<string, unknown> };
  };
  const eventsById = treeAny.eventsById ?? treeAny.transaction?.eventsById ?? {};

  for (const event of Object.values(eventsById)) {
    const eventData = event as Record<string, unknown>;
    if (eventData.CreatedTreeEvent) {
      const created = (eventData.CreatedTreeEvent as Record<string, unknown>).value as Record<string, unknown>;
      const templateId = created.templateId as string;
      const isMatch = templateId.includes(`:${templateIdContains}:`) || templateId.endsWith(`:${templateIdContains}`);
      if (isMatch) {
        return created.contractId as string;
      }
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
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    // Create prerequisite stock security (V30 DAML contracts validate security_id exists)
    const stockSecurity = await setupStockSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
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

    // Create stock transfer data
    const transferData = createTestStockTransferData({
      security_id: stockSecurity.securityId,
      quantity: '1000',
      resulting_security_ids: [generateTestId('result-1'), generateTestId('result-2')],
      balance_security_id: generateTestId('balance'),
      consideration_text: 'Transfer consideration',
    });

    // Create transfer via batch API
    const cmd = buildUpdateCapTableCommand(
      {
        capTableContractId: stockSecurity.capTableContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: updatedCapTableDetails,
      },
      { creates: [{ type: 'stockTransfer', data: transferData }] }
    );

    const validDisclosedContracts = cmd.disclosedContracts.filter(
      (dc: DisclosedContract) => dc.createdEventBlob && dc.createdEventBlob.length > 0
    );

    const result = await ctx.ocp.client.submitAndWaitForTransactionTree({
      commands: [cmd.command],
      actAs: [ctx.issuerParty],
      disclosedContracts: validDisclosedContracts,
    });

    // Extract contract ID
    const transferContractId = extractContractIdFromResponse(result, 'StockTransfer');
    expect(transferContractId).toBeTruthy();

    // Read back as OCF
    const ocfResult = await ctx.ocp.OpenCapTable.stockTransfer.getStockTransferAsOcf({
      contractId: transferContractId!,
    });

    // Validate structure
    expect(ocfResult.event.object_type).toBe('TX_STOCK_TRANSFER');
    expect(ocfResult.event.id).toBe(transferData.id);
    expect(ocfResult.event.security_id).toBe(transferData.security_id);
    expect(ocfResult.event.quantity).toBe(transferData.quantity);
    expect(ocfResult.event.resulting_security_ids).toEqual(transferData.resulting_security_ids);
    expect(ocfResult.event.balance_security_id).toBe(transferData.balance_security_id);

    // Validate against OCF schema
    await validateOcfObject(ocfResult.event as unknown as Record<string, unknown>);
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
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    // Create prerequisite convertible security (V30 DAML contracts validate security_id exists)
    const convertibleSecurity = await setupConvertibleSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });

    // Get updated cap table contract details
    const events = await ctx.ocp.client.getEventsByContractId({
      contractId: convertibleSecurity.capTableContractId,
    });
    const updatedCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: convertibleSecurity.capTableContractId,
          createdEventBlob: events.created.createdEvent.createdEventBlob,
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    const transferData = createTestConvertibleTransferData({
      security_id: convertibleSecurity.securityId,
      amount: { amount: '75000', currency: 'USD' },
      resulting_security_ids: [generateTestId('conv-result')],
      consideration_text: 'Convertible note transfer',
    });

    const cmd = buildUpdateCapTableCommand(
      {
        capTableContractId: convertibleSecurity.capTableContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: updatedCapTableDetails,
      },
      { creates: [{ type: 'convertibleTransfer', data: transferData }] }
    );

    const validDisclosedContracts = cmd.disclosedContracts.filter(
      (dc: DisclosedContract) => dc.createdEventBlob && dc.createdEventBlob.length > 0
    );

    const result = await ctx.ocp.client.submitAndWaitForTransactionTree({
      commands: [cmd.command],
      actAs: [ctx.issuerParty],
      disclosedContracts: validDisclosedContracts,
    });

    const transferContractId = extractContractIdFromResponse(result, 'ConvertibleTransfer');
    expect(transferContractId).toBeTruthy();

    const ocfResult = await ctx.ocp.OpenCapTable.convertibleTransfer.getConvertibleTransferAsOcf({
      contractId: transferContractId!,
    });

    expect(ocfResult.event.object_type).toBe('TX_CONVERTIBLE_TRANSFER');
    expect(ocfResult.event.id).toBe(transferData.id);
    expect(ocfResult.event.security_id).toBe(transferData.security_id);
    expect(ocfResult.event.amount.amount).toBe(transferData.amount.amount);
    expect(ocfResult.event.amount.currency).toBe(transferData.amount.currency);
    expect(ocfResult.event.resulting_security_ids).toEqual(transferData.resulting_security_ids);

    await validateOcfObject(ocfResult.event as unknown as Record<string, unknown>);
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
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    // Create prerequisite equity compensation security (V30 DAML contracts validate security_id exists)
    const eqCompSecurity = await setupEquityCompensationSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });

    // Get updated cap table contract details
    const events = await ctx.ocp.client.getEventsByContractId({ contractId: eqCompSecurity.capTableContractId });
    const updatedCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: eqCompSecurity.capTableContractId,
          createdEventBlob: events.created.createdEvent.createdEventBlob,
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    const transferData = createTestEquityCompensationTransferData({
      security_id: eqCompSecurity.securityId,
      quantity: '10000',
      resulting_security_ids: [generateTestId('eq-result')],
      balance_security_id: generateTestId('eq-balance'),
      consideration_text: 'Stock option transfer',
    });

    const cmd = buildUpdateCapTableCommand(
      {
        capTableContractId: eqCompSecurity.capTableContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: updatedCapTableDetails,
      },
      { creates: [{ type: 'equityCompensationTransfer', data: transferData }] }
    );

    const validDisclosedContracts = cmd.disclosedContracts.filter(
      (dc: DisclosedContract) => dc.createdEventBlob && dc.createdEventBlob.length > 0
    );

    const result = await ctx.ocp.client.submitAndWaitForTransactionTree({
      commands: [cmd.command],
      actAs: [ctx.issuerParty],
      disclosedContracts: validDisclosedContracts,
    });

    const transferContractId = extractContractIdFromResponse(result, 'EquityCompensationTransfer');
    expect(transferContractId).toBeTruthy();

    const ocfResult = await ctx.ocp.OpenCapTable.equityCompensationTransfer.getEquityCompensationTransferAsOcf({
      contractId: transferContractId!,
    });

    expect(ocfResult.event.object_type).toBe('TX_EQUITY_COMPENSATION_TRANSFER');
    expect(ocfResult.event.id).toBe(transferData.id);
    expect(ocfResult.event.security_id).toBe(transferData.security_id);
    expect(ocfResult.event.quantity).toBe(transferData.quantity);
    expect(ocfResult.event.resulting_security_ids).toEqual(transferData.resulting_security_ids);
    expect(ocfResult.event.balance_security_id).toBe(transferData.balance_security_id);

    await validateOcfObject(ocfResult.event as unknown as Record<string, unknown>);
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
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    // Create prerequisite warrant security (V30 DAML contracts validate security_id exists)
    const warrantSecurity = await setupWarrantSecurity(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
    });

    // Get updated cap table contract details
    const events = await ctx.ocp.client.getEventsByContractId({ contractId: warrantSecurity.capTableContractId });
    const updatedCapTableDetails = events.created?.createdEvent
      ? {
          templateId: events.created.createdEvent.templateId,
          contractId: warrantSecurity.capTableContractId,
          createdEventBlob: events.created.createdEvent.createdEventBlob,
          synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
        }
      : undefined;

    const transferData = createTestWarrantTransferData({
      security_id: warrantSecurity.securityId,
      quantity: '5000',
      resulting_security_ids: [generateTestId('warrant-result-1'), generateTestId('warrant-result-2')],
      consideration_text: 'Warrant transfer to new holder',
    });

    const cmd = buildUpdateCapTableCommand(
      {
        capTableContractId: warrantSecurity.capTableContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: updatedCapTableDetails,
      },
      { creates: [{ type: 'warrantTransfer', data: transferData }] }
    );

    const validDisclosedContracts = cmd.disclosedContracts.filter(
      (dc: DisclosedContract) => dc.createdEventBlob && dc.createdEventBlob.length > 0
    );

    const result = await ctx.ocp.client.submitAndWaitForTransactionTree({
      commands: [cmd.command],
      actAs: [ctx.issuerParty],
      disclosedContracts: validDisclosedContracts,
    });

    const transferContractId = extractContractIdFromResponse(result, 'WarrantTransfer');
    expect(transferContractId).toBeTruthy();

    const ocfResult = await ctx.ocp.OpenCapTable.warrantTransfer.getWarrantTransferAsOcf({
      contractId: transferContractId!,
    });

    expect(ocfResult.event.object_type).toBe('TX_WARRANT_TRANSFER');
    expect(ocfResult.event.id).toBe(transferData.id);
    expect(ocfResult.event.security_id).toBe(transferData.security_id);
    expect(ocfResult.event.quantity).toBe(transferData.quantity);
    expect(ocfResult.event.resulting_security_ids).toEqual(transferData.resulting_security_ids);

    await validateOcfObject(ocfResult.event as unknown as Record<string, unknown>);
  });
});
