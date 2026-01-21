import { OcpValidationError } from '../../../errors';
import type { OcfWarrantAcceptance } from '../../../types';
import { cleanComments, damlTimeToDateString, dateStringToDAMLTime } from '../../../utils/typeConversions';

/**
 * Common DAML acceptance data structure.
 */
export interface DamlWarrantAcceptanceData {
  id: string;
  date: string;
  security_id: string;
  comments: string[];
}

/**
 * Convert OCF Warrant Acceptance data to DAML format.
 *
 * @param d - The native OCF warrant acceptance data
 * @returns The DAML-formatted warrant acceptance data
 */
export function warrantAcceptanceDataToDaml(d: OcfWarrantAcceptance): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('warrantAcceptance.id', 'Required field is missing or empty', {
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
 * Convert DAML Warrant Acceptance data to native OCF format.
 *
 * @param damlData - The DAML-formatted warrant acceptance data
 * @returns The native OCF warrant acceptance object
 */
export function damlWarrantAcceptanceToNative(damlData: DamlWarrantAcceptanceData): OcfWarrantAcceptance {
  return {
    id: damlData.id,
    date: damlTimeToDateString(damlData.date),
    security_id: damlData.security_id,
    ...(Array.isArray(damlData.comments) && damlData.comments.length > 0 ? { comments: damlData.comments } : {}),
  };
}
