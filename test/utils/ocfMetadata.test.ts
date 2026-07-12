import { getOcfMetadata, isValidOcfType, OCF_METADATA, type OcfMetadataObjectType } from '../../src/utils/ocfMetadata';

function getMetadataForUntrustedType(type: string) {
  return isValidOcfType(type) ? getOcfMetadata(type) : undefined;
}

describe('OCF metadata registry', () => {
  test.each<OcfMetadataObjectType>(['STOCK_CLASS', 'STAKEHOLDER', 'TX_STOCK_ISSUANCE'])(
    'recognizes owned registry key %s',
    (type) => {
      expect(isValidOcfType(type)).toBe(true);
      expect(getMetadataForUntrustedType(type)).toBe(OCF_METADATA[type]);
    }
  );

  test('rejects an ordinary unknown key', () => {
    expect(isValidOcfType('UNKNOWN')).toBe(false);
    expect(getMetadataForUntrustedType('UNKNOWN')).toBeUndefined();
  });

  test.each(['constructor', 'toString', '__proto__'])('rejects inherited prototype key %s', (prototypeKey) => {
    expect(isValidOcfType(prototypeKey)).toBe(false);
    expect(getMetadataForUntrustedType(prototypeKey)).toBeUndefined();
  });
});
