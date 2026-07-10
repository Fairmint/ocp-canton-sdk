import { countManifestObjects, type OcfManifest } from '../../src/utils/cantonOcfExtractor';
import {
  createTestDocumentData,
  createTestIssuerData,
  createTestStakeholderData,
  createTestStockClassData,
  createTestStockIssuanceData,
  createTestStockRetractionData,
  createTestStockTransferData,
  createTestValuationData,
  createTestVestingTermsData,
} from '../integration/utils';

describe('countManifestObjects', () => {
  const fullManifest: OcfManifest = {
    issuer: createTestIssuerData({ id: 'issuer-1' }),
    stakeholders: [createTestStakeholderData({ id: 's1' }), createTestStakeholderData({ id: 's2' })],
    stockClasses: [createTestStockClassData({ id: 'sc1' })],
    stockPlans: [],
    vestingTerms: [createTestVestingTermsData({ id: 'vt1' })],
    transactions: [
      createTestStockIssuanceData({ id: 't1', stakeholder_id: 's1', stock_class_id: 'sc1' }),
      createTestStockTransferData({ id: 't2', security_id: 'security-1' }),
      createTestStockRetractionData({ id: 't3', security_id: 'security-2' }),
    ],
    valuations: [createTestValuationData({ id: 'v1', stock_class_id: 'sc1' })],
    documents: [createTestDocumentData({ id: 'd1' }), createTestDocumentData({ id: 'd2' })],
    stockLegendTemplates: [],
  };

  test('counts all objects in a full manifest', () => {
    // 1 issuer + 2 stakeholders + 1 stockClass + 0 stockPlans + 1 vestingTerms
    // + 3 transactions + 1 valuation + 2 documents + 0 stockLegendTemplates = 11
    expect(countManifestObjects(fullManifest)).toBe(11);
  });

  test('handles partial manifest missing valuations, documents, and stockLegendTemplates', () => {
    // Simulates buildCaptableInput output which omits these fields
    const partial: Partial<OcfManifest> = {
      issuer: fullManifest.issuer,
      stakeholders: fullManifest.stakeholders,
      stockClasses: fullManifest.stockClasses,
      stockPlans: fullManifest.stockPlans,
      vestingTerms: fullManifest.vestingTerms,
      transactions: fullManifest.transactions,
      // valuations, documents, stockLegendTemplates intentionally omitted
    };

    // 1 + 2 + 1 + 0 + 1 + 3 = 8 (omitted fields treated as empty)
    expect(countManifestObjects(partial)).toBe(8);
  });

  test('handles empty manifest', () => {
    expect(countManifestObjects({})).toBe(0);
  });

  test('handles manifest with only issuer', () => {
    expect(countManifestObjects({ issuer: fullManifest.issuer })).toBe(1);
  });

  test('handles manifest with null issuer', () => {
    expect(countManifestObjects({ issuer: null })).toBe(0);
  });
});
