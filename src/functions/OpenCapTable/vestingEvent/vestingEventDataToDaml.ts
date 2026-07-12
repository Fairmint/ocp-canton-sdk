/**
 * OCF to DAML converter for VestingEvent entities.
 */

import type { OcfVestingEvent } from '../../../types';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { requiredNonEmptyTextToDaml } from '../shared/damlText';
import {
  nonEmptyCommentsToDaml,
  requirePlainWriterInput,
  validateCanonicalWriterInput,
} from '../shared/ocfWriterValidation';

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
    id: requiredNonEmptyTextToDaml(input.id, 'vestingEvent.id'),
    date: dateStringToDAMLTime(input.date, 'vestingEvent.date'),
    security_id: requiredNonEmptyTextToDaml(input.security_id, 'vestingEvent.security_id'),
    vesting_condition_id: requiredNonEmptyTextToDaml(input.vesting_condition_id, 'vestingEvent.vesting_condition_id'),
    comments: nonEmptyCommentsToDaml(input.comments, 'vestingEvent.comments'),
  } satisfies DamlDataTypeFor<'vestingEvent'>;
}
