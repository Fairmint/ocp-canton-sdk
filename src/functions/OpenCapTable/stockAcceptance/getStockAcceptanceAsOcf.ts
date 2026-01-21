import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { OcfStockAcceptance } from '../../../types';
import { damlTimeToDateString } from '../../../utils/typeConversions';

/**
 * OCF Stock Acceptance event with object_type discriminator.
 */
export interface OcfStockAcceptanceEvent extends OcfStockAcceptance {
  object_type: 'TX_STOCK_ACCEPTANCE';
}

export interface GetStockAcceptanceAsOcfParams {
  contractId: string;
}

export interface GetStockAcceptanceAsOcfResult {
  event: OcfStockAcceptanceEvent;
  contractId: string;
}

/**
 * DAML StockAcceptance contract createArgument structure.
 */
interface StockAcceptanceCreateArgument {
  acceptance_data: {
    id: string;
    date: string;
    security_id: string;
    comments: string[];
  };
}

/**
 * Retrieve a Stock Acceptance contract and convert to OCF format.
 *
 * @param client - The LedgerJsonApiClient instance
 * @param params - Parameters containing the contractId
 * @returns The OCF-formatted stock acceptance event
 */
export async function getStockAcceptanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockAcceptanceAsOcfParams
): Promise<GetStockAcceptanceAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created) {
    throw new Error('Missing created event');
  }
  if (!res.created.createdEvent.createArgument) {
    throw new Error('Missing createArgument');
  }

  const contract = res.created.createdEvent.createArgument as StockAcceptanceCreateArgument;
  const data = contract.acceptance_data;

  const event: OcfStockAcceptanceEvent = {
    object_type: 'TX_STOCK_ACCEPTANCE',
    id: data.id,
    date: damlTimeToDateString(data.date),
    security_id: data.security_id,
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };

  return { event, contractId: params.contractId };
}
