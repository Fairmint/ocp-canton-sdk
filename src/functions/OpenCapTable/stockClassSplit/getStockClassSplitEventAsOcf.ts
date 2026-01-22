import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes } from '../../../errors';
import { normalizeNumericString } from '../../../utils/typeConversions';

export interface OcfStockClassSplitEvent {
  object_type: 'TX_STOCK_CLASS_SPLIT';
  id: string;
  date: string;
  stock_class_id: string;
  split_ratio_numerator: string;
  split_ratio_denominator: string;
  comments?: string[];
}

export interface GetStockClassSplitEventAsOcfParams {
  contractId: string;
}
export interface GetStockClassSplitEventAsOcfResult {
  event: OcfStockClassSplitEvent;
  contractId: string;
}

/** Type alias for DAML StockClassSplit contract createArgument */
type StockClassSplitCreateArgument = Fairmint.OpenCapTable.OCF.StockClassSplit.StockClassSplit;

export async function getStockClassSplitEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockClassSplitEventAsOcfParams
): Promise<GetStockClassSplitEventAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created?.createdEvent.createArgument) {
    throw new OcpContractError('Missing createArgument', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }
  const contract = res.created.createdEvent.createArgument as StockClassSplitCreateArgument;
  const data = contract.split_data;

  // Extract numerator and denominator from the split_ratio (OcfRatio type)
  const splitRatioNumerator = data.split_ratio.numerator as string | number;
  const splitRatioNumeratorStr =
    typeof splitRatioNumerator === 'number' ? splitRatioNumerator.toString() : splitRatioNumerator;

  const splitRatioDenominator = data.split_ratio.denominator as string | number;
  const splitRatioDenominatorStr =
    typeof splitRatioDenominator === 'number' ? splitRatioDenominator.toString() : splitRatioDenominator;

  const event: OcfStockClassSplitEvent = {
    object_type: 'TX_STOCK_CLASS_SPLIT',
    id: data.id,
    date: data.date.split('T')[0],
    stock_class_id: data.stock_class_id,
    split_ratio_numerator: normalizeNumericString(splitRatioNumeratorStr),
    split_ratio_denominator: normalizeNumericString(splitRatioDenominatorStr),
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };
  return { event, contractId: params.contractId };
}
