import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes } from '../../../errors';
import type { OcfWarrantTransfer } from '../../../types/native';
import { normalizeNumericString } from '../../../utils/typeConversions';

/**
 * OCF Warrant Transfer Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/transfer/WarrantTransfer.schema.json
 */
export interface OcfWarrantTransferEvent extends Omit<OcfWarrantTransfer, 'quantity'> {
  object_type: 'TX_WARRANT_TRANSFER';
  /** Quantity as string for OCF JSON serialization */
  quantity: string;
}

export interface GetWarrantTransferAsOcfParams {
  contractId: string;
}

export interface GetWarrantTransferAsOcfResult {
  event: OcfWarrantTransferEvent;
  contractId: string;
}

/** Type alias for DAML WarrantTransfer contract createArgument */
type WarrantTransferCreateArgument = Fairmint.OpenCapTable.OCF.WarrantTransfer.WarrantTransfer;

export async function getWarrantTransferAsOcf(
  client: LedgerJsonApiClient,
  params: GetWarrantTransferAsOcfParams
): Promise<GetWarrantTransferAsOcfResult> {
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
  const contract = res.created.createdEvent.createArgument as WarrantTransferCreateArgument;
  const data = contract.transfer_data;

  // Convert quantity to string for normalization (DAML Numeric may come as number at runtime)
  const quantity = data.quantity as string | number;
  const quantityStr = typeof quantity === 'number' ? quantity.toString() : quantity;

  const event: OcfWarrantTransferEvent = {
    object_type: 'TX_WARRANT_TRANSFER',
    id: data.id,
    date: data.date.split('T')[0],
    security_id: data.security_id,
    quantity: normalizeNumericString(quantityStr),
    resulting_security_ids: data.resulting_security_ids,
    ...(data.balance_security_id ? { balance_security_id: data.balance_security_id } : {}),
    ...(data.consideration_text ? { consideration_text: data.consideration_text } : {}),
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };
  return { event, contractId: params.contractId };
}
