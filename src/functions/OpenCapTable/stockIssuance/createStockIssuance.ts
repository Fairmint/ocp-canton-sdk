import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { OcfStockIssuance, StockIssuanceType } from '../../../types';
import {
  cleanComments,
  dateStringToDAMLTime,
  monetaryToDaml,
  numberToString,
  optionalString,
} from '../../../utils/typeConversions';

function getIssuanceType(t: StockIssuanceType | undefined): string | null {
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

export function stockIssuanceDataToDaml(d: OcfStockIssuance): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('stockIssuance.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  if (!d.security_id) {
    throw new OcpValidationError('stockIssuance.security_id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.security_id,
    });
  }
  if (!d.custom_id) {
    throw new OcpValidationError('stockIssuance.custom_id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.custom_id,
    });
  }
  if (!d.stakeholder_id) {
    throw new OcpValidationError('stockIssuance.stakeholder_id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.stakeholder_id,
    });
  }
  if (!d.stock_class_id) {
    throw new OcpValidationError('stockIssuance.stock_class_id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.stock_class_id,
    });
  }

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
        starting_share_number: numberToString(r.starting_share_number),
        ending_share_number: numberToString(r.ending_share_number),
      })),
    share_price: monetaryToDaml(d.share_price),
    quantity: numberToString(d.quantity),
    vesting_terms_id: optionalString(d.vesting_terms_id),
    vestings: (d.vestings ?? [])
      .filter((v) => Number(v.amount) > 0)
      .map((v) => ({
        date: dateStringToDAMLTime(v.date),
        amount: numberToString(v.amount),
      })),
    cost_basis: d.cost_basis ? monetaryToDaml(d.cost_basis) : null,
    stock_legend_ids: d.stock_legend_ids ?? [],
    issuance_type: getIssuanceType(d.issuance_type),
    comments: cleanComments(d.comments),
  };
}
