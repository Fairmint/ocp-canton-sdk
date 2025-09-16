import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';

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

export interface GetStockPlanPoolAdjustmentEventAsOcfParams { contractId: string }
export interface GetStockPlanPoolAdjustmentEventAsOcfResult { event: OcfStockPlanPoolAdjustmentEvent; contractId: string }

export async function getStockPlanPoolAdjustmentEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockPlanPoolAdjustmentEventAsOcfParams
): Promise<GetStockPlanPoolAdjustmentEventAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created?.createdEvent?.createArgument) throw new Error('Missing createArgument');
  const arg = res.created.createdEvent.createArgument as any;
  const d = arg.adjustment_data || arg;
  const event: OcfStockPlanPoolAdjustmentEvent = {
    object_type: 'TX_STOCK_PLAN_POOL_ADJUSTMENT',
    id: d.ocf_id,
    date: (d.date as string).split('T')[0],
    stock_plan_id: d.stock_plan_id,
    shares_reserved: typeof d.shares_reserved === 'number' ? String(d.shares_reserved) : d.shares_reserved,
    ...(d.board_approval_date ? { board_approval_date: (d.board_approval_date as string).split('T')[0] } : {}),
    ...(d.stockholder_approval_date ? { stockholder_approval_date: (d.stockholder_approval_date as string).split('T')[0] } : {}),
    ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments } : {})
  };
  return { event, contractId: params.contractId };
}


