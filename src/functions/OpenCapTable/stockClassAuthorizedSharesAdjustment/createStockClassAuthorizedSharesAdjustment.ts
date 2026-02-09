import type { OcfStockClassAuthorizedSharesAdjustment } from '../../../types';
import { cleanComments, dateStringToDAMLTime } from '../../../utils/typeConversions';

export function stockClassAuthorizedSharesAdjustmentDataToDaml(
  d: OcfStockClassAuthorizedSharesAdjustment
): Record<string, unknown> {
  return {
    id: d.id,
    stock_class_id: d.stock_class_id,
    date: dateStringToDAMLTime(d.date),
    new_shares_authorized: d.new_shares_authorized,
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    comments: cleanComments(d.comments),
  };
}
