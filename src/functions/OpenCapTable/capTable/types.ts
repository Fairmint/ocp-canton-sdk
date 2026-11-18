import type { OcfEntityType } from './entityTypes';

/**
 * Minimal view of the records currently on a cap table's book, grouped by entity type.
 *
 * Replication and manifest extraction need only which records exist, the contract behind each one and the security
 * IDs already in use. Producers build it from whatever they read off the ledger.
 */
export interface CantonRecordIndex {
  /**
   * Map of entity type to the canonical object IDs currently on the book.
   * Each entry contains all object IDs of that type.
   */
  entities: Map<OcfEntityType, Set<string>>;

  /**
   * Map of entity type to (canonical object ID → contract ID) for fetching individual contracts.
   * Useful for deep verification where contract data needs to be compared.
   */
  contractIds: Map<OcfEntityType, Map<string, string>>;

  /**
   * Security IDs currently on the book.
   *
   * Security IDs are unique across instruments: a stock, warrant, convertible or equity compensation issuance cannot
   * reuse a security ID that any other issuance on the book already holds. Used by computeReplicationDiff to detect
   * duplicate security IDs before submitting writes that the ledger would reject.
   */
  securityIds: Set<string>;
}
