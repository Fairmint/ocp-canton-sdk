/**
 * OCF to DAML converter for EquityCompensationRelease entities.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfEquityCompensationRelease } from '../../../types';
import type { PkgEquityCompensationReleaseOcfData } from '../../../types/daml';
import {
  cleanComments,
  dateStringToDAMLDate,
  monetaryToDaml,
  normalizeNumericString,
  optionalString,
} from '../../../utils/typeConversions';

/**
 * Convert native OCF EquityCompensationRelease data to DAML format.
 *
 * @param d - The native OCF equity compensation release data object
 * @returns The DAML-formatted equity compensation release data
 * @throws OcpValidationError if required fields are missing
 */
export function equityCompensationReleaseDataToDaml(
  d: OcfEquityCompensationRelease
): PkgEquityCompensationReleaseOcfData {
  if (!d.id) {
    throw new OcpValidationError('equityCompensationRelease.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  return {
    id: d.id,
    date: dateStringToDAMLDate(d.date, 'equityCompensationRelease.date'),
    security_id: d.security_id,
    quantity: normalizeNumericString(d.quantity),
    release_price: monetaryToDaml(d.release_price),
    settlement_date: dateStringToDAMLDate(d.settlement_date, 'equityCompensationRelease.settlement_date'),
    resulting_security_ids: d.resulting_security_ids,
    consideration_text: optionalString(d.consideration_text),
    comments: cleanComments(d.comments),
  };
}
