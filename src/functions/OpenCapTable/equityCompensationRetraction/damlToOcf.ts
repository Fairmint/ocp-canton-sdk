/**
 * DAML to OCF converters for EquityCompensationRetraction entities.
 */

import type { OcfEquityCompensationRetraction } from '../../../types';
import { damlTimeToDateString } from '../../../utils/typeConversions';

/**
 * DAML EquityCompensationRetraction data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlEquityCompensationRetractionData {
  id: string;
  date: string;
  security_id: string;
  reason_text: string;
  comments: string[];
}

/**
 * Convert DAML EquityCompensationRetraction data to native OCF format.
 *
 * @param d - The DAML equity compensation retraction data object
 * @returns The native OCF EquityCompensationRetraction object
 */
export function damlEquityCompensationRetractionToNative(
  d: DamlEquityCompensationRetractionData
): OcfEquityCompensationRetraction {
  return {
    id: d.id,
    date: damlTimeToDateString(d.date),
    security_id: d.security_id,
    reason_text: d.reason_text,
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
