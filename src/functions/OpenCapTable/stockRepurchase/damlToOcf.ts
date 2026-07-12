/**
 * DAML to OCF converters for StockRepurchase entities.
 */

import type { OcfStockRepurchase } from '../../../types';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData } from '../capTable/damlEntityData';
import { requireGeneratedDamlMonetary, requireGeneratedDamlNumeric10 } from '../shared/generatedDamlValues';

/**
 * DAML StockRepurchase data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlStockRepurchaseData = DamlDataTypeFor<'stockRepurchase'>;

/**
 * Convert DAML StockRepurchase data to native OCF format.
 *
 * @param d - The DAML stock repurchase data object
 * @returns The native OCF StockRepurchase object
 */
export function damlStockRepurchaseToNative(input: DamlStockRepurchaseData): OcfStockRepurchase {
  const data = decodeDamlEntityData('stockRepurchase', input);
  const balanceSecurityId = data.balance_security_id ?? undefined;
  const considerationText = data.consideration_text ?? undefined;
  return {
    object_type: 'TX_STOCK_REPURCHASE',
    id: data.id,
    date: damlTimeToDateString(data.date, 'stockRepurchase.date'),
    security_id: data.security_id,
    quantity: requireGeneratedDamlNumeric10(data.quantity, 'stockRepurchase.quantity'),
    price: requireGeneratedDamlMonetary(data.price, 'stockRepurchase.price'),
    ...(balanceSecurityId !== undefined ? { balance_security_id: balanceSecurityId } : {}),
    ...(considerationText !== undefined ? { consideration_text: considerationText } : {}),
    ...(data.comments.length > 0 ? { comments: data.comments } : {}),
  };
}
