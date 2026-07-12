/**
 * DAML to OCF converter for StockClassSplit.
 */

import type { OcfStockClassSplit } from '../../../types/native';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData } from '../capTable/damlEntityData';
import { requireGeneratedDamlNumeric10 } from '../shared/generatedDamlValues';

/** DAML StockClassSplitOcfData structure */
export type DamlStockClassSplitData = DamlDataTypeFor<'stockClassSplit'>;

/**
 * Convert DAML StockClassSplit data to native OCF format.
 *
 * Handles the nested OcfRatio structure and normalizes numeric strings.
 */
export function damlStockClassSplitToNative(input: DamlStockClassSplitData): OcfStockClassSplit {
  const data = decodeDamlEntityData('stockClassSplit', input);
  return {
    object_type: 'TX_STOCK_CLASS_SPLIT',
    id: data.id,
    date: damlTimeToDateString(data.date, 'stockClassSplit.date'),
    stock_class_id: data.stock_class_id,
    split_ratio: {
      numerator: requireGeneratedDamlNumeric10(data.split_ratio.numerator, 'stockClassSplit.split_ratio.numerator'),
      denominator: requireGeneratedDamlNumeric10(
        data.split_ratio.denominator,
        'stockClassSplit.split_ratio.denominator'
      ),
    },
    ...(data.comments.length > 0 ? { comments: data.comments } : {}),
  };
}
