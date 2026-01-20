import type { OcfStockPlanPoolAdjustment } from '../../../types';
import { cleanComments, dateStringToDAMLTime, numberToString } from '../../../utils/typeConversions';

/**
 * Convert OCF stock plan pool adjustment data to DAML format.
 *
 * @deprecated Use `ocp.OpenCapTable.capTable.update().create('stockPlanPoolAdjustment', data).execute()` instead.
 *   This function will be removed in a future major version.
 */
export function stockPlanPoolAdjustmentDataToDaml(d: OcfStockPlanPoolAdjustment): Record<string, unknown> {
  return {
    id: d.id,
    stock_plan_id: d.stock_plan_id,
    date: dateStringToDAMLTime(d.date),
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    shares_reserved: numberToString(d.shares_reserved),
    comments: cleanComments(d.comments),
  };
}
