import type { OcfConvertibleCancellation } from '../../../types';
import type { PkgConvertibleCancellationOcfData } from '../../../types/daml';
import { convertibleCancellationValuesToDaml } from '../shared/cancellationValues';

export function convertibleCancellationDataToDaml(d: OcfConvertibleCancellation): PkgConvertibleCancellationOcfData {
  return convertibleCancellationValuesToDaml(d);
}
