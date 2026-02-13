import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
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
    default: {
      const exhaustiveCheck: never = b;
      throw new OcpParseError(`Unknown cancellation behavior: ${String(exhaustiveCheck)}`, {
        source: 'stockPlan.default_cancellation_behavior',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}

/**
 * Resolve stock class IDs from either the current `stock_class_ids` array
 * or the deprecated singular `stock_class_id` field.
 *
 * The OCF StockPlan schema uses a `oneOf` allowing either field but not both.
 * Our DAML contract always expects `stock_class_ids` as an array.
 */
function resolveStockClassIds(d: OcfStockPlan): string[] {
  if (Array.isArray(d.stock_class_ids) && d.stock_class_ids.length > 0) {
    return d.stock_class_ids;
  }
  // Fall back to deprecated singular field (OCF schema oneOf alternative)
  if (typeof d.stock_class_id === 'string' && d.stock_class_id.length > 0) {
    return [d.stock_class_id];
  }
  throw new OcpValidationError(
    'stockPlan.stock_class_ids',
    'Either stock_class_ids (array) or deprecated stock_class_id (string) is required',
    {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'string[]',
      receivedValue: d.stock_class_ids,
    }
  );
}

export function stockPlanDataToDaml(d: OcfStockPlan): Fairmint.OpenCapTable.OCF.StockPlan.StockPlanOcfData {
  if (!d.id) {
    throw new OcpValidationError('stockPlan.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }

  return {
    id: d.id,
    plan_name: d.plan_name,
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    initial_shares_reserved: d.initial_shares_reserved,
    default_cancellation_behavior: cancellationBehaviorToDaml(d.default_cancellation_behavior),
    stock_class_ids: resolveStockClassIds(d),
    comments: cleanComments(d.comments),
  };
}
