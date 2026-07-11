import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { OcfStockPlan, StockPlanCancellationBehavior } from '../../../types';
import { cleanComments, normalizeNumericString, optionalDateStringToDAMLTime } from '../../../utils/typeConversions';

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

function requireStockClassIds(d: OcfStockPlan): string[] {
  if (Array.isArray(d.stock_class_ids) && d.stock_class_ids.length > 0) return d.stock_class_ids;

  throw new OcpValidationError(
    'stockPlan.stock_class_ids',
    'stock_class_ids must contain at least one stock class identifier',
    {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: '[string, ...string[]]',
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
    board_approval_date: optionalDateStringToDAMLTime(d.board_approval_date, 'stockPlan.board_approval_date'),
    stockholder_approval_date: optionalDateStringToDAMLTime(
      d.stockholder_approval_date,
      'stockPlan.stockholder_approval_date'
    ),
    initial_shares_reserved: normalizeNumericString(d.initial_shares_reserved),
    default_cancellation_behavior: cancellationBehaviorToDaml(d.default_cancellation_behavior),
    stock_class_ids: requireStockClassIds(d),
    comments: cleanComments(d.comments),
  };
}
