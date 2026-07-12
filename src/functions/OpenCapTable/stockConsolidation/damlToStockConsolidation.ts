/** DAML to OCF converter for StockConsolidation. */

import type { OcfStockConsolidation } from '../../../types/native';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor, OcfReadDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData } from '../capTable/damlEntityData';
import {
  freezeStockCorporateActionEvent,
  optionalStockCorporateActionText,
  requireStockCorporateActionComments,
  requireStockCorporateActionIdentifiers,
  requireStockCorporateActionText,
} from '../shared/stockCorporateActionValues';

/** Exact generated DAML StockConsolidation payload. */
export type DamlStockConsolidationData = DamlDataTypeFor<'stockConsolidation'>;

/** Convert exact generated DAML StockConsolidation data to canonical OCF. */
export function damlStockConsolidationToNative(
  input: DamlStockConsolidationData
): OcfReadDataTypeFor<'stockConsolidation'> {
  const rootPath = 'stockConsolidation';
  const data = decodeDamlEntityData('stockConsolidation', input);
  const reasonText = optionalStockCorporateActionText(data.reason_text, `${rootPath}.reason_text`);
  const comments = requireStockCorporateActionComments(data.comments, `${rootPath}.comments`);

  const event: OcfStockConsolidation = {
    object_type: 'TX_STOCK_CONSOLIDATION',
    id: requireStockCorporateActionText(data.id, `${rootPath}.id`),
    date: damlTimeToDateString(data.date, `${rootPath}.date`),
    security_ids: requireStockCorporateActionIdentifiers(data.security_ids, `${rootPath}.security_ids`),
    resulting_security_id: requireStockCorporateActionText(
      data.resulting_security_id,
      `${rootPath}.resulting_security_id`
    ),
    ...(reasonText !== undefined ? { reason_text: reasonText } : {}),
    ...(comments.length > 0 ? { comments } : {}),
  };
  return freezeStockCorporateActionEvent(event);
}
