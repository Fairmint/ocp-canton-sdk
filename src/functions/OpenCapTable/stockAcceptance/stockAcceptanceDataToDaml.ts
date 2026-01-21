import { OcpValidationError } from '../../../errors';
import type { OcfStockAcceptance } from '../../../types';
import { cleanComments, damlTimeToDateString, dateStringToDAMLTime } from '../../../utils/typeConversions';

/**
 * Common DAML acceptance data structure.
 */
export interface DamlStockAcceptanceData {
  id: string;
  date: string;
  security_id: string;
  comments: string[];
}

/**
 * Convert OCF Stock Acceptance data to DAML format.
 *
 * @param d - The native OCF stock acceptance data
 * @returns The DAML-formatted stock acceptance data
 */
export function stockAcceptanceDataToDaml(d: OcfStockAcceptance): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('stockAcceptance.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    comments: cleanComments(d.comments),
  };
}

/**
 * Convert DAML Stock Acceptance data to native OCF format.
 *
 * @param damlData - The DAML-formatted stock acceptance data
 * @returns The native OCF stock acceptance object
 */
export function damlStockAcceptanceToNative(damlData: DamlStockAcceptanceData): OcfStockAcceptance {
  return {
    id: damlData.id,
    date: damlTimeToDateString(damlData.date),
    security_id: damlData.security_id,
    ...(Array.isArray(damlData.comments) && damlData.comments.length > 0 ? { comments: damlData.comments } : {}),
  };
}
