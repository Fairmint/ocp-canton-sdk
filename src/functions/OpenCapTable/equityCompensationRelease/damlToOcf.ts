/**
 * DAML to OCF converters for EquityCompensationRelease entities.
 */

import type { OcfEquityCompensationRelease } from '../../../types';
import { damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';

/**
 * DAML EquityCompensationRelease data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlEquityCompensationReleaseData {
  id: string;
  date: string;
  security_id: string;
  quantity: string;
  resulting_security_ids: string[];
  balance_security_id?: string | null;
  settlement_date?: string | null;
  consideration_text?: string | null;
  comments: string[];
}

/**
 * Convert DAML EquityCompensationRelease data to native OCF format.
 *
 * @param d - The DAML equity compensation release data object
 * @returns The native OCF EquityCompensationRelease object
 */
export function damlEquityCompensationReleaseToNative(
  d: DamlEquityCompensationReleaseData
): OcfEquityCompensationRelease {
  return {
    id: d.id,
    date: damlTimeToDateString(d.date),
    security_id: d.security_id,
    quantity: normalizeNumericString(d.quantity),
    resulting_security_ids: d.resulting_security_ids,
    ...(d.balance_security_id && { balance_security_id: d.balance_security_id }),
    ...(d.settlement_date && { settlement_date: damlTimeToDateString(d.settlement_date) }),
    ...(d.consideration_text && { consideration_text: d.consideration_text }),
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
