import { OcpValidationError } from '../../../errors';
import type { OcfEquityCompensationAcceptance } from '../../../types';
import { cleanComments, damlTimeToDateString, dateStringToDAMLTime } from '../../../utils/typeConversions';

/**
 * Common DAML acceptance data structure.
 */
export interface DamlEquityCompensationAcceptanceData {
  id: string;
  date: string;
  security_id: string;
  comments: string[];
}

/**
 * Convert OCF Equity Compensation Acceptance data to DAML format.
 *
 * @param d - The native OCF equity compensation acceptance data
 * @returns The DAML-formatted equity compensation acceptance data
 */
export function equityCompensationAcceptanceDataToDaml(d: OcfEquityCompensationAcceptance): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('equityCompensationAcceptance.id', 'Required field is missing or empty', {
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
 * Convert DAML Equity Compensation Acceptance data to native OCF format.
 *
 * @param damlData - The DAML-formatted equity compensation acceptance data
 * @returns The native OCF equity compensation acceptance object
 */
export function damlEquityCompensationAcceptanceToNative(
  damlData: DamlEquityCompensationAcceptanceData
): OcfEquityCompensationAcceptance {
  return {
    id: damlData.id,
    date: damlTimeToDateString(damlData.date),
    security_id: damlData.security_id,
    ...(Array.isArray(damlData.comments) && damlData.comments.length > 0 ? { comments: damlData.comments } : {}),
  };
}
