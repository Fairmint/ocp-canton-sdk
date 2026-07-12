/**
 * OCF to DAML converter for StockConsolidation.
 */

import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfStockConsolidation } from '../../../types/native';
import {
  cleanComments,
  dateStringToDAMLTime,
  isRecord,
  optionalString,
  toNonEmptyStringArray,
} from '../../../utils/typeConversions';
import { assertCanonicalJsonGraph, assertExactObjectFields } from '../shared/ocfValues';

/**
 * Convert native OCF StockConsolidation data to DAML format.
 *
 * Both canonical OCF and DAML use resulting_security_id (singular).
 */
export function stockConsolidationDataToDaml(d: OcfStockConsolidation): Record<string, unknown> {
  const runtimeValue: unknown = d;
  assertCanonicalJsonGraph(runtimeValue, 'stockConsolidation', { rejectUndefined: true });
  if (!isRecord(runtimeValue)) {
    throw new OcpValidationError('stockConsolidation', 'Stock consolidation must be an object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'object',
      receivedValue: runtimeValue,
    });
  }
  assertExactObjectFields(
    runtimeValue,
    ['comments', 'date', 'id', 'object_type', 'reason_text', 'resulting_security_id', 'security_ids'],
    'stockConsolidation'
  );
  if (!d.id) {
    throw new OcpValidationError('stockConsolidation.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  const resultingSecurityId: unknown = d.resulting_security_id;
  if (typeof resultingSecurityId !== 'string') {
    throw new OcpValidationError('stockConsolidation.resulting_security_id', 'resulting_security_id must be a string', {
      code:
        resultingSecurityId === undefined || resultingSecurityId === null
          ? OcpErrorCodes.REQUIRED_FIELD_MISSING
          : OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string',
      receivedValue: resultingSecurityId,
    });
  }
  const securityIds = toNonEmptyStringArray(d.security_ids, 'stockConsolidation.security_ids', {
    uniqueItems: true,
  });
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date, 'stockConsolidation.date'),
    security_ids: securityIds,
    resulting_security_id: resultingSecurityId,
    reason_text: optionalString(d.reason_text),
    comments: cleanComments(d.comments),
  };
}
