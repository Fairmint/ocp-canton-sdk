/**
 * DAML to OCF converters for WarrantRetraction entities.
 */

import type { OcfWarrantRetraction } from '../../../types';
import { damlTimeToDateString } from '../../../utils/typeConversions';

/**
 * DAML WarrantRetraction data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlWarrantRetractionData {
  id: string;
  date: string;
  security_id: string;
  reason_text: string;
  comments: string[];
}

/**
 * Convert DAML WarrantRetraction data to native OCF format.
 *
 * @param d - The DAML warrant retraction data object
 * @returns The native OCF WarrantRetraction object
 */
export function damlWarrantRetractionToNative(d: DamlWarrantRetractionData): OcfWarrantRetraction {
  return {
    id: d.id,
    date: damlTimeToDateString(d.date),
    security_id: d.security_id,
    reason_text: d.reason_text,
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
