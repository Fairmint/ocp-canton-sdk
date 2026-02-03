/**
 * DAML to OCF converters for WarrantCancellation entities.
 */

import type { OcfWarrantCancellation } from '../../../types';
import { type DamlQuantityCancellationData, quantityCancellationToNative } from '../../../utils/typeConversions';

/**
 * DAML WarrantCancellation data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlWarrantCancellationData = DamlQuantityCancellationData;

/**
 * Convert DAML WarrantCancellation data to native OCF format.
 *
 * @param d - The DAML warrant cancellation data object
 * @returns The native OCF WarrantCancellation object
 */
export function damlWarrantCancellationToNative(d: DamlWarrantCancellationData): OcfWarrantCancellation {
  return quantityCancellationToNative(d) as OcfWarrantCancellation;
}
