import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { OcfEquityCompensationTransfer } from '../../../types/native';
import { normalizeNumericString } from '../../../utils/typeConversions';

/**
 * OCF Equity Compensation Transfer Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/transfer/EquityCompensationTransfer.schema.json
 */
export interface OcfEquityCompensationTransferEvent extends Omit<OcfEquityCompensationTransfer, 'quantity'> {
  object_type: 'TX_EQUITY_COMPENSATION_TRANSFER';
  /** Quantity as string for OCF JSON serialization */
  quantity: string;
}

export interface GetEquityCompensationTransferAsOcfParams {
  contractId: string;
}

export interface GetEquityCompensationTransferAsOcfResult {
  event: OcfEquityCompensationTransferEvent;
  contractId: string;
}

/** Type alias for DAML EquityCompensationTransfer contract createArgument */
type EquityCompensationTransferCreateArgument =
  Fairmint.OpenCapTable.OCF.EquityCompensationTransfer.EquityCompensationTransfer;

export async function getEquityCompensationTransferAsOcf(
  client: LedgerJsonApiClient,
  params: GetEquityCompensationTransferAsOcfParams
): Promise<GetEquityCompensationTransferAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created) {
    throw new Error('Missing created event');
  }
  if (!res.created.createdEvent.createArgument) {
    throw new Error('Missing createArgument');
  }
  const contract = res.created.createdEvent.createArgument as EquityCompensationTransferCreateArgument;
  const data = contract.transfer_data;

  // Convert quantity to string for normalization (DAML Numeric may come as number at runtime)
  const quantity = data.quantity as string | number;
  const quantityStr = typeof quantity === 'number' ? quantity.toString() : quantity;

  const event: OcfEquityCompensationTransferEvent = {
    object_type: 'TX_EQUITY_COMPENSATION_TRANSFER',
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
