import * as replication from '../../src/replication';

describe('replication subpath exports', () => {
  it('exposes only the curated replication/verification runtime surface', () => {
    expect(Object.keys(replication).sort()).toEqual([
      'DEFAULT_DEPRECATED_FIELDS',
      'DEFAULT_INTERNAL_FIELDS',
      'ENTITY_OBJECT_TYPE_MAP',
      'SCHEMA_DEFAULT_EQUIVALENCE_RULES',
      'TRANSACTION_SUBTYPE_MAP',
      'buildCantonOcfDataMap',
      'computeReplicationDiff',
      'countManifestObjects',
      'createOcfMismatchError',
      'diffOcfObjects',
      'extractCantonOcfManifest',
      'getEntityTypeLabel',
      'getOcfSchema',
      'getOcfTypeLabel',
      'isOcfMismatchError',
      'isSchemaDefaultEquivalent',
      'isSchemaDefaultEquivalentWithContext',
      'mapCategorizedTypeToEntityType',
      'matchesTemplateIdentity',
      'normalizeEntityType',
      'normalizeObjectType',
      'normalizeOcfData',
      'ocfCompare',
      'ocfDeepEqual',
      'parseOcfEntityInput',
      'parseOcfObject',
      'sortTransactions',
      'stripInternalFields',
    ]);
  });
});
