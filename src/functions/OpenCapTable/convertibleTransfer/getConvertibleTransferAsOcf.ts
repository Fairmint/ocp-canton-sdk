import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { OcfConvertibleTransfer } from '../../../types/native';
import { normalizeNumericString } from '../../../utils/typeConversions';

/**
 * OCF Convertible Transfer Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/transfer/ConvertibleTransfer.schema.json
 */
export interface OcfConvertibleTransferEvent extends Omit<OcfConvertibleTransfer, 'amount'> {
  object_type: 'TX_CONVERTIBLE_TRANSFER';
  /** Amount as Monetary type with string amount for OCF JSON serialization */
  amount: { amount: string; currency: string };
}

export interface GetConvertibleTransferAsOcfParams {
  contractId: string;
}

export interface GetConvertibleTransferAsOcfResult {
  event: OcfConvertibleTransferEvent;
  contractId: string;
}

/** Type alias for DAML ConvertibleTransfer contract createArgument */
type ConvertibleTransferCreateArgument = Fairmint.OpenCapTable.OCF.ConvertibleTransfer.ConvertibleTransfer;

export async function getConvertibleTransferAsOcf(
  client: LedgerJsonApiClient,
  params: GetConvertibleTransferAsOcfParams
): Promise<GetConvertibleTransferAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created) {
    throw new Error('Missing created event');
  }
  if (!res.created.createdEvent.createArgument) {
    throw new Error('Missing createArgument');
  }
  const contract = res.created.createdEvent.createArgument as ConvertibleTransferCreateArgument;
  const data = contract.transfer_data;

  // Convert amount to string for normalization (DAML Numeric may come as number at runtime)
  const amountValue = data.amount.amount as string | number;
  const amountStr = typeof amountValue === 'number' ? amountValue.toString() : amountValue;

  const event: OcfConvertibleTransferEvent = {
    object_type: 'TX_CONVERTIBLE_TRANSFER',
    id: data.id,
    date: data.date.split('T')[0],
    security_id: data.security_id,
    amount: {
      amount: normalizeNumericString(amountStr),
      currency: data.amount.currency,
    },
    resulting_security_ids: data.resulting_security_ids,
    ...(data.balance_security_id ? { balance_security_id: data.balance_security_id } : {}),
    ...(data.consideration_text ? { consideration_text: data.consideration_text } : {}),
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };
  return { event, contractId: params.contractId };
}
