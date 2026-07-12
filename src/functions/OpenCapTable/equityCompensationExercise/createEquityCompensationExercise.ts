import type { OcfEquityCompensationExercise } from '../../../types';
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
import { requireOcfDecimalString } from '../shared/ocfValues';

type DamlEquityCompensationExerciseData = DamlDataTypeFor<'equityCompensationExercise'>;

const ROOT_FIELDS = [
  'object_type',
  'id',
  'date',
  'security_id',
  'quantity',
  'consideration_text',
  'resulting_security_ids',
  'comments',
] as const;

/** Convert exact canonical OCF EquityCompensationExercise data to generated DAML data. */
export function equityCompensationExerciseDataToDaml(
  input: OcfEquityCompensationExercise
): DamlEquityCompensationExerciseData {
  const field = 'equityCompensationExercise';
  const data = requireExactConversionExerciseInput(input, field, ROOT_FIELDS);
  requireConversionExerciseObjectType(data.object_type, 'TX_EQUITY_COMPENSATION_EXERCISE', `${field}.object_type`);

  return {
    id: requireConversionExerciseText(data.id, `${field}.id`),
    security_id: requireConversionExerciseText(data.security_id, `${field}.security_id`),
    date: dateStringToDAMLTime(requireConversionExerciseText(data.date, `${field}.date`), `${field}.date`),
    quantity: requireOcfDecimalString(data.quantity, `${field}.quantity`),
    consideration_text: optionalConversionExerciseText(data.consideration_text, `${field}.consideration_text`),
    resulting_security_ids: requireConversionExerciseTextArray(
      data.resulting_security_ids,
      `${field}.resulting_security_ids`
    ),
    comments: conversionExerciseCommentsToDaml(data.comments, `${field}.comments`),
  };
}
