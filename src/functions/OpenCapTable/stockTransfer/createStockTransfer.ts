import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfStockTransfer } from '../../../types';
import type { PkgStockTransferOcfData } from '../../../types/daml';
import {
  cleanComments,
  dateStringToDAMLDate,
  normalizeNumericString,
  optionalString,
} from '../../../utils/typeConversions';

export function stockTransferDataToDaml(d: OcfStockTransfer): PkgStockTransferOcfData {
  // Validate required array field
  if (d.resulting_security_ids.length === 0) {
    throw new OcpValidationError(
      'stockTransfer.resulting_security_ids',
      'resulting_security_ids must contain at least one element',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, receivedValue: d.resulting_security_ids }
    );
  }
  return {
    id: d.id,
    security_id: d.security_id,
    date: dateStringToDAMLDate(d.date, 'stockTransfer.date'),
    quantity: normalizeNumericString(d.quantity),
    resulting_security_ids: d.resulting_security_ids,
    balance_security_id: optionalString(d.balance_security_id),
    consideration_text: optionalString(d.consideration_text),
    comments: cleanComments(d.comments),
  };
}
