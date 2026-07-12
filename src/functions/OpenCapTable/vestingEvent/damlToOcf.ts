/**
 * DAML to OCF converters for VestingEvent entities.
 */

import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { OcfVestingEvent } from '../../../types';
import {
  rejectUnknownGeneratedFields,
  requireGeneratedNonEmptyString,
  requireGeneratedNonEmptyStringArray,
  requireGeneratedRecord,
  requireGeneratedString,
} from '../../../utils/generatedDamlValidation';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import { decodeLosslessGeneratedDamlValue } from '../capTable/damlCodecLosslessness';
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
export function damlVestingEventToNative(d: DamlVestingEventData): OcfVestingEvent {
  const source = 'vestingEvent';
  validateVestingDamlDataInput('vestingEvent', d, source);
  const decoded = decodeLosslessGeneratedDamlValue(Fairmint.OpenCapTable.OCF.VestingEvent.VestingEventOcfData, d, {
    rootPath: source,
    description: 'vesting event data',
    decodeSource: source,
  });
  const data = requireGeneratedRecord(decoded, source);
  rejectUnknownGeneratedFields(data, source, ['id', 'date', 'security_id', 'vesting_condition_id', 'comments']);
  const id = requireGeneratedNonEmptyString(data.id, `${source}.id`);
  const date = requireGeneratedString(data.date, `${source}.date`);
  const securityId = requireGeneratedNonEmptyString(data.security_id, `${source}.security_id`);
  const vestingConditionId = requireGeneratedNonEmptyString(
    data.vesting_condition_id,
    `${source}.vesting_condition_id`
  );
  const comments = requireGeneratedNonEmptyStringArray(data.comments, `${source}.comments`);

  return {
    object_type: 'TX_VESTING_EVENT',
    id,
    date: damlTimeToDateString(date, `${source}.date`),
    security_id: securityId,
    vesting_condition_id: vestingConditionId,
    ...(comments.length > 0 && { comments }),
  };
}
