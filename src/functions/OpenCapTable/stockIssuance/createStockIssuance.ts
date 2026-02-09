import { OcpErrorCodes, OcpParseError } from '../../../errors';
import type {
  OcfStockIssuance,
  PkgStockIssuanceOcfData,
  PkgStockIssuanceType,
  StockIssuanceType,
} from '../../../types';
import { validateStockIssuanceData } from '../../../utils/entityValidators';
import {
  cleanComments,
  dateStringToDAMLTime,
  monetaryToDaml,
  normalizeNumericString,
  optionalString,
} from '../../../utils/typeConversions';

/**
 * Convert native StockIssuanceType to DAML enum value.
 *
 * @param t - Native stock issuance type
 * @returns DAML enum value or null if not specified
 * @throws OcpParseError for unknown issuance types
 */
function getIssuanceType(t: StockIssuanceType | undefined): PkgStockIssuanceType | null {
  if (!t) return null;
  switch (t) {
    case 'RSA':
      return 'OcfStockIssuanceRSA';
    case 'FOUNDERS_STOCK':
      return 'OcfStockIssuanceFounders';
    default:
      throw new OcpParseError(`Unknown stock issuance type: ${String(t)}`, {
        source: 'stockIssuance.issuance_type',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

/**
 * Convert native OcfStockIssuance to DAML StockIssuanceOcfData format.
 *
 * @param d - Native stock issuance data
 * @returns DAML-formatted stock issuance data
 */
export function stockIssuanceDataToDaml(d: OcfStockIssuance): PkgStockIssuanceOcfData {
  // Validate input data using the entity validator
  validateStockIssuanceData(d, 'stockIssuance');

  return {
    id: d.id,
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    stock_class_id: d.stock_class_id,
    date: dateStringToDAMLTime(d.date),
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    consideration_text: optionalString(d.consideration_text),
    security_law_exemptions: (d.security_law_exemptions ?? []).map((e) => ({
      description: e.description,
      jurisdiction: e.jurisdiction,
    })),
    stock_plan_id: optionalString(d.stock_plan_id),
    share_numbers_issued: (d.share_numbers_issued ?? [])
      .filter((range) => !(range.starting_share_number === '0' && range.ending_share_number === '0'))
      .map((r) => ({
        starting_share_number: r.starting_share_number,
        ending_share_number: r.ending_share_number,
      })),
    share_price: monetaryToDaml(d.share_price),
    quantity: normalizeNumericString(d.quantity),
    vesting_terms_id: optionalString(d.vesting_terms_id),
    vestings: (d.vestings ?? [])
      .filter((v) => Number(v.amount) > 0)
      .map((v) => ({
        date: dateStringToDAMLTime(v.date),
        amount: v.amount,
      })),
    cost_basis: d.cost_basis ? monetaryToDaml(d.cost_basis) : null,
    stock_legend_ids: d.stock_legend_ids ?? [],
    issuance_type: getIssuanceType(d.issuance_type),
    comments: cleanComments(d.comments),
  };
}
