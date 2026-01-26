import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes } from '../../../errors';
import { normalizeNumericString } from '../../../utils/typeConversions';

export interface OcfStockCancellationEvent {
  object_type: 'TX_STOCK_CANCELLATION';
  id: string;
  date: string;
  security_id: string;
  quantity: string;
  balance_security_id?: string;
  reason_text: string;
  comments?: string[];
}

export interface GetStockCancellationAsOcfParams {
  contractId: string;
}
export interface GetStockCancellationAsOcfResult {
  event: OcfStockCancellationEvent;
  contractId: string;
}

/** Type alias for DAML StockCancellation contract createArgument */
type StockCancellationCreateArgument = Fairmint.OpenCapTable.OCF.StockCancellation.StockCancellation;

export async function getStockCancellationAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockCancellationAsOcfParams
): Promise<GetStockCancellationAsOcfResult> {
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
  const contract = res.created.createdEvent.createArgument as StockCancellationCreateArgument;
  const data = contract.cancellation_data;

  // Convert quantity to string for normalization (DAML Numeric may come as number at runtime)
  const quantity = data.quantity as string | number;
  const quantityStr = typeof quantity === 'number' ? quantity.toString() : quantity;

  const event: OcfStockCancellationEvent = {
    object_type: 'TX_STOCK_CANCELLATION',
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
