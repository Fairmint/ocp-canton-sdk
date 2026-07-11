/** DAML to OCF converters for ConvertibleConversion entities. */

import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { CapitalizationDefinition, OcfConvertibleConversion } from '../../../types';
import { damlTimeToDateString, isRecord } from '../../../utils/typeConversions';
import { decodeLosslessGeneratedDamlValue } from '../capTable/damlCodecLosslessness';
import { requireDecimalString, requireDenseArray } from '../shared/ocfValues';

type GeneratedConvertibleConversionData = Fairmint.OpenCapTable.OCF.ConvertibleConversion.ConvertibleConversionOcfData;

/** Generated ledger representation with omitted Optional properties accepted at the direct JavaScript boundary. */
export type DamlConvertibleConversionData = Omit<
  GeneratedConvertibleConversionData,
  'balance_security_id' | 'capitalization_definition' | 'quantity_converted'
> & {
  readonly balance_security_id?: GeneratedConvertibleConversionData['balance_security_id'];
  readonly capitalization_definition?: GeneratedConvertibleConversionData['capitalization_definition'];
  readonly quantity_converted?: GeneratedConvertibleConversionData['quantity_converted'];
};

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
  if (value === null || value === undefined) throw requiredMissing(field, 'object', value);
  if (!isRecord(value)) throw invalidType(field, 'object', value);
  return value;
}

function requireString(value: unknown, field: string): string {
  if (value === null || value === undefined) throw requiredMissing(field, 'string', value);
  if (typeof value !== 'string') throw invalidType(field, 'string', value);
  return value;
}

function requireNonEmptyString(value: unknown, field: string): string {
  const stringValue = requireString(value, field);
  if (stringValue.length === 0) throw invalidFormat(field, 'non-empty string', value);
  return stringValue;
}

function optionalNonEmptyString(value: unknown, field: string): string | undefined {
  if (value === null || value === undefined) return undefined;
  return requireNonEmptyString(value, field);
}

function requireNonEmptyStringArray(value: unknown, field: string): string[] {
  if (value === null || value === undefined) throw requiredMissing(field, 'non-empty array of strings', value);
  if (!Array.isArray(value)) throw invalidType(field, 'non-empty array of strings', value);
  const values = requireDenseArray(value, field);
  if (values.length === 0) throw requiredMissing(field, 'non-empty array of strings', value);
  return values.map((item, index) => requireNonEmptyString(item, `${field}.${index}`));
}

function optionalComments(value: unknown): string[] | undefined {
  if (value === null || value === undefined) return undefined;
  const comments = requireDenseArray(value, 'convertibleConversion.comments').map((comment, index) =>
    requireString(comment, `convertibleConversion.comments.${index}`)
  );
  return comments.length === 0 ? undefined : comments;
}

function capitalizationDefinitionFromDaml(value: unknown): CapitalizationDefinition | undefined {
  if (value === null || value === undefined) return undefined;
  const field = 'convertibleConversion.capitalization_definition';
  const definition = requireRecord(value, field);
  const readIds = (name: keyof CapitalizationDefinition): string[] =>
    requireDenseArray(definition[name], `${field}.${name}`).map((id, index) =>
      requireString(id, `${field}.${name}.${index}`)
    );
  return {
    include_stock_class_ids: readIds('include_stock_class_ids'),
    include_stock_plans_ids: readIds('include_stock_plans_ids'),
    include_security_ids: readIds('include_security_ids'),
    exclude_security_ids: readIds('exclude_security_ids'),
  };
}

/** Convert exact generated DAML ConvertibleConversion data to canonical OCF. */
export function damlConvertibleConversionToNative(value: DamlConvertibleConversionData): OcfConvertibleConversion {
  const data = requireRecord(value, 'convertibleConversion');
  // Preserve the dedicated getter's historical error priority for an empty result set.
  const resultingSecurityIds = requireNonEmptyStringArray(
    data.resulting_security_ids,
    'convertibleConversion.resulting_security_ids'
  );
  const reasonText = requireNonEmptyString(data.reason_text, 'convertibleConversion.reason_text');
  const triggerId = requireNonEmptyString(data.trigger_id, 'convertibleConversion.trigger_id');
  const balanceSecurityId = optionalNonEmptyString(
    data.balance_security_id,
    'convertibleConversion.balance_security_id'
  );
  const capitalizationDefinition = capitalizationDefinitionFromDaml(data.capitalization_definition);
  const quantityConverted =
    data.quantity_converted === null || data.quantity_converted === undefined
      ? undefined
      : requireDecimalString(data.quantity_converted, 'convertibleConversion.quantity_converted');
  const comments = optionalComments(data.comments);

  const native: OcfConvertibleConversion = {
    object_type: 'TX_CONVERTIBLE_CONVERSION',
    id: requireNonEmptyString(data.id, 'convertibleConversion.id'),
    date: damlTimeToDateString(data.date, 'convertibleConversion.date'),
    reason_text: reasonText,
    security_id: requireNonEmptyString(data.security_id, 'convertibleConversion.security_id'),
    trigger_id: triggerId,
    resulting_security_ids: resultingSecurityIds,
    ...(balanceSecurityId !== undefined ? { balance_security_id: balanceSecurityId } : {}),
    ...(capitalizationDefinition !== undefined ? { capitalization_definition: capitalizationDefinition } : {}),
    ...(quantityConverted !== undefined ? { quantity_converted: quantityConverted } : {}),
    ...(comments !== undefined ? { comments } : {}),
  };

  decodeLosslessGeneratedDamlValue(
    Fairmint.OpenCapTable.OCF.ConvertibleConversion.ConvertibleConversionOcfData,
    data,
    {
      rootPath: 'convertibleConversion',
      description: 'convertibleConversion',
      decodeSource: 'getConvertibleConversionAsOcf',
      allowUndefinedOptional: true,
      allowNullishEmptyArray: true,
      context: {
        entityType: 'convertibleConversion',
        expectedTemplateId: Fairmint.OpenCapTable.OCF.ConvertibleConversion.ConvertibleConversion.templateId,
      },
    },
    {
      decodeInput: data.comments === null || data.comments === undefined ? { ...data, comments: [] } : data,
    }
  );

  return native;
}
