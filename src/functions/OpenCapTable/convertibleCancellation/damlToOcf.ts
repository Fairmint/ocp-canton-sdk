/**
 * DAML to OCF converters for ConvertibleCancellation entities.
 */

import type { OcfConvertibleCancellation } from '../../../types';
import { damlMonetaryToNative, damlTimeToDateString } from '../../../utils/typeConversions';

/**
 * DAML Monetary data structure.
 */
interface DamlMonetary {
  amount: string;
  currency: string;
}
/**
 * DAML ConvertibleCancellation data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlConvertibleCancellationData {
  id: string;
  date: string;
  security_id: string;
  amount: DamlMonetary;
  reason_text: string;
  balance_security_id?: string;
  comments?: string[];
}

/**
 * Convert DAML ConvertibleCancellation data to native OCF format.
 *
 * @param d - The DAML convertible cancellation data object
 * @returns The native OCF ConvertibleCancellation object
 */
export function damlConvertibleCancellationToNative(d: DamlConvertibleCancellationData): OcfConvertibleCancellation {
  // Validate required amount field (may be missing in legacy data)
  if (!d.amount) {
    throw new Error('ConvertibleCancellation.amount is required but was not provided');
  }
  return {
    id: d.id,
    date: damlTimeToDateString(d.date),
    security_id: d.security_id,
    amount: damlMonetaryToNative(d.amount),
    reason_text: d.reason_text,
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id } : {}),
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}
