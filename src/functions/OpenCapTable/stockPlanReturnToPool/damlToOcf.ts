/**
 * DAML to OCF converters for StockPlanReturnToPool entities.
 */

import type { OcfStockPlanReturnToPool } from '../../../types';
import { damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';

/**
 * DAML StockPlanReturnToPool data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlStockPlanReturnToPoolData {
  id: string;
  date: string;
  stock_plan_id: string;
  quantity: string;
  reason_text: string;
  comments: string[];
}

/**
 * Convert DAML StockPlanReturnToPool data to native OCF format.
 *
 * @param d - The DAML stock plan return to pool data object
 * @returns The native OCF StockPlanReturnToPool object
 */
export function damlStockPlanReturnToPoolToNative(d: DamlStockPlanReturnToPoolData): OcfStockPlanReturnToPool {
  return {
    id: d.id,
    date: damlTimeToDateString(d.date),
    stock_plan_id: d.stock_plan_id,
    quantity: normalizeNumericString(d.quantity),
    reason_text: d.reason_text,
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
