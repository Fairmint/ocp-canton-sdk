/**
 * OCF to DAML converter for Valuation entities.
 */

import type { OcfValuation, ValuationType } from '../../../types';
import { validateValuationData } from '../../../utils/entityValidators';
import { cleanComments, dateStringToDAMLTime, monetaryToDaml, optionalString } from '../../../utils/typeConversions';

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
  // Validate input data using the entity validator
  validateValuationData(d, 'valuation');

  const damlValuationType = VALUATION_TYPE_MAP[d.valuation_type];

  return {
    id: d.id,
    stock_class_id: d.stock_class_id,
    provider: optionalString(d.provider),
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    price_per_share: monetaryToDaml(d.price_per_share),
    effective_date: dateStringToDAMLTime(d.effective_date),
    valuation_type: damlValuationType,
    comments: cleanComments(d.comments),
  };
}
