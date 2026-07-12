import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import { ENTITY_TEMPLATE_ID_MAP, type OcfReadDataTypeFor } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlStockConsolidationToNative } from './damlToStockConsolidation';

export type OcfStockConsolidationEvent = OcfReadDataTypeFor<'stockConsolidation'>;

export type GetStockConsolidationAsOcfParams = GetByContractIdParams;
export interface GetStockConsolidationAsOcfResult {
  readonly event: OcfStockConsolidationEvent;
  readonly contractId: string;
}

export async function getStockConsolidationAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockConsolidationAsOcfParams
): Promise<GetStockConsolidationAsOcfResult> {
  const { contractId, createArgument } = await readSingleContract(client, params, {
    operation: 'getStockConsolidationAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.stockConsolidation,
  });
  const data = extractAndDecodeDamlEntityData('stockConsolidation', createArgument);
  const event = damlStockConsolidationToNative(data);
  return Object.freeze({ event, contractId });
}
