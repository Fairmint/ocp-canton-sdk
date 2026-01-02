import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
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

interface CancellationArgument {
  id: string;
  date: string;
  security_id: string;
  quantity: number | string;
  balance_security_id?: string;
  reason_text: string;
  comments?: string[];
}

interface CreateArgument {
  cancellation_data?: CancellationArgument;
  id?: string;
  date?: string;
  security_id?: string;
  quantity?: number | string;
  balance_security_id?: string;
  reason_text?: string;
  comments?: string[];
}

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
  const d = res.created.createdEvent.createArgument as CreateArgument;
  const data = d.cancellation_data ?? d; // template stores as cancellation_data

  if (!data.id) throw new Error('Missing required field: id');
  if (!data.date) throw new Error('Missing required field: date');
  if (!data.security_id) throw new Error('Missing required field: security_id');
  if (!data.reason_text) throw new Error('Missing required field: reason_text');

  const event: OcfStockCancellationEvent = {
    object_type: 'TX_STOCK_CANCELLATION',
    id: data.id,
    date: data.date.split('T')[0],
    security_id: data.security_id,
    quantity: normalizeNumericString(
      typeof data.quantity === 'number'
        ? data.quantity.toString()
        : (data.quantity ??
            (() => {
              throw new Error('Stock cancellation quantity is required');
            })())
    ),
    ...(data.balance_security_id ? { balance_security_id: data.balance_security_id } : {}),
    reason_text: data.reason_text,
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };
  return { event, contractId: params.contractId };
}
