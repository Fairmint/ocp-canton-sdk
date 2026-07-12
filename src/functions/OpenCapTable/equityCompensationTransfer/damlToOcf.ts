/**
 * DAML to OCF converters for EquityCompensationTransfer entities.
 */

import type { OcfEquityCompensationTransfer } from '../../../types';
import { damlTimeToDateString, toNonEmptyStringArray } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData } from '../capTable/damlEntityData';
import { requireDecimalString } from '../shared/ocfValues';

/**
 * DAML EquityCompensationTransfer data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlEquityCompensationTransferData = DamlDataTypeFor<'equityCompensationTransfer'>;

/**
 * Convert DAML EquityCompensationTransfer data to native OCF format.
 *
 * @param d - The DAML equity compensation transfer data object
 * @returns The native OCF EquityCompensationTransfer object
 */
export function damlEquityCompensationTransferToNative(
  d: DamlEquityCompensationTransferData
): OcfEquityCompensationTransfer {
  const decoded = decodeDamlEntityData('equityCompensationTransfer', d);
  return {
    object_type: 'TX_EQUITY_COMPENSATION_TRANSFER',
    id: decoded.id,
    date: damlTimeToDateString(decoded.date, 'equityCompensationTransfer.date'),
    security_id: decoded.security_id,
    quantity: requireDecimalString(decoded.quantity, 'equityCompensationTransfer.quantity'),
    resulting_security_ids: toNonEmptyStringArray(
      decoded.resulting_security_ids,
      'equityCompensationTransfer.resulting_security_ids',
      { uniqueItems: true }
    ),
    ...(decoded.balance_security_id !== null ? { balance_security_id: decoded.balance_security_id } : {}),
    ...(decoded.consideration_text !== null ? { consideration_text: decoded.consideration_text } : {}),
    ...(decoded.comments.length > 0 ? { comments: decoded.comments } : {}),
  };
}
