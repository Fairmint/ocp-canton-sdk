import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { normalizeNumericString } from '../../../utils/typeConversions';

export interface OcfStockClassAuthorizedSharesAdjustmentEvent {
  object_type: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT';
  id: string;
  date: string;
  stock_class_id: string;
  new_shares_authorized: string;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  comments?: string[];
}

export interface GetStockClassAuthorizedSharesAdjustmentEventAsOcfParams {
  contractId: string;
}
export interface GetStockClassAuthorizedSharesAdjustmentEventAsOcfResult {
  event: OcfStockClassAuthorizedSharesAdjustmentEvent;
  contractId: string;
}

/** Type alias for DAML StockClassAuthorizedSharesAdjustment contract createArgument */
type StockClassAuthorizedSharesAdjustmentCreateArgument =
  Fairmint.OpenCapTable.OCF.StockClassAuthorizedSharesAdjustment.StockClassAuthorizedSharesAdjustment;

export async function getStockClassAuthorizedSharesAdjustmentEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockClassAuthorizedSharesAdjustmentEventAsOcfParams
): Promise<GetStockClassAuthorizedSharesAdjustmentEventAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created?.createdEvent.createArgument) throw new Error('Missing createArgument');
  const contract = res.created.createdEvent.createArgument as StockClassAuthorizedSharesAdjustmentCreateArgument;
  const data = contract.adjustment_data;

  const event: OcfStockClassAuthorizedSharesAdjustmentEvent = {
    object_type: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
    id: data.id,
    date: data.date.split('T')[0],
    stock_class_id: data.stock_class_id,
    new_shares_authorized: normalizeNumericString(data.new_shares_authorized),
    ...(data.board_approval_date ? { board_approval_date: data.board_approval_date.split('T')[0] } : {}),
    ...(data.stockholder_approval_date
      ? { stockholder_approval_date: data.stockholder_approval_date.split('T')[0] }
      : {}),
    ...(data.comments.length ? { comments: data.comments } : {}),
  };
  return { event, contractId: params.contractId };
}
