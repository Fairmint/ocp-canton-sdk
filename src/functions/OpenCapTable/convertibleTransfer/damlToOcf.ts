/**
 * DAML to OCF converters for ConvertibleTransfer entities.
 */

import type { OcfConvertibleTransfer } from '../../../types';
import { damlTimeToDateString, toNonEmptyStringArray } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData } from '../capTable/damlEntityData';
import { requireCurrencyCode, requireDecimalString } from '../shared/ocfValues';

/**
 * DAML ConvertibleTransfer data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlConvertibleTransferData = DamlDataTypeFor<'convertibleTransfer'>;

/**
 * Convert DAML ConvertibleTransfer data to native OCF format.
 *
 * @param d - The DAML convertible transfer data object
 * @returns The native OCF ConvertibleTransfer object
 */
export function damlConvertibleTransferToNative(d: DamlConvertibleTransferData): OcfConvertibleTransfer {
  const decoded = decodeDamlEntityData('convertibleTransfer', d);
  return {
    object_type: 'TX_CONVERTIBLE_TRANSFER',
    id: decoded.id,
    date: damlTimeToDateString(decoded.date, 'convertibleTransfer.date'),
    security_id: decoded.security_id,
    amount: {
      amount: requireDecimalString(decoded.amount.amount, 'convertibleTransfer.amount.amount'),
      currency: requireCurrencyCode(decoded.amount.currency, 'convertibleTransfer.amount.currency'),
    },
    resulting_security_ids: toNonEmptyStringArray(
      decoded.resulting_security_ids,
      'convertibleTransfer.resulting_security_ids',
      { uniqueItems: true }
    ),
    ...(decoded.balance_security_id !== null ? { balance_security_id: decoded.balance_security_id } : {}),
    ...(decoded.consideration_text !== null ? { consideration_text: decoded.consideration_text } : {}),
    ...(decoded.comments.length > 0 ? { comments: decoded.comments } : {}),
  };
}
