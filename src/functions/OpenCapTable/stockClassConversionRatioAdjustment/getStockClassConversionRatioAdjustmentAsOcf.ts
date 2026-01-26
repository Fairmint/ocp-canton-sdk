import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes } from '../../../errors';
import { normalizeNumericString } from '../../../utils/typeConversions';

export interface OcfStockClassConversionRatioAdjustmentEvent {
  object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT';
  id: string;
  date: string;
  stock_class_id: string;
  new_ratio_numerator: string;
  new_ratio_denominator: string;
  comments?: string[];
}

export interface GetStockClassConversionRatioAdjustmentAsOcfParams {
  contractId: string;
}
export interface GetStockClassConversionRatioAdjustmentAsOcfResult {
  event: OcfStockClassConversionRatioAdjustmentEvent;
  contractId: string;
}

/** Type alias for DAML StockClassConversionRatioAdjustment contract createArgument */
type StockClassConversionRatioAdjustmentCreateArgument =
  Fairmint.OpenCapTable.OCF.StockClassConversionRatioAdjustment.StockClassConversionRatioAdjustment;

export async function getStockClassConversionRatioAdjustmentAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockClassConversionRatioAdjustmentAsOcfParams
): Promise<GetStockClassConversionRatioAdjustmentAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created?.createdEvent.createArgument) {
    throw new OcpContractError('Missing createArgument', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }
  const contract = res.created.createdEvent.createArgument as StockClassConversionRatioAdjustmentCreateArgument;
  const data = contract.adjustment_data;

  // Extract numerator and denominator from new_ratio_conversion_mechanism.ratio (OcfRatio type)
  const newRatioNumerator = data.new_ratio_conversion_mechanism.ratio.numerator as string | number;
  const newRatioNumeratorStr = typeof newRatioNumerator === 'number' ? newRatioNumerator.toString() : newRatioNumerator;

  const newRatioDenominator = data.new_ratio_conversion_mechanism.ratio.denominator as string | number;
  const newRatioDenominatorStr =
    typeof newRatioDenominator === 'number' ? newRatioDenominator.toString() : newRatioDenominator;

  const event: OcfStockClassConversionRatioAdjustmentEvent = {
    object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
    id: data.id,
    date: data.date.split('T')[0],
    stock_class_id: data.stock_class_id,
    new_ratio_numerator: normalizeNumericString(newRatioNumeratorStr),
    new_ratio_denominator: normalizeNumericString(newRatioDenominatorStr),
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };
  return { event, contractId: params.contractId };
}
