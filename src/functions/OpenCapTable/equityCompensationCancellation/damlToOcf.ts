/**
 * DAML to OCF converters for EquityCompensationCancellation entities.
 */

import type { OcfEquityCompensationCancellation } from '../../../types';
import { damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';

/**
 * DAML EquityCompensationCancellation data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlEquityCompensationCancellationData {
  id: string;
  date: string;
  security_id: string;
  quantity: string;
  reason_text: string;
  balance_security_id?: string;
  comments: string[];
}

/**
 * Convert DAML EquityCompensationCancellation data to native OCF format.
 *
 * @param d - The DAML equity compensation cancellation data object
 * @returns The native OCF EquityCompensationCancellation object
 */
export function damlEquityCompensationCancellationToNative(
  d: DamlEquityCompensationCancellationData
): OcfEquityCompensationCancellation {
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
