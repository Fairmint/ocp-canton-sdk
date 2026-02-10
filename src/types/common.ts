/**
 * Common types shared across all SDK operations.
 *
 * This module provides:
 * - Standardized params/result types for contract operations
 * - Utility types for OCF output formatting
 * - Re-exports of commonly needed types from canton-node-sdk
 *
 * @module
 */

import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
// ===== Re-exports for SDK consumers =====
// These prevent consumers from needing deep imports into canton-node-sdk internals.

export type { Command, DisclosedContract };

export type { ClientConfig, LedgerJsonApiClient, ValidatorApiClient } from '@fairmint/canton-node-sdk';

export type { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

// ===== Common Params Types =====

/**
 * Standard params for retrieving an entity by its contract ID.
 *
 * Used by all `get()` operations that look up a single contract.
 *
 * @example
 * ```typescript
 * const { data: issuer } = await ocp.OpenCapTable.issuer.get({
 *   contractId: '00abc123...',
 * });
 * console.log(issuer.legal_name);
 * ```
 */
export interface GetByContractIdParams {
  /** The Canton contract ID of the entity to retrieve */
  contractId: string;
}

// ===== Common Result Types =====

/**
 * Standard result shape for operations that return a single OCF entity.
 *
 * All `get()` operations return this type. The `data` field contains the
 * OCF entity with an `object_type` discriminant for type-safe pattern matching.
 *
 * @typeParam T - The OCF entity type (e.g., `OcfIssuerOutput`)
 *
 * @example
 * ```typescript
 * // All get() operations return ContractResult<T>:
 * const result = await ocp.OpenCapTable.issuer.get({ contractId });
 * console.log(result.data.legal_name);
 * console.log(result.contractId);
 *
 * // Destructure for convenience:
 * const { data: issuer } = await ocp.OpenCapTable.issuer.get({ contractId });
 * ```
 */
export interface ContractResult<T> {
  /** The OCF entity data with `object_type` discriminant */
  readonly data: T;
  /** The Canton contract ID */
  readonly contractId: string;
}

// ===== Utility Types =====

/**
 * Add an `object_type` discriminant to an OCF type.
 *
 * Used to create output types that include the OCF `object_type` field
 * for discriminated union support.
 *
 * @typeParam T - The base OCF type
 * @typeParam OT - The object_type literal string
 *
 * @example
 * ```typescript
 * type OcfIssuerOutput = WithObjectType<OcfIssuer, 'ISSUER'>;
 * // equivalent to: OcfIssuer & { readonly object_type: 'ISSUER' }
 * ```
 */
export type WithObjectType<T, OT extends string> = T & { readonly object_type: OT };
