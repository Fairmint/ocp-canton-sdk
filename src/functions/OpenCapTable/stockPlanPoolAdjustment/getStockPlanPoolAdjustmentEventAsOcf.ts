import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
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

export interface GetStockPlanPoolAdjustmentEventAsOcfParams {
  contractId: string;
}
export interface GetStockPlanPoolAdjustmentEventAsOcfResult {
  event: OcfStockPlanPoolAdjustmentEvent;
  contractId: string;
}

/** Type alias for DAML StockPlanPoolAdjustment contract createArgument */
type StockPlanPoolAdjustmentCreateArgument = Fairmint.OpenCapTable.OCF.StockPlanPoolAdjustment.StockPlanPoolAdjustment;

export async function getStockPlanPoolAdjustmentEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockPlanPoolAdjustmentEventAsOcfParams
): Promise<GetStockPlanPoolAdjustmentEventAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created?.createdEvent.createArgument) throw new Error('Missing createArgument');
  const contract = res.created.createdEvent.createArgument as StockPlanPoolAdjustmentCreateArgument;
  const data = contract.adjustment_data;

  const event: OcfStockPlanPoolAdjustmentEvent = {
    object_type: 'TX_STOCK_PLAN_POOL_ADJUSTMENT',
    id: data.id,
    date: data.date.split('T')[0],
    stock_plan_id: data.stock_plan_id,
    shares_reserved: normalizeNumericString(data.shares_reserved),
    ...(data.board_approval_date ? { board_approval_date: data.board_approval_date.split('T')[0] } : {}),
    ...(data.stockholder_approval_date
      ? { stockholder_approval_date: data.stockholder_approval_date.split('T')[0] }
      : {}),
    ...(data.comments.length ? { comments: data.comments } : {}),
  };
  return { event, contractId: params.contractId };
}
