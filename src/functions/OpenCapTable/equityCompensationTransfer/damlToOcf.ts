/**
 * DAML to OCF converters for EquityCompensationTransfer entities.
 */

import type { OcfEquityCompensationTransfer } from '../../../types';
import { type DamlQuantityTransferData, quantityTransferToNative } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData } from '../capTable/damlEntityData';
import { parseDamlNumeric10 } from '../shared/damlNumerics';

/**
 * DAML EquityCompensationTransfer data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlEquityCompensationTransferData = DamlDataTypeFor<'equityCompensationTransfer'>;

/**
 * Convert DAML EquityCompensationTransfer data to native OCF format.
 *
 * @param d - The DAML equity compensation transfer data object
 * @returns The native OCF EquityCompensationTransfer object
 */
export function damlEquityCompensationTransferToNative(
  d: DamlEquityCompensationTransferData
): OcfEquityCompensationTransfer {
  const decoded = decodeDamlEntityData('equityCompensationTransfer', d);
  return {
    ...quantityTransferToNative(
      {
        ...decoded,
        quantity: parseDamlNumeric10(decoded.quantity, 'equityCompensationTransfer.quantity'),
      } satisfies DamlQuantityTransferData,
      'equityCompensationTransfer.date'
    ),
    object_type: 'TX_EQUITY_COMPENSATION_TRANSFER',
  };
}
