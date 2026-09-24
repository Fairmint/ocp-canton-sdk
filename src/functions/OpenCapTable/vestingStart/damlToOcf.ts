/**
 * DAML to OCF converters for VestingStart entities.
 */

import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { OcfVestingStart } from '../../../types';
import {
  assertSafeGeneratedDamlJson,
  rejectUnknownGeneratedFields,
  requireGeneratedRecord,
  requireGeneratedString,
  requireGeneratedStringArray,
} from '../../../utils/generatedDamlValidation';
import { damlTimeToDateString } from '../../../utils/typeConversions';

/**
 * DAML VestingStart data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlVestingStartData = Fairmint.OpenCapTable.OCF.VestingStart.VestingStartOcfData;

/**
 * Convert DAML VestingStart data to native OCF format.
 *
 * @param d - The DAML vesting start data object
 * @returns The native OCF VestingStart object
 */
export function damlVestingStartToNative(d: DamlVestingStartData, source = 'vestingStart'): OcfVestingStart {
  assertSafeGeneratedDamlJson(d, source);
  const data = requireGeneratedRecord(d, source);
  rejectUnknownGeneratedFields(data, source, ['id', 'date', 'security_id', 'vesting_condition_id', 'comments']);
  const id = requireGeneratedString(data.id, `${source}.id`);
  const date = requireGeneratedString(data.date, `${source}.date`);
  const securityId = requireGeneratedString(data.security_id, `${source}.security_id`);
  const vestingConditionId = requireGeneratedString(data.vesting_condition_id, `${source}.vesting_condition_id`);
  const comments = requireGeneratedStringArray(data.comments, `${source}.comments`);

  return {
    object_type: 'TX_VESTING_START',
    id,
    date: damlTimeToDateString(date, `${source}.date`),
    security_id: securityId,
    vesting_condition_id: vestingConditionId,
    ...(comments.length > 0 && { comments }),
  };
}
