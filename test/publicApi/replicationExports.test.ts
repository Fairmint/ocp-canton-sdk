import * as replication from '../../src/replication';

describe('replication subpath exports', () => {
  it('exposes only the curated replication/verification runtime surface', () => {
    expect(Object.keys(replication).sort()).toEqual([
      'DEFAULT_DEPRECATED_FIELDS',
      'DEFAULT_INTERNAL_FIELDS',
      'ENTITY_OBJECT_TYPE_MAP',
      'FIELD_TO_ENTITY_TYPE',
      'SECURITY_ID_FIELD_TO_ENTITY_TYPE',
      'TRANSACTION_SUBTYPE_MAP',
      'archiveCapTable',
      'buildCantonOcfDataMap',
      'classifyIssuerCapTables',
      'computeReplicationDiff',
      'countManifestObjects',
      'createFactory',
      'createOcfMismatchError',
      'diffOcfObjects',
      'extractCantonOcfManifest',
      'getCapTableState',
      'getEntityTypeLabel',
      'getOcfSchema',
      'getOcfTypeLabel',
      'getSystemOperatorPartyId',
      'isOcfMismatchError',
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
