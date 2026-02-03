/**
 * DAML to OCF converters for EquityCompensationCancellation entities.
 */

import type { OcfEquityCompensationCancellation } from '../../../types';
import { quantityCancellationToNative, type DamlQuantityCancellationData } from '../../../utils/typeConversions';

/**
 * DAML EquityCompensationCancellation data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlEquityCompensationCancellationData = DamlQuantityCancellationData;

/**
 * Convert DAML EquityCompensationCancellation data to native OCF format.
 *
 * @param d - The DAML equity compensation cancellation data object
 * @returns The native OCF EquityCompensationCancellation object
 */
export function damlEquityCompensationCancellationToNative(
  d: DamlEquityCompensationCancellationData
): OcfEquityCompensationCancellation {
  return quantityCancellationToNative(d) as OcfEquityCompensationCancellation;
}
