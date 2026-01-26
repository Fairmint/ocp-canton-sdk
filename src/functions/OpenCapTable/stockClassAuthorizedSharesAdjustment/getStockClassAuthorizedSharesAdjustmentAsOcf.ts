import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes } from '../../../errors';
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

export interface GetStockClassAuthorizedSharesAdjustmentAsOcfParams {
  contractId: string;
}
export interface GetStockClassAuthorizedSharesAdjustmentAsOcfResult {
  event: OcfStockClassAuthorizedSharesAdjustmentEvent;
  contractId: string;
}

/** Type alias for DAML StockClassAuthorizedSharesAdjustment contract createArgument */
type StockClassAuthorizedSharesAdjustmentCreateArgument =
  Fairmint.OpenCapTable.OCF.StockClassAuthorizedSharesAdjustment.StockClassAuthorizedSharesAdjustment;

export async function getStockClassAuthorizedSharesAdjustmentAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockClassAuthorizedSharesAdjustmentAsOcfParams
): Promise<GetStockClassAuthorizedSharesAdjustmentAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created?.createdEvent.createArgument) {
    throw new OcpContractError('Missing createArgument', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }
  const contract = res.created.createdEvent.createArgument as StockClassAuthorizedSharesAdjustmentCreateArgument;
  const data = contract.adjustment_data;

  // Convert new_shares_authorized to string for normalization (DAML Numeric may come as number at runtime)
  const newSharesAuthorized = data.new_shares_authorized as string | number;
  const newSharesAuthorizedStr =
    typeof newSharesAuthorized === 'number' ? newSharesAuthorized.toString() : newSharesAuthorized;

  const event: OcfStockClassAuthorizedSharesAdjustmentEvent = {
    object_type: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
    id: data.id,
    date: data.date.split('T')[0],
    stock_class_id: data.stock_class_id,
    new_shares_authorized: normalizeNumericString(newSharesAuthorizedStr),
    ...(data.board_approval_date ? { board_approval_date: data.board_approval_date.split('T')[0] } : {}),
    ...(data.stockholder_approval_date
      ? { stockholder_approval_date: data.stockholder_approval_date.split('T')[0] }
      : {}),
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };
  return { event, contractId: params.contractId };
}
