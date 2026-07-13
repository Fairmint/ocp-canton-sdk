import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import type { OcfStockAcceptance } from '../../../types';
import type { GetByContractIdParams } from '../../../types/common';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import { readSingleContract } from '../shared/singleContractRead';

/**
 * OCF Stock Acceptance event with object_type discriminator.
 */
export interface OcfStockAcceptanceEvent extends OcfStockAcceptance {
  object_type: 'TX_STOCK_ACCEPTANCE';
}

export type GetStockAcceptanceAsOcfParams = GetByContractIdParams;

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

function hasStockAcceptanceData(arg: unknown): arg is StockAcceptanceCreateArgument {
  const record = arg as { acceptance_data?: unknown };
  return typeof record.acceptance_data === 'object' && record.acceptance_data !== null;
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
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStockAcceptanceAsOcf',
  });
  if (!hasStockAcceptanceData(createArgument)) {
    throw new OcpParseError('StockAcceptance data not found in contract create argument', {
      source: 'StockAcceptance.createArgument',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

  const contract = createArgument;
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
