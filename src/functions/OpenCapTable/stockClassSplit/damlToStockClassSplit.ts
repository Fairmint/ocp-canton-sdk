/**
 * DAML to OCF converter for StockClassSplit.
 */

import type { OcfStockClassSplit } from '../../../types/native';
import { damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';

/** DAML StockClassSplitOcfData structure */
export interface DamlStockClassSplitData {
  id: string;
  date: string;
  stock_class_id: string;
  split_ratio: {
    numerator: string | number;
    denominator: string | number;
  };
  comments: string[];
}

/**
 * Convert DAML StockClassSplit data to native OCF format.
 *
 * Handles the nested OcfRatio structure and normalizes numeric strings.
 */
export function damlStockClassSplitToNative(d: DamlStockClassSplitData): OcfStockClassSplit {
  const numeratorStr =
    typeof d.split_ratio.numerator === 'number' ? d.split_ratio.numerator.toString() : d.split_ratio.numerator;
  const denominatorStr =
    typeof d.split_ratio.denominator === 'number' ? d.split_ratio.denominator.toString() : d.split_ratio.denominator;

  return {
    object_type: 'TX_STOCK_CLASS_SPLIT',
    id: d.id,
    date: damlTimeToDateString(d.date, 'stockClassSplit.date'),
    stock_class_id: d.stock_class_id,
    split_ratio: {
      numerator: normalizeNumericString(numeratorStr),
      denominator: normalizeNumericString(denominatorStr),
    },
    ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments } : {}),
  };
}
