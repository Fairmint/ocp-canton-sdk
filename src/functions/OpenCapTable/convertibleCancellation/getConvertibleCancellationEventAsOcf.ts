import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes } from '../../../errors';

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

/** Type alias for DAML ConvertibleCancellation contract createArgument */
type ConvertibleCancellationCreateArgument = Fairmint.OpenCapTable.OCF.ConvertibleCancellation.ConvertibleCancellation;

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
    throw new OcpContractError('Missing created event', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }
  if (!res.created.createdEvent.createArgument) {
    throw new OcpContractError('Missing createArgument', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }
  const contract = res.created.createdEvent.createArgument as ConvertibleCancellationCreateArgument;
  const data = contract.cancellation_data;

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
