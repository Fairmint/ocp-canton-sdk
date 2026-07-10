import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockConsolidation } from '../../../types/native';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlStockConsolidationToNative } from './damlToStockConsolidation';

export type OcfStockConsolidationEvent = OcfStockConsolidation;

export type GetStockConsolidationAsOcfParams = GetByContractIdParams;
export interface GetStockConsolidationAsOcfResult {
  event: OcfStockConsolidationEvent;
  contractId: string;
}

export async function getStockConsolidationAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockConsolidationAsOcfParams
): Promise<GetStockConsolidationAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStockConsolidationAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.stockConsolidation,
  });
  const data = extractAndDecodeDamlEntityData('stockConsolidation', createArgument);
  const event = damlStockConsolidationToNative(data);
  return { event, contractId: params.contractId };
}
