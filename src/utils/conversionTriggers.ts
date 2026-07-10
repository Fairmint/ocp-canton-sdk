import { OcpErrorCodes, OcpValidationError } from '../errors';
import type { ConversionTriggerFor, ConversionTriggerType } from '../types/native';
import { dateStringToDAMLTime } from './typeConversions';

const CONVERSION_TRIGGER_TYPES: ReadonlySet<string> = new Set([
  'AUTOMATIC_ON_CONDITION',
  'AUTOMATIC_ON_DATE',
  'ELECTIVE_IN_RANGE',
  'ELECTIVE_ON_CONDITION',
  'ELECTIVE_AT_WILL',
  'UNSPECIFIED',
]);

function isConversionTriggerType(value: unknown): value is ConversionTriggerType {
  switch (value) {
    case 'AUTOMATIC_ON_CONDITION':
    case 'AUTOMATIC_ON_DATE':
    case 'ELECTIVE_IN_RANGE':
    case 'ELECTIVE_ON_CONDITION':
    case 'ELECTIVE_AT_WILL':
    case 'UNSPECIFIED':
      return true;
    default:
      return false;
  }
}

export interface ConversionTriggerFields<ConversionRight> {
  type: unknown;
  trigger_id: unknown;
  conversion_right: ConversionRight;
  nickname?: unknown;
  trigger_description?: unknown;
  trigger_date?: unknown;
  trigger_condition?: unknown;
  start_date?: unknown;
  end_date?: unknown;
}

interface ConversionTriggerParseOptions {
  nullIsAbsent?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function fieldPath(source: string, field: string): string {
  return `${source}.${field}`;
}

function requireString(value: unknown, source: string, field: string): string {
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath(source, field), `${field} is required and must be a string`, {
      code: value === undefined || value === null ? OcpErrorCodes.REQUIRED_FIELD_MISSING : OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string',
      receivedValue: value,
    });
  }
  if (value.length === 0) {
    throw new OcpValidationError(fieldPath(source, field), `${field} is required and must be a non-empty string`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'non-empty string',
      receivedValue: value,
    });
  }
  return value;
}

function optionalString(value: unknown, source: string, field: string, nullIsAbsent: boolean): string | undefined {
  if (value === undefined || (nullIsAbsent && value === null)) return undefined;
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath(source, field), `${field} must be a string when present`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string',
      receivedValue: value,
    });
  }
  return value;
}

function requireTriggerType(value: unknown, source: string): ConversionTriggerType {
  if (!isConversionTriggerType(value)) {
    throw new OcpValidationError(fieldPath(source, 'type'), `Unknown conversion trigger type: ${String(value)}`, {
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      expectedType: [...CONVERSION_TRIGGER_TYPES].join(' | '),
      receivedValue: value,
    });
  }
  return value;
}

function rejectPresent(
  value: unknown,
  source: string,
  field: string,
  triggerType: ConversionTriggerType,
  nullIsAbsent: boolean
): void {
  if (value === undefined || (nullIsAbsent && value === null)) return;
  throw new OcpValidationError(
    fieldPath(source, field),
    `${field} is not valid for conversion trigger type ${triggerType}`,
    {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'absent',
      receivedValue: value,
    }
  );
}

function commonFields<ConversionRight>(
  fields: ConversionTriggerFields<ConversionRight>,
  source: string,
  nullIsAbsent: boolean
): {
  trigger_id: string;
  conversion_right: ConversionRight;
  nickname?: string;
  trigger_description?: string;
} {
  const trigger_id = requireString(fields.trigger_id, source, 'trigger_id');
  if (fields.conversion_right === undefined || fields.conversion_right === null) {
    throw new OcpValidationError(fieldPath(source, 'conversion_right'), 'conversion_right is required', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: fields.conversion_right,
    });
  }
  const nickname = optionalString(fields.nickname, source, 'nickname', nullIsAbsent);
  const trigger_description = optionalString(fields.trigger_description, source, 'trigger_description', nullIsAbsent);
  return {
    trigger_id,
    conversion_right: fields.conversion_right,
    ...(nickname !== undefined ? { nickname } : {}),
    ...(trigger_description !== undefined ? { trigger_description } : {}),
  };
}

/**
 * Validate and construct one exact canonical conversion-trigger variant.
 *
 * DAML readers may opt into treating `null` as an absent optional. OCF writers
 * keep the strict default and reject `null`. Any present field owned by another
 * variant is rejected instead of silently discarded.
 */
