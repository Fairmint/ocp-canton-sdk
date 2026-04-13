import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { GetByContractIdParams } from '../../../types/common';
import { normalizeNumericString } from '../../../utils/typeConversions';
import { readSingleContract } from '../shared/singleContractRead';

export interface OcfStockClassSplitEvent {
  object_type: 'TX_STOCK_CLASS_SPLIT';
  id: string;
  date: string;
  stock_class_id: string;
  split_ratio: { numerator: string; denominator: string };
  comments?: string[];
}

export type GetStockClassSplitAsOcfParams = GetByContractIdParams;
export interface GetStockClassSplitAsOcfResult {
  event: OcfStockClassSplitEvent;
  contractId: string;
}

/** Type alias for DAML StockClassSplit contract createArgument */
type StockClassSplitCreateArgument = Fairmint.OpenCapTable.OCF.StockClassSplit.StockClassSplit;

export async function getStockClassSplitAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockClassSplitAsOcfParams
): Promise<GetStockClassSplitAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStockClassSplitAsOcf',
  });
  const contract = createArgument as StockClassSplitCreateArgument;
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
    split_ratio: {
      numerator: normalizeNumericString(splitRatioNumeratorStr),
      denominator: normalizeNumericString(splitRatioDenominatorStr),
    },
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };
  return { event, contractId: params.contractId };
}
