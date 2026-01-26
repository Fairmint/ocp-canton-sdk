/**
 * DAML to OCF converters for ConvertibleConversion entities.
 */

import type { OcfConvertibleConversion } from '../../../types';
import { damlTimeToDateString } from '../../../utils/typeConversions';

/**
 * DAML ConvertibleConversion data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlConvertibleConversionData {
  id: string;
  date: string;
  security_id: string;
  resulting_security_ids: string[];
  balance_security_id?: string | null;
  trigger_id?: string | null;
  comments: string[];
}

/**
 * Convert DAML ConvertibleConversion data to native OCF format.
 *
 * @param d - The DAML convertible conversion data object
 * @returns The native OCF ConvertibleConversion object
 */
export function damlConvertibleConversionToNative(d: DamlConvertibleConversionData): OcfConvertibleConversion {
  return {
    id: d.id,
    date: damlTimeToDateString(d.date),
    security_id: d.security_id,
    resulting_security_ids: d.resulting_security_ids,
    ...(d.balance_security_id && { balance_security_id: d.balance_security_id }),
    ...(d.trigger_id && { trigger_id: d.trigger_id }),
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
