/**
 * DAML to OCF converters for VestingAcceleration entities.
 */

import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { OcfVestingAcceleration } from '../../../types';
import {
  assertSafeGeneratedDamlJson,
  rejectUnknownGeneratedFields,
  requireGeneratedRecord,
  requireGeneratedString,
  requireGeneratedStringArray,
} from '../../../utils/generatedDamlValidation';
import { damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';

/**
 * DAML VestingAcceleration data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlVestingAccelerationData = Fairmint.OpenCapTable.OCF.VestingAcceleration.VestingAccelerationOcfData;

/**
 * Convert DAML VestingAcceleration data to native OCF format.
 *
 * @param d - The DAML vesting acceleration data object
 * @returns The native OCF VestingAcceleration object
 */
export function damlVestingAccelerationToNative(
  d: DamlVestingAccelerationData,
  source = 'vestingAcceleration'
): OcfVestingAcceleration {
  assertSafeGeneratedDamlJson(d, source);
  const data = requireGeneratedRecord(d, source);
  rejectUnknownGeneratedFields(data, source, ['id', 'date', 'security_id', 'quantity', 'reason_text', 'comments']);
  const id = requireGeneratedString(data.id, `${source}.id`);
  const date = requireGeneratedString(data.date, `${source}.date`);
  const securityId = requireGeneratedString(data.security_id, `${source}.security_id`);
  const quantity = requireGeneratedString(data.quantity, `${source}.quantity`);
  const reasonText = requireGeneratedString(data.reason_text, `${source}.reason_text`);
  const comments = requireGeneratedStringArray(data.comments, `${source}.comments`);

  return {
    object_type: 'TX_VESTING_ACCELERATION',
    id,
    date: damlTimeToDateString(date, `${source}.date`),
    security_id: securityId,
    quantity: normalizeNumericString(quantity, `${source}.quantity`),
    reason_text: reasonText,
    ...(comments.length > 0 && { comments }),
  };
}
