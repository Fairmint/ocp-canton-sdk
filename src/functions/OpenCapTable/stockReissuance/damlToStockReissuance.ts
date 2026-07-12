/**
 * DAML to OCF converter for StockReissuance.
 */

import type { OcfStockReissuance } from '../../../types/native';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor, OcfReadDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData, type ReadonlyDamlDataTypeFor } from '../capTable/damlEntityData';
import {
  freezeStockCorporateActionEvent,
  optionalStockCorporateActionText,
  requireStockCorporateActionComments,
  requireStockCorporateActionIdentifiers,
  requireStockCorporateActionText,
} from '../shared/stockCorporateActionValues';

/** DAML StockReissuanceOcfData structure */
export type DamlStockReissuanceData = DamlDataTypeFor<'stockReissuance'>;

/**
 * Convert DAML StockReissuance data to native OCF format.
 */
export function damlStockReissuanceToNative(
  input: ReadonlyDamlDataTypeFor<'stockReissuance'>
): OcfReadDataTypeFor<'stockReissuance'> {
  const data = decodeDamlEntityData('stockReissuance', input);
  const reasonText = optionalStockCorporateActionText(data.reason_text, 'stockReissuance.reason_text');
  const splitTransactionId = optionalStockCorporateActionText(
    data.split_transaction_id,
    'stockReissuance.split_transaction_id'
  );
  const comments = requireStockCorporateActionComments(data.comments, 'stockReissuance.comments');
  const event: OcfStockReissuance = {
    object_type: 'TX_STOCK_REISSUANCE',
    id: requireStockCorporateActionText(data.id, 'stockReissuance.id'),
    date: damlTimeToDateString(data.date, 'stockReissuance.date'),
    security_id: requireStockCorporateActionText(data.security_id, 'stockReissuance.security_id'),
    resulting_security_ids: requireStockCorporateActionIdentifiers(
      data.resulting_security_ids,
      'stockReissuance.resulting_security_ids'
    ),
    ...(reasonText !== undefined ? { reason_text: reasonText } : {}),
    ...(splitTransactionId !== undefined ? { split_transaction_id: splitTransactionId } : {}),
    ...(comments.length > 0 ? { comments } : {}),
  };
  return freezeStockCorporateActionEvent(event);
}
