/**
 * DAML to OCF converters for ConvertibleCancellation entities.
 */

import type { OcfConvertibleCancellation } from '../../../types';
import type { PkgConvertibleCancellationOcfData } from '../../../types/daml';
import { convertibleCancellationValuesFromDaml } from '../shared/cancellationValues';

/** Exact generated DAML input accepted by the convertible-cancellation converter. */
export type DamlConvertibleCancellationData = PkgConvertibleCancellationOcfData;

/**
 * Convert DAML ConvertibleCancellation data to native OCF format.
 *
 * @param d - The DAML convertible cancellation data object
 * @returns The native OCF ConvertibleCancellation object
 */
export function damlConvertibleCancellationToNative(d: DamlConvertibleCancellationData): OcfConvertibleCancellation {
  return {
    ...convertibleCancellationValuesFromDaml(d),
    object_type: 'TX_CONVERTIBLE_CANCELLATION',
  };
}
