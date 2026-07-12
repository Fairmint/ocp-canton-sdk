import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockClassConversionRatioAdjustment } from '../../../types/native';
import { decodeGeneratedDaml, extractGeneratedCreateArgumentData } from '../../../utils/generatedDamlValidation';
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

/** Type alias for the exact generated contract create argument. */
type StockClassConversionRatioAdjustmentCreateArgument =
  Fairmint.OpenCapTable.OCF.StockClassConversionRatioAdjustment.StockClassConversionRatioAdjustment;

/** Validate the complete generated template wrapper before exposing its adjustment data. */
export function decodeStockClassConversionRatioAdjustmentCreateArgument(
  createArgument: unknown,
  source: string
): StockClassConversionRatioAdjustmentCreateArgument {
  extractGeneratedCreateArgumentData(createArgument, source, { dataField: 'adjustment_data' });
  const template = Fairmint.OpenCapTable.OCF.StockClassConversionRatioAdjustment.StockClassConversionRatioAdjustment;
  return decodeGeneratedDaml(
    createArgument,
    {
      decode: (value) => template.decoder.runWithException(value),
      encode: (value) => template.encode(value),
    },
    source,
    {
      classification: 'invalid_generated_create_argument',
      context: { expectedTemplateId: template.templateId },
    }
  );
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
  decodeStockClassConversionRatioAdjustmentCreateArgument(
    createArgument,
    'StockClassConversionRatioAdjustment.createArgument'
  );
  return { event, contractId: params.contractId };
}
