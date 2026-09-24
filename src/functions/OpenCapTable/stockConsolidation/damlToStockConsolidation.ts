/**
 * DAML to OCF converter for StockConsolidation.
 */

import type { OcfStockConsolidation } from '../../../types/native';
import { damlTimeToDateString } from '../../../utils/typeConversions';

/** DAML StockConsolidationOcfData structure */
export interface DamlStockConsolidationData {
  id: string;
  date: string;
  security_ids: string[];
  resulting_security_id: string; // DAML has singular
  reason_text: string | null;
  comments: string[];
}

/**
 * Convert DAML StockConsolidation data to native OCF format.
 *
 * Converts DAML StockConsolidation data to canonical OCF format.
 */
export function damlStockConsolidationToNative(d: DamlStockConsolidationData): OcfStockConsolidation {
  return {
    object_type: 'TX_STOCK_CONSOLIDATION',
    id: d.id,
    date: damlTimeToDateString(d.date, 'stockConsolidation.date'),
    security_ids: d.security_ids,
    resulting_security_id: d.resulting_security_id,
    ...(d.reason_text ? { reason_text: d.reason_text } : {}),
    ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments } : {}),
  };
}
