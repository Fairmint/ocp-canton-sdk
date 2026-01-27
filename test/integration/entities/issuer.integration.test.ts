/**
 * Integration tests for Issuer operations.
 *
 * Tests the full lifecycle of Issuer entities:
 *
 * - Create issuer and read back as valid OCF
 * - Data round-trip verification
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration
 * ```
 */

import { validateOcfObject } from '../../utils/ocfSchemaValidator';
import { createIntegrationTestSuite } from '../setup';
import { createTestIssuerData, generateTestId, setupTestIssuer } from '../utils';

createIntegrationTestSuite('Issuer operations', (getContext) => {
  test('creates issuer and reads it back as valid OCF', async () => {
    const ctx = getContext();

    const testSetup = await setupTestIssuer(ctx.ocp, {
      issuerParty: ctx.issuerParty,
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerData: {
        id: generateTestId('issuer-ocf-test'),
        legal_name: 'Integration Test Corp',
      },
    });

    // Read back the issuer as OCF using the actual Issuer contract ID
    const ocfResult = await ctx.ocp.OpenCapTable.issuer.getIssuerAsOcf({
      contractId: testSetup.issuerOcfContractId,
    });

    // Validate OCF structure
    expect(ocfResult.issuer.object_type).toBe('ISSUER');
    expect(ocfResult.issuer.legal_name).toBe('Integration Test Corp');

    // Validate against official OCF schema
    await validateOcfObject(ocfResult.issuer as unknown as Record<string, unknown>);
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

    const testSetup = await setupTestIssuer(ctx.ocp, {
      issuerParty: ctx.issuerParty,
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerData: originalData,
    });

    const ocfResult = await ctx.ocp.OpenCapTable.issuer.getIssuerAsOcf({
      contractId: testSetup.issuerOcfContractId,
    });

    // Verify data round-trip
    expect(ocfResult.issuer.id).toBe(originalData.id);
    expect(ocfResult.issuer.legal_name).toBe(originalData.legal_name);
    expect(ocfResult.issuer.formation_date).toBe(originalData.formation_date);
    expect(ocfResult.issuer.country_of_formation).toBe(originalData.country_of_formation);
    expect(ocfResult.issuer.country_subdivision_of_formation).toBe(originalData.country_subdivision_of_formation);
    expect(ocfResult.issuer.dba).toBe(originalData.dba);
  });
});
