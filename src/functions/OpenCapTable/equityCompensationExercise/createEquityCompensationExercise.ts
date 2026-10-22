import type { OcfEquityCompensationExercise } from '../../../types';
import {
  cleanComments,
  dateStringToDAMLDate,
  normalizeNumericString,
  optionalString,
} from '../../../utils/typeConversions';

export function equityCompensationExerciseDataToDaml(d: OcfEquityCompensationExercise): Record<string, unknown> {
  return {
    id: d.id,
    security_id: d.security_id,
    date: dateStringToDAMLDate(d.date, 'equityCompensationExercise.date'),
    quantity: normalizeNumericString(d.quantity),
    consideration_text: optionalString(d.consideration_text),
    resulting_security_ids: d.resulting_security_ids,
    comments: cleanComments(d.comments),
  };
}
