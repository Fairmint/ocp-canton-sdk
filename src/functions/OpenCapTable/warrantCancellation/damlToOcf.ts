/**
 * DAML to OCF converters for WarrantCancellation entities.
 */

import type { OcfWarrantCancellation } from '../../../types';
import { damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';

/**
 * DAML WarrantCancellation data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlWarrantCancellationData {
  id: string;
  date: string;
  security_id: string;
  quantity: string;
  reason_text: string;
  balance_security_id?: string;
  comments: string[];
}

/**
 * Convert DAML WarrantCancellation data to native OCF format.
 *
 * @param d - The DAML warrant cancellation data object
 * @returns The native OCF WarrantCancellation object
 */
export function damlWarrantCancellationToNative(d: DamlWarrantCancellationData): OcfWarrantCancellation {
  return {
    id: d.id,
    date: damlTimeToDateString(d.date),
    security_id: d.security_id,
    quantity: normalizeNumericString(d.quantity),
    reason_text: d.reason_text,
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id } : {}),
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
