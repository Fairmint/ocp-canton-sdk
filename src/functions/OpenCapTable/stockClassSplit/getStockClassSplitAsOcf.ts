import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import { ENTITY_TEMPLATE_ID_MAP, type OcfReadDataTypeFor } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlStockClassSplitToNative } from './damlToStockClassSplit';

export type OcfStockClassSplitEvent = OcfReadDataTypeFor<'stockClassSplit'>;

export type GetStockClassSplitAsOcfParams = GetByContractIdParams;
export interface GetStockClassSplitAsOcfResult {
  readonly event: OcfStockClassSplitEvent;
  readonly contractId: string;
}

export async function getStockClassSplitAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockClassSplitAsOcfParams
): Promise<GetStockClassSplitAsOcfResult> {
  const { contractId, createArgument } = await readSingleContract(client, params, {
    operation: 'getStockClassSplitAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.stockClassSplit,
  });
  const data = extractAndDecodeDamlEntityData('stockClassSplit', createArgument);
  const event = damlStockClassSplitToNative(data);
  return Object.freeze({ event, contractId });
}
