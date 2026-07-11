/** OCF to DAML converter for ConvertibleConversion entities. */

import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { CapitalizationDefinition, OcfConvertibleConversion } from '../../../types';
import { dateStringToDAMLTime, isRecord } from '../../../utils/typeConversions';
import { canonicalOptionalNumericToDaml } from '../shared/conversionMechanisms';
import {
  assertExactObjectFields,
  assertNotRuntimeProxy,
  optionalStringArrayToDaml,
  requireStringArray,
} from '../shared/ocfValues';

type DamlConvertibleConversion = Fairmint.OpenCapTable.OCF.ConvertibleConversion.ConvertibleConversionOcfData;

const ROOT_FIELDS = [
  'object_type',
  'id',
  'date',
  'reason_text',
  'security_id',
  'trigger_id',
  'resulting_security_ids',
  'balance_security_id',
  'capitalization_definition',
  'quantity_converted',
  'comments',
] as const;
const CAPITALIZATION_FIELDS = [
  'include_stock_class_ids',
  'include_stock_plans_ids',
  'include_security_ids',
  'exclude_security_ids',
] as const satisfies ReadonlyArray<keyof CapitalizationDefinition>;

function requiredMissing(field: string, expectedType: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(field, `${field} is required`, {
    code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    expectedType,
    receivedValue,
  });
}

function invalidType(field: string, expectedType: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(field, `${field} has an invalid type`, {
    code: OcpErrorCodes.INVALID_TYPE,
    expectedType,
    receivedValue,
  });
}

function invalidFormat(field: string, expectedType: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(field, `${field} has an invalid format`, {
    code: OcpErrorCodes.INVALID_FORMAT,
    expectedType,
    receivedValue,
  });
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (value === undefined) throw requiredMissing(field, 'object', value);
  assertNotRuntimeProxy(value, field, 'plain OCF object');
  if (!isRecord(value)) throw invalidType(field, 'object', value);
  return value;
}

function requireString(value: unknown, field: string): string {
  if (value === undefined) throw requiredMissing(field, 'string', value);
  if (typeof value !== 'string') throw invalidType(field, 'string', value);
  return value;
}

function requireNonEmptyString(value: unknown, field: string): string {
  const text = requireString(value, field);
  if (text.length === 0) throw invalidFormat(field, 'non-empty string', value);
  return text;
}

function requireObjectType(value: unknown): void {
  const field = 'convertibleConversion.object_type';
  const objectType = requireString(value, field);
  if (objectType !== 'TX_CONVERTIBLE_CONVERSION') {
    throw new OcpValidationError(field, `Unknown convertible-conversion object_type: ${objectType}`, {
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      expectedType: 'TX_CONVERTIBLE_CONVERSION',
      receivedValue: value,
    });
  }
}

function requiredDateToDaml(value: unknown, fieldPath: string): string {
  if (value === undefined) {
    throw requiredMissing(fieldPath, 'YYYY-MM-DD or RFC 3339 date-time string', value);
  }
  return dateStringToDAMLTime(value, fieldPath);
}

function optionalStringToDaml(value: unknown, field: string): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string') throw invalidType(field, 'string or omitted property', value);
  return value;
}

function capitalizationDefinitionToDaml(value: unknown): CapitalizationDefinition | null {
  const field = 'convertibleConversion.capitalization_definition';
  if (value === undefined) return null;
  if (value === null) throw invalidType(field, 'CapitalizationDefinition object or omitted property', value);
  const definition = requireRecord(value, field);
  assertExactObjectFields(definition, CAPITALIZATION_FIELDS, field);

  return {
    include_stock_class_ids: requireStringArray(definition.include_stock_class_ids, `${field}.include_stock_class_ids`),
    include_stock_plans_ids: requireStringArray(definition.include_stock_plans_ids, `${field}.include_stock_plans_ids`),
    include_security_ids: requireStringArray(definition.include_security_ids, `${field}.include_security_ids`),
    exclude_security_ids: requireStringArray(definition.exclude_security_ids, `${field}.exclude_security_ids`),
  };
}

/** Convert exact canonical OCF ConvertibleConversion data to generated DAML data. */
export function convertibleConversionDataToDaml(input: OcfConvertibleConversion): DamlConvertibleConversion {
  const field = 'convertibleConversion';
  const data = requireRecord(input, field);
  assertExactObjectFields(data, ROOT_FIELDS, field);
  requireObjectType(data.object_type);

  return {
    id: requireNonEmptyString(data.id, `${field}.id`),
    date: requiredDateToDaml(data.date, `${field}.date`),
    reason_text: requireNonEmptyString(data.reason_text, `${field}.reason_text`),
    security_id: requireNonEmptyString(data.security_id, `${field}.security_id`),
    trigger_id: requireNonEmptyString(data.trigger_id, `${field}.trigger_id`),
    resulting_security_ids: requireStringArray(data.resulting_security_ids, `${field}.resulting_security_ids`),
    balance_security_id: optionalStringToDaml(data.balance_security_id, `${field}.balance_security_id`),
    capitalization_definition: capitalizationDefinitionToDaml(data.capitalization_definition),
    quantity_converted: canonicalOptionalNumericToDaml(data.quantity_converted, `${field}.quantity_converted`),
    comments: optionalStringArrayToDaml(data.comments, `${field}.comments`),
  };
}
