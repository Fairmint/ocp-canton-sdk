import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { GetByContractIdParams } from '../../../types/common';
import { decodeGeneratedDaml, extractGeneratedCreateArgumentData } from '../../../utils/generatedDamlValidation';
import { readSingleContract } from '../shared/singleContractRead';
import { damlStockClassConversionRatioAdjustmentToNative } from './damlToStockClassConversionRatioAdjustment';

export interface OcfStockClassConversionRatioAdjustmentEvent {
  object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT';
  id: string;
  date: string;
  stock_class_id: string;
  new_ratio_conversion_mechanism: {
    type: 'RATIO_CONVERSION';
    conversion_price: { amount: string; currency: string };
    ratio: { numerator: string; denominator: string };
    rounding_type: 'NORMAL' | 'CEILING' | 'FLOOR';
  };
  comments?: string[];
}

export type GetStockClassConversionRatioAdjustmentAsOcfParams = GetByContractIdParams;
export interface GetStockClassConversionRatioAdjustmentAsOcfResult {
  event: OcfStockClassConversionRatioAdjustmentEvent;
  contractId: string;
}

/** Type alias for DAML StockClassConversionRatioAdjustment contract createArgument */
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
    expectedTemplateId:
      Fairmint.OpenCapTable.OCF.StockClassConversionRatioAdjustment.StockClassConversionRatioAdjustment.templateId,
  });
  const argumentPath = 'StockClassConversionRatioAdjustment.createArgument';
  const data = extractGeneratedCreateArgumentData(createArgument, argumentPath, {
    dataField: 'adjustment_data',
  });
  const event: OcfStockClassConversionRatioAdjustmentEvent = damlStockClassConversionRatioAdjustmentToNative(
    data as StockClassConversionRatioAdjustmentCreateArgument['adjustment_data']
  );
  decodeStockClassConversionRatioAdjustmentCreateArgument(createArgument, argumentPath);
  return { event, contractId: params.contractId };
}
