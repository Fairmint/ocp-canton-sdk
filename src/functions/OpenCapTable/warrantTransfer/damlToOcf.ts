/**
 * DAML to OCF converters for WarrantTransfer entities.
 */

import type { OcfWarrantTransferOutput } from '../../../types';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData } from '../capTable/damlEntityData';
import { requireGeneratedDamlNumeric10 } from '../shared/generatedDamlValues';
import {
  freezeTransferEvent,
  generatedOptionalTransferText,
  requireGeneratedTransferComments,
  requireGeneratedTransferResultIds,
  requireGeneratedTransferText,
} from '../shared/transferReadValues';

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
export function damlWarrantTransferToNative(d: DamlWarrantTransferData): OcfWarrantTransferOutput {
  const decoded = decodeDamlEntityData('warrantTransfer', d);
  const balanceSecurityId = generatedOptionalTransferText(
    decoded.balance_security_id,
    'warrantTransfer.balance_security_id'
  );
  const considerationText = generatedOptionalTransferText(
    decoded.consideration_text,
    'warrantTransfer.consideration_text'
  );
  const comments = requireGeneratedTransferComments(decoded.comments, 'warrantTransfer.comments');
  return freezeTransferEvent({
    object_type: 'TX_WARRANT_TRANSFER',
    id: requireGeneratedTransferText(decoded.id, 'warrantTransfer.id'),
    date: damlTimeToDateString(decoded.date, 'warrantTransfer.date'),
    security_id: requireGeneratedTransferText(decoded.security_id, 'warrantTransfer.security_id'),
    quantity: requireGeneratedDamlNumeric10(decoded.quantity, 'warrantTransfer.quantity', 'positive'),
    resulting_security_ids: requireGeneratedTransferResultIds(
      decoded.resulting_security_ids,
      'warrantTransfer.resulting_security_ids'
    ),
    ...(balanceSecurityId === undefined ? {} : { balance_security_id: balanceSecurityId }),
    ...(considerationText === undefined ? {} : { consideration_text: considerationText }),
    ...(comments.length > 0 ? { comments } : {}),
  });
}
