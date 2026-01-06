import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';

/**
 * OCF Convertible Cancellation Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/cancellation/ConvertibleCancellation.schema.json
 *
 * Note: Convertible cancellations don't have a quantity field since convertibles are monetary instruments (SAFEs,
 * convertible notes) rather than share-based securities.
 */
export interface OcfConvertibleCancellationEvent {
  object_type: 'TX_CONVERTIBLE_CANCELLATION';
  id: string;
  date: string;
  security_id: string;
  balance_security_id?: string;
  reason_text: string;
  comments?: string[];
}

export interface GetConvertibleCancellationEventAsOcfParams {
  contractId: string;
}

export interface GetConvertibleCancellationEventAsOcfResult {
  event: OcfConvertibleCancellationEvent;
  contractId: string;
}

/** Shape of cancellation_data from DAML ledger */
interface CancellationArgument {
  id: string;
  date: string;
  security_id: string;
  balance_security_id?: string;
  reason_text: string;
  comments?: string[];
}

/** Shape of createArgument from ledger - may have nested cancellation_data or flat structure */
interface CreateArgument {
  cancellation_data?: CancellationArgument;
  id?: string;
  date?: string;
  security_id?: string;
  balance_security_id?: string;
  reason_text?: string;
  comments?: string[];
}

/**
 * Get a convertible cancellation contract and convert it to OCF format.
 *
 * @param client - The LedgerJsonApiClient instance
 * @param params - Parameters containing the contract ID
 * @returns The convertible cancellation event in OCF format
 */
export async function getConvertibleCancellationEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetConvertibleCancellationEventAsOcfParams
): Promise<GetConvertibleCancellationEventAsOcfResult> {
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

  const event: OcfConvertibleCancellationEvent = {
    object_type: 'TX_CONVERTIBLE_CANCELLATION',
    id: data.id,
    date: data.date.split('T')[0],
    security_id: data.security_id,
    ...(data.balance_security_id ? { balance_security_id: data.balance_security_id } : {}),
    reason_text: data.reason_text,
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };
  return { event, contractId: params.contractId };
}
