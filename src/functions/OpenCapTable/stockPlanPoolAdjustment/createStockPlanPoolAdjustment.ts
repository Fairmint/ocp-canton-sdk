import type { OcfStockPlanPoolAdjustment } from '../../../types';
import {
  cleanComments,
  dateStringToDAMLTime,
  normalizeNumericString,
  optionalDateStringToDAMLTime,
} from '../../../utils/typeConversions';

export function stockPlanPoolAdjustmentDataToDaml(d: OcfStockPlanPoolAdjustment): Record<string, unknown> {
  return {
    id: d.id,
    stock_plan_id: d.stock_plan_id,
    date: dateStringToDAMLTime(d.date, 'stockPlanPoolAdjustment.date'),
    board_approval_date: optionalDateStringToDAMLTime(
      d.board_approval_date,
      'stockPlanPoolAdjustment.board_approval_date'
    ),
    stockholder_approval_date: optionalDateStringToDAMLTime(
      d.stockholder_approval_date,
      'stockPlanPoolAdjustment.stockholder_approval_date'
    ),
    shares_reserved: normalizeNumericString(d.shares_reserved),
    comments: cleanComments(d.comments),
  };
}
