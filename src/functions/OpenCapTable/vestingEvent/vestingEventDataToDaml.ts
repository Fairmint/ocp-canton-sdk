/**
 * OCF to DAML converter for VestingEvent entities.
 */

import type { OcfVestingEvent } from '../../../types';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { requiredTextToDaml } from '../shared/damlText';
import { commentsToDaml, requirePlainWriterInput, validateCanonicalWriterInput } from '../shared/ocfWriterValidation';

/**
 * Convert native OCF VestingEvent data to DAML format.
 *
 * @param d - The native OCF vesting event data object
 * @returns The DAML-formatted vesting event data
 * @throws OcpValidationError if required fields are missing
 */
export function vestingEventDataToDaml(d: OcfVestingEvent): DamlDataTypeFor<'vestingEvent'> {
  const input = requirePlainWriterInput(d, 'vestingEvent');
  validateCanonicalWriterInput('vestingEvent', 'TX_VESTING_EVENT', input, 'vestingEvent');
  return {
    id: requiredTextToDaml(input.id, 'vestingEvent.id'),
    date: dateStringToDAMLTime(input.date, 'vestingEvent.date'),
    security_id: requiredTextToDaml(input.security_id, 'vestingEvent.security_id'),
    vesting_condition_id: requiredTextToDaml(input.vesting_condition_id, 'vestingEvent.vesting_condition_id'),
    comments: commentsToDaml(input.comments, 'vestingEvent.comments'),
  } satisfies DamlDataTypeFor<'vestingEvent'>;
}
