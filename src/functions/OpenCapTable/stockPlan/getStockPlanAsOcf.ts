import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { OcfStockPlanData, StockPlanCancellationBehavior } from '../../../types/native';
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

function damlStockPlanDataToNative(d: Fairmint.OpenCapTable.StockPlan.OcfStockPlanData): OcfStockPlanData {
  const dataWithId = d as unknown as { id?: string };
  return {
    id: dataWithId.id ?? '',
    plan_name: d.plan_name || '',
    ...(d.board_approval_date && {
      board_approval_date: damlTimeToDateString(d.board_approval_date),
    }),
    ...(d.stockholder_approval_date && {
      stockholder_approval_date: damlTimeToDateString(d.stockholder_approval_date),
    }),
    initial_shares_reserved: normalizeNumericString(d.initial_shares_reserved || '0'),
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

export interface OcfStockPlan {
  object_type: 'STOCK_PLAN';
  id?: string;
  plan_name: string;
  initial_shares_reserved: string | number;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  default_cancellation_behavior?: string;
  comments?: string[];
}

export interface GetStockPlanAsOcfParams {
  contractId: string;
}

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
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }
  const createArgument = eventsResponse.created.createdEvent.createArgument as Record<string, unknown>;

  if (!('plan_data' in createArgument)) {
    throw new Error('plan_data not found in contract create argument');
  }

  const native = damlStockPlanDataToNative(
    createArgument.plan_data as Fairmint.OpenCapTable.StockPlan.OcfStockPlanData
  );

  const ocf: OcfStockPlan = {
    object_type: 'STOCK_PLAN',
    ...native,
  };

  return { stockPlan: ocf, contractId: params.contractId };
}
