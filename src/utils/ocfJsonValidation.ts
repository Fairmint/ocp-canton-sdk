import { OcpErrorCodes, OcpValidationError } from '../errors';
import { findUnsafeJsonIssue } from './safeJson';

/** Validate an OCF SDK input before schema parsing or direct conversion touches it. */
export function assertSafeOcfJson(value: unknown, source: string): void {
  const issue = findUnsafeJsonIssue(value, source);
  if (issue === undefined) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) return;
    throw new OcpValidationError(source, 'OCF input must be a JSON object', {
      code: OcpErrorCodes.INVALID_TYPE,
      classification: 'invalid_ocf_json',
      expectedType: 'plain JSON object',
      receivedValue: value,
    });
  }

  throw new OcpValidationError(issue.path, issue.message, {
    code:
      issue.kind === 'undefined'
        ? OcpErrorCodes.REQUIRED_FIELD_MISSING
        : issue.kind === 'non_json_value' || issue.kind === 'proxy'
          ? OcpErrorCodes.INVALID_TYPE
          : OcpErrorCodes.INVALID_FORMAT,
    classification: 'invalid_ocf_json',
    expectedType: 'plain, dense, accessor-free JSON',
    receivedValue: issue.receivedValue,
    context: { issueKind: issue.kind },
  });
}
