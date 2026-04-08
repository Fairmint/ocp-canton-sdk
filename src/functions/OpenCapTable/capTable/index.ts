export * from './buildCapTableCommand';
export * from './capTableRegistry';
export * from './types';

// Archive operations
export {
  archiveCapTable,
  buildArchiveCapTableCommand,
  type ArchiveCapTableParams,
  type ArchiveCapTableResult,
} from './archiveCapTable';
export {
  archiveFullCapTable,
  getSystemOperatorPartyId,
  type ArchiveCapTableEntities,
  type ArchiveFullCapTableOptions,
  type ArchiveFullCapTableResult,
} from './archiveFullCapTable';

// Batch API exports
export * from './batchTypes';
export {
  CapTableBatch,
  buildUpdateCapTableCommand,
  type BatchItemDetails,
  type BatchItemMeta,
  type CapTableBatchParams,
} from './CapTableBatch';
export { convertToDaml } from './ocfToDaml';

// DAML to OCF conversion (read operations)
export {
  ENTITY_DATA_FIELD_MAP,
  convertToOcf,
  extractCreateArgument,
  extractEntityData,
  getEntityAsOcf,
  type GetEntityAsOcfResult,
  type SupportedOcfReadType,
} from './damlToOcf';

// CapTable state reader (for replication)
export {
  discoverCapTables,
  FIELD_TO_ENTITY_TYPE,
  SECURITY_ID_FIELD_TO_ENTITY_TYPE,
  getCapTableState,
  type CapTableDiscoveryResult,
  type CapTableDiscoveryStatus,
  type CapTableState,
  type DiscoverCapTablesParams,
  type DiscoveredCapTableState,
} from './getCapTableState';
