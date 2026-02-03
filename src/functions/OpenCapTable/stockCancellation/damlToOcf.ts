/**
 * DAML to OCF converters for StockCancellation entities.
 */

import type { OcfStockCancellation } from '../../../types';
import { quantityCancellationToNative, type DamlQuantityCancellationData } from '../../../utils/typeConversions';

/**
 * DAML StockCancellation data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlStockCancellationData = DamlQuantityCancellationData;

/**
 * Convert DAML StockCancellation data to native OCF format.
 *
 * @param d - The DAML stock cancellation data object
 * @returns The native OCF StockCancellation object
 */
export function damlStockCancellationToNative(d: DamlStockCancellationData): OcfStockCancellation {
  return quantityCancellationToNative(d) as OcfStockCancellation;
}
