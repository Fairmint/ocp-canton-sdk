import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes } from '../../../errors';
import type { OcfStockTransfer } from '../../../types/native';
import { normalizeNumericString } from '../../../utils/typeConversions';

/**
 * OCF Stock Transfer Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/transfer/StockTransfer.schema.json
 */
export interface OcfStockTransferEvent extends Omit<OcfStockTransfer, 'quantity'> {
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
  const contract = res.created.createdEvent.createArgument as StockTransferCreateArgument;
  const data = contract.transfer_data;

  // Convert quantity to string for normalization (DAML Numeric may come as number at runtime)
  const quantity = data.quantity as string | number;
  const quantityStr = typeof quantity === 'number' ? quantity.toString() : quantity;

  const event: OcfStockTransferEvent = {
    object_type: 'TX_STOCK_TRANSFER',
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
