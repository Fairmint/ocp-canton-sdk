import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { OcfStockRepurchase } from '../../../types/native';
import { damlMonetaryToNative, normalizeNumericString } from '../../../utils/typeConversions';

/**
 * OCF Stock Repurchase Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/repurchase/StockRepurchase.schema.json
 */
export interface OcfStockRepurchaseEvent extends Omit<OcfStockRepurchase, 'quantity'> {
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

/** Type alias for DAML StockRepurchase contract createArgument */
type StockRepurchaseCreateArgument = Fairmint.OpenCapTable.OCF.StockRepurchase.StockRepurchase;

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
  const contract = res.created.createdEvent.createArgument as StockRepurchaseCreateArgument;
  const data = contract.repurchase_data;

  // Convert quantity to string for normalization (DAML Numeric may come as number at runtime)
  const quantity = data.quantity as string | number;
  const quantityStr = typeof quantity === 'number' ? quantity.toString() : quantity;

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
