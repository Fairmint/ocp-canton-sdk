/**
 * DAML to OCF converters for StockTransfer entities.
 */

import type { OcfStockTransferOutput } from '../../../types';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData } from '../capTable/damlEntityData';
import { requireGeneratedDamlNumeric10 } from '../shared/generatedDamlValues';
import {
  freezeTransferEvent,
  generatedOptionalTransferText,
  requireGeneratedTransferComments,
  requireGeneratedTransferResultIds,
  requireGeneratedTransferText,
} from '../shared/transferReadValues';

/**
 * DAML StockTransfer data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlStockTransferData = DamlDataTypeFor<'stockTransfer'>;

/**
 * Convert DAML StockTransfer data to native OCF format.
 *
 * @param d - The DAML stock transfer data object
 * @returns The native OCF StockTransfer object
 */
export function damlStockTransferToNative(d: DamlStockTransferData): OcfStockTransferOutput {
  const decoded = decodeDamlEntityData('stockTransfer', d);
  const balanceSecurityId = generatedOptionalTransferText(
    decoded.balance_security_id,
    'stockTransfer.balance_security_id'
  );
  const considerationText = generatedOptionalTransferText(
    decoded.consideration_text,
    'stockTransfer.consideration_text'
  );
  const comments = requireGeneratedTransferComments(decoded.comments, 'stockTransfer.comments');
  return freezeTransferEvent({
    object_type: 'TX_STOCK_TRANSFER',
    id: requireGeneratedTransferText(decoded.id, 'stockTransfer.id'),
    date: damlTimeToDateString(decoded.date, 'stockTransfer.date'),
    security_id: requireGeneratedTransferText(decoded.security_id, 'stockTransfer.security_id'),
    quantity: requireGeneratedDamlNumeric10(decoded.quantity, 'stockTransfer.quantity', 'positive'),
    resulting_security_ids: requireGeneratedTransferResultIds(
      decoded.resulting_security_ids,
      'stockTransfer.resulting_security_ids'
    ),
    ...(balanceSecurityId === undefined ? {} : { balance_security_id: balanceSecurityId }),
    ...(considerationText === undefined ? {} : { consideration_text: considerationText }),
    ...(comments.length > 0 ? { comments } : {}),
  });
}
