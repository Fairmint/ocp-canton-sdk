import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { OcfStockPlan, StockPlanCancellationBehavior } from '../../../types';
import { cleanComments, dateStringToDAMLTime } from '../../../utils/typeConversions';

function cancellationBehaviorToDaml(
  b: StockPlanCancellationBehavior | undefined
): Fairmint.OpenCapTable.OCF.StockPlan.StockPlanOcfData['default_cancellation_behavior'] {
  if (!b) return null;
  switch (b) {
    case 'RETIRE':
      return 'OcfPlanCancelRetire';
    case 'RETURN_TO_POOL':
      return 'OcfPlanCancelReturnToPool';
    case 'HOLD_AS_CAPITAL_STOCK':
      return 'OcfPlanCancelHoldAsCapitalStock';
    case 'DEFINED_PER_PLAN_SECURITY':
      return 'OcfPlanCancelDefinedPerPlanSecurity';
    default:
      throw new Error('Unknown cancellation behavior');
  }
}

// Type for handling deprecated stock_class_id field in input data
type StockPlanDataWithDeprecated = Omit<OcfStockPlan, 'stock_class_ids'> & {
  stock_class_id?: string;
  stock_class_ids?: string[];
};

export function stockPlanDataToDaml(d: OcfStockPlan): Fairmint.OpenCapTable.OCF.StockPlan.StockPlanOcfData {
  if (!d.id) throw new Error('stockPlan.id is required');

  // Handle deprecated stock_class_id → stock_class_ids
  // Cast to allow for deprecated field and potentially missing stock_class_ids (when only deprecated field is provided)
  const data = d as StockPlanDataWithDeprecated;
  const currentIds = data.stock_class_ids ?? [];
  const stockClassIds = currentIds.length > 0 ? currentIds : data.stock_class_id ? [data.stock_class_id] : [];

  return {
    id: d.id,
    plan_name: d.plan_name,
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    initial_shares_reserved:
      typeof d.initial_shares_reserved === 'number' ? d.initial_shares_reserved.toString() : d.initial_shares_reserved,
    default_cancellation_behavior: cancellationBehaviorToDaml(d.default_cancellation_behavior),
    stock_class_ids: stockClassIds,
    comments: cleanComments(d.comments),
  };
}
