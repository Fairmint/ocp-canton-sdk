import type { OcfStockClassAuthorizedSharesAdjustment } from '../../../types';
import type { PkgStockClassAuthorizedSharesAdjustmentOcfData } from '../../../types/daml';
import {
  cleanComments,
  dateStringToDAMLDate,
  normalizeNumericString,
  optionalDateStringToDAMLDate,
} from '../../../utils/typeConversions';

export function stockClassAuthorizedSharesAdjustmentDataToDaml(
  d: OcfStockClassAuthorizedSharesAdjustment
): PkgStockClassAuthorizedSharesAdjustmentOcfData {
  return {
    id: d.id,
    stock_class_id: d.stock_class_id,
    date: dateStringToDAMLDate(d.date, 'stockClassAuthorizedSharesAdjustment.date'),
    new_shares_authorized: normalizeNumericString(d.new_shares_authorized),
    board_approval_date: optionalDateStringToDAMLDate(
      d.board_approval_date,
      'stockClassAuthorizedSharesAdjustment.board_approval_date'
    ),
    stockholder_approval_date: optionalDateStringToDAMLDate(
      d.stockholder_approval_date,
      'stockClassAuthorizedSharesAdjustment.stockholder_approval_date'
    ),
    comments: cleanComments(d.comments),
  };
}
