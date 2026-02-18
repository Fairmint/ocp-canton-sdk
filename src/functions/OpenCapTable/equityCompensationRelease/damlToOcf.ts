/**
 * DAML to OCF converters for EquityCompensationRelease entities.
 */

import type { OcfEquityCompensationRelease } from '../../../types';
import { damlMonetaryToNative, damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';

type DamlMonetary = Parameters<typeof damlMonetaryToNative>[0];

/**
 * DAML EquityCompensationRelease data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlEquityCompensationReleaseData {
  id: string;
  date: string;
  security_id: string;
  quantity: string;
  release_price: DamlMonetary;
  resulting_security_ids: string[];
  settlement_date: string;
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
    release_price: damlMonetaryToNative(d.release_price),
    settlement_date: damlTimeToDateString(d.settlement_date),
    resulting_security_ids: d.resulting_security_ids,
    ...(d.consideration_text && { consideration_text: d.consideration_text }),
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
