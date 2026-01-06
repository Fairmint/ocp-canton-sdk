import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
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

/** Type alias for DAML StockTransfer contract createArgument */
type StockTransferCreateArgument = Fairmint.OpenCapTable.OCF.StockTransfer.StockTransfer;

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
  const contract = res.created.createdEvent.createArgument as StockTransferCreateArgument;
  const data = contract.transfer_data;

  const event: OcfStockTransferEvent = {
    object_type: 'TX_STOCK_TRANSFER',
    id: data.id,
    date: data.date.split('T')[0],
    security_id: data.security_id,
    quantity: normalizeNumericString(data.quantity),
    resulting_security_ids: data.resulting_security_ids,
    ...(data.balance_security_id ? { balance_security_id: data.balance_security_id } : {}),
    ...(data.consideration_text ? { consideration_text: data.consideration_text } : {}),
    ...(data.comments.length ? { comments: data.comments } : {}),
  };
  return { event, contractId: params.contractId };
}
