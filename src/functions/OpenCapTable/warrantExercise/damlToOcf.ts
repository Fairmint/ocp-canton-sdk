/**
 * DAML to OCF converters for WarrantExercise entities.
 */

import type { OcfWarrantExercise } from '../../../types';
import { damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';

/**
 * DAML WarrantExercise data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlWarrantExerciseData {
  id: string;
  date: string;
  security_id: string;
  quantity: string;
  resulting_security_ids: string[];
  balance_security_id?: string | null;
  consideration_text?: string | null;
  comments: string[];
}

/**
 * Convert DAML WarrantExercise data to native OCF format.
 *
 * @param d - The DAML warrant exercise data object
 * @returns The native OCF WarrantExercise object
 */
export function damlWarrantExerciseToNative(d: DamlWarrantExerciseData): OcfWarrantExercise {
  return {
    id: d.id,
    date: damlTimeToDateString(d.date),
    security_id: d.security_id,
    quantity: normalizeNumericString(d.quantity),
    resulting_security_ids: d.resulting_security_ids,
    ...(d.balance_security_id && { balance_security_id: d.balance_security_id }),
    ...(d.consideration_text && { consideration_text: d.consideration_text }),
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
