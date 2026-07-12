import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { OcfStockPlan, StockPlanCancellationBehavior } from '../../../types';
import { canonicalizeOcfNumeric10 } from '../../../utils/numeric10';
import { assertSafeOcfJson } from '../../../utils/ocfJsonValidation';
import { parseOcfEntityInput } from '../../../utils/ocfZodSchemas';
import { cleanComments, optionalDateStringToDAMLTime } from '../../../utils/typeConversions';

function cancellationBehaviorToDaml(
  b: StockPlanCancellationBehavior | undefined
): Fairmint.OpenCapTable.OCF.StockPlan.StockPlanOcfData['default_cancellation_behavior'] {
  if (!b) return null;
  if (typeof b !== 'string') {
    throw new OcpValidationError('stockPlan.default_cancellation_behavior', 'Cancellation behavior must be a string', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'StockPlanCancellationBehavior',
      receivedValue: b,
    });
  }
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
      throw new OcpParseError('Unknown cancellation behavior', {
        source: 'stockPlan.default_cancellation_behavior',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        context: { receivedValue: exhaustiveCheck },
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
  assertSafeOcfJson(d, 'stockPlan');
  if (!d.id) {
    throw new OcpValidationError('stockPlan.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }

  if (typeof d.initial_shares_reserved !== 'string') {
    throw new OcpValidationError('stockPlan.initial_shares_reserved', 'Initial shares reserved must be a string', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'OCF Numeric string',
      receivedValue: d.initial_shares_reserved,
    });
  }
  const initialSharesReserved = canonicalizeOcfNumeric10(d.initial_shares_reserved);
  if (!initialSharesReserved.ok) {
    throw new OcpValidationError('stockPlan.initial_shares_reserved', initialSharesReserved.message, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'OCF Numeric string within DAML Numeric 10 bounds',
      receivedValue: d.initial_shares_reserved,
    });
  }

  const result = {
    id: d.id,
    plan_name: d.plan_name,
    board_approval_date: optionalDateStringToDAMLTime(d.board_approval_date, 'stockPlan.board_approval_date'),
    stockholder_approval_date: optionalDateStringToDAMLTime(
      d.stockholder_approval_date,
      'stockPlan.stockholder_approval_date'
    ),
    initial_shares_reserved: initialSharesReserved.value,
    default_cancellation_behavior: cancellationBehaviorToDaml(d.default_cancellation_behavior),
    stock_class_ids: requireStockClassIds(d),
    comments: cleanComments(d.comments),
  };
  parseOcfEntityInput('stockPlan', d);
  return result;
}
