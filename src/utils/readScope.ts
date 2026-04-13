import type { ReadScopeParams } from '../types/common';

/**
 * Canonical helper for forwarding Canton read scope into ledger reads.
 *
 * Preserves explicit empty arrays while omitting the field when undefined.
 */
export function ledgerReadScope(params?: ReadScopeParams): Pick<ReadScopeParams, 'readAs'> | Record<never, never> {
  return params?.readAs === undefined ? {} : { readAs: params.readAs };
}
