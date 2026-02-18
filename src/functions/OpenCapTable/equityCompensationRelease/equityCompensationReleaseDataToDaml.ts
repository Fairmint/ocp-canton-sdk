/**
 * OCF to DAML converter for EquityCompensationRelease entities.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfEquityCompensationRelease } from '../../../types';
import {
  cleanComments,
  dateStringToDAMLTime,
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
export function equityCompensationReleaseDataToDaml(d: OcfEquityCompensationRelease): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('equityCompensationRelease.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  if (!d.security_id) {
    throw new OcpValidationError('equityCompensationRelease.security_id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.security_id,
    });
  }
  if (!d.quantity) {
    throw new OcpValidationError('equityCompensationRelease.quantity', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.quantity,
    });
  }
  const releasePrice: unknown = d.release_price;
  if (releasePrice === undefined || releasePrice === null) {
    throw new OcpValidationError('equityCompensationRelease.release_price', 'Required field is missing', {
      expectedType: 'Monetary',
      receivedValue: releasePrice,
    });
  }
  if (!d.settlement_date) {
    throw new OcpValidationError('equityCompensationRelease.settlement_date', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.settlement_date,
    });
  }

  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    quantity: normalizeNumericString(d.quantity),
    release_price: monetaryToDaml(d.release_price),
    settlement_date: dateStringToDAMLTime(d.settlement_date),
    resulting_security_ids: d.resulting_security_ids,
    consideration_text: optionalString(d.consideration_text),
    comments: cleanComments(d.comments),
  };
}
