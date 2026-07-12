/**
 * OCF to DAML converter for VestingStart entities.
 */

import type { OcfVestingStart } from '../../../types';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { requiredNonEmptyTextToDaml } from '../shared/damlText';
import {
  nonEmptyCommentsToDaml,
  requirePlainWriterInput,
  validateCanonicalWriterInput,
} from '../shared/ocfWriterValidation';

/**
 * Convert native OCF VestingStart data to DAML format.
 *
 * @param d - The native OCF vesting start data object
 * @returns The DAML-formatted vesting start data
 * @throws OcpValidationError if required fields are missing
 */
export function vestingStartDataToDaml(d: OcfVestingStart): DamlDataTypeFor<'vestingStart'> {
  const input = requirePlainWriterInput(d, 'vestingStart');
  validateCanonicalWriterInput('vestingStart', 'TX_VESTING_START', input, 'vestingStart');
  return {
    id: requiredNonEmptyTextToDaml(input.id, 'vestingStart.id'),
    date: dateStringToDAMLTime(input.date, 'vestingStart.date'),
    security_id: requiredNonEmptyTextToDaml(input.security_id, 'vestingStart.security_id'),
    vesting_condition_id: requiredNonEmptyTextToDaml(input.vesting_condition_id, 'vestingStart.vesting_condition_id'),
    comments: nonEmptyCommentsToDaml(input.comments, 'vestingStart.comments'),
  } satisfies DamlDataTypeFor<'vestingStart'>;
}
