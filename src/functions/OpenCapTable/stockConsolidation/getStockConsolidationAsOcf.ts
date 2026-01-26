import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes } from '../../../errors';

export interface OcfStockConsolidationEvent {
  object_type: 'TX_STOCK_CONSOLIDATION';
  id: string;
  date: string;
  security_ids: string[];
  resulting_security_ids: string[];
  reason_text?: string;
  comments?: string[];
}

export interface GetStockConsolidationAsOcfParams {
  contractId: string;
}
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
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created?.createdEvent.createArgument) {
    throw new OcpContractError('Missing createArgument', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }
  const contract = res.created.createdEvent.createArgument as StockConsolidationCreateArgument;
  const data = contract.consolidation_data;

  // DAML has resulting_security_id (singular), but OCF expects resulting_security_ids (array)
  // We wrap the single ID in an array to match OCF format
  const event: OcfStockConsolidationEvent = {
    object_type: 'TX_STOCK_CONSOLIDATION',
    id: data.id,
    date: data.date.split('T')[0],
    security_ids: data.security_ids,
    resulting_security_ids: [data.resulting_security_id],
    ...(data.reason_text ? { reason_text: data.reason_text } : {}),
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };
  return { event, contractId: params.contractId };
}
