/**
 * DAML to OCF converters for VestingAcceleration entities.
 */

import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { OcfVestingAcceleration } from '../../../types';
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
import { damlPositiveVestingNumericToNative } from '../vestingTerms/vestingQuantity';

/**
 * DAML VestingAcceleration data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlVestingAccelerationData =
  ReadonlyGeneratedDaml<Fairmint.OpenCapTable.OCF.VestingAcceleration.VestingAccelerationOcfData>;

/**
 * Convert DAML VestingAcceleration data to native OCF format.
 *
 * @param d - The DAML vesting acceleration data object
 * @returns The native OCF VestingAcceleration object
 */
export function damlVestingAccelerationToNative(d: DamlVestingAccelerationData): OcfVestingAcceleration {
  const source = 'vestingAcceleration';
  validateVestingDamlDataInput('vestingAcceleration', d, source);
  const decoded = decodeLosslessGeneratedDamlValue(
    Fairmint.OpenCapTable.OCF.VestingAcceleration.VestingAccelerationOcfData,
    d,
    { rootPath: source, description: 'vesting acceleration data', decodeSource: source }
  );
  const data = requireGeneratedRecord(decoded, source);
  rejectUnknownGeneratedFields(data, source, ['id', 'date', 'security_id', 'quantity', 'reason_text', 'comments']);
  const id = requireGeneratedNonEmptyString(data.id, `${source}.id`);
  const date = requireGeneratedString(data.date, `${source}.date`);
  const securityId = requireGeneratedNonEmptyString(data.security_id, `${source}.security_id`);
  const quantity = requireGeneratedString(data.quantity, `${source}.quantity`);
  const reasonText = requireGeneratedNonEmptyString(data.reason_text, `${source}.reason_text`);
  const comments = requireGeneratedNonEmptyStringArray(data.comments, `${source}.comments`);

  return {
    object_type: 'TX_VESTING_ACCELERATION',
    id,
    date: damlTimeToDateString(date, `${source}.date`),
    security_id: securityId,
    quantity: damlPositiveVestingNumericToNative(quantity, `${source}.quantity`),
    reason_text: reasonText,
    ...(comments.length > 0 && { comments }),
  };
}
