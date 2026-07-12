import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { isRecord } from '../../../utils/typeConversions';
import {
  assertCanonicalJsonGraph,
  assertExactObjectFields,
  assertNotRuntimeProxy,
  optionalStringArrayToDaml,
  requireStringArray,
} from './ocfValues';

function requiredMissing(fieldPath: string, expectedType: string, receivedValue: unknown): never {
  throw new OcpValidationError(fieldPath, `${fieldPath} is required`, {
    code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    expectedType,
    receivedValue,
  });
}

function invalidType(fieldPath: string, expectedType: string, receivedValue: unknown): never {
  throw new OcpValidationError(fieldPath, `${fieldPath} has an invalid type`, {
    code: OcpErrorCodes.INVALID_TYPE,
    expectedType,
    receivedValue,
  });
}

/** Validate an exact, trap-free canonical OCF writer object before reading any property. */
export function requireExactConversionExerciseInput(
  input: unknown,
  fieldPath: string,
  allowedFields: readonly string[]
): Record<string, unknown> {
  if (input === undefined) requiredMissing(fieldPath, 'plain OCF object', input);
  assertNotRuntimeProxy(input, fieldPath, 'plain OCF object');
  if (!isRecord(input)) invalidType(fieldPath, 'plain OCF object', input);
  assertCanonicalJsonGraph(input, fieldPath, { rejectUndefined: true });
  assertExactObjectFields(input, allowedFields, fieldPath);
  return input;
}

/** Require a canonical OCF Text value while preserving the empty string. */
export function requireConversionExerciseText(value: unknown, fieldPath: string): string {
  if (value === undefined) requiredMissing(fieldPath, 'string', value);
  if (typeof value !== 'string') invalidType(fieldPath, 'string', value);
  return value;
}

/** Encode an optional canonical OCF Text as DAML Optional Text. */
export function optionalConversionExerciseText(value: unknown, fieldPath: string): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string') invalidType(fieldPath, 'string or omitted property', value);
  return value;
}

/** Require a dense Text array without imposing cardinality or uniqueness. */
export function requireConversionExerciseTextArray(value: unknown, fieldPath: string): string[] {
  if (value === undefined) requiredMissing(fieldPath, 'array of strings', value);
  if (value === null) invalidType(fieldPath, 'array of strings', value);
  return requireStringArray(value, fieldPath);
}

/** Encode optional comments while preserving empty Text elements. */
export function conversionExerciseCommentsToDaml(value: unknown, fieldPath: string): string[] {
  return optionalStringArrayToDaml(value, fieldPath);
}

/** Require the exact canonical transaction discriminator. */
export function requireConversionExerciseObjectType(value: unknown, expected: string, fieldPath: string): void {
  const objectType = requireConversionExerciseText(value, fieldPath);
  if (objectType !== expected) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be ${expected}`, {
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      expectedType: expected,
      receivedValue: value,
    });
  }
}
