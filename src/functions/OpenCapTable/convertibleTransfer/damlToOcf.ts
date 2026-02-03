/**
 * DAML to OCF converters for ConvertibleTransfer entities.
 */

import type { OcfConvertibleTransfer } from '../../../types';
import { damlMonetaryToNative, damlTimeToDateString } from '../../../utils/typeConversions';

/**
 * DAML ConvertibleTransfer data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlConvertibleTransferData {
  id: string;
  date: string;
  security_id: string;
  amount: { amount: string; currency: string };
  resulting_security_ids: string[];
  balance_security_id?: string;
  consideration_text?: string;
  comments: string[];
}

/**
 * Convert DAML ConvertibleTransfer data to native OCF format.
 *
 * @param d - The DAML convertible transfer data object
 * @returns The native OCF ConvertibleTransfer object
 */
export function damlConvertibleTransferToNative(d: DamlConvertibleTransferData): OcfConvertibleTransfer {
  return {
    id: d.id,
    date: damlTimeToDateString(d.date),
    security_id: d.security_id,
    amount: damlMonetaryToNative(d.amount),
    resulting_security_ids: d.resulting_security_ids,
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id } : {}),
    ...(d.consideration_text ? { consideration_text: d.consideration_text } : {}),
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
