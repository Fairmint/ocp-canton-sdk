/**
 * DAML to OCF converters for StockTransfer entities.
 */

import type { OcfStockTransfer } from '../../../types';
import { type DamlQuantityTransferData, quantityTransferToNative } from '../../../utils/typeConversions';

/**
 * DAML StockTransfer data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlStockTransferData = DamlQuantityTransferData;

/**
 * Convert DAML StockTransfer data to native OCF format.
 *
 * @param d - The DAML stock transfer data object
 * @returns The native OCF StockTransfer object
 */
export function damlStockTransferToNative(d: DamlStockTransferData): OcfStockTransfer {
  return quantityTransferToNative(d) as OcfStockTransfer;
}
