import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';

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

interface AdjustmentData {
  id: string;
  date: string;
  stock_plan_id: string;
  shares_reserved: string | number;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  comments?: string[];
}

interface CreateArgument {
  adjustment_data?: AdjustmentData;
  id?: string;
  date?: string;
  stock_plan_id?: string;
  shares_reserved?: string | number;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  comments?: string[];
}

export async function getStockPlanPoolAdjustmentEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockPlanPoolAdjustmentEventAsOcfParams
): Promise<GetStockPlanPoolAdjustmentEventAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created?.createdEvent?.createArgument) throw new Error('Missing createArgument');
  const arg = res.created.createdEvent.createArgument as CreateArgument;
  const d = arg.adjustment_data ?? arg;

  if (!d.id) throw new Error('Missing id');
  if (!d.stock_plan_id) throw new Error('Missing stock_plan_id');
  if (d.shares_reserved === undefined) throw new Error('Missing shares_reserved');
  if (!d.date) throw new Error('Missing date');

  const event: OcfStockPlanPoolAdjustmentEvent = {
    object_type: 'TX_STOCK_PLAN_POOL_ADJUSTMENT',
    id: d.id,
    date: d.date.split('T')[0],
    stock_plan_id: d.stock_plan_id,
    shares_reserved: typeof d.shares_reserved === 'number' ? String(d.shares_reserved) : d.shares_reserved,
    ...(d.board_approval_date ? { board_approval_date: d.board_approval_date.split('T')[0] } : {}),
    ...(d.stockholder_approval_date ? { stockholder_approval_date: d.stockholder_approval_date.split('T')[0] } : {}),
    ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments } : {}),
  };
  return { event, contractId: params.contractId };
}
