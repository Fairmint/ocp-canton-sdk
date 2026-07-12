/**
 * Curated public API for the OCP Canton SDK.
 *
 * Generated DAML codecs and low-level conversion/read helpers intentionally stay
 * behind this boundary. Public declarations are expressed only in canonical OCF
 * and Canton client types so strict consumers do not inherit code-generator
 * implementation details.
 */

export * from './clientOptions';
export * from './environment';
export * from './errors';
export * from './observability';
export * from './OcpClient';

export * from './types/branded';
export * from './types/common';
export * from './types/native';
export * from './types/output';

export type { ArchiveCapTableParams, ArchiveCapTableResult } from './functions/OpenCapTable/capTable/archiveCapTable';
export {
  CapTableBatch,
  buildUpdateCapTableCommand,
  type BatchItemDetails,
  type BatchItemMeta,
  type CapTableBatchParams,
} from './functions/OpenCapTable/capTable/CapTableBatch';
export * from './functions/OpenCapTable/capTable/entityTypes';
export type {
  CapTableState,
  CapTableWithArchiveContext,
  IssuerCapTableClassification,
  IssuerCapTableStatus,
} from './functions/OpenCapTable/capTable/getCapTableState';

export {
  buildCreateIssuerCommand,
  type CreateIssuerParams,
  type IssuerDataInput,
} from './functions/OpenCapTable/issuer/api';
export { authorizeIssuer } from './functions/OpenCapTable/issuerAuthorization/authorizeIssuer';
export type {
  AuthorizeIssuerParams,
  AuthorizeIssuerResult,
  WithdrawAuthorizationParams,
  WithdrawAuthorizationResult,
} from './functions/OpenCapTable/issuerAuthorization/types';
export { withdrawAuthorization } from './functions/OpenCapTable/issuerAuthorization/withdrawAuthorization';

export {
  countManifestObjects,
  extractCantonOcfManifest,
  sortTransactions,
  type ExtractCantonOcfOptions,
  type OcfManifest,
  type SortableOcfTransaction,
} from './utils/cantonOcfExtractor';

export {
  CantonOcfDataMap,
  buildCantonOcfDataMap,
  computeReplicationDiff,
  type CantonOcfDataEntry,
  type ComputeReplicationDiffOptions,
  type ReadonlyOcfEntityData,
  type ReplicationCreateItem,
  type ReplicationDeleteItem,
  type ReplicationDiff,
  type ReplicationEditItem,
  type ReplicationItem,
  type SecurityIdConflict,
  type SourceReplicationItem,
} from './utils/replicationHelpers';
