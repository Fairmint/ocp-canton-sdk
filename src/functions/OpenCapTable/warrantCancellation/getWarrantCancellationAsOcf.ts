import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes } from '../../../errors';
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

export interface GetWarrantCancellationAsOcfParams {
  contractId: string;
}

export interface GetWarrantCancellationAsOcfResult {
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
export async function getWarrantCancellationAsOcf(
  client: LedgerJsonApiClient,
  params: GetWarrantCancellationAsOcfParams
): Promise<GetWarrantCancellationAsOcfResult> {
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
  const contract = res.created.createdEvent.createArgument as WarrantCancellationCreateArgument;
  const data = contract.cancellation_data;

  // Convert quantity to string for normalization (DAML Numeric may come as number at runtime)
  const quantity = data.quantity as string | number;
  const quantityStr = typeof quantity === 'number' ? quantity.toString() : quantity;

  const event: OcfWarrantCancellationEvent = {
    object_type: 'TX_WARRANT_CANCELLATION',
    id: data.id,
    date: data.date.split('T')[0],
    security_id: data.security_id,
    quantity: normalizeNumericString(quantityStr),
    ...(data.balance_security_id ? { balance_security_id: data.balance_security_id } : {}),
    reason_text: data.reason_text,
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };
  return { event, contractId: params.contractId };
}
