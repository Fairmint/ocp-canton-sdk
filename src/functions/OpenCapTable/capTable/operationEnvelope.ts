/** @internal Descriptor-only validation for public create/edit operation envelopes. */

import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { isRecord } from '../../../utils/typeConversions';
import { assertExactObjectFields, assertNotRuntimeProxy } from '../shared/ocfValues';

export interface ValidatedOcfOperationEnvelope {
  readonly type: string;
  readonly data: unknown;
}

function requiredField(fieldPath: string, expectedType: string): never {
  throw new OcpValidationError(fieldPath, `${fieldPath} is required`, {
    code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    expectedType,
  });
}

/** Validate an exact `{ type, data }` envelope before reading either property. */
export function requireOcfOperationEnvelope(value: unknown, fieldPath: string): ValidatedOcfOperationEnvelope {
  assertNotRuntimeProxy(value, fieldPath, 'plain OCF operation object');
  if (!isRecord(value)) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a plain OCF operation object`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'plain object with type and data properties',
      receivedValue: value,
    });
  }
  assertExactObjectFields(value, ['type', 'data'], fieldPath);

  const typeDescriptor = Object.getOwnPropertyDescriptor(value, 'type');
  if (typeDescriptor === undefined || !('value' in typeDescriptor) || typeDescriptor.value === undefined) {
    requiredField(`${fieldPath}.type`, 'OCF entity type string');
  }
  const dataDescriptor = Object.getOwnPropertyDescriptor(value, 'data');
  if (dataDescriptor === undefined || !('value' in dataDescriptor) || dataDescriptor.value === undefined) {
    requiredField(`${fieldPath}.data`, 'canonical OCF entity data');
  }
  if (typeof typeDescriptor.value !== 'string') {
    throw new OcpValidationError(`${fieldPath}.type`, `${fieldPath}.type must be a string`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'OCF entity type string',
      receivedValue: typeDescriptor.value,
    });
  }

  return { type: typeDescriptor.value, data: dataDescriptor.value };
}
