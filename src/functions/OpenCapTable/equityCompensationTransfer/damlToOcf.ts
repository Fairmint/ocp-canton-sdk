/**
 * DAML to OCF converters for EquityCompensationTransfer entities.
 */

import type { OcfEquityCompensationTransfer } from '../../../types';
import { damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';

/**
 * DAML EquityCompensationTransfer data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlEquityCompensationTransferData {
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
 * Convert DAML EquityCompensationTransfer data to native OCF format.
 *
 * @param d - The DAML equity compensation transfer data object
 * @returns The native OCF EquityCompensationTransfer object
 */
export function damlEquityCompensationTransferToNative(
  d: DamlEquityCompensationTransferData
): OcfEquityCompensationTransfer {
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
