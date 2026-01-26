import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes } from '../../../errors';

export interface OcfStockReissuanceEvent {
  object_type: 'TX_STOCK_REISSUANCE';
  id: string;
  date: string;
  security_id: string;
  resulting_security_ids: string[];
  reason_text?: string;
  split_transaction_id?: string;
  comments?: string[];
}

export interface GetStockReissuanceAsOcfParams {
  contractId: string;
}
export interface GetStockReissuanceAsOcfResult {
  event: OcfStockReissuanceEvent;
  contractId: string;
}

/** Type alias for DAML StockReissuance contract createArgument */
type StockReissuanceCreateArgument = Fairmint.OpenCapTable.OCF.StockReissuance.StockReissuance;

export async function getStockReissuanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockReissuanceAsOcfParams
): Promise<GetStockReissuanceAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created?.createdEvent.createArgument) {
    throw new OcpContractError('Missing createArgument', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }
  const contract = res.created.createdEvent.createArgument as StockReissuanceCreateArgument;
  const data = contract.reissuance_data;

  const event: OcfStockReissuanceEvent = {
    object_type: 'TX_STOCK_REISSUANCE',
    id: data.id,
    date: data.date.split('T')[0],
    security_id: data.security_id,
    resulting_security_ids: data.resulting_security_ids,
    ...(data.reason_text ? { reason_text: data.reason_text } : {}),
    ...(data.split_transaction_id ? { split_transaction_id: data.split_transaction_id } : {}),
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };
  return { event, contractId: params.contractId };
}
