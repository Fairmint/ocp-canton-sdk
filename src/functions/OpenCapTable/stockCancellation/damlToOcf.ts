/**
 * DAML to OCF converters for StockCancellation entities.
 */

import type { OcfStockCancellation } from '../../../types';
import type { PkgStockCancellationOcfData } from '../../../types/daml';
import { quantityCancellationValuesFromDaml } from '../shared/cancellationValues';

/**
 * DAML StockCancellation data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlStockCancellationData = PkgStockCancellationOcfData;

/**
 * Convert DAML StockCancellation data to native OCF format.
 *
 * @param d - The DAML stock cancellation data object
 * @returns The native OCF StockCancellation object
 */
export function damlStockCancellationToNative(d: DamlStockCancellationData): OcfStockCancellation {
  return {
    ...quantityCancellationValuesFromDaml(d, 'stockCancellation'),
    object_type: 'TX_STOCK_CANCELLATION',
  };
}
