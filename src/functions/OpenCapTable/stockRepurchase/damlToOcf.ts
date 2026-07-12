/**
 * DAML to OCF converters for StockRepurchase entities.
 */

import type { OcfStockRepurchase } from '../../../types';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor, OcfReadDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData, type ReadonlyDamlDataTypeFor } from '../capTable/damlEntityData';
import { requireGeneratedDamlMonetary, requireGeneratedDamlNumeric10 } from '../shared/generatedDamlValues';
import {
  freezeStockCorporateActionEvent,
  optionalStockCorporateActionText,
  requireStockCorporateActionComments,
  requireStockCorporateActionText,
} from '../shared/stockCorporateActionValues';

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
export function damlStockRepurchaseToNative(
  input: ReadonlyDamlDataTypeFor<'stockRepurchase'>
): OcfReadDataTypeFor<'stockRepurchase'> {
  const data = decodeDamlEntityData('stockRepurchase', input);
  const balanceSecurityId = optionalStockCorporateActionText(
    data.balance_security_id,
    'stockRepurchase.balance_security_id'
  );
  const considerationText = optionalStockCorporateActionText(
    data.consideration_text,
    'stockRepurchase.consideration_text'
  );
  const comments = requireStockCorporateActionComments(data.comments, 'stockRepurchase.comments');
  const event: OcfStockRepurchase = {
    object_type: 'TX_STOCK_REPURCHASE',
    id: requireStockCorporateActionText(data.id, 'stockRepurchase.id'),
    date: damlTimeToDateString(data.date, 'stockRepurchase.date'),
    security_id: requireStockCorporateActionText(data.security_id, 'stockRepurchase.security_id'),
    quantity: requireGeneratedDamlNumeric10(data.quantity, 'stockRepurchase.quantity', 'positive'),
    price: requireGeneratedDamlMonetary(data.price, 'stockRepurchase.price'),
    ...(balanceSecurityId !== undefined ? { balance_security_id: balanceSecurityId } : {}),
    ...(considerationText !== undefined ? { consideration_text: considerationText } : {}),
    ...(comments.length > 0 ? { comments } : {}),
  };
  return freezeStockCorporateActionEvent(event);
}
