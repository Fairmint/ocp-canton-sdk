/**
 * DAML to OCF converters for EquityCompensationTransfer entities.
 */

import type { OcfEquityCompensationTransferOutput } from '../../../types';
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
): OcfEquityCompensationTransferOutput {
  const decoded = decodeDamlEntityData('equityCompensationTransfer', d);
  const balanceSecurityId = generatedOptionalTransferText(
    decoded.balance_security_id,
    'equityCompensationTransfer.balance_security_id'
  );
  const considerationText = generatedOptionalTransferText(
    decoded.consideration_text,
    'equityCompensationTransfer.consideration_text'
  );
  const comments = requireGeneratedTransferComments(decoded.comments, 'equityCompensationTransfer.comments');
  return freezeTransferEvent({
    object_type: 'TX_EQUITY_COMPENSATION_TRANSFER',
    id: requireGeneratedTransferText(decoded.id, 'equityCompensationTransfer.id'),
    date: damlTimeToDateString(decoded.date, 'equityCompensationTransfer.date'),
    security_id: requireGeneratedTransferText(decoded.security_id, 'equityCompensationTransfer.security_id'),
    quantity: requireGeneratedDamlNumeric10(decoded.quantity, 'equityCompensationTransfer.quantity', 'positive'),
    resulting_security_ids: requireGeneratedTransferResultIds(
      decoded.resulting_security_ids,
      'equityCompensationTransfer.resulting_security_ids'
    ),
    ...(balanceSecurityId === undefined ? {} : { balance_security_id: balanceSecurityId }),
    ...(considerationText === undefined ? {} : { consideration_text: considerationText }),
    ...(comments.length > 0 ? { comments } : {}),
  });
}
