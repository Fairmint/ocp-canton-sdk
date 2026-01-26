import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes } from '../../../errors';
import { normalizeNumericString } from '../../../utils/typeConversions';

export interface OcfStockPlanPoolAdjustmentEvent {
  object_type: 'TX_STOCK_PLAN_POOL_ADJUSTMENT';
  id: string;
  date: string;
  stock_plan_id: string;
  shares_reserved: string;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  comments?: string[];
}

export interface GetStockPlanPoolAdjustmentAsOcfParams {
  contractId: string;
}
export interface GetStockPlanPoolAdjustmentAsOcfResult {
  event: OcfStockPlanPoolAdjustmentEvent;
  contractId: string;
}

/** Type alias for DAML StockPlanPoolAdjustment contract createArgument */
type StockPlanPoolAdjustmentCreateArgument = Fairmint.OpenCapTable.OCF.StockPlanPoolAdjustment.StockPlanPoolAdjustment;

export async function getStockPlanPoolAdjustmentAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockPlanPoolAdjustmentAsOcfParams
): Promise<GetStockPlanPoolAdjustmentAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created?.createdEvent.createArgument) {
    throw new OcpContractError('Missing createArgument', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }
  const contract = res.created.createdEvent.createArgument as StockPlanPoolAdjustmentCreateArgument;
  const data = contract.adjustment_data;

  // Convert shares_reserved to string for normalization (DAML Numeric may come as number at runtime)
  const sharesReserved = data.shares_reserved as string | number;
  const sharesReservedStr = typeof sharesReserved === 'number' ? sharesReserved.toString() : sharesReserved;

  const event: OcfStockPlanPoolAdjustmentEvent = {
    object_type: 'TX_STOCK_PLAN_POOL_ADJUSTMENT',
    id: data.id,
    date: data.date.split('T')[0],
    stock_plan_id: data.stock_plan_id,
    shares_reserved: normalizeNumericString(sharesReservedStr),
    ...(data.board_approval_date ? { board_approval_date: data.board_approval_date.split('T')[0] } : {}),
    ...(data.stockholder_approval_date
      ? { stockholder_approval_date: data.stockholder_approval_date.split('T')[0] }
      : {}),
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };
  return { event, contractId: params.contractId };
}
