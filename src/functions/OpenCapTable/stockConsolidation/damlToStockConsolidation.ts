/**
 * DAML to OCF converter for StockConsolidation.
 */

import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfStockConsolidation } from '../../../types/native';
import { damlTimeToDateString, toNonEmptyArray } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';

/** DAML StockConsolidationOcfData structure */
export type DamlStockConsolidationData = DamlDataTypeFor<'stockConsolidation'>;

/**
 * Convert DAML StockConsolidation data to native OCF format.
 *
 * Converts DAML StockConsolidation data to canonical OCF format.
 */
export function damlStockConsolidationToNative(d: DamlStockConsolidationData): OcfStockConsolidation {
  if (new Set(d.security_ids).size !== d.security_ids.length) {
    throw new OcpValidationError('stockConsolidation.security_ids', 'Array items must be unique', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'array of unique security IDs',
      receivedValue: d.security_ids,
    });
  }

  return {
    object_type: 'TX_STOCK_CONSOLIDATION',
    id: d.id,
    date: damlTimeToDateString(d.date, 'stockConsolidation.date'),
    security_ids: toNonEmptyArray(d.security_ids, 'stockConsolidation.security_ids'),
    resulting_security_id: d.resulting_security_id,
    ...(d.reason_text ? { reason_text: d.reason_text } : {}),
    ...(d.comments.length ? { comments: d.comments } : {}),
  };
}
