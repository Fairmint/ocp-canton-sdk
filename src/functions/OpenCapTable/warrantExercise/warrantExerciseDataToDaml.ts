/** OCF to DAML converter for WarrantExercise entities. */

import type { OcfWarrantExercise } from '../../../types';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import {
  conversionExerciseCommentsToDaml,
  optionalConversionExerciseText,
  requireConversionExerciseObjectType,
  requireConversionExerciseText,
  requireConversionExerciseTextArray,
  requireExactConversionExerciseInput,
} from '../shared/conversionExerciseValues';

type DamlWarrantExerciseData = DamlDataTypeFor<'warrantExercise'>;

const ROOT_FIELDS = [
  'object_type',
  'id',
  'date',
  'security_id',
  'trigger_id',
  'resulting_security_ids',
  'consideration_text',
  'comments',
] as const;

/** Convert exact canonical OCF WarrantExercise data to generated DAML data. */
export function warrantExerciseDataToDaml(input: OcfWarrantExercise): DamlWarrantExerciseData {
  const field = 'warrantExercise';
  const data = requireExactConversionExerciseInput(input, field, ROOT_FIELDS);
  requireConversionExerciseObjectType(data.object_type, 'TX_WARRANT_EXERCISE', `${field}.object_type`);

  return {
    id: requireConversionExerciseText(data.id, `${field}.id`),
    date: dateStringToDAMLTime(requireConversionExerciseText(data.date, `${field}.date`), `${field}.date`),
    security_id: requireConversionExerciseText(data.security_id, `${field}.security_id`),
    trigger_id: requireConversionExerciseText(data.trigger_id, `${field}.trigger_id`),
    // DAML retains this ledger-only field; canonical OCF has no corresponding input.
    quantity: null,
    resulting_security_ids: requireConversionExerciseTextArray(
      data.resulting_security_ids,
      `${field}.resulting_security_ids`
    ),
    consideration_text: optionalConversionExerciseText(data.consideration_text, `${field}.consideration_text`),
    comments: conversionExerciseCommentsToDaml(data.comments, `${field}.comments`),
  };
}
