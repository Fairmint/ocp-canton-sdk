import type { OcfStockPlanPoolAdjustment } from '../../../types';
import type { PkgStockPlanPoolAdjustmentOcfData } from '../../../types/daml';
import {
  cleanComments,
  dateStringToDAMLDate,
  normalizeNumericString,
  optionalDateStringToDAMLDate,
} from '../../../utils/typeConversions';

export function stockPlanPoolAdjustmentDataToDaml(d: OcfStockPlanPoolAdjustment): PkgStockPlanPoolAdjustmentOcfData {
  return {
    id: d.id,
    stock_plan_id: d.stock_plan_id,
    date: dateStringToDAMLDate(d.date, 'stockPlanPoolAdjustment.date'),
    board_approval_date: optionalDateStringToDAMLDate(
      d.board_approval_date,
      'stockPlanPoolAdjustment.board_approval_date'
    ),
    stockholder_approval_date: optionalDateStringToDAMLDate(
      d.stockholder_approval_date,
      'stockPlanPoolAdjustment.stockholder_approval_date'
    ),
    shares_reserved: normalizeNumericString(d.shares_reserved),
    comments: cleanComments(d.comments),
  };
}
