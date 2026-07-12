/** DAML to OCF converters for WarrantExercise entities. */

import type { OcfWarrantExercise } from '../../../types';
import type { DeepReadonly } from '../../../types/common';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData } from '../capTable/damlEntityData';
import {
  freezeConversionExerciseEvent,
  generatedOptionalConversionExerciseText,
  requireGeneratedConversionExerciseComments,
  requireGeneratedConversionExerciseResultIds,
  requireGeneratedConversionExerciseText,
} from '../shared/conversionExerciseReadValues';
import { requireGeneratedDamlNumeric10 } from '../shared/generatedDamlValues';

/** Exact generated DAML WarrantExercise payload. */
export type DamlWarrantExerciseData = DamlDataTypeFor<'warrantExercise'>;

/** Convert generated DAML WarrantExercise data to canonical OCF. */
export function damlWarrantExerciseToNative(input: DamlWarrantExerciseData): DeepReadonly<OcfWarrantExercise> {
  const data = decodeDamlEntityData('warrantExercise', input);
  const considerationText = generatedOptionalConversionExerciseText(
    data.consideration_text,
    'warrantExercise.consideration_text'
  );
  if (data.quantity !== null) {
    requireGeneratedDamlNumeric10(data.quantity, 'warrantExercise.quantity', 'positive');
  }
  const comments = requireGeneratedConversionExerciseComments(data.comments, 'warrantExercise.comments');

  return freezeConversionExerciseEvent({
    object_type: 'TX_WARRANT_EXERCISE',
    id: requireGeneratedConversionExerciseText(data.id, 'warrantExercise.id'),
    date: damlTimeToDateString(data.date, 'warrantExercise.date'),
    security_id: requireGeneratedConversionExerciseText(data.security_id, 'warrantExercise.security_id'),
    trigger_id: requireGeneratedConversionExerciseText(data.trigger_id, 'warrantExercise.trigger_id'),
    resulting_security_ids: requireGeneratedConversionExerciseResultIds(
      data.resulting_security_ids,
      'warrantExercise.resulting_security_ids'
    ),
    ...(considerationText !== undefined ? { consideration_text: considerationText } : {}),
    ...(comments.length > 0 ? { comments } : {}),
  });
}
