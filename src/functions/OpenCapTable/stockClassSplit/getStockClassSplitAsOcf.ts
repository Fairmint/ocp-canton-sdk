import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockClassSplit } from '../../../types/native';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlStockClassSplitToNative } from './damlToStockClassSplit';

export type OcfStockClassSplitEvent = OcfStockClassSplit;

export type GetStockClassSplitAsOcfParams = GetByContractIdParams;
export interface GetStockClassSplitAsOcfResult {
  event: OcfStockClassSplitEvent;
  contractId: string;
}

export async function getStockClassSplitAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockClassSplitAsOcfParams
): Promise<GetStockClassSplitAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStockClassSplitAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.stockClassSplit,
  });
  const data = extractAndDecodeDamlEntityData('stockClassSplit', createArgument);
  const event = damlStockClassSplitToNative(data);
  return { event, contractId: params.contractId };
}
