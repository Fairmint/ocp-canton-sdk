import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { StockPlanCancellationBehavior } from '../../../types/native';
import { damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';

function damlCancellationBehaviorToNative(b: string): StockPlanCancellationBehavior | undefined {
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
      return undefined;
  }
}

function damlStockPlanDataToNative(
  d: Fairmint.OpenCapTable.OCF.StockPlan.StockPlanOcfData
): Omit<OcfStockPlanOutput, 'object_type'> {
  const dataWithId = d as unknown as { id?: string };

  // Validate required fields - fail fast if missing
  if (!dataWithId.id) {
    throw new OcpValidationError('stockPlan.id', 'Required field is missing', {
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
  if (!d.initial_shares_reserved) {
    throw new OcpValidationError('stockPlan.initial_shares_reserved', 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.initial_shares_reserved,
    });
  }

  return {
    id: dataWithId.id,
    plan_name: d.plan_name,
    ...(d.board_approval_date && {
      board_approval_date: damlTimeToDateString(d.board_approval_date),
    }),
    ...(d.stockholder_approval_date && {
      stockholder_approval_date: damlTimeToDateString(d.stockholder_approval_date),
    }),
    initial_shares_reserved: normalizeNumericString(d.initial_shares_reserved),
    ...(d.default_cancellation_behavior && {
      default_cancellation_behavior: damlCancellationBehaviorToNative(d.default_cancellation_behavior),
    }),
    stock_class_ids: Array.isArray((d as unknown as { stock_class_ids?: unknown }).stock_class_ids)
      ? (d as unknown as { stock_class_ids: string[] }).stock_class_ids
      : [],
    comments: Array.isArray((d as unknown as { comments?: unknown }).comments)
      ? (d as unknown as { comments: string[] }).comments
      : [],
  };
}

interface OcfStockPlanOutput {
  object_type: 'STOCK_PLAN';
  id?: string;
  plan_name: string;
  initial_shares_reserved: string | number;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  default_cancellation_behavior?: string;
  stock_class_ids?: string[];
  comments?: string[];
}

export interface GetStockPlanAsOcfParams {
  contractId: string;
}

export interface GetStockPlanAsOcfResult {
  stockPlan: OcfStockPlanOutput;
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
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent.createArgument) {
    throw new OcpContractError('Invalid contract events response: missing created event or create argument', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }
  const createArgument = eventsResponse.created.createdEvent.createArgument as Record<string, unknown>;

  if (!('plan_data' in createArgument)) {
    throw new OcpParseError('plan_data not found in contract create argument', {
      source: 'StockPlan.createArgument',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

  const native = damlStockPlanDataToNative(
    createArgument.plan_data as Fairmint.OpenCapTable.OCF.StockPlan.StockPlanOcfData
  );

  const ocf: OcfStockPlanOutput = {
    object_type: 'STOCK_PLAN',
    ...native,
  };

  return { stockPlan: ocf, contractId: params.contractId };
}