export function parseConversionTriggerFields<ConversionRight>(
  fields: ConversionTriggerFields<ConversionRight>,
  source: string,
  options?: ConversionTriggerParseOptions
): ConversionTriggerFor<ConversionRight>;
export function parseConversionTriggerFields(
  fields: unknown,
  source: string,
  options?: ConversionTriggerParseOptions
): ConversionTriggerFor<unknown>;
export function parseConversionTriggerFields(
  fields: unknown,
  source: string,
  options: ConversionTriggerParseOptions = {}
): ConversionTriggerFor<unknown> {
  if (!isRecord(fields)) {
    throw new OcpValidationError(source, 'Conversion trigger must be an object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'object',
      receivedValue: fields,
    });
  }
  const triggerFields: ConversionTriggerFields<unknown> = {
    type: fields.type,
    trigger_id: fields.trigger_id,
    conversion_right: fields.conversion_right,
    nickname: fields.nickname,
    trigger_description: fields.trigger_description,
    trigger_date: fields.trigger_date,
    trigger_condition: fields.trigger_condition,
    start_date: fields.start_date,
    end_date: fields.end_date,
  };
  const nullIsAbsent = options.nullIsAbsent ?? false;
  const type = requireTriggerType(triggerFields.type, source);
  const common = commonFields(triggerFields, source, nullIsAbsent);

  switch (type) {
    case 'AUTOMATIC_ON_CONDITION':
    case 'ELECTIVE_ON_CONDITION': {
      rejectPresent(triggerFields.trigger_date, source, 'trigger_date', type, nullIsAbsent);
      rejectPresent(triggerFields.start_date, source, 'start_date', type, nullIsAbsent);
      rejectPresent(triggerFields.end_date, source, 'end_date', type, nullIsAbsent);
      return {
        ...common,
        type,
        trigger_condition: requireString(triggerFields.trigger_condition, source, 'trigger_condition'),
      };
    }
    case 'AUTOMATIC_ON_DATE': {
      rejectPresent(triggerFields.trigger_condition, source, 'trigger_condition', type, nullIsAbsent);
      rejectPresent(triggerFields.start_date, source, 'start_date', type, nullIsAbsent);
      rejectPresent(triggerFields.end_date, source, 'end_date', type, nullIsAbsent);
      return {
        ...common,
        type,
        trigger_date: requireString(triggerFields.trigger_date, source, 'trigger_date'),
      };
    }
    case 'ELECTIVE_IN_RANGE': {
      rejectPresent(triggerFields.trigger_date, source, 'trigger_date', type, nullIsAbsent);
      rejectPresent(triggerFields.trigger_condition, source, 'trigger_condition', type, nullIsAbsent);
      return {
        ...common,
        type,
        start_date: requireString(triggerFields.start_date, source, 'start_date'),
        end_date: requireString(triggerFields.end_date, source, 'end_date'),
      };
    }
    case 'ELECTIVE_AT_WILL':
    case 'UNSPECIFIED': {
      rejectPresent(triggerFields.trigger_date, source, 'trigger_date', type, nullIsAbsent);
      rejectPresent(triggerFields.trigger_condition, source, 'trigger_condition', type, nullIsAbsent);
      rejectPresent(triggerFields.start_date, source, 'start_date', type, nullIsAbsent);
      rejectPresent(triggerFields.end_date, source, 'end_date', type, nullIsAbsent);
      return { ...common, type };
    }
  }
}

export interface DamlConversionTriggerTiming {
  trigger_date: string | null;
  trigger_condition: string | null;
  start_date: string | null;
  end_date: string | null;
}

/** Convert the timing fields of an already-validated trigger to their canonical DAML representation. */
export function conversionTriggerTimingToDaml<ConversionRight>(
  trigger: ConversionTriggerFor<ConversionRight>,
  source: string
): DamlConversionTriggerTiming {
  switch (trigger.type) {
    case 'AUTOMATIC_ON_CONDITION':
    case 'ELECTIVE_ON_CONDITION':
      return {
        trigger_date: null,
        trigger_condition: trigger.trigger_condition,
        start_date: null,
        end_date: null,
      };
    case 'AUTOMATIC_ON_DATE':
      return {
        trigger_date: dateStringToDAMLTime(trigger.trigger_date, `${source}.trigger_date`),
        trigger_condition: null,
        start_date: null,
        end_date: null,
      };
    case 'ELECTIVE_IN_RANGE':
      return {
        trigger_date: null,
        trigger_condition: null,
        start_date: dateStringToDAMLTime(trigger.start_date, `${source}.start_date`),
        end_date: dateStringToDAMLTime(trigger.end_date, `${source}.end_date`),
      };
    case 'ELECTIVE_AT_WILL':
    case 'UNSPECIFIED':
      return {
        trigger_date: null,
        trigger_condition: null,
        start_date: null,
        end_date: null,
      };
  }
}
