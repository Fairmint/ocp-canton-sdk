/**
 * Integration tests for Document operations.
 *
 * Tests the full lifecycle of Document entities:
 *
 * - Create document and read back as valid OCF
 * - Data round-trip verification
 * - Archive operation
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration
 * ```
 */

import { validateOcfObject } from '../../utils/ocfSchemaValidator';
import { createIntegrationTestSuite } from '../setup';
import { createTestDocumentData, generateTestId, setupTestDocument, setupTestIssuer } from '../utils';

createIntegrationTestSuite('Document operations', (getContext) => {
  test('creates document and reads it back as valid OCF', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const documentSetup = await setupTestDocument(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      documentData: {
        id: generateTestId('doc-ocf-test'),
        path: 'documents/test-agreement.pdf',
        md5: 'a1b2c3d4e5f6789012345678901234ab',
      },
    });

    const ocfResult = await ctx.ocp.OpenCapTable.document.getDocumentAsOcf({
      contractId: documentSetup.documentContractId,
    });

    expect(ocfResult.document.object_type).toBe('DOCUMENT');
    expect(ocfResult.document.path).toBe('documents/test-agreement.pdf');

    await validateOcfObject(ocfResult.document as unknown as Record<string, unknown>);
  });

  test('document data round-trips correctly', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const originalData = createTestDocumentData({
      id: generateTestId('doc-roundtrip'),
      path: 'documents/roundtrip-doc.pdf',
      md5: 'deadbeef12345678901234567890abcd',
      comments: ['Test document comment'],
    });

    const documentSetup = await setupTestDocument(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      documentData: originalData,
    });

    const ocfResult = await ctx.ocp.OpenCapTable.document.getDocumentAsOcf({
      contractId: documentSetup.documentContractId,
    });

    expect(ocfResult.document.id).toBe(originalData.id);
    expect(ocfResult.document.path).toBe(originalData.path);
    expect(ocfResult.document.md5).toBe(originalData.md5);
  });

  test('creates document with URI instead of path', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const documentSetup = await setupTestDocument(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      documentData: {
        id: generateTestId('doc-uri-test'),
        uri: 'https://example.com/documents/external-doc.pdf',
        md5: 'cafebabe12345678901234567890abcd',
      },
    });

    const ocfResult = await ctx.ocp.OpenCapTable.document.getDocumentAsOcf({
      contractId: documentSetup.documentContractId,
    });

    expect(ocfResult.document.object_type).toBe('DOCUMENT');
    expect(ocfResult.document.uri).toBe('https://example.com/documents/external-doc.pdf');

    await validateOcfObject(ocfResult.document as unknown as Record<string, unknown>);
  });

  // TODO: Archive test requires delete command to be exposed in OcpClient
  test.skip('archives document', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const documentSetup = await setupTestDocument(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      documentData: {
        id: generateTestId('doc-archive-test'),
        path: 'documents/to-archive.pdf',
        md5: '12345678901234567890123456789abc',
      },
    });

    // Archive operation not yet exposed in OcpClient
    expect(documentSetup.documentContractId).toBeDefined();
  });
});
