/**
 * DAML to OCF converters for StockConversion entities.
 */

import type { OcfStockConversion } from '../../../types';
import { damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';

/**
 * DAML StockConversion data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlStockConversionData {
  id: string;
  date: string;
  security_id: string;
  quantity: string;
  resulting_security_ids: string[];
  balance_security_id?: string | null;
  comments: string[];
}

/**
 * Convert DAML StockConversion data to native OCF format.
 *
 * @param d - The DAML stock conversion data object
 * @returns The native OCF StockConversion object
 */
export function damlStockConversionToNative(d: DamlStockConversionData): OcfStockConversion {
  return {
    id: d.id,
    date: damlTimeToDateString(d.date),
    security_id: d.security_id,
    quantity: normalizeNumericString(d.quantity),
    resulting_security_ids: d.resulting_security_ids,
    ...(d.balance_security_id && { balance_security_id: d.balance_security_id }),
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
