import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';

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

export interface GetStockCancellationEventAsOcfParams { contractId: string }
export interface GetStockCancellationEventAsOcfResult { event: OcfStockCancellationEvent; contractId: string }

export async function getStockCancellationEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockCancellationEventAsOcfParams
): Promise<GetStockCancellationEventAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created?.createdEvent?.createArgument) throw new Error('Missing createArgument');
  const d = res.created.createdEvent.createArgument as any;
  const data = d.cancellation_data || d; // template stores as cancellation_data
  const event: OcfStockCancellationEvent = {
    object_type: 'TX_STOCK_CANCELLATION',
    id: (data as any).id,
    date: (data.date as string).split('T')[0],
    security_id: data.security_id,
    quantity: typeof data.quantity === 'number' ? String(data.quantity) : data.quantity,
    ...(data.balance_security_id ? { balance_security_id: data.balance_security_id } : {}),
    reason_text: data.reason_text,
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {})
  };
  return { event, contractId: params.contractId };
}


