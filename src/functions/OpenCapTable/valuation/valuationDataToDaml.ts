/**
 * OCF to DAML converter for Valuation entities.
 */

import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfValuation } from '../../../types';
import { damlEnumConstructor } from '../../../utils/damlEnums';
import {
  cleanComments,
  dateStringToDAMLDate,
  monetaryToDaml,
  optionalDateStringToDAMLDate,
  optionalString,
} from '../../../utils/typeConversions';

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

  const damlValuationType = damlEnumConstructor('OcfValuationType', d.valuation_type, 'valuation.valuation_type');

  return {
    id: d.id,
    stock_class_id: d.stock_class_id,
    provider: optionalString(d.provider),
    board_approval_date: optionalDateStringToDAMLDate(d.board_approval_date, 'valuation.board_approval_date'),
    stockholder_approval_date: optionalDateStringToDAMLDate(
      d.stockholder_approval_date,
      'valuation.stockholder_approval_date'
    ),
    price_per_share: monetaryToDaml(d.price_per_share),
    effective_date: dateStringToDAMLDate(d.effective_date, 'valuation.effective_date'),
    valuation_type: damlValuationType,
    comments: cleanComments(d.comments),
  };
}
