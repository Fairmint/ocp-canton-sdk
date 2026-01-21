/**
 * DAML to OCF converter for StockClassSplit.
 */

import type { OcfStockClassSplit } from '../../../types/native';
import { normalizeNumericString } from '../../../utils/typeConversions';

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
    id: d.id,
    date: d.date.split('T')[0],
    stock_class_id: d.stock_class_id,
    split_ratio_numerator: normalizeNumericString(numeratorStr),
    split_ratio_denominator: normalizeNumericString(denominatorStr),
    ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments } : {}),
  };
}
