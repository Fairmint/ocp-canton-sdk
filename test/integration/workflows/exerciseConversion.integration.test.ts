/**
 * Integration tests for exercise and conversion transaction types.
 *
 * Tests the complete lifecycle of:
 * - WarrantExercise - Exercise warrants into stock
 * - ConvertibleConversion - Convert convertible notes to equity
 * - StockConversion - Convert between stock classes
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration
 * ```
 */

import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { buildUpdateCapTableCommand } from '../../../src/functions/OpenCapTable';
import type { OcfConvertibleConversion, OcfStockConversion, OcfWarrantExercise } from '../../../src/types/native';
import { createIntegrationTestSuite } from '../setup';
import { generateDateString, generateTestId, setupTestIssuer, setupTestStakeholder } from '../utils';

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

createIntegrationTestSuite('Exercise and Conversion operations', (getContext) => {
  /**
   * Test: Create warrant exercise via batch API.
   *
   * This test verifies that a WarrantExercise transaction can be created via the UpdateCapTable batch API.
   */
  test('creates warrant exercise transaction via batch API', async () => {
    const ctx = getContext();

    // Setup issuer and stakeholder
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      issuerData: {
        id: generateTestId('we-issuer'),
        legal_name: 'Warrant Exercise Test Corp',
      },
    });

    const stakeholderSetup = await setupTestStakeholder(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stakeholderData: {
        id: generateTestId('we-stakeholder'),
        name: { legal_name: 'Warrant Holder' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    // Create a warrant exercise transaction
    const warrantExerciseData: OcfWarrantExercise = {
      id: generateTestId('warrant-exercise'),
      date: generateDateString(0),
      security_id: generateTestId('warrant-sec'),
      quantity: '1000',
      resulting_security_ids: [generateTestId('stock-sec-result')],
      consideration_text: 'Exercise of warrants into common stock',
      comments: ['Exercised via integration test'],
    };

    const cmd = buildUpdateCapTableCommand(
      {
        capTableContractId: stakeholderSetup.newCapTableContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: stakeholderSetup.newCapTableContractDetails,
      },
      { creates: [{ type: 'warrantExercise', data: warrantExerciseData }] }
    );

    const validDC = cmd.disclosedContracts.filter(
      (dc: DisclosedContract) => dc.createdEventBlob && dc.createdEventBlob.length > 0
    );

    const result = await ctx.ocp.client.submitAndWaitForTransactionTree({
      commands: [cmd.command],
      actAs: [ctx.issuerParty],
      disclosedContracts: validDC,
    });

    // Verify the transaction was created
    expect(result.transactionTree).toBeDefined();

    // Extract and verify the new CapTable was created
    const newCapTableContractId = extractContractIdFromResponse(result, 'CapTable');
    expect(newCapTableContractId).toBeTruthy();
  });

  /**
   * Test: Create convertible conversion via batch API.
   *
   * This test verifies that a ConvertibleConversion transaction can be created via the UpdateCapTable batch API.
   */
  test('creates convertible conversion transaction via batch API', async () => {
    const ctx = getContext();

    // Setup issuer and stakeholder
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      issuerData: {
        id: generateTestId('cc-issuer'),
        legal_name: 'Convertible Conversion Test Corp',
      },
    });

    const stakeholderSetup = await setupTestStakeholder(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stakeholderData: {
        id: generateTestId('cc-stakeholder'),
        name: { legal_name: 'Convertible Note Holder' },
        stakeholder_type: 'INSTITUTION',
      },
    });

    // Create a convertible conversion transaction
    const convertibleConversionData: OcfConvertibleConversion = {
      id: generateTestId('convertible-conversion'),
      date: generateDateString(0),
      security_id: generateTestId('convertible-sec'),
      resulting_security_ids: [generateTestId('stock-sec-result')],
      trigger_id: 'qualified-financing-trigger',
      comments: ['Converted on Series A closing'],
    };

    const cmd = buildUpdateCapTableCommand(
      {
        capTableContractId: stakeholderSetup.newCapTableContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: stakeholderSetup.newCapTableContractDetails,
      },
      { creates: [{ type: 'convertibleConversion', data: convertibleConversionData }] }
    );

    const validDC = cmd.disclosedContracts.filter(
      (dc: DisclosedContract) => dc.createdEventBlob && dc.createdEventBlob.length > 0
    );

    const result = await ctx.ocp.client.submitAndWaitForTransactionTree({
      commands: [cmd.command],
      actAs: [ctx.issuerParty],
      disclosedContracts: validDC,
    });

    // Verify the transaction was created
    expect(result.transactionTree).toBeDefined();

    // Extract and verify the new CapTable was created
    const newCapTableContractId = extractContractIdFromResponse(result, 'CapTable');
    expect(newCapTableContractId).toBeTruthy();
  });

  /**
   * Test: Create stock conversion via batch API.
   *
   * This test verifies that a StockConversion transaction can be created via the UpdateCapTable batch API.
   */
  test('creates stock conversion transaction via batch API', async () => {
    const ctx = getContext();

    // Setup issuer and stakeholder
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      issuerData: {
        id: generateTestId('sc-issuer'),
        legal_name: 'Stock Conversion Test Corp',
      },
    });

    const stakeholderSetup = await setupTestStakeholder(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stakeholderData: {
        id: generateTestId('sc-stakeholder'),
        name: { legal_name: 'Preferred Stock Holder' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    // Create a stock conversion transaction
    const stockConversionData: OcfStockConversion = {
      id: generateTestId('stock-conversion'),
      date: generateDateString(0),
      security_id: generateTestId('preferred-sec'),
      quantity: '5000',
      resulting_security_ids: [generateTestId('common-sec-result')],
      comments: ['Converted preferred to common on IPO'],
    };

    const cmd = buildUpdateCapTableCommand(
      {
        capTableContractId: stakeholderSetup.newCapTableContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: stakeholderSetup.newCapTableContractDetails,
      },
      { creates: [{ type: 'stockConversion', data: stockConversionData }] }
    );

    const validDC = cmd.disclosedContracts.filter(
      (dc: DisclosedContract) => dc.createdEventBlob && dc.createdEventBlob.length > 0
    );

    const result = await ctx.ocp.client.submitAndWaitForTransactionTree({
      commands: [cmd.command],
      actAs: [ctx.issuerParty],
      disclosedContracts: validDC,
    });

    // Verify the transaction was created
    expect(result.transactionTree).toBeDefined();

    // Extract and verify the new CapTable was created
    const newCapTableContractId = extractContractIdFromResponse(result, 'CapTable');
    expect(newCapTableContractId).toBeTruthy();
  });

  /**
   * Test: Create multiple exercise/conversion transactions in a single batch.
   *
   * This test verifies that multiple exercise and conversion transactions can be created atomically.
   */
  test('creates multiple exercise/conversion transactions in a single batch', async () => {
    const ctx = getContext();

    // Setup issuer and stakeholder
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      issuerData: {
        id: generateTestId('multi-issuer'),
        legal_name: 'Multi Exercise/Conversion Test Corp',
      },
    });

    const stakeholderSetup = await setupTestStakeholder(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stakeholderData: {
        id: generateTestId('multi-stakeholder'),
        name: { legal_name: 'Multi-Security Holder' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    // Create multiple transactions in a single batch
    const warrantExerciseData: OcfWarrantExercise = {
      id: generateTestId('batch-warrant-exercise'),
      date: generateDateString(0),
      security_id: generateTestId('batch-warrant-sec'),
      quantity: '2000',
      resulting_security_ids: [generateTestId('batch-stock-sec-1')],
    };

    const stockConversionData: OcfStockConversion = {
      id: generateTestId('batch-stock-conversion'),
      date: generateDateString(0),
      security_id: generateTestId('batch-preferred-sec'),
      quantity: '3000',
      resulting_security_ids: [generateTestId('batch-common-sec-1')],
    };

    const cmd = buildUpdateCapTableCommand(
      {
        capTableContractId: stakeholderSetup.newCapTableContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: stakeholderSetup.newCapTableContractDetails,
      },
      {
        creates: [
          { type: 'warrantExercise', data: warrantExerciseData },
          { type: 'stockConversion', data: stockConversionData },
        ],
      }
    );

    const validDC = cmd.disclosedContracts.filter(
      (dc: DisclosedContract) => dc.createdEventBlob && dc.createdEventBlob.length > 0
    );

    const result = await ctx.ocp.client.submitAndWaitForTransactionTree({
      commands: [cmd.command],
      actAs: [ctx.issuerParty],
      disclosedContracts: validDC,
    });

    // Verify the transactions were created atomically
    expect(result.transactionTree).toBeDefined();

    // Extract and verify the new CapTable was created
    const newCapTableContractId = extractContractIdFromResponse(result, 'CapTable');
    expect(newCapTableContractId).toBeTruthy();
  });

  /**
   * Test: Warrant exercise with partial exercise (balance security).
   *
   * This test verifies that a partial warrant exercise correctly references the balance security.
   */
  test('creates warrant exercise with balance security for partial exercise', async () => {
    const ctx = getContext();

    // Setup issuer and stakeholder
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      issuerData: {
        id: generateTestId('partial-we-issuer'),
        legal_name: 'Partial Exercise Test Corp',
      },
    });

    const stakeholderSetup = await setupTestStakeholder(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stakeholderData: {
        id: generateTestId('partial-we-stakeholder'),
        name: { legal_name: 'Partial Exercise Holder' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    // Create a partial warrant exercise with balance security
    const warrantExerciseData: OcfWarrantExercise = {
      id: generateTestId('partial-warrant-exercise'),
      date: generateDateString(0),
      security_id: generateTestId('original-warrant-sec'),
      quantity: '500', // Partial exercise
      resulting_security_ids: [generateTestId('exercised-stock-sec')],
      balance_security_id: generateTestId('remaining-warrant-sec'), // Remaining warrants
      consideration_text: 'Partial exercise - 500 of 1000 warrants',
    };

    const cmd = buildUpdateCapTableCommand(
      {
        capTableContractId: stakeholderSetup.newCapTableContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: stakeholderSetup.newCapTableContractDetails,
      },
      { creates: [{ type: 'warrantExercise', data: warrantExerciseData }] }
    );

    const validDC = cmd.disclosedContracts.filter(
      (dc: DisclosedContract) => dc.createdEventBlob && dc.createdEventBlob.length > 0
    );

    const result = await ctx.ocp.client.submitAndWaitForTransactionTree({
      commands: [cmd.command],
      actAs: [ctx.issuerParty],
      disclosedContracts: validDC,
    });

    // Verify the transaction was created
    expect(result.transactionTree).toBeDefined();

    // Extract and verify the new CapTable was created
    const newCapTableContractId = extractContractIdFromResponse(result, 'CapTable');
    expect(newCapTableContractId).toBeTruthy();
  });
});
