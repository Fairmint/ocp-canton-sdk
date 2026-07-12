/**
 * DAML to OCF converters for EquityCompensationCancellation entities.
 */

import type { OcfEquityCompensationCancellation } from '../../../types';
import type { PkgEquityCompensationCancellationOcfData } from '../../../types/daml';
import { quantityCancellationValuesFromDaml } from '../shared/cancellationValues';

/**
 * DAML EquityCompensationCancellation data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlEquityCompensationCancellationData = PkgEquityCompensationCancellationOcfData;

/**
 * Convert DAML EquityCompensationCancellation data to native OCF format.
 *
 * @param d - The DAML equity compensation cancellation data object
 * @returns The native OCF EquityCompensationCancellation object
 */
export function damlEquityCompensationCancellationToNative(
  d: DamlEquityCompensationCancellationData
): OcfEquityCompensationCancellation {
  return {
    ...quantityCancellationValuesFromDaml(d, 'equityCompensationCancellation'),
    object_type: 'TX_EQUITY_COMPENSATION_CANCELLATION',
  };
}
