/**
 * DAML to OCF converters for ConvertibleRetraction entities.
 */

import type { OcfConvertibleRetraction } from '../../../types';
import { damlTimeToDateString } from '../../../utils/typeConversions';

/**
 * DAML ConvertibleRetraction data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlConvertibleRetractionData {
  id: string;
  date: string;
  security_id: string;
  reason_text: string;
  comments: string[];
}

/**
 * Convert DAML ConvertibleRetraction data to native OCF format.
 *
 * @param d - The DAML convertible retraction data object
 * @returns The native OCF ConvertibleRetraction object
 */
export function damlConvertibleRetractionToNative(d: DamlConvertibleRetractionData): OcfConvertibleRetraction {
  return {
    id: d.id,
    date: damlTimeToDateString(d.date),
    security_id: d.security_id,
    reason_text: d.reason_text,
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
