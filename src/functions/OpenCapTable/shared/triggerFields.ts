import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type {
  ConversionTriggerFieldShape,
  ConversionTriggerFieldShapeFor,
  ConversionTriggerType,
} from '../../../types/native';
import { damlTimeToDateString, dateStringToDAMLTime } from '../../../utils/typeConversions';

export type OcfTriggerDiscriminator = ConversionTriggerType;

type TriggerField = 'trigger_date' | 'trigger_condition' | 'start_date' | 'end_date';

export interface TriggerFieldInput {
  trigger_date?: unknown;
  trigger_condition?: unknown;
  start_date?: unknown;
  end_date?: unknown;
}

export interface DamlTriggerFields {
  trigger_date: string | null;
  trigger_condition: string | null;
  start_date: string | null;
  end_date: string | null;
}

export type NativeTriggerFields<Type extends OcfTriggerDiscriminator = OcfTriggerDiscriminator> =
  ConversionTriggerFieldShapeFor<Type>;

const TRIGGER_FIELDS: readonly TriggerField[] = ['trigger_date', 'trigger_condition', 'start_date', 'end_date'];

function fieldPath(basePath: string, field: TriggerField): string {
  return `${basePath}.${field}`;
}

function rejectInputField(
  input: TriggerFieldInput,
  field: TriggerField,
  type: OcfTriggerDiscriminator,
  basePath: string
) {
  if (!Object.prototype.hasOwnProperty.call(input, field)) return;

  throw new OcpValidationError(fieldPath(basePath, field), `${field} is not allowed for ${type} triggers`, {
    code: OcpErrorCodes.INVALID_FORMAT,
    receivedValue: input[field],
  });
}

function rejectDamlField(
  input: TriggerFieldInput,
  field: TriggerField,
  type: OcfTriggerDiscriminator,
  basePath: string
) {
  if (input[field] === null || input[field] === undefined) return;

  throw new OcpValidationError(fieldPath(basePath, field), `${field} is not allowed for ${type} triggers`, {
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    receivedValue: input[field],
  });
}

function rejectInputFields(
  input: TriggerFieldInput,
  fields: readonly TriggerField[],
  type: OcfTriggerDiscriminator,
  basePath: string
): void {
  for (const field of fields) rejectInputField(input, field, type, basePath);
}

function rejectDamlFields(
  input: TriggerFieldInput,
  fields: readonly TriggerField[],
  type: OcfTriggerDiscriminator,
  basePath: string
): void {
  for (const field of fields) rejectDamlField(input, field, type, basePath);
}

function requiredCondition(value: unknown, path: string): string {
  if (value === null || value === undefined || value === '') {
    throw new OcpValidationError(path, 'trigger_condition is required for condition-based triggers', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: value,
    });
  }
  if (typeof value !== 'string') {
    throw new OcpValidationError(path, 'Expected a string', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string',
      receivedValue: value,
    });
  }
  return value;
}

function requiredDateToDaml(value: unknown, dateFieldPath: string): string {
  if (value === null || value === undefined) {
    throw new OcpValidationError(dateFieldPath, 'Date is required for this trigger type', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: value,
    });
  }
  return dateStringToDAMLTime(value, dateFieldPath);
}

function requiredDateFromDaml(value: unknown, dateFieldPath: string): string {
  if (value === null || value === undefined) {
    throw new OcpValidationError(dateFieldPath, 'Date is required for this trigger type', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: value,
    });
  }
  return damlTimeToDateString(value, dateFieldPath);
}

/** Validate an OCF trigger's complete discriminator-specific shape and encode it for DAML. */
export function triggerFieldsToDaml(input: ConversionTriggerFieldShape, basePath: string): DamlTriggerFields {
  switch (input.type) {
    case 'AUTOMATIC_ON_DATE':
      rejectInputFields(input, ['trigger_condition', 'start_date', 'end_date'], input.type, basePath);
      return {
        trigger_date: requiredDateToDaml(input.trigger_date, fieldPath(basePath, 'trigger_date')),
        trigger_condition: null,
        start_date: null,
        end_date: null,
      };
    case 'ELECTIVE_IN_RANGE':
      rejectInputFields(input, ['trigger_date', 'trigger_condition'], input.type, basePath);
      return {
        trigger_date: null,
        trigger_condition: null,
        start_date: requiredDateToDaml(input.start_date, fieldPath(basePath, 'start_date')),
        end_date: requiredDateToDaml(input.end_date, fieldPath(basePath, 'end_date')),
      };
    case 'AUTOMATIC_ON_CONDITION':
    case 'ELECTIVE_ON_CONDITION':
      rejectInputFields(input, ['trigger_date', 'start_date', 'end_date'], input.type, basePath);
      return {
        trigger_date: null,
        trigger_condition: requiredCondition(input.trigger_condition, fieldPath(basePath, 'trigger_condition')),
        start_date: null,
        end_date: null,
      };
    case 'ELECTIVE_AT_WILL':
    case 'UNSPECIFIED':
      rejectInputFields(input, TRIGGER_FIELDS, input.type, basePath);
      return { trigger_date: null, trigger_condition: null, start_date: null, end_date: null };
  }
}

/** Validate a DAML trigger's complete discriminator-specific shape and decode it as OCF. */
export function triggerFieldsFromDaml<Type extends OcfTriggerDiscriminator>(
  input: TriggerFieldInput,
  type: Type,
  basePath: string
): NativeTriggerFields<Type>;
export function triggerFieldsFromDaml(
  input: TriggerFieldInput,
  type: OcfTriggerDiscriminator,
  basePath: string
): NativeTriggerFields {
  switch (type) {
    case 'AUTOMATIC_ON_DATE':
      rejectDamlFields(input, ['trigger_condition', 'start_date', 'end_date'], type, basePath);
      return {
        type,
        trigger_date: requiredDateFromDaml(input.trigger_date, fieldPath(basePath, 'trigger_date')),
      };
    case 'ELECTIVE_IN_RANGE':
      rejectDamlFields(input, ['trigger_date', 'trigger_condition'], type, basePath);
      return {
        type,
        start_date: requiredDateFromDaml(input.start_date, fieldPath(basePath, 'start_date')),
        end_date: requiredDateFromDaml(input.end_date, fieldPath(basePath, 'end_date')),
      };
    case 'AUTOMATIC_ON_CONDITION':
    case 'ELECTIVE_ON_CONDITION':
      rejectDamlFields(input, ['trigger_date', 'start_date', 'end_date'], type, basePath);
      return {
        type,
        trigger_condition: requiredCondition(input.trigger_condition, fieldPath(basePath, 'trigger_condition')),
      };
    case 'ELECTIVE_AT_WILL':
    case 'UNSPECIFIED':
      rejectDamlFields(input, TRIGGER_FIELDS, type, basePath);
      return { type };
  }
}
