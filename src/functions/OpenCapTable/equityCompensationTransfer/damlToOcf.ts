/**
 * DAML to OCF converters for EquityCompensationTransfer entities.
 */

import type { OcfEquityCompensationTransfer } from '../../../types';
import { type DamlQuantityTransferData, quantityTransferToNative } from '../../../utils/typeConversions';

/**
 * DAML EquityCompensationTransfer data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlEquityCompensationTransferData = DamlQuantityTransferData;

/**
 * Convert DAML EquityCompensationTransfer data to native OCF format.
 *
 * @param d - The DAML equity compensation transfer data object
 * @returns The native OCF EquityCompensationTransfer object
 */
export function damlEquityCompensationTransferToNative(
  d: DamlEquityCompensationTransferData
): OcfEquityCompensationTransfer {
  return quantityTransferToNative(d) as OcfEquityCompensationTransfer;
}
