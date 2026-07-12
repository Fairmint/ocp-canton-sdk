/**
 * DAML to OCF converters for ConvertibleTransfer entities.
 */

import type { OcfConvertibleTransferOutput } from '../../../types';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData } from '../capTable/damlEntityData';
import { requireGeneratedDamlMonetary } from '../shared/generatedDamlValues';
import {
  freezeTransferEvent,
  generatedOptionalTransferText,
  requireGeneratedTransferComments,
  requireGeneratedTransferResultIds,
  requireGeneratedTransferText,
} from '../shared/transferReadValues';

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
export function damlConvertibleTransferToNative(d: DamlConvertibleTransferData): OcfConvertibleTransferOutput {
  const decoded = decodeDamlEntityData('convertibleTransfer', d);
  const balanceSecurityId = generatedOptionalTransferText(
    decoded.balance_security_id,
    'convertibleTransfer.balance_security_id'
  );
  const considerationText = generatedOptionalTransferText(
    decoded.consideration_text,
    'convertibleTransfer.consideration_text'
  );
  const comments = requireGeneratedTransferComments(decoded.comments, 'convertibleTransfer.comments');
  return freezeTransferEvent({
    object_type: 'TX_CONVERTIBLE_TRANSFER',
    id: requireGeneratedTransferText(decoded.id, 'convertibleTransfer.id'),
    date: damlTimeToDateString(decoded.date, 'convertibleTransfer.date'),
    security_id: requireGeneratedTransferText(decoded.security_id, 'convertibleTransfer.security_id'),
    amount: requireGeneratedDamlMonetary(decoded.amount, 'convertibleTransfer.amount', 'positive'),
    resulting_security_ids: requireGeneratedTransferResultIds(
      decoded.resulting_security_ids,
      'convertibleTransfer.resulting_security_ids'
    ),
    ...(balanceSecurityId === undefined ? {} : { balance_security_id: balanceSecurityId }),
    ...(considerationText === undefined ? {} : { consideration_text: considerationText }),
    ...(comments.length > 0 ? { comments } : {}),
  });
}
