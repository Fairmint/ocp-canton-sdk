import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockConsolidation } from '../../../types/native';
import { readSingleContract } from '../shared/singleContractRead';
import { damlStockConsolidationToNative } from './damlToStockConsolidation';

export type OcfStockConsolidationEvent = OcfStockConsolidation;

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
  const event = damlStockConsolidationToNative(contract.consolidation_data);
  return { event, contractId: params.contractId };
}
