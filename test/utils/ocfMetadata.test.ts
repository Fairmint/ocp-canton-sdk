import { ENTITY_REGISTRY } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { getAllOcfTypes, getOcfMetadata, isValidOcfType, OCF_METADATA } from '../../src/utils/ocfMetadata';

describe('OCF_METADATA', () => {
  it('is derived from the entity registry: one entry per entity kind, with its template identity', () => {
    const registryEntries = Object.values(ENTITY_REGISTRY);

    expect(getAllOcfTypes().sort()).toEqual(registryEntries.map((entry) => entry.objectType).sort());
    for (const entry of registryEntries) {
      expect(getOcfMetadata(entry.objectType).templateId).toBe(entry.templateId);
    }
  });

  it('reads the OCF id of every template from its ocf_data field', () => {
    for (const objectType of getAllOcfTypes()) {
      expect(OCF_METADATA[objectType].ocfIdPath).toEqual(['ocf_data', 'id']);
    }
  });

  it('recognizes registered object types only', () => {
    expect(isValidOcfType('TX_STOCK_ISSUANCE')).toBe(true);
    expect(isValidOcfType('ISSUER')).toBe(true);
    expect(isValidOcfType('TX_NOT_A_TYPE')).toBe(false);
  });
});
