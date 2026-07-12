/**
 * DAML to OCF converters for VestingStart entities.
 */

import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { OcfVestingStart } from '../../../types';
import {
  rejectUnknownGeneratedFields,
  requireGeneratedNonEmptyString,
  requireGeneratedNonEmptyStringArray,
  requireGeneratedRecord,
  requireGeneratedString,
} from '../../../utils/generatedDamlValidation';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import { decodeLosslessGeneratedDamlValue, type ReadonlyGeneratedDaml } from '../capTable/damlCodecLosslessness';
import { validateVestingDamlDataInput } from '../capTable/vestingContractData';

/**
 * DAML VestingStart data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlVestingStartData = ReadonlyGeneratedDaml<Fairmint.OpenCapTable.OCF.VestingStart.VestingStartOcfData>;

/**
 * Convert DAML VestingStart data to native OCF format.
 *
 * @param d - The DAML vesting start data object
 * @returns The native OCF VestingStart object
 */
export function damlVestingStartToNative(d: DamlVestingStartData): OcfVestingStart {
  const source = 'vestingStart';
  validateVestingDamlDataInput('vestingStart', d, source);
  const decoded = decodeLosslessGeneratedDamlValue(Fairmint.OpenCapTable.OCF.VestingStart.VestingStartOcfData, d, {
    rootPath: source,
    description: 'vesting start data',
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
    object_type: 'TX_VESTING_START',
    id,
    date: damlTimeToDateString(date, `${source}.date`),
    security_id: securityId,
    vesting_condition_id: vestingConditionId,
    ...(comments.length > 0 && { comments }),
  };
}
