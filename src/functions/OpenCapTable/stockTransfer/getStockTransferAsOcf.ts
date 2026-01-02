import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { OcfStockTransferTxData } from '../../../types/native';
import { normalizeNumericString } from '../../../utils/typeConversions';

/**
 * OCF Stock Transfer Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/transfer/StockTransfer.schema.json
 */
export interface OcfStockTransferEvent extends Omit<OcfStockTransferTxData, 'quantity'> {
  object_type: 'TX_STOCK_TRANSFER';
  /** Quantity as string for OCF JSON serialization */
  quantity: string;
}

export interface GetStockTransferAsOcfParams {
  contractId: string;
}

export interface GetStockTransferAsOcfResult {
  event: OcfStockTransferEvent;
  contractId: string;
}

/** Shape of transfer_data from DAML ledger */
interface DamlStockTransferData {
  id: string;
  date: string;
  security_id: string;
  quantity: number | string;
  resulting_security_ids: string[];
  balance_security_id?: string;
  consideration_text?: string;
  comments?: string[];
}

/** Shape of createArgument from ledger - may have nested transfer_data or flat structure */
interface CreateArgument {
  transfer_data?: DamlStockTransferData;
  id?: string;
  date?: string;
  security_id?: string;
  quantity?: number | string;
  resulting_security_ids?: string[];
  balance_security_id?: string;
  consideration_text?: string;
  comments?: string[];
}

export async function getStockTransferAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockTransferAsOcfParams
): Promise<GetStockTransferAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created) {
    throw new Error('Missing created event');
  }
  if (!res.created.createdEvent.createArgument) {
    throw new Error('Missing createArgument');
  }
  const d = res.created.createdEvent.createArgument as CreateArgument;
  const data = d.transfer_data ?? d; // template stores as transfer_data

  if (!data.id) throw new Error('Missing required field: id');
  if (!data.date) throw new Error('Missing required field: date');
  if (!data.security_id) throw new Error('Missing required field: security_id');
  if (data.quantity === undefined) {
    throw new Error('Missing required field: quantity');
  }
  if (!data.resulting_security_ids || data.resulting_security_ids.length === 0) {
    throw new Error('Missing required field: resulting_security_ids');
  }

  const event: OcfStockTransferEvent = {
    object_type: 'TX_STOCK_TRANSFER',
    id: data.id,
    date: data.date.split('T')[0],
    security_id: data.security_id,
    quantity: normalizeNumericString(typeof data.quantity === 'number' ? data.quantity.toString() : data.quantity),
    resulting_security_ids: data.resulting_security_ids,
    ...(data.balance_security_id ? { balance_security_id: data.balance_security_id } : {}),
    ...(data.consideration_text ? { consideration_text: data.consideration_text } : {}),
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };
  return { event, contractId: params.contractId };
}
