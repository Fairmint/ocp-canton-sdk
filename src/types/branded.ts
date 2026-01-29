/**
 * Branded types for improved type safety.
 *
 * Branded types (also called "nominal types" or "tagged types") use a phantom brand
 * to create types that are structurally identical to their base type but considered
 * distinct by TypeScript. This prevents accidental mixing of semantically different
 * string values like ContractIds and PartyIds.
 *
 * @example
 * ```typescript
 * const contractId: ContractId = '00abc123' as ContractId;
 * const partyId: PartyId = 'alice::namespace' as PartyId;
 *
 * // TypeScript error: cannot assign ContractId to PartyId
 * const wrongParty: PartyId = contractId; // Error!
 *
 * // Can still use string operations
 * console.log(contractId.length); // Works fine
 * ```
 */

/**
 * Unique symbol for branding types.
 * This symbol is never used at runtime, only for type discrimination.
 */
declare const BRAND_SYMBOL: unique symbol;

/**
 * Generic branded type helper.
 * Creates a type that is a string at runtime but carries a type brand.
 */
type Brand<T, B extends string> = T & { readonly [BRAND_SYMBOL]: B };

/**
 * Canton contract identifier.
 *
 * A branded string type representing a unique contract ID on the Canton ledger.
 * Contract IDs are opaque identifiers assigned by Canton when contracts are created.
 *
 * @example
 * ```typescript
 * async function getIssuer(contractId: ContractId) {
 *   // TypeScript ensures only ContractId values are passed
 * }
 *
 * // Create from raw string (after validation)
 * const id = validateContractId(rawString); // Returns ContractId
 * ```
 */
export type ContractId = Brand<string, 'ContractId'>;

/**
 * Canton party identifier.
 *
 * A branded string type representing a party on the Canton network.
 * Party IDs typically follow the format `hint::namespace` (e.g., `alice::12345`).
 *
 * @example
 * ```typescript
 * async function createIssuer(issuerParty: PartyId) {
 *   // TypeScript ensures only PartyId values are passed
 * }
 * ```
 */
export type PartyId = Brand<string, 'PartyId'>;

/**
 * OCF entity identifier.
 *
 * A branded string type representing an OCF object's ID field.
 * These are user-provided identifiers used to reference OCF objects.
 *
 * @example
 * ```typescript
 * const issuerId: OcfId = 'issuer-001' as OcfId;
 * const stakeholderId: OcfId = 'stakeholder-abc' as OcfId;
 * ```
 */
export type OcfId = Brand<string, 'OcfId'>;

/**
 * Security identifier for tracking securities across transactions.
 *
 * A branded string type representing a security's unique identifier.
 * Security IDs are used to track individual securities through their lifecycle
 * (issuance, transfer, cancellation, etc.).
 */
export type SecurityId = Brand<string, 'SecurityId'>;

// ===== Type Guard Functions =====

/**
 * Type guard to check if a string is a valid ContractId format.
 * Canton contract IDs are non-empty strings.
 *
 * Note: This performs a structural check, not validation against the ledger.
 */
export function isContractId(value: unknown): value is ContractId {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard to check if a string is a valid PartyId format.
 * Party IDs are typically in the format `hint::namespace`.
 *
 * Note: This performs a structural check, not validation against the ledger.
 */
export function isPartyId(value: unknown): value is PartyId {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard for OcfId.
 */
export function isOcfId(value: unknown): value is OcfId {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard for SecurityId.
 */
export function isSecurityId(value: unknown): value is SecurityId {
  return typeof value === 'string' && value.length > 0;
}

// ===== Conversion Functions =====

/**
 * Convert a string to ContractId after validation.
 * Throws if the value is not a valid contract ID.
 */
export function toContractId(value: string): ContractId {
  if (!isContractId(value)) {
    throw new Error(`Invalid ContractId: ${value}`);
  }
  return value;
}

/**
 * Convert a string to PartyId after validation.
 * Throws if the value is not a valid party ID.
 */
export function toPartyId(value: string): PartyId {
  if (!isPartyId(value)) {
    throw new Error(`Invalid PartyId: ${value}`);
  }
  return value;
}

/**
 * Convert a string to OcfId after validation.
 * Throws if the value is not a valid OCF ID.
 */
export function toOcfId(value: string): OcfId {
  if (!isOcfId(value)) {
    throw new Error(`Invalid OcfId: ${value}`);
  }
  return value;
}

/**
 * Convert a string to SecurityId after validation.
 * Throws if the value is not a valid security ID.
 */
export function toSecurityId(value: string): SecurityId {
  if (!isSecurityId(value)) {
    throw new Error(`Invalid SecurityId: ${value}`);
  }
  return value;
}

// ===== Unsafe Conversion Functions =====

/**
 * Unsafe conversion from string to ContractId without validation.
 * Use only when you are certain the string is a valid contract ID.
 */
export function unsafeToContractId(value: string): ContractId {
  return value as ContractId;
}

/**
 * Unsafe conversion from string to PartyId without validation.
 * Use only when you are certain the string is a valid party ID.
 */
export function unsafeToPartyId(value: string): PartyId {
  return value as PartyId;
}

/**
 * Unsafe conversion from string to OcfId without validation.
 * Use only when you are certain the string is a valid OCF ID.
 */
export function unsafeToOcfId(value: string): OcfId {
  return value as OcfId;
}

/**
 * Unsafe conversion from string to SecurityId without validation.
 * Use only when you are certain the string is a valid security ID.
 */
export function unsafeToSecurityId(value: string): SecurityId {
  return value as SecurityId;
}
