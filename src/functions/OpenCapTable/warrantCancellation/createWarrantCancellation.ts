import type { OcfWarrantCancellation } from '../../../types';
import type { PkgWarrantCancellationOcfData } from '../../../types/daml';
import { quantityCancellationValuesToDaml } from '../shared/cancellationValues';

export function warrantCancellationDataToDaml(d: OcfWarrantCancellation): PkgWarrantCancellationOcfData {
  return quantityCancellationValuesToDaml(d, 'warrantCancellation', 'TX_WARRANT_CANCELLATION');
}
