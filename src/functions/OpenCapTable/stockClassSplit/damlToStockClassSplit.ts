/**
 * DAML to OCF converter for StockClassSplit.
 */

import type { OcfStockClassSplit } from '../../../types/native';
import { damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';

/** DAML StockClassSplitOcfData structure */
export type DamlStockClassSplitData = DamlDataTypeFor<'stockClassSplit'>;

/**
 * Convert DAML StockClassSplit data to native OCF format.
 *
 * Handles the nested OcfRatio structure and normalizes numeric strings.
 */
export function damlStockClassSplitToNative(d: DamlStockClassSplitData): OcfStockClassSplit {
  return {
    object_type: 'TX_STOCK_CLASS_SPLIT',
    id: d.id,
    date: damlTimeToDateString(d.date, 'stockClassSplit.date'),
    stock_class_id: d.stock_class_id,
    split_ratio: {
      numerator: normalizeNumericString(d.split_ratio.numerator),
      denominator: normalizeNumericString(d.split_ratio.denominator),
    },
    ...(d.comments.length ? { comments: d.comments } : {}),
  };
}
