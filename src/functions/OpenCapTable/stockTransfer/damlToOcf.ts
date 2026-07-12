/**
 * DAML to OCF converters for StockTransfer entities.
 */

import type { OcfStockTransfer } from '../../../types';
import { type DamlQuantityTransferData, quantityTransferToNative } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData } from '../capTable/damlEntityData';
import { parseDamlNumeric10 } from '../shared/damlNumerics';

/**
 * DAML StockTransfer data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlStockTransferData = DamlDataTypeFor<'stockTransfer'>;

/**
 * Convert DAML StockTransfer data to native OCF format.
 *
 * @param d - The DAML stock transfer data object
 * @returns The native OCF StockTransfer object
 */
export function damlStockTransferToNative(d: DamlStockTransferData): OcfStockTransfer {
  const decoded = decodeDamlEntityData('stockTransfer', d);
  return {
    ...quantityTransferToNative(
      {
        ...decoded,
        quantity: parseDamlNumeric10(decoded.quantity, 'stockTransfer.quantity'),
      } satisfies DamlQuantityTransferData,
      'stockTransfer.date'
    ),
    object_type: 'TX_STOCK_TRANSFER',
  };
}
