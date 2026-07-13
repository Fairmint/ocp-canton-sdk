import type { OcfStockPlanPoolAdjustment } from '../../../types';
import { cleanComments, dateStringToDAMLTime, normalizeNumericString } from '../../../utils/typeConversions';

export function stockPlanPoolAdjustmentDataToDaml(d: OcfStockPlanPoolAdjustment): Record<string, unknown> {
  return {
    id: d.id,
    stock_plan_id: d.stock_plan_id,
    date: dateStringToDAMLTime(d.date),
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    shares_reserved: normalizeNumericString(d.shares_reserved),
    comments: cleanComments(d.comments),
  };
}
