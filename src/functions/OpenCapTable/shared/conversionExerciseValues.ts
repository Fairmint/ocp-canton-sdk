import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { NonEmptyArray } from '../../../types/native';
import { isRecord } from '../../../utils/typeConversions';
import {
  assertCanonicalJsonGraph,
  assertExactObjectFields,
  assertNotRuntimeProxy,
  optionalStringArrayToDaml,
  requirePositiveDecimal,
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

/** Require the non-empty Text accepted by the pinned DAML ensure clauses. */
export function requireConversionExerciseText(value: unknown, fieldPath: string): string {
  if (value === undefined) requiredMissing(fieldPath, 'non-empty string', value);
  if (typeof value !== 'string') invalidType(fieldPath, 'non-empty string', value);
  if (value.length === 0) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must not be empty`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'non-empty string',
      receivedValue: value,
    });
  }
  return value;
}

/** Encode an optional non-empty canonical OCF Text as DAML Optional Text. */
export function optionalConversionExerciseText(value: unknown, fieldPath: string): string | null {
  if (value === undefined) return null;
  if (value === null) invalidType(fieldPath, 'non-empty string or omitted property', value);
  return requireConversionExerciseText(value, fieldPath);
}

/** Require a dense Text array whose elements satisfy the pinned non-empty Text invariant. */
export function requireConversionExerciseTextArray(value: unknown, fieldPath: string): string[] {
  if (value === undefined) requiredMissing(fieldPath, 'array of strings', value);
  if (value === null) invalidType(fieldPath, 'array of strings', value);
  return requireStringArray(value, fieldPath).map((item, index) =>
    requireConversionExerciseText(item, `${fieldPath}[${index}]`)
  );
}

/** Require a non-empty Text array while preserving order and duplicate identifiers. */
export function requireNonEmptyConversionExerciseTextArray(value: unknown, fieldPath: string): NonEmptyArray<string> {
  const values = requireConversionExerciseTextArray(value, fieldPath);
  const [first, ...remaining] = values;
  if (first === undefined) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must contain at least one item`, {
      code: OcpErrorCodes.OUT_OF_RANGE,
      expectedType: 'non-empty array of non-empty strings',
      receivedValue: value,
    });
  }
  return [first, ...remaining];
}

/** Encode optional comments while rejecting empty DAML Text elements. */
export function conversionExerciseCommentsToDaml(value: unknown, fieldPath: string): string[] {
  return optionalStringArrayToDaml(value, fieldPath).map((comment, index) =>
    requireConversionExerciseText(comment, `${fieldPath}[${index}]`)
  );
}

/** Encode an optional strictly positive quantity as DAML Optional Numeric(10). */
export function optionalPositiveConversionExerciseNumericToDaml(value: unknown, fieldPath: string): string | null {
  if (value === undefined) return null;
  if (value === null) invalidType(fieldPath, 'positive decimal string or omitted property', value);
  return requirePositiveDecimal(value, fieldPath);
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
