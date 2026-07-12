/**
 * DAML to OCF converters for VestingEvent entities.
 */

import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { OcfVestingEvent } from '../../../types';
import {
  assertSafeGeneratedDamlJson,
  rejectUnknownGeneratedFields,
  requireGeneratedRecord,
  requireGeneratedString,
  requireGeneratedStringArray,
} from '../../../utils/generatedDamlValidation';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import { validateVestingDamlDataInput } from '../capTable/vestingContractData';

/**
 * DAML VestingEvent data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlVestingEventData = Fairmint.OpenCapTable.OCF.VestingEvent.VestingEventOcfData;

/**
 * Convert DAML VestingEvent data to native OCF format.
 *
 * @param d - The DAML vesting event data object
 * @returns The native OCF VestingEvent object
 */
export function damlVestingEventToNative(d: DamlVestingEventData, source = 'vestingEvent'): OcfVestingEvent {
  validateVestingDamlDataInput('vestingEvent', d, source);
  assertSafeGeneratedDamlJson(d, source);
  const data = requireGeneratedRecord(d, source);
  rejectUnknownGeneratedFields(data, source, ['id', 'date', 'security_id', 'vesting_condition_id', 'comments']);
  const id = requireGeneratedString(data.id, `${source}.id`);
  const date = requireGeneratedString(data.date, `${source}.date`);
  const securityId = requireGeneratedString(data.security_id, `${source}.security_id`);
  const vestingConditionId = requireGeneratedString(data.vesting_condition_id, `${source}.vesting_condition_id`);
  const comments = requireGeneratedStringArray(data.comments, `${source}.comments`);

  return {
    object_type: 'TX_VESTING_EVENT',
    id,
    date: damlTimeToDateString(date, `${source}.date`),
    security_id: securityId,
    vesting_condition_id: vestingConditionId,
    ...(comments.length > 0 && { comments }),
  };
}
