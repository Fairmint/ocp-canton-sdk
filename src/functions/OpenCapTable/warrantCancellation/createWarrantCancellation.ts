import type { OcfWarrantCancellation } from '../../../types';
import { cleanComments, dateStringToDAMLTime, numberToString, optionalString } from '../../../utils/typeConversions';

/**
 * Convert native warrant cancellation data to DAML format.
 *
 * @deprecated Use `ocp.OpenCapTable.capTable.update().create('warrantCancellation', data).execute()` instead.
 *   This function will be removed in a future major version.
 * @param d - The native warrant cancellation data
 * @returns DAML-formatted warrant cancellation data
 */
export function warrantCancellationDataToDaml(d: OcfWarrantCancellation): Record<string, unknown> {
  return {
    id: d.id,
    security_id: d.security_id,
    reason_text: d.reason_text,
    date: dateStringToDAMLTime(d.date),
    quantity: numberToString(d.quantity),
    balance_security_id: optionalString(d.balance_security_id),
    comments: cleanComments(d.comments),
  };
}
