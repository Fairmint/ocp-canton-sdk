/**
 * DAML to OCF converters for StockRetraction entities.
 */

import type { OcfStockRetraction } from '../../../types';
import { damlTimeToDateString } from '../../../utils/typeConversions';

/**
 * DAML StockRetraction data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlStockRetractionData {
  id: string;
  date: string;
  security_id: string;
  reason_text: string;
  comments: string[];
}

/**
 * Convert DAML StockRetraction data to native OCF format.
 *
 * @param d - The DAML stock retraction data object
 * @returns The native OCF StockRetraction object
 */
export function damlStockRetractionToNative(d: DamlStockRetractionData): OcfStockRetraction {
  return {
    id: d.id,
    date: damlTimeToDateString(d.date),
    security_id: d.security_id,
    reason_text: d.reason_text,
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
