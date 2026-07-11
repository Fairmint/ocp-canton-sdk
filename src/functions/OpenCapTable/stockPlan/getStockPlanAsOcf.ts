import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockPlan, StockPlanCancellationBehavior } from '../../../types/native';
import { normalizeNumericString, optionalDamlTimeToDateString } from '../../../utils/typeConversions';
import { readSingleContract } from '../shared/singleContractRead';

function damlCancellationBehaviorToNative(b: string | null): StockPlanCancellationBehavior | undefined {
  if (b === null) return undefined;
  switch (b) {
    case 'OcfPlanCancelRetire':
      return 'RETIRE';
    case 'OcfPlanCancelReturnToPool':
      return 'RETURN_TO_POOL';
    case 'OcfPlanCancelHoldAsCapitalStock':
      return 'HOLD_AS_CAPITAL_STOCK';
    case 'OcfPlanCancelDefinedPerPlanSecurity':
      return 'DEFINED_PER_PLAN_SECURITY';
    default:
      throw new OcpParseError(`Unknown DAML cancellation behavior: ${b}`, {
        source: 'stockPlan.default_cancellation_behavior',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

function isNonEmptyStringArray(value: unknown): value is [string, ...string[]] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string');
}

export function damlStockPlanDataToNative(d: Fairmint.OpenCapTable.OCF.StockPlan.StockPlanOcfData): OcfStockPlan {
  // Access fields via Record type to handle DAML types that may vary from the SDK definition
  const damlRecord = d as Record<string, unknown>;
  const dataWithId = damlRecord as { id?: string };

  // Validate required fields - fail fast if missing
  if (typeof dataWithId.id !== 'string' || dataWithId.id.length === 0) {
    throw new OcpValidationError('stockPlan.id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: dataWithId.id,
    });
  }
  if (!d.plan_name) {
    throw new OcpValidationError('stockPlan.plan_name', 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.plan_name,
    });
  }
  const initialSharesReserved = damlRecord.initial_shares_reserved;
  if (initialSharesReserved === undefined || initialSharesReserved === null) {
    throw new OcpValidationError('stockPlan.initial_shares_reserved', 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: initialSharesReserved,
    });
  }
  if (typeof initialSharesReserved !== 'string' && typeof initialSharesReserved !== 'number') {
    throw new OcpValidationError('stockPlan.initial_shares_reserved', 'Invalid initial_shares_reserved format', {
      code: OcpErrorCodes.INVALID_FORMAT,
      receivedValue: initialSharesReserved,
    });
  }
  const stockClassIds = damlRecord.stock_class_ids;
  if (!isNonEmptyStringArray(stockClassIds)) {
    throw new OcpValidationError('stockPlan.stock_class_ids', 'Expected at least one stock class identifier', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: '[string, ...string[]]',
      receivedValue: stockClassIds,
    });
  }

  const boardApprovalDate = optionalDamlTimeToDateString(d.board_approval_date, 'stockPlan.board_approval_date');
  const stockholderApprovalDate = optionalDamlTimeToDateString(
    d.stockholder_approval_date,
    'stockPlan.stockholder_approval_date'
  );

  return {
    object_type: 'STOCK_PLAN',
    id: dataWithId.id,
    plan_name: d.plan_name,
    ...(boardApprovalDate !== undefined ? { board_approval_date: boardApprovalDate } : {}),
    ...(stockholderApprovalDate !== undefined ? { stockholder_approval_date: stockholderApprovalDate } : {}),
    initial_shares_reserved: normalizeNumericString(initialSharesReserved.toString()),
    ...(d.default_cancellation_behavior && {
      default_cancellation_behavior: damlCancellationBehaviorToNative(d.default_cancellation_behavior),
    }),
    stock_class_ids: stockClassIds,
    comments: Array.isArray((d as unknown as { comments?: unknown }).comments)
      ? (d as unknown as { comments: string[] }).comments
      : [],
  };
}

export interface GetStockPlanAsOcfParams extends GetByContractIdParams {}

export interface GetStockPlanAsOcfResult {
  stockPlan: OcfStockPlan;
  contractId: string;
}

/**
 * Retrieve a stock plan contract and return it as an OCF JSON object
 *
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/StockPlan.schema.json
 */
export async function getStockPlanAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockPlanAsOcfParams
): Promise<GetStockPlanAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStockPlanAsOcf',
    expectedTemplateId: Fairmint.OpenCapTable.OCF.StockPlan.StockPlan.templateId,
  });

  const planData = createArgument.plan_data;
  if (typeof planData !== 'object' || planData === null || Array.isArray(planData)) {
    throw new OcpParseError('plan_data must be a non-null object in contract create argument', {
      source: 'StockPlan.createArgument',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: { receivedValue: planData },
    });
  }

  const stockPlan = damlStockPlanDataToNative(planData as Fairmint.OpenCapTable.OCF.StockPlan.StockPlanOcfData);

  return { stockPlan, contractId: params.contractId };
}
