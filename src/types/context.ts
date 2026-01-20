import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

/**
 * Client context for caching common parameters across operations.
 *
 * Once set, these values are used as defaults for all operations,
 * reducing boilerplate when making multiple calls.
 */
export interface OcpClientContext {
  /** Featured app right contract details for cross-party visibility */
  featuredAppRightContractDetails?: DisclosedContract;
  /** Default parties to act as when submitting commands */
  defaultActAs?: string[];
  /** Default parties for read access */
  defaultReadAs?: string[];
}
