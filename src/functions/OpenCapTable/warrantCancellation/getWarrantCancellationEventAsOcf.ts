import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { normalizeNumericString } from '../../../utils/typeConversions';

/**
 * OCF Warrant Cancellation Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/cancellation/WarrantCancellation.schema.json
 */
export interface OcfWarrantCancellationEvent {
  object_type: 'TX_WARRANT_CANCELLATION';
  id: string;
  date: string;
  security_id: string;
  quantity: string;
  balance_security_id?: string;
  reason_text: string;
  comments?: string[];
}

export interface GetWarrantCancellationEventAsOcfParams {
  contractId: string;
}

export interface GetWarrantCancellationEventAsOcfResult {
  event: OcfWarrantCancellationEvent;
  contractId: string;
}

/** Type alias for DAML WarrantCancellation contract createArgument */
type WarrantCancellationCreateArgument = Fairmint.OpenCapTable.OCF.WarrantCancellation.WarrantCancellation;

/**
 * Get a warrant cancellation contract and convert it to OCF format.
 *
 * @param client - The LedgerJsonApiClient instance
 * @param params - Parameters containing the contract ID
 * @returns The warrant cancellation event in OCF format
 */
export async function getWarrantCancellationEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetWarrantCancellationEventAsOcfParams
): Promise<GetWarrantCancellationEventAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created) {
    throw new Error('Missing created event');
  }
  if (!res.created.createdEvent.createArgument) {
    throw new Error('Missing createArgument');
  }
  const contract = res.created.createdEvent.createArgument as WarrantCancellationCreateArgument;
  const data = contract.cancellation_data;

  const event: OcfWarrantCancellationEvent = {
    object_type: 'TX_WARRANT_CANCELLATION',
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
