import type { OcfEquityCompensationCancellationTxData } from '../../../types';
import { cleanComments, dateStringToDAMLTime, numberToString, optionalString } from '../../../utils/typeConversions';

/**
 * Convert native equity compensation cancellation data to DAML format.
 *
 * @param d - The native equity compensation cancellation data
 * @returns DAML-formatted equity compensation cancellation data
 */
export function equityCompensationCancellationDataToDaml(
  d: OcfEquityCompensationCancellationTxData
): Record<string, unknown> {
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
