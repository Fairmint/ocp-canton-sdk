/** DAML to OCF converters for WarrantExercise entities. */

import type { OcfWarrantExercise } from '../../../types';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData } from '../capTable/damlEntityData';
import { requireGeneratedDamlNumeric10 } from '../shared/generatedDamlValues';

/** Exact generated DAML WarrantExercise payload. */
export type DamlWarrantExerciseData = DamlDataTypeFor<'warrantExercise'>;

/** Convert generated DAML WarrantExercise data to canonical OCF. */
export function damlWarrantExerciseToNative(input: DamlWarrantExerciseData): OcfWarrantExercise {
  const data = decodeDamlEntityData('warrantExercise', input);
  const considerationText = data.consideration_text ?? undefined;
  if (data.quantity !== null) {
    requireGeneratedDamlNumeric10(data.quantity, 'warrantExercise.quantity');
  }

  return {
    object_type: 'TX_WARRANT_EXERCISE',
    id: data.id,
    date: damlTimeToDateString(data.date, 'warrantExercise.date'),
    security_id: data.security_id,
    trigger_id: data.trigger_id,
    resulting_security_ids: data.resulting_security_ids,
    ...(considerationText !== undefined ? { consideration_text: considerationText } : {}),
    ...(data.comments.length > 0 ? { comments: data.comments } : {}),
  };
}
