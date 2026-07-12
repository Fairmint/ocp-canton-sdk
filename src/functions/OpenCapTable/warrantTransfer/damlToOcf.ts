/**
 * DAML to OCF converters for WarrantTransfer entities.
 */

import type { OcfWarrantTransfer } from '../../../types';
import { damlTimeToDateString, toNonEmptyStringArray } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData } from '../capTable/damlEntityData';
import { requireDecimalString } from '../shared/ocfValues';

/**
 * DAML WarrantTransfer data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlWarrantTransferData = DamlDataTypeFor<'warrantTransfer'>;

/**
 * Convert DAML WarrantTransfer data to native OCF format.
 *
 * @param d - The DAML warrant transfer data object
 * @returns The native OCF WarrantTransfer object
 */
export function damlWarrantTransferToNative(d: DamlWarrantTransferData): OcfWarrantTransfer {
  const decoded = decodeDamlEntityData('warrantTransfer', d);
  return {
    object_type: 'TX_WARRANT_TRANSFER',
    id: decoded.id,
    date: damlTimeToDateString(decoded.date, 'warrantTransfer.date'),
    security_id: decoded.security_id,
    quantity: requireDecimalString(decoded.quantity, 'warrantTransfer.quantity'),
    resulting_security_ids: toNonEmptyStringArray(
      decoded.resulting_security_ids,
      'warrantTransfer.resulting_security_ids',
      { uniqueItems: true }
    ),
    ...(decoded.balance_security_id !== null ? { balance_security_id: decoded.balance_security_id } : {}),
    ...(decoded.consideration_text !== null ? { consideration_text: decoded.consideration_text } : {}),
    ...(decoded.comments.length > 0 ? { comments: decoded.comments } : {}),
  };
}
