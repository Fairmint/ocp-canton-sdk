/** OCF to DAML conversion for StakeholderStatusChangeEvent data. */

import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfStakeholderStatusChangeEvent } from '../../../types/native';
import { isStakeholderStatus, stakeholderStatusToDaml } from '../../../utils/enumConversions';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { requiredTextToDaml } from '../shared/damlText';
import { commentsToDaml, requireExactWriterInput, validateCanonicalWriterInput } from '../shared/ocfWriterValidation';

const ROOT_FIELDS = ['comments', 'date', 'id', 'new_status', 'object_type', 'stakeholder_id'] as const;

/** Validate canonical OCF and encode the exact generated status-event payload. */
export function stakeholderStatusChangeEventDataToDaml(
  data: OcfStakeholderStatusChangeEvent
): DamlDataTypeFor<'stakeholderStatusChangeEvent'> {
  const path = 'stakeholderStatusChangeEvent';
  const input = requireExactWriterInput(data, path, ROOT_FIELDS);
  if (input.new_status === undefined) {
    throw new OcpValidationError(`${path}.new_status`, `${path}.new_status is required`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'StakeholderStatus',
      receivedValue: input.new_status,
    });
  }
  if (!isStakeholderStatus(input.new_status)) {
    throw new OcpValidationError(`${path}.new_status`, `${path}.new_status must be a canonical stakeholder status`, {
      code: typeof input.new_status === 'string' ? OcpErrorCodes.UNKNOWN_ENUM_VALUE : OcpErrorCodes.INVALID_TYPE,
      expectedType: 'StakeholderStatus',
      receivedValue: input.new_status,
    });
  }

  const result = {
    id: requiredTextToDaml(input.id, `${path}.id`),
    date: dateStringToDAMLTime(input.date, `${path}.date`),
    stakeholder_id: requiredTextToDaml(input.stakeholder_id, `${path}.stakeholder_id`),
    new_status: stakeholderStatusToDaml(input.new_status),
    comments: commentsToDaml(input.comments, `${path}.comments`),
  } satisfies DamlDataTypeFor<'stakeholderStatusChangeEvent'>;

  validateCanonicalWriterInput('stakeholderStatusChangeEvent', 'CE_STAKEHOLDER_STATUS', input, path);
  return result;
}
