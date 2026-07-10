import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockReissuance } from '../../../types/native';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlStockReissuanceToNative } from './damlToStockReissuance';

export type OcfStockReissuanceEvent = OcfStockReissuance;

export type GetStockReissuanceAsOcfParams = GetByContractIdParams;
export interface GetStockReissuanceAsOcfResult {
  event: OcfStockReissuanceEvent;
  contractId: string;
}

export async function getStockReissuanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockReissuanceAsOcfParams
): Promise<GetStockReissuanceAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStockReissuanceAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.stockReissuance,
  });
  const data = extractAndDecodeDamlEntityData('stockReissuance', createArgument);
  const event = damlStockReissuanceToNative(data);
  return { event, contractId: params.contractId };
}
