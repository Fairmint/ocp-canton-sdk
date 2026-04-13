import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { GetByContractIdParams } from '../../../types/common';
import { readSingleContract } from '../shared/singleContractRead';

export interface OcfStockConsolidationEvent {
  object_type: 'TX_STOCK_CONSOLIDATION';
  id: string;
  date: string;
  security_ids: string[];
  resulting_security_id: string;
  reason_text?: string;
  comments?: string[];
}

export type GetStockConsolidationAsOcfParams = GetByContractIdParams;
export interface GetStockConsolidationAsOcfResult {
  event: OcfStockConsolidationEvent;
  contractId: string;
}

/** Type alias for DAML StockConsolidation contract createArgument */
type StockConsolidationCreateArgument = Fairmint.OpenCapTable.OCF.StockConsolidation.StockConsolidation;

export async function getStockConsolidationAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockConsolidationAsOcfParams
): Promise<GetStockConsolidationAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStockConsolidationAsOcf',
  });
  const contract = createArgument as StockConsolidationCreateArgument;
  const data = contract.consolidation_data;

  const event: OcfStockConsolidationEvent = {
    object_type: 'TX_STOCK_CONSOLIDATION',
    id: data.id,
    date: data.date.split('T')[0],
    security_ids: data.security_ids,
    resulting_security_id: data.resulting_security_id,
    ...(data.reason_text ? { reason_text: data.reason_text } : {}),
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };
  return { event, contractId: params.contractId };
}
