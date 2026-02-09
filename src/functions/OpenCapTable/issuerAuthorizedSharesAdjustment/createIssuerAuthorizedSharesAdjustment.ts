import type { OcfIssuerAuthorizedSharesAdjustment } from '../../../types';
import { cleanComments, dateStringToDAMLTime } from '../../../utils/typeConversions';

export function issuerAuthorizedSharesAdjustmentDataToDaml(
  d: OcfIssuerAuthorizedSharesAdjustment
): Record<string, unknown> {
  return {
    id: d.id,
    issuer_id: d.issuer_id,
    date: dateStringToDAMLTime(d.date),
    new_shares_authorized: d.new_shares_authorized,
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    comments: cleanComments(d.comments),
  };
}
