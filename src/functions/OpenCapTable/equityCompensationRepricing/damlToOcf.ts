/**
 * DAML to OCF converters for EquityCompensationRepricing entities.
 */

import type { OcfEquityCompensationRepricing } from '../../../types';
import { damlMonetaryToNative, damlTimeToDateString } from '../../../utils/typeConversions';

type DamlMonetary = Parameters<typeof damlMonetaryToNative>[0];

/**
 * DAML EquityCompensationRepricing data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlEquityCompensationRepricingData {
  id: string;
  date: string;
  security_id: string;
  new_exercise_price: DamlMonetary;
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
    new_exercise_price: damlMonetaryToNative(d.new_exercise_price),
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
