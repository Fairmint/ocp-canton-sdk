import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockClassConversionRatioAdjustment } from '../../../types/native';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlStockClassConversionRatioAdjustmentToNative } from './damlToStockClassConversionRatioAdjustment';

export type OcfStockClassConversionRatioAdjustmentEvent = OcfStockClassConversionRatioAdjustment;

export type GetStockClassConversionRatioAdjustmentAsOcfParams = GetByContractIdParams;
export interface GetStockClassConversionRatioAdjustmentAsOcfResult {
  event: OcfStockClassConversionRatioAdjustmentEvent;
  contractId: string;
}

export async function getStockClassConversionRatioAdjustmentAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockClassConversionRatioAdjustmentAsOcfParams
): Promise<GetStockClassConversionRatioAdjustmentAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStockClassConversionRatioAdjustmentAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.stockClassConversionRatioAdjustment,
  });
  const data = extractAndDecodeDamlEntityData('stockClassConversionRatioAdjustment', createArgument);
  const event = damlStockClassConversionRatioAdjustmentToNative(data);
  return { event, contractId: params.contractId };
}
