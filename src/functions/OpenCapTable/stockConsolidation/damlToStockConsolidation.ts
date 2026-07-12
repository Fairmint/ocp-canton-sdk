/**
 * DAML to OCF converter for StockConsolidation.
 */

import type { OcfStockConsolidation } from '../../../types/native';
import {
  assertSafeGeneratedDamlJson,
  rejectUnknownGeneratedFields,
  requireGeneratedRecord,
  requireGeneratedString,
  requireGeneratedStringArray,
} from '../../../utils/generatedDamlValidation';
import { damlTimeToDateString, toNonEmptyStringArray } from '../../../utils/typeConversions';

/** DAML StockConsolidationOcfData structure */
export interface DamlStockConsolidationData {
  id: string;
  date: string;
  security_ids: string[];
  resulting_security_id: string; // DAML has singular
  reason_text: string | null;
  comments: string[];
}

/**
 * Convert DAML StockConsolidation data to native OCF format.
 *
 * Converts DAML StockConsolidation data to canonical OCF format.
 */
export function damlStockConsolidationToNative(d: DamlStockConsolidationData): OcfStockConsolidation {
  const rootPath = 'stockConsolidation';
  assertSafeGeneratedDamlJson(d, rootPath);
  const data = requireGeneratedRecord(d, rootPath);
  rejectUnknownGeneratedFields(data, rootPath, [
    'comments',
    'date',
    'id',
    'reason_text',
    'resulting_security_id',
    'security_ids',
  ]);
  const id = requireGeneratedString(data.id, `${rootPath}.id`);
  const date = requireGeneratedString(data.date, `${rootPath}.date`);
  const resultingSecurityId = requireGeneratedString(data.resulting_security_id, `${rootPath}.resulting_security_id`);
  const comments = requireGeneratedStringArray(data.comments, `${rootPath}.comments`);
  const reasonText =
    data.reason_text === null ? null : requireGeneratedString(data.reason_text, `${rootPath}.reason_text`);

  return {
    object_type: 'TX_STOCK_CONSOLIDATION',
    id,
    date: damlTimeToDateString(date, `${rootPath}.date`),
    security_ids: toNonEmptyStringArray(data.security_ids, `${rootPath}.security_ids`, { uniqueItems: true }),
    resulting_security_id: resultingSecurityId,
    ...(reasonText ? { reason_text: reasonText } : {}),
    ...(comments.length > 0 ? { comments } : {}),
  };
}
