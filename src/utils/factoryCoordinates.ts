import type { OcpFactoryCoordinates } from '../clientOptions';
import { OcpErrorCodes, OcpValidationError } from '../errors';

/** Internal runtime guard for factory coordinates received from typed or untyped callers. */
export function hasCompleteFactoryCoordinates(value: unknown): value is OcpFactoryCoordinates {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.contractId === 'string' &&
    candidate.contractId.trim().length > 0 &&
    typeof candidate.templateId === 'string' &&
    candidate.templateId.trim().length > 0
  );
}

/** Validate an optional atomic factory override at every public runtime boundary. */
export function validateFactoryCoordinates(value: unknown): asserts value is OcpFactoryCoordinates | undefined {
  if (value !== undefined && !hasCompleteFactoryCoordinates(value)) {
    throw new OcpValidationError('factory', 'factory override must include non-empty contractId and templateId', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'object with non-empty string contractId and templateId properties',
      receivedValue: value,
    });
  }
}
