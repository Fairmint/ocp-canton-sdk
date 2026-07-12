/**
 * DAML to OCF converters for ConvertibleCancellation entities.
 */

import type { OcfConvertibleCancellation } from '../../../types';
import type { PkgConvertibleCancellationOcfData } from '../../../types/daml';
import { cancellationBalanceSecurityIdFromDaml, damlTimeToDateString } from '../../../utils/typeConversions';
import { requireMonetary } from '../shared/ocfValues';

/** Exact generated DAML input accepted by the convertible-cancellation converter. */
export type DamlConvertibleCancellationData = PkgConvertibleCancellationOcfData;

/**
 * Convert DAML ConvertibleCancellation data to native OCF format.
 *
 * @param d - The DAML convertible cancellation data object
 * @returns The native OCF ConvertibleCancellation object
 */
export function damlConvertibleCancellationToNative(d: DamlConvertibleCancellationData): OcfConvertibleCancellation {
  const balanceSecurityId = cancellationBalanceSecurityIdFromDaml(
    d.balance_security_id,
    'convertibleCancellation.balance_security_id'
  );

  return {
    object_type: 'TX_CONVERTIBLE_CANCELLATION',
    id: d.id,
    date: damlTimeToDateString(d.date, 'convertibleCancellation.date'),
    security_id: d.security_id,
    amount: requireMonetary(d.amount, 'convertibleCancellation.amount'),
    reason_text: d.reason_text,
    ...(balanceSecurityId !== undefined ? { balance_security_id: balanceSecurityId } : {}),
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}
