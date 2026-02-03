/**
 * DAML to OCF converters for ConvertibleCancellation entities.
 */

import type { OcfConvertibleCancellation } from '../../../types';
import { damlTimeToDateString } from '../../../utils/typeConversions';

/**
 * DAML ConvertibleCancellation data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlConvertibleCancellationData {
  id: string;
  date: string;
  security_id: string;
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
  return {
    id: d.id,
    date: damlTimeToDateString(d.date),
    security_id: d.security_id,
    reason_text: d.reason_text,
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id } : {}),
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}
