/**
 * Integration tests for Issuer operations.
 *
 * Tests the full lifecycle of Issuer entities:
 *
 * - Create issuer (with the cap table) and read back as valid OCF
 * - Data round-trip verification
 * - Edit through `CapTable_Restate`
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration
 * ```
 */

import { validateOcfObject } from '../../utils/ocfSchemaValidator';
import { createIntegrationTestSuite } from '../setup';
import { createTestIssuerData, generateTestId, restateOperations, setupTestBook } from '../utils';

createIntegrationTestSuite('Issuer operations', (getContext) => {
  test('creates issuer and reads it back as valid OCF', async () => {
    const ctx = getContext();

    const book = await setupTestBook(ctx, {
      id: generateTestId('issuer-ocf-test'),
      legal_name: 'Integration Test Corp',
    });

    // Read back the issuer as OCF using the Issuer record's contract ID
    const ocfResult = await ctx.ocp.OpenCapTable.issuer.get({
      contractId: book.issuerContractId,
      readAs: [ctx.transferAgentParty],
    });

    // Validate OCF structure
    expect(ocfResult.data.object_type).toBe('ISSUER');
    expect(ocfResult.data.legal_name).toBe('Integration Test Corp');

    // Validate against official OCF schema
    await validateOcfObject(ocfResult.data);
  });

  test('issuer data round-trips correctly', async () => {
    const ctx = getContext();

    const originalData = createTestIssuerData({
      id: generateTestId('issuer-roundtrip'),
      legal_name: 'Roundtrip Test Inc.',
      formation_date: '2023-06-15',
      country_of_formation: 'US',
      country_subdivision_of_formation: 'CA',
      dba: 'Roundtrip DBA',
      tax_ids: [{ country: 'US', tax_id: '98-7654321' }],
      comments: ['Test comment 1', 'Test comment 2'],
    });

    const book = await setupTestBook(ctx, originalData);

    const ocfResult = await ctx.ocp.OpenCapTable.issuer.get({
      contractId: book.issuerContractId,
      readAs: [ctx.transferAgentParty],
    });

    // Verify data round-trip
    expect(ocfResult.data.id).toBe(originalData.id);
    expect(ocfResult.data.legal_name).toBe(originalData.legal_name);
    expect(ocfResult.data.formation_date).toBe(originalData.formation_date);
    expect(ocfResult.data.country_of_formation).toBe(originalData.country_of_formation);
    expect(ocfResult.data.country_subdivision_of_formation).toBe(originalData.country_subdivision_of_formation);
    expect(ocfResult.data.dba).toBe(originalData.dba);
    expect(ocfResult.data.tax_ids).toEqual(originalData.tax_ids);
    expect(ocfResult.data.comments).toEqual(originalData.comments);
  });

  test('edits issuer via CapTable_Restate', async () => {
    const ctx = getContext();

    // Create issuer with initial data
    const originalData = createTestIssuerData({
      id: generateTestId('issuer-restate'),
      legal_name: 'Original Corp Name',
      formation_date: '2023-01-01',
      country_of_formation: 'US',
    });
    const book = await setupTestBook(ctx, originalData);

    // Edit the issuer through a restatement
    const updatedIssuerData = {
      ...originalData,
      legal_name: 'Updated Corp Name',
      dba: 'New DBA Name',
    };
    const created = await restateOperations(book, [{ kind: 'edit', type: 'issuer', data: updatedIssuerData }]);

    // An edit replaces the record's contract: the restatement returns the new one
    const edited = created.get(originalData.id);
    expect(edited?.entityType).toBe('issuer');
    expect(edited?.contractId).not.toBe(book.issuerContractId);

    const ocfResult = await ctx.ocp.OpenCapTable.issuer.get({
      contractId: edited?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(ocfResult.data.legal_name).toBe('Updated Corp Name');
    expect(ocfResult.data.dba).toBe('New DBA Name');
  });
});
