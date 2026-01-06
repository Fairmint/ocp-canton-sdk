import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { OcfStockRepurchaseTxData } from '../../../types/native';
import { damlMonetaryToNative, normalizeNumericString } from '../../../utils/typeConversions';

/**
 * OCF Stock Repurchase Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/repurchase/StockRepurchase.schema.json
 */
export interface OcfStockRepurchaseEvent extends Omit<OcfStockRepurchaseTxData, 'quantity'> {
  object_type: 'TX_STOCK_REPURCHASE';
  /** Quantity as string for OCF JSON serialization */
  quantity: string;
}

export interface GetStockRepurchaseAsOcfParams {
  contractId: string;
}

export interface GetStockRepurchaseAsOcfResult {
  event: OcfStockRepurchaseEvent;
  contractId: string;
}

/** Shape of repurchase_data from DAML ledger */
interface DamlStockRepurchaseData {
  id: string;
  date: string;
  security_id: string;
  quantity: number | string;
  price: Fairmint.OpenCapTable.Types.OcfMonetary;
  balance_security_id?: string;
  consideration_text?: string;
  comments?: string[];
}

/** Shape of createArgument from ledger - may have nested repurchase_data or flat structure */
interface CreateArgument {
  repurchase_data?: DamlStockRepurchaseData;
  id?: string;
  date?: string;
  security_id?: string;
  quantity?: number | string;
  price?: Fairmint.OpenCapTable.Types.OcfMonetary;
  balance_security_id?: string;
  consideration_text?: string;
  comments?: string[];
}

export async function getStockRepurchaseAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockRepurchaseAsOcfParams
): Promise<GetStockRepurchaseAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created) {
    throw new Error('Missing created event');
  }
  if (!res.created.createdEvent.createArgument) {
    throw new Error('Missing createArgument');
  }
  const d = res.created.createdEvent.createArgument as CreateArgument;
  const data = d.repurchase_data ?? d; // template stores as repurchase_data

  if (!data.id) throw new Error('Missing required field: id');
  if (!data.date) throw new Error('Missing required field: date');
  if (!data.security_id) throw new Error('Missing required field: security_id');
  if (data.quantity == null) {
    throw new Error('Missing required field: quantity');
  }
  if (!data.price) {
    throw new Error('Missing required field: price');
  }

  // Convert quantity to string for normalization
  const quantityStr = typeof data.quantity === 'number' ? data.quantity.toString() : data.quantity;

  const event: OcfStockRepurchaseEvent = {
    object_type: 'TX_STOCK_REPURCHASE',
    id: data.id,
    date: data.date.split('T')[0],
    security_id: data.security_id,
    quantity: normalizeNumericString(quantityStr),
    price: damlMonetaryToNative(data.price),
    ...(data.balance_security_id ? { balance_security_id: data.balance_security_id } : {}),
    ...(data.consideration_text ? { consideration_text: data.consideration_text } : {}),
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };
  return { event, contractId: params.contractId };
}
