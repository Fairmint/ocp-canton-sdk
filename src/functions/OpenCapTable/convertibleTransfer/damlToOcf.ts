/**
 * DAML to OCF converters for ConvertibleTransfer entities.
 */

import type { OcfConvertibleTransfer } from '../../../types';
import { damlMonetaryToNative, damlTimeToDateString, toUniqueNonEmptyArray } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData } from '../capTable/damlEntityData';
import { parseDamlNumeric10 } from '../shared/damlNumerics';

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
  const amount = damlMonetaryToNative(decoded.amount, 'convertibleTransfer.amount');
  return {
    object_type: 'TX_CONVERTIBLE_TRANSFER',
    id: decoded.id,
    date: damlTimeToDateString(decoded.date, 'convertibleTransfer.date'),
    security_id: decoded.security_id,
    amount: {
      ...amount,
      amount: parseDamlNumeric10(decoded.amount.amount, 'convertibleTransfer.amount.amount'),
    },
    resulting_security_ids: toUniqueNonEmptyArray(
      decoded.resulting_security_ids,
      'convertibleTransfer.resulting_security_ids'
    ),
    ...(decoded.balance_security_id !== null ? { balance_security_id: decoded.balance_security_id } : {}),
    ...(decoded.consideration_text !== null ? { consideration_text: decoded.consideration_text } : {}),
    ...(decoded.comments.length > 0 ? { comments: decoded.comments } : {}),
  };
}
