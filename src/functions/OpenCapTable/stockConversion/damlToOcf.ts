/** DAML to OCF converters for StockConversion entities. */

import type { OcfStockConversion } from '../../../types';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData } from '../capTable/damlEntityData';
import { requireGeneratedDamlNumeric10 } from '../shared/generatedDamlValues';

/** Exact generated DAML StockConversion payload. */
export type DamlStockConversionData = DamlDataTypeFor<'stockConversion'>;

/** Convert generated DAML StockConversion data to canonical OCF. */
export function damlStockConversionToNative(input: DamlStockConversionData): OcfStockConversion {
  const data = decodeDamlEntityData('stockConversion', input);
  const balanceSecurityId = data.balance_security_id ?? undefined;

  return {
    object_type: 'TX_STOCK_CONVERSION',
    id: data.id,
    date: damlTimeToDateString(data.date, 'stockConversion.date'),
    security_id: data.security_id,
    quantity_converted: requireGeneratedDamlNumeric10(data.quantity_converted, 'stockConversion.quantity_converted'),
    resulting_security_ids: data.resulting_security_ids,
    ...(balanceSecurityId !== undefined ? { balance_security_id: balanceSecurityId } : {}),
    ...(data.comments.length > 0 ? { comments: data.comments } : {}),
  };
}
