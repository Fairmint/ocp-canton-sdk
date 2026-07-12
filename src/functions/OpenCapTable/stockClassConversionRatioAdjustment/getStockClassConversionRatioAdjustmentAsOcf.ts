import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import { ENTITY_TEMPLATE_ID_MAP, type OcfReadDataTypeFor } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlStockClassConversionRatioAdjustmentToNative } from './damlToStockClassConversionRatioAdjustment';

export type OcfStockClassConversionRatioAdjustmentEvent = OcfReadDataTypeFor<'stockClassConversionRatioAdjustment'>;

export type GetStockClassConversionRatioAdjustmentAsOcfParams = GetByContractIdParams;
export interface GetStockClassConversionRatioAdjustmentAsOcfResult {
  readonly event: OcfStockClassConversionRatioAdjustmentEvent;
  readonly contractId: string;
}

export async function getStockClassConversionRatioAdjustmentAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockClassConversionRatioAdjustmentAsOcfParams
): Promise<GetStockClassConversionRatioAdjustmentAsOcfResult> {
  const { contractId, createArgument } = await readSingleContract(client, params, {
    operation: 'getStockClassConversionRatioAdjustmentAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.stockClassConversionRatioAdjustment,
  });
  const data = extractAndDecodeDamlEntityData('stockClassConversionRatioAdjustment', createArgument);
  const event = damlStockClassConversionRatioAdjustmentToNative(data);
  return Object.freeze({ event, contractId });
}
