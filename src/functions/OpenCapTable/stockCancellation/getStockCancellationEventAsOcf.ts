import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { normalizeNumericString } from '../../../utils/typeConversions';

export interface OcfStockCancellationEvent {
  object_type: 'TX_STOCK_CANCELLATION';
  id: string;
  date: string;
  security_id: string;
  quantity: string;
  balance_security_id?: string;
  reason_text: string;
  comments?: string[];
}

export interface GetStockCancellationEventAsOcfParams {
  contractId: string;
}
export interface GetStockCancellationEventAsOcfResult {
  event: OcfStockCancellationEvent;
  contractId: string;
}

/** Type alias for DAML StockCancellation contract createArgument */
type StockCancellationCreateArgument = Fairmint.OpenCapTable.OCF.StockCancellation.StockCancellation;

export async function getStockCancellationEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockCancellationEventAsOcfParams
): Promise<GetStockCancellationEventAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created) {
    throw new Error('Missing created event');
  }
  if (!res.created.createdEvent.createArgument) {
    throw new Error('Missing createArgument');
  }
  const contract = res.created.createdEvent.createArgument as StockCancellationCreateArgument;
  const data = contract.cancellation_data;

  const event: OcfStockCancellationEvent = {
    object_type: 'TX_STOCK_CANCELLATION',
    id: data.id,
    date: data.date.split('T')[0],
    security_id: data.security_id,
    quantity: normalizeNumericString(data.quantity),
    ...(data.balance_security_id ? { balance_security_id: data.balance_security_id } : {}),
    reason_text: data.reason_text,
    ...(data.comments.length ? { comments: data.comments } : {}),
  };
  return { event, contractId: params.contractId };
}
