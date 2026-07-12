/** DAML to OCF converter for StockConsolidation. */

import type { OcfStockConsolidation } from '../../../types/native';
import { damlTimeToDateString, toNonEmptyStringArray } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData } from '../capTable/damlEntityData';

/** Exact generated DAML StockConsolidation payload. */
export type DamlStockConsolidationData = DamlDataTypeFor<'stockConsolidation'>;

/** Convert exact generated DAML StockConsolidation data to canonical OCF. */
export function damlStockConsolidationToNative(input: DamlStockConsolidationData): OcfStockConsolidation {
  const rootPath = 'stockConsolidation';
  const data = decodeDamlEntityData('stockConsolidation', input);
  const reasonText = data.reason_text ?? undefined;

  return {
    object_type: 'TX_STOCK_CONSOLIDATION',
    id: data.id,
    date: damlTimeToDateString(data.date, `${rootPath}.date`),
    security_ids: toNonEmptyStringArray(data.security_ids, `${rootPath}.security_ids`, { uniqueItems: true }),
    resulting_security_id: data.resulting_security_id,
    ...(reasonText !== undefined ? { reason_text: reasonText } : {}),
    ...(data.comments.length > 0 ? { comments: data.comments } : {}),
  };
}
