import type { OcfIssuerAuthorizedSharesAdjustment } from '../../../types';
import {
  cleanComments,
  dateStringToDAMLDate,
  normalizeNumericString,
  optionalDateStringToDAMLDate,
} from '../../../utils/typeConversions';

export function issuerAuthorizedSharesAdjustmentDataToDaml(
  d: OcfIssuerAuthorizedSharesAdjustment
): Record<string, unknown> {
  return {
    id: d.id,
    issuer_id: d.issuer_id,
    date: dateStringToDAMLDate(d.date, 'issuerAuthorizedSharesAdjustment.date'),
    new_shares_authorized: normalizeNumericString(d.new_shares_authorized),
    board_approval_date: optionalDateStringToDAMLDate(
      d.board_approval_date,
      'issuerAuthorizedSharesAdjustment.board_approval_date'
    ),
    stockholder_approval_date: optionalDateStringToDAMLDate(
      d.stockholder_approval_date,
      'issuerAuthorizedSharesAdjustment.stockholder_approval_date'
    ),
    comments: cleanComments(d.comments),
  };
}
