/**
 * DAML to OCF converters for EquityCompensationRepricing entities.
 */

import type { OcfEquityCompensationRepricing } from '../../../types';
import { damlTimeToDateString } from '../../../utils/typeConversions';

/**
 * DAML EquityCompensationRepricing data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlEquityCompensationRepricingData {
  id: string;
  date: string;
  security_id: string;
  resulting_security_ids: string[];
  comments: string[];
}

/**
 * Convert DAML EquityCompensationRepricing data to native OCF format.
 *
 * @param d - The DAML equity compensation repricing data object
 * @returns The native OCF EquityCompensationRepricing object
 */
export function damlEquityCompensationRepricingToNative(
  d: DamlEquityCompensationRepricingData
): OcfEquityCompensationRepricing {
  return {
    id: d.id,
    date: damlTimeToDateString(d.date),
    security_id: d.security_id,
    resulting_security_ids: d.resulting_security_ids,
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
