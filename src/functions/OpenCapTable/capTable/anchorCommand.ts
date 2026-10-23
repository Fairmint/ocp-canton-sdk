/**
 * Shared plumbing of the `CapTable` anchor's choice builders: the anchor command, argument guards and the JSON-safety
 * check every built payload passes before it leaves the SDK.
 */

import { OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { requireDate } from '../../../register/dates';
import { canonicalDecimal } from '../../../register/numeric';
import type { Command } from '../../../types/common';
import type { CapTableCommand, CapTableOperationMeta } from '../../../types/register';
import { assertSafeOcfJson } from '../../../utils/ocfJsonValidation';

/** The JSON choice argument of an `ExerciseCommand`. */
export type AnchorChoiceArgument = Extract<Command, { ExerciseCommand: unknown }>['ExerciseCommand']['choiceArgument'];

/** The anchor a choice is exercised on. */
export interface CapTableAnchorRef {
  /** The `CapTable` anchor's contract ID */
  capTableContractId: string;
  /** The anchor's template ID as the ledger reports it; defaults to the bundled `OpenCapTable-v35` template */
  capTableTemplateId?: string;
}

/** Throws unless the value is a non-empty string. */
export function requireText(value: unknown, fieldPath: string): string {
  if (typeof value !== 'string' || value === '') {
    throw new OcpValidationError(fieldPath, 'Required field is missing or empty', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'non-empty string',
      receivedValue: value,
    });
  }
  return value;
}

/** A decimal argument in canonical form. */
export function requireDecimal(value: unknown, fieldPath: string): string {
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, 'Expected a decimal string', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'decimal string',
      receivedValue: value,
    });
  }
  return canonicalDecimal(value, fieldPath);
}

/** A Daml `Date` argument: an exact `YYYY-MM-DD`. */
export function requireChoiceDate(value: unknown, fieldPath: string): string {
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, 'Expected a Daml Date (YYYY-MM-DD)', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'YYYY-MM-DD',
      receivedValue: value,
    });
  }
  return requireDate(value, fieldPath);
}

/** A list argument the ledger caps: non-empty and at most `max` long, with the ledger's own messages. */
export function requireBoundedList<Item>(
  value: readonly Item[],
  fieldPath: string,
  messages: { empty: string; tooMany: string },
  max: number
): readonly Item[] {
  if (!Array.isArray(value)) {
    throw new OcpValidationError(fieldPath, 'Expected an array', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'array',
      receivedValue: value,
    });
  }
  if (value.length === 0) {
    throw new OcpValidationError(fieldPath, messages.empty, { code: OcpErrorCodes.REQUIRED_FIELD_MISSING });
  }
  if (value.length > max) {
    throw new OcpValidationError(fieldPath, messages.tooMany, {
      code: OcpErrorCodes.OUT_OF_RANGE,
      receivedValue: value.length,
    });
  }
  return value;
}

/** Throws when two items share a key, as the ledger refuses a lot named twice. */
export function requireDistinct(keys: readonly string[], fieldPath: string, message: string): void {
  const seen = new Set<string>();
  for (const [index, key] of keys.entries()) {
    if (seen.has(key)) {
      throw new OcpValidationError(`${fieldPath}[${index}]`, message, {
        code: OcpErrorCodes.INVALID_FORMAT,
        receivedValue: key,
      });
    }
    seen.add(key);
  }
}

/** The allowed and required fields of one envelope kind. */
export interface EnvelopeFields {
  readonly required: readonly string[];
  readonly optional: readonly string[];
}

/** Validate an untyped caller's envelope exactly (JSON-safe, no unknown field, every required one) before reading it. */
export function assertExactEnvelope(value: unknown, kind: string, fields: EnvelopeFields, fieldPath: string): void {
  assertSafeOcfJson(value, fieldPath);
  const record = value as Record<string, unknown>;
  const allowed = new Set<string>([...fields.required, ...fields.optional]);
  const unknownField = Object.keys(record).find((field) => !allowed.has(field));
  if (unknownField !== undefined) {
    throw new OcpValidationError(`${fieldPath}.${unknownField}`, `Unexpected ${kind} operation field ${unknownField}`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: `only ${[...allowed].join(', ')}`,
      receivedValue: record[unknownField],
    });
  }
  for (const field of fields.required) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) {
      throw new OcpValidationError(`${fieldPath}.${field}`, `${kind} operation is missing required field ${field}`, {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        expectedType: fields.required.join(', '),
      });
    }
  }
}

/**
 * The JSON path of the first `undefined` in a payload, or `undefined` when there is none. Converters write `null` for
 * an absent optional; an `undefined` that slips through would otherwise reach Canton as an opaque
 * `commands.0: Invalid input`.
 */
export function findUndefinedPath(value: unknown, currentPath: string): string | undefined {
  if (value === undefined) return currentPath;
  if (value === null || typeof value !== 'object') return undefined;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      const found = findUndefinedPath(value[index], `${currentPath}[${index}]`);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  for (const [key, child] of Object.entries(value)) {
    const found = findUndefinedPath(child, `${currentPath}.${key}`);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * Throw when a built choice argument is not JSON-safe, naming the operation behind the bad value when `describe`
 * can tell it from the path.
 */
export function assertJsonSafe(choiceArgument: unknown, describe?: (path: string) => string | undefined): void {
  const undefinedPath = findUndefinedPath(choiceArgument, 'choiceArgument');
  if (undefinedPath === undefined) return;
  const operation = describe?.(undefinedPath);
  throw new OcpValidationError(
    'choiceArgument',
    `Converter produced non-JSON-safe payload: undefined value at "${undefinedPath}"` +
      `${operation !== undefined ? ` (${operation})` : ''}. ` +
      'This is a converter bug — all optional fields must use null, not undefined.',
    { code: OcpErrorCodes.INVALID_TYPE }
  );
}

/**
 * The `ExerciseCommand` of an anchor choice, submitted by its one controller, once the argument is proven JSON-safe
 * (`describe` names the operation behind a bad value).
 */
export function anchorCommand(
  anchor: CapTableAnchorRef,
  choice: string,
  choiceArgument: AnchorChoiceArgument,
  controller: string,
  describe?: (path: string) => string | undefined
): CapTableCommand {
  const contractId = requireText(anchor.capTableContractId, 'capTableContractId');
  const templateId =
    anchor.capTableTemplateId === undefined
      ? OCP_TEMPLATES.capTable
      : requireText(anchor.capTableTemplateId, 'capTableTemplateId');
  assertJsonSafe(choiceArgument, describe);
  return {
    command: { ExerciseCommand: { templateId, contractId, choice, choiceArgument } },
    disclosedContracts: [],
    actAs: [controller],
  };
}

/** The operation a JSON path into `choiceArgument.operations` points at, for a non-JSON-safe payload's message. */
export function describeOperationAt(
  operations: readonly CapTableOperationMeta[]
): (path: string) => string | undefined {
  return (path) => {
    const match = /^choiceArgument\.operations\[(\d+)]/.exec(path);
    const meta = match?.[1] === undefined ? undefined : operations[Number(match[1])];
    if (meta === undefined) return undefined;
    const subject = meta.id ?? meta.securityId;
    return `operation ${meta.index}: ${meta.entityType ?? meta.kind}${subject !== undefined ? ` ${subject}` : ''}`;
  };
}
