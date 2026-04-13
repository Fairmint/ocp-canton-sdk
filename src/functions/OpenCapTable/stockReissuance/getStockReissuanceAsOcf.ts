import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { GetByContractIdParams } from '../../../types/common';
import { readSingleContract } from '../shared/singleContractRead';

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

export type GetStockReissuanceAsOcfParams = GetByContractIdParams;
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
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStockReissuanceAsOcf',
  });
  const contract = createArgument as StockReissuanceCreateArgument;
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
