import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import { ENTITY_TEMPLATE_ID_MAP, type OcfReadDataTypeFor } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlStockReissuanceToNative } from './damlToStockReissuance';

export type OcfStockReissuanceEvent = OcfReadDataTypeFor<'stockReissuance'>;

export type GetStockReissuanceAsOcfParams = GetByContractIdParams;
export interface GetStockReissuanceAsOcfResult {
  readonly event: OcfStockReissuanceEvent;
  readonly contractId: string;
}

export async function getStockReissuanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockReissuanceAsOcfParams
): Promise<GetStockReissuanceAsOcfResult> {
  const { contractId, createArgument } = await readSingleContract(client, params, {
    operation: 'getStockReissuanceAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.stockReissuance,
  });
  const data = extractAndDecodeDamlEntityData('stockReissuance', createArgument);
  const event = damlStockReissuanceToNative(data);
  return Object.freeze({ event, contractId });
}
