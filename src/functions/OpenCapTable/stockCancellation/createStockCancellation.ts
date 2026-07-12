import type { OcfStockCancellation } from '../../../types';
import type { PkgStockCancellationOcfData } from '../../../types/daml';
import { quantityCancellationValuesToDaml } from '../shared/cancellationValues';

export function stockCancellationDataToDaml(d: OcfStockCancellation): PkgStockCancellationOcfData {
  return quantityCancellationValuesToDaml(d, 'stockCancellation', 'TX_STOCK_CANCELLATION');
}
