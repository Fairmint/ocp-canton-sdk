import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockCancellation } from '../../../types/native';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlStockCancellationToNative } from './damlToOcf';

export type OcfStockCancellationEvent = OcfStockCancellation;

export type GetStockCancellationAsOcfParams = GetByContractIdParams;
export interface GetStockCancellationAsOcfResult {
  event: OcfStockCancellationEvent;
  contractId: string;
}

export async function getStockCancellationAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockCancellationAsOcfParams
): Promise<GetStockCancellationAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStockCancellationAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.stockCancellation,
  });
  const data = extractAndDecodeDamlEntityData('stockCancellation', createArgument);
  const event = damlStockCancellationToNative(data);
  return { event, contractId: params.contractId };
}
