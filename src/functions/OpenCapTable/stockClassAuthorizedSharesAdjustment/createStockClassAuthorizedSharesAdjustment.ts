import type { OcfStockClassAuthorizedSharesAdjustment } from '../../../types';
import {
  cleanComments,
  dateStringToDAMLTime,
  normalizeNumericString,
  optionalDateStringToDAMLTime,
} from '../../../utils/typeConversions';

export function stockClassAuthorizedSharesAdjustmentDataToDaml(
  d: OcfStockClassAuthorizedSharesAdjustment
): Record<string, unknown> {
  return {
    id: d.id,
    stock_class_id: d.stock_class_id,
    date: dateStringToDAMLTime(d.date, 'stockClassAuthorizedSharesAdjustment.date'),
    new_shares_authorized: normalizeNumericString(d.new_shares_authorized),
    board_approval_date: optionalDateStringToDAMLTime(
      d.board_approval_date,
      'stockClassAuthorizedSharesAdjustment.board_approval_date'
    ),
    stockholder_approval_date: optionalDateStringToDAMLTime(
      d.stockholder_approval_date,
      'stockClassAuthorizedSharesAdjustment.stockholder_approval_date'
    ),
    comments: cleanComments(d.comments),
  };
}
