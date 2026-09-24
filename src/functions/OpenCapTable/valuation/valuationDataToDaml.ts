/**
 * OCF to DAML converter for Valuation entities.
 */

import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfValuation, ValuationType } from '../../../types';
import {
  cleanComments,
  dateStringToDAMLTime,
  monetaryToDaml,
  optionalDateStringToDAMLTime,
  optionalString,
} from '../../../utils/typeConversions';

/**
 * Map from OCF ValuationType to DAML OcfValuationType.
 * Currently OCF only supports '409A', which maps to 'OcfValuationType409A'.
 */
const VALUATION_TYPE_MAP: Record<ValuationType, string> = {
  '409A': 'OcfValuationType409A',
};

/**
 * Convert native OCF Valuation data to DAML format.
 *
 * @param d - The native OCF valuation data object
 * @returns The DAML-formatted valuation data
 * @throws OcpValidationError if required fields are missing
 */
export function valuationDataToDaml(d: OcfValuation): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('valuation.id', 'Required field is missing or empty', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });
  }

  const damlValuationType = VALUATION_TYPE_MAP[d.valuation_type];

  return {
    id: d.id,
    stock_class_id: d.stock_class_id,
    provider: optionalString(d.provider),
    board_approval_date: optionalDateStringToDAMLTime(d.board_approval_date, 'valuation.board_approval_date'),
    stockholder_approval_date: optionalDateStringToDAMLTime(
      d.stockholder_approval_date,
      'valuation.stockholder_approval_date'
    ),
    price_per_share: monetaryToDaml(d.price_per_share),
    effective_date: dateStringToDAMLTime(d.effective_date, 'valuation.effective_date'),
    valuation_type: damlValuationType,
    comments: cleanComments(d.comments),
  };
}
