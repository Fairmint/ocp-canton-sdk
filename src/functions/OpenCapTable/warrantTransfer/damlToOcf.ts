/**
 * DAML to OCF converters for WarrantTransfer entities.
 */

import type { OcfWarrantTransfer } from '../../../types';
import { damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';

/**
 * DAML WarrantTransfer data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlWarrantTransferData {
  id: string;
  date: string;
  security_id: string;
  quantity: string;
  resulting_security_ids: string[];
  balance_security_id?: string;
  consideration_text?: string;
  comments: string[];
}

/**
 * Convert DAML WarrantTransfer data to native OCF format.
 *
 * @param d - The DAML warrant transfer data object
 * @returns The native OCF WarrantTransfer object
 */
export function damlWarrantTransferToNative(d: DamlWarrantTransferData): OcfWarrantTransfer {
  return {
    id: d.id,
    date: damlTimeToDateString(d.date),
    security_id: d.security_id,
    quantity: normalizeNumericString(d.quantity),
    resulting_security_ids: d.resulting_security_ids,
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id } : {}),
    ...(d.consideration_text ? { consideration_text: d.consideration_text } : {}),
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
