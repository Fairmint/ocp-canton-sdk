import { OcpValidationError } from '../../../errors';
import type { OcfConvertibleAcceptance } from '../../../types';
import { cleanComments, damlTimeToDateString, dateStringToDAMLTime } from '../../../utils/typeConversions';

/**
 * Common DAML acceptance data structure.
 */
export interface DamlConvertibleAcceptanceData {
  id: string;
  date: string;
  security_id: string;
  comments: string[];
}

/**
 * Convert OCF Convertible Acceptance data to DAML format.
 *
 * @param d - The native OCF convertible acceptance data
 * @returns The DAML-formatted convertible acceptance data
 */
export function convertibleAcceptanceDataToDaml(d: OcfConvertibleAcceptance): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('convertibleAcceptance.id', 'Required field is missing or empty', {
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
 * Convert DAML Convertible Acceptance data to native OCF format.
 *
 * @param damlData - The DAML-formatted convertible acceptance data
 * @returns The native OCF convertible acceptance object
 */
export function damlConvertibleAcceptanceToNative(damlData: DamlConvertibleAcceptanceData): OcfConvertibleAcceptance {
  return {
    id: damlData.id,
    date: damlTimeToDateString(damlData.date),
    security_id: damlData.security_id,
    ...(Array.isArray(damlData.comments) && damlData.comments.length > 0 ? { comments: damlData.comments } : {}),
  };
}
