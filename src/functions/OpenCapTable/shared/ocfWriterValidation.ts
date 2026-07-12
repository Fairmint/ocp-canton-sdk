import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { parseOcfEntityInput } from '../../../utils/ocfZodSchemas';
import type { OcfDataTypeFor, OcfEntityType } from '../capTable/entityTypes';
import { assertPlainDataValue, PlainDataValidationError } from './plainDataValidation';

function pathFor(parent: string, key: string | number): string {
  return typeof key === 'number' ? `${parent}[${key}]` : `${parent}.${key}`;
}

function validatePlainWriterValue(value: unknown, fieldPath: string): void {
  try {
    assertPlainDataValue(value, fieldPath, { allowUndefinedObjectProperties: true });
  } catch (error) {
    if (!(error instanceof PlainDataValidationError)) throw error;
    throw new OcpValidationError(error.fieldPath, error.message, {
      code: error.code,
      expectedType: error.expectedType,
      receivedValue: error.receivedValue,
    });
  }
}

/** Require one direct writer input to use only lossless JSON-like own-property structures. */
export function requirePlainWriterInput(value: unknown, fieldPath: string): Record<string, unknown> {
  if (value === undefined) {
    throw new OcpValidationError(fieldPath, `${fieldPath} is required`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'plain JSON object',
      receivedValue: value,
    });
  }
  validatePlainWriterValue(value, fieldPath);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a plain object`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'plain JSON object',
      receivedValue: value,
    });
  }
  return value as Record<string, unknown>;
}

/** Require a dense plain array before a writer maps it. */
export function requireWriterArray(value: unknown, fieldPath: string): readonly unknown[] {
  if (value === undefined) {
    throw new OcpValidationError(fieldPath, `${fieldPath} is required`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'dense plain array',
      receivedValue: value,
    });
  }
  validatePlainWriterValue(value, fieldPath);
  if (!Array.isArray(value)) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be an array`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'dense plain array',
      receivedValue: value,
    });
  }
  return value;
}

/** Require an optional dense array, rejecting explicit null. */
export function optionalWriterArray(value: unknown, fieldPath: string): readonly unknown[] {
  if (value === undefined) return [];
  return requireWriterArray(value, fieldPath);
}

/** Require a present DAML/OCF Text value while preserving a schema-valid empty string. */
export function requireWriterString(value: unknown, fieldPath: string): string {
  if (value === undefined) {
    throw new OcpValidationError(fieldPath, `${fieldPath} is required`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'string',
      receivedValue: value,
    });
  }
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a string`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string',
      receivedValue: value,
    });
  }
  return value;
}

/** Validate the complete canonical OCF shape after contextual writer conversions have run. */
export function validateCanonicalObjectType<const EntityType extends OcfEntityType>(
  _entityType: EntityType,
  objectType: OcfDataTypeFor<EntityType>['object_type'],
  input: Record<string, unknown>,
  fieldPath: string
): void {
  const receivedObjectType = input.object_type;
  if (receivedObjectType === undefined) {
    throw new OcpValidationError(`${fieldPath}.object_type`, `${fieldPath}.object_type is required`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: objectType,
      receivedValue: receivedObjectType,
    });
  }
  if (receivedObjectType !== objectType) {
    throw new OcpValidationError(`${fieldPath}.object_type`, `${fieldPath}.object_type must be ${objectType}`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: objectType,
      receivedValue: receivedObjectType,
    });
  }
}

/** Validate the complete canonical OCF shape after contextual writer conversions have run. */
export function validateCanonicalWriterInput<const EntityType extends OcfEntityType>(
  entityType: EntityType,
  objectType: OcfDataTypeFor<EntityType>['object_type'],
  input: Record<string, unknown>,
  fieldPath: string
): void {
  validateCanonicalObjectType(entityType, objectType, input, fieldPath);
  try {
    parseOcfEntityInput(entityType, input);
  } catch (error) {
    if (!(error instanceof OcpValidationError)) throw error;
    const errorPath = error.fieldPath;
    if (errorPath === fieldPath || errorPath.startsWith(`${fieldPath}.`) || errorPath.startsWith(`${fieldPath}[`)) {
      throw error;
    }
    const contextualPath = errorPath.length === 0 ? fieldPath : `${fieldPath}.${errorPath}`;
    const message = error.message.replace(/^Validation error at '.*?': /, '');
    throw new OcpValidationError(contextualPath, message, {
      code: error.code,
      receivedValue: error.receivedValue,
      ...(error.expectedType !== undefined ? { expectedType: error.expectedType } : {}),
      ...(error.classification !== undefined ? { classification: error.classification } : {}),
      ...(error.context !== undefined ? { context: error.context } : {}),
    });
  }
}

/** Encode optional comments without dropping schema-valid empty strings. */
export function commentsToDaml(value: unknown, fieldPath: string): string[] {
  const comments = optionalWriterArray(value, fieldPath);
  return comments.map((comment, index) => {
    if (typeof comment !== 'string') {
      throw new OcpValidationError(pathFor(fieldPath, index), 'Comment must be a string', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'string',
        receivedValue: comment,
      });
    }
    return comment;
  });
}

/** Encode security exemptions without accepting inherited, sparse, or incomplete records. */
export function securityLawExemptionsToDaml(
  value: unknown,
  fieldPath: string
): Array<{ description: string; jurisdiction: string }> {
  const exemptions = requireWriterArray(value, fieldPath);
  return exemptions.map((exemption, index) => {
    const path = pathFor(fieldPath, index);
    const record = requirePlainWriterInput(exemption, path);
    for (const field of ['description', 'jurisdiction'] as const) {
      const fieldValue = record[field];
      if (fieldValue === undefined) {
        throw new OcpValidationError(pathFor(path, field), `${pathFor(path, field)} is required`, {
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          expectedType: 'string',
          receivedValue: fieldValue,
        });
      }
      if (typeof fieldValue !== 'string') {
        throw new OcpValidationError(pathFor(path, field), `${pathFor(path, field)} must be a string`, {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'string',
          receivedValue: fieldValue,
        });
      }
    }
    return { description: record.description as string, jurisdiction: record.jurisdiction as string };
  });
}
