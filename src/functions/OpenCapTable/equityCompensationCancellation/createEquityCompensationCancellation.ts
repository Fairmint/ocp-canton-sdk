import type { OcfEquityCompensationCancellation } from '../../../types';
import type { PkgEquityCompensationCancellationOcfData } from '../../../types/daml';
import { quantityCancellationValuesToDaml } from '../shared/cancellationValues';

export function equityCompensationCancellationDataToDaml(
  d: OcfEquityCompensationCancellation
): PkgEquityCompensationCancellationOcfData {
  return quantityCancellationValuesToDaml(d, 'equityCompensationCancellation', 'TX_EQUITY_COMPENSATION_CANCELLATION');
}
