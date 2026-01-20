import type { OcfConvertibleCancellation } from '../../../types';
import { cleanComments, dateStringToDAMLTime, optionalString } from '../../../utils/typeConversions';

/**
 * Convert native convertible cancellation data to DAML format.
 *
 * Note: Convertible cancellations don't have a quantity field since convertibles are monetary instruments (SAFEs,
 * convertible notes) rather than share-based securities.
 *
 * @deprecated Use `ocp.OpenCapTable.capTable.update().create('convertibleCancellation', data).execute()` instead.
 *   This function will be removed in a future major version.
 * @param d - The native convertible cancellation data
 * @returns DAML-formatted convertible cancellation data
 */
export function convertibleCancellationDataToDaml(d: OcfConvertibleCancellation): Record<string, unknown> {
  return {
    id: d.id,
    security_id: d.security_id,
    reason_text: d.reason_text,
    date: dateStringToDAMLTime(d.date),
    balance_security_id: optionalString(d.balance_security_id),
    comments: cleanComments(d.comments),
  };
}
