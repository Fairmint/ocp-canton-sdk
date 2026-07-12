/**
 * DAML to OCF converters for WarrantTransfer entities.
 */

import type { OcfWarrantTransfer } from '../../../types';
import { type DamlQuantityTransferData, quantityTransferToNative } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData } from '../capTable/damlEntityData';
import { parseDamlNumeric10 } from '../shared/damlNumerics';

/**
 * DAML WarrantTransfer data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlWarrantTransferData = DamlDataTypeFor<'warrantTransfer'>;

/**
 * Convert DAML WarrantTransfer data to native OCF format.
 *
 * @param d - The DAML warrant transfer data object
 * @returns The native OCF WarrantTransfer object
 */
export function damlWarrantTransferToNative(d: DamlWarrantTransferData): OcfWarrantTransfer {
  const decoded = decodeDamlEntityData('warrantTransfer', d);
  return {
    ...quantityTransferToNative(
      {
        ...decoded,
        quantity: parseDamlNumeric10(decoded.quantity, 'warrantTransfer.quantity'),
      } satisfies DamlQuantityTransferData,
      'warrantTransfer.date'
    ),
    object_type: 'TX_WARRANT_TRANSFER',
  };
}
