/**
 * DAML to OCF converters for WarrantTransfer entities.
 */

import type { OcfWarrantTransfer } from '../../../types';
import { quantityTransferToNative, type DamlQuantityTransferData } from '../../../utils/typeConversions';

/**
 * DAML WarrantTransfer data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlWarrantTransferData = DamlQuantityTransferData;

/**
 * Convert DAML WarrantTransfer data to native OCF format.
 *
 * @param d - The DAML warrant transfer data object
 * @returns The native OCF WarrantTransfer object
 */
export function damlWarrantTransferToNative(d: DamlWarrantTransferData): OcfWarrantTransfer {
  return quantityTransferToNative(d) as OcfWarrantTransfer;
}
