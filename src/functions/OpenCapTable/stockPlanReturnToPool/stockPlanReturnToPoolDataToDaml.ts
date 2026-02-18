/**
 * OCF to DAML converter for StockPlanReturnToPool entities.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfStockPlanReturnToPool } from '../../../types';
import { cleanComments, dateStringToDAMLTime, normalizeNumericString } from '../../../utils/typeConversions';

/**
 * Convert native OCF StockPlanReturnToPool data to DAML format.
 *
 * @param d - The native OCF stock plan return to pool data object
 * @returns The DAML-formatted stock plan return to pool data
 * @throws OcpValidationError if required fields are missing
 */
export function stockPlanReturnToPoolDataToDaml(d: OcfStockPlanReturnToPool): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('stockPlanReturnToPool.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  if (!d.security_id) {
    throw new OcpValidationError('stockPlanReturnToPool.security_id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.security_id,
    });
  }
  if (!d.stock_plan_id) {
    throw new OcpValidationError('stockPlanReturnToPool.stock_plan_id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.stock_plan_id,
    });
  }
  if (!d.quantity) {
    throw new OcpValidationError('stockPlanReturnToPool.quantity', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.quantity,
    });
  }
  if (!d.reason_text) {
    throw new OcpValidationError('stockPlanReturnToPool.reason_text', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.reason_text,
    });
  }

  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    stock_plan_id: d.stock_plan_id,
    quantity: normalizeNumericString(d.quantity),
    reason_text: d.reason_text,
    comments: cleanComments(d.comments),
  };
}
