import { countManifestObjects, type OcfManifest } from '../../src/utils/cantonOcfExtractor';

describe('countManifestObjects', () => {
  const fullManifest: OcfManifest = {
    issuer: { id: 'issuer-1', object_type: 'ISSUER' } as OcfManifest['issuer'],
    stakeholders: [{ id: 's1' }, { id: 's2' }] as OcfManifest['stakeholders'],
    stockClasses: [{ id: 'sc1' }] as OcfManifest['stockClasses'],
    stockPlans: [] as OcfManifest['stockPlans'],
    vestingTerms: [{ id: 'vt1' }] as OcfManifest['vestingTerms'],
    transactions: [{ id: 't1' }, { id: 't2' }, { id: 't3' }] as OcfManifest['transactions'],
    valuations: [{ id: 'v1' }] as OcfManifest['valuations'],
    documents: [{ id: 'd1' }, { id: 'd2' }] as OcfManifest['documents'],
    stockLegendTemplates: [] as OcfManifest['stockLegendTemplates'],
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
