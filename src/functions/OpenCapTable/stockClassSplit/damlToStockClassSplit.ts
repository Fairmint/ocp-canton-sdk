/**
 * DAML to OCF converter for StockClassSplit.
 */

import type { OcfStockClassSplit } from '../../../types/native';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor, OcfReadDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData } from '../capTable/damlEntityData';
import { requireGeneratedDamlNumeric10 } from '../shared/generatedDamlValues';
import {
  freezeStockCorporateActionEvent,
  requireStockCorporateActionComments,
  requireStockCorporateActionText,
} from '../shared/stockCorporateActionValues';

/** DAML StockClassSplitOcfData structure */
export type DamlStockClassSplitData = DamlDataTypeFor<'stockClassSplit'>;

/**
 * Convert DAML StockClassSplit data to native OCF format.
 *
 * Handles the nested OcfRatio structure and normalizes numeric strings.
 */
export function damlStockClassSplitToNative(input: DamlStockClassSplitData): OcfReadDataTypeFor<'stockClassSplit'> {
  const data = decodeDamlEntityData('stockClassSplit', input);
  const comments = requireStockCorporateActionComments(data.comments, 'stockClassSplit.comments');
  const event: OcfStockClassSplit = {
    object_type: 'TX_STOCK_CLASS_SPLIT',
    id: requireStockCorporateActionText(data.id, 'stockClassSplit.id'),
    date: damlTimeToDateString(data.date, 'stockClassSplit.date'),
    stock_class_id: requireStockCorporateActionText(data.stock_class_id, 'stockClassSplit.stock_class_id'),
    split_ratio: {
      numerator: requireGeneratedDamlNumeric10(
        data.split_ratio.numerator,
        'stockClassSplit.split_ratio.numerator',
        'positive'
      ),
      denominator: requireGeneratedDamlNumeric10(
        data.split_ratio.denominator,
        'stockClassSplit.split_ratio.denominator',
        'positive'
      ),
    },
    ...(comments.length > 0 ? { comments } : {}),
  };
  return freezeStockCorporateActionEvent(event);
}
