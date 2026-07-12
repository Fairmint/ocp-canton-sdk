import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { describeDiagnosticValue } from '../../../errors/diagnostics';
import type { ConvertibleConversionTrigger, ConvertibleType, OcfConvertibleIssuance } from '../../../types/native';
import { parseConversionTriggerFields } from '../../../utils/conversionTriggers';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';
import { canonicalOptionalNumericToDaml, convertibleMechanismToDaml } from '../shared/conversionMechanisms';
import { nativeMonetaryToDamlNumeric10 } from '../shared/damlNumerics';
import {
  canonicalOptionalBooleanToDaml,
  canonicalOptionalDateToDaml,
  canonicalOptionalTextToDaml,
} from '../shared/damlText';
import {
  commentsToDaml,
  requirePlainWriterInput,
  requireWriterArray,
  requireWriterString,
  securityLawExemptionsToDaml,
  validateCanonicalWriterInput,
} from '../shared/ocfWriterValidation';
import { triggerFieldsToDaml } from '../shared/triggerFields';

/** Strongly typed converter input; object_type is optional for direct helper use. */
export type ConvertibleIssuanceInput = Omit<OcfConvertibleIssuance, 'object_type'> & {
  readonly object_type?: 'TX_CONVERTIBLE_ISSUANCE';
};

const ROOT_FIELDS = [
  'object_type',
  'id',
  'date',
  'security_id',
  'custom_id',
  'stakeholder_id',
  'board_approval_date',
  'stockholder_approval_date',
  'consideration_text',
  'security_law_exemptions',
  'investment_amount',
  'convertible_type',
  'conversion_triggers',
  'pro_rata',
  'seniority',
  'comments',
] as const;
const MONETARY_FIELDS = ['amount', 'currency'] as const;
const SECURITY_EXEMPTION_FIELDS = ['description', 'jurisdiction'] as const;
const CONVERSION_RIGHT_FIELDS = [
  'type',
  'conversion_mechanism',
  'converts_to_future_round',
  'converts_to_stock_class_id',
] as const;
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
  assertNotRuntimeProxy(value, field, 'plain OCF object');
  if (!isRecord(value)) throw invalidType(field, 'object', value);
  return value;
}

function requireArray(value: unknown, field: string): unknown[] {
  if (value === null || value === undefined) throw requiredMissing(field, 'array', value);
  assertNotRuntimeProxy(value, field, 'ordinary JSON array');
  if (!Array.isArray(value)) throw invalidType(field, 'array', value);
  return requireDenseArray(value, field);
}

function requireString(value: unknown, field: string): string {
  if (value === null || value === undefined) throw requiredMissing(field, 'non-empty string', value);
  if (typeof value !== 'string') throw invalidType(field, 'non-empty string', value);
  if (value.length === 0) throw invalidFormat(field, 'non-empty string', value);
  return value;
}

function optionalTextToDaml(value: unknown, field: string): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string') throw invalidType(field, 'non-empty string or omitted property', value);
  if (value.length === 0) throw invalidFormat(field, 'non-empty string or omitted property', value);
  return value;
}

function requiredDateToDaml(value: unknown, fieldPath: string): string {
  if (value === null || value === undefined) {
    throw requiredMissing(fieldPath, 'YYYY-MM-DD or RFC 3339 date-time string', value);
  }
  return dateStringToDAMLTime(value, fieldPath);
}

function requiredMonetaryToDaml(value: unknown, field: string): ReturnType<typeof monetaryToDaml> {
  const monetary = requireRecord(value, field);
  assertExactObjectFields(monetary, MONETARY_FIELDS, field);
  return monetaryToDaml(requireMonetary(monetary, field), field);
}

function securityLawExemptionsToDaml(
  value: unknown,
  field: string
): Array<{ description: string; jurisdiction: string }> {
  return requireArray(value, field).map((entry, index) => {
    const source = `${field}.${index}`;
    const exemption = requireRecord(entry, source);
    assertExactObjectFields(exemption, SECURITY_EXEMPTION_FIELDS, source);
    return {
      description: requireString(exemption.description, `${source}.description`),
      jurisdiction: requireString(exemption.jurisdiction, `${source}.jurisdiction`),
    };
  });
}

function commentsToDaml(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  assertNotRuntimeProxy(value, field, 'ordinary JSON array of non-empty strings or omitted property');
  if (!Array.isArray(value)) throw invalidType(field, 'array of non-empty strings or omitted property', value);
  return requireDenseArray(value, field).map((comment, index) => requireString(comment, `${field}.${index}`));
}

function convertibleTypeToDaml(value: unknown): Fairmint.OpenCapTable.Types.Conversion.OcfConvertibleType {
  const field = 'convertibleIssuance.convertible_type';
  const runtimeValue = requireString(value, field);
  switch (runtimeValue) {
    case 'NOTE':
      return 'OcfConvertibleNote';
    case 'SAFE':
      return 'OcfConvertibleSafe';
    case 'CONVERTIBLE_SECURITY':
      return 'OcfConvertibleSecurity';
    default:
      throw new OcpValidationError(field, `Unknown convertible type: ${runtimeValue}`, {
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        expectedType: 'NOTE | SAFE | CONVERTIBLE_SECURITY',
        receivedValue: value,
      });
  }
  throw new OcpValidationError(
    'convertibleIssuance.convertible_type',
    `Unknown convertible type: ${describeDiagnosticValue(value)}`,
    {
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      expectedType: 'NOTE | SAFE | CONVERTIBLE_SECURITY',
      receivedValue: value,
    }
  );
}

function triggerTypeToDaml(
  value: unknown,
  field: string
): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTriggerType {
  const runtimeValue = requireString(value, field);
  switch (runtimeValue) {
    case 'AUTOMATIC_ON_CONDITION':
      return 'OcfTriggerTypeTypeAutomaticOnCondition';
    case 'AUTOMATIC_ON_DATE':
      return 'OcfTriggerTypeTypeAutomaticOnDate';
    case 'ELECTIVE_IN_RANGE':
      return 'OcfTriggerTypeTypeElectiveInRange';
    case 'ELECTIVE_ON_CONDITION':
      return 'OcfTriggerTypeTypeElectiveOnCondition';
    case 'ELECTIVE_AT_WILL':
      return 'OcfTriggerTypeTypeElectiveAtWill';
    case 'UNSPECIFIED':
      return 'OcfTriggerTypeTypeUnspecified';
    default:
      throw new OcpValidationError(field, `Unknown conversion trigger type: ${runtimeValue}`, {
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        expectedType:
          'AUTOMATIC_ON_CONDITION | AUTOMATIC_ON_DATE | ELECTIVE_IN_RANGE | ELECTIVE_ON_CONDITION | ELECTIVE_AT_WILL | UNSPECIFIED',
        receivedValue: value,
      });
  }
  throw new OcpValidationError(
    'convertibleIssuance.conversion_triggers[].type',
    `Unknown conversion trigger type: ${describeDiagnosticValue(value)}`,
    {
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      expectedType:
        'AUTOMATIC_ON_CONDITION | AUTOMATIC_ON_DATE | ELECTIVE_IN_RANGE | ELECTIVE_ON_CONDITION | ELECTIVE_AT_WILL | UNSPECIFIED',
      receivedValue: value,
    }
  );
}

function conversionRightToDaml(
  right: ConvertibleConversionTrigger['conversion_right'],
  source: string
): Fairmint.OpenCapTable.Types.Conversion.OcfConvertibleConversionRight {
  const record = requirePlainWriterInput(right, source);
  if (record.type !== 'CONVERTIBLE_CONVERSION_RIGHT') {
    throw new OcpValidationError(`${source}.type`, 'Convertible conversion right has an invalid or missing type', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'CONVERTIBLE_CONVERSION_RIGHT',
      receivedValue: record.type,
    });
  }
  return {
    type_: 'CONVERTIBLE_CONVERSION_RIGHT',
    conversion_mechanism: convertibleMechanismToDaml(
      record.conversion_mechanism as ConvertibleConversionTrigger['conversion_right']['conversion_mechanism'],
      `${source}.conversion_mechanism`
    ),
    converts_to_future_round: canonicalOptionalBooleanToDaml(
      record.converts_to_future_round,
      `${source}.converts_to_future_round`
    ),
    converts_to_stock_class_id: canonicalOptionalTextToDaml(
      record.converts_to_stock_class_id,
      `${source}.converts_to_stock_class_id`
    ),
  };
}

function triggerToDaml(
  value: unknown,
  index: number
): Fairmint.OpenCapTable.OCF.ConvertibleIssuance.OcfConvertibleConversionTrigger {
  const source = `convertibleIssuance.conversion_triggers[${index}]`;
  const parsed = parseConversionTriggerFields(trigger, source);
  const triggerFields = triggerFieldsToDaml(parsed, parsed.type, source);

  return {
    type_: triggerTypeToDaml(parsed.type, `${source}.type`),
    trigger_id: parsed.trigger_id,
    conversion_right: conversionRightToDaml(parsed.conversion_right, `${source}.conversion_right`),
    nickname: canonicalOptionalTextToDaml(parsed.nickname, `${source}.nickname`),
    trigger_description: canonicalOptionalTextToDaml(parsed.trigger_description, `${source}.trigger_description`),
    ...triggerFields,
  };
}

function seniorityToDaml(value: unknown): string {
  const field = 'convertibleIssuance.seniority';
  const expectedType = 'safe integer number';
  if (value === undefined) {
    throw new OcpValidationError(field, `${field} is required`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType,
      receivedValue: value,
    });
  }
  if (typeof value !== 'number') {
    throw new OcpValidationError(field, `${field} must be a number`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType,
      receivedValue: value,
    });
  }
  if (!Number.isSafeInteger(value)) {
    throw new OcpValidationError(field, `${field} must be a safe integer`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType,
      receivedValue: value,
    });
  }
  return value.toString();
}

export function convertibleIssuanceDataToDaml(
  input: ConvertibleIssuanceInput
): Fairmint.OpenCapTable.OCF.ConvertibleIssuance.ConvertibleIssuanceOcfData {
  const writerInput = requirePlainWriterInput(input, 'convertibleIssuance');
  requireWriterArray(input.conversion_triggers, 'convertibleIssuance.conversion_triggers');
  const result: Fairmint.OpenCapTable.OCF.ConvertibleIssuance.ConvertibleIssuanceOcfData = {
    id: requireWriterString(input.id, 'convertibleIssuance.id'),
    date: dateStringToDAMLTime(input.date, 'convertibleIssuance.date'),
    security_id: requireWriterString(input.security_id, 'convertibleIssuance.security_id'),
    custom_id: requireWriterString(input.custom_id, 'convertibleIssuance.custom_id'),
    stakeholder_id: requireWriterString(input.stakeholder_id, 'convertibleIssuance.stakeholder_id'),
    board_approval_date: canonicalOptionalDateToDaml(
      input.board_approval_date,
      'convertibleIssuance.board_approval_date'
    ),
    stockholder_approval_date: canonicalOptionalDateToDaml(
      input.stockholder_approval_date,
      'convertibleIssuance.stockholder_approval_date'
    ),
    consideration_text: canonicalOptionalTextToDaml(input.consideration_text, 'convertibleIssuance.consideration_text'),
    security_law_exemptions: securityLawExemptionsToDaml(
      input.security_law_exemptions,
      'convertibleIssuance.security_law_exemptions'
    ),
    investment_amount: nativeMonetaryToDamlNumeric10(input.investment_amount, 'convertibleIssuance.investment_amount'),
    convertible_type: convertibleTypeToDaml(input.convertible_type),
    conversion_triggers: input.conversion_triggers.map(triggerToDaml),
    pro_rata: canonicalOptionalNumericToDaml(input.pro_rata, 'convertibleIssuance.pro_rata'),
    seniority: seniorityToDaml(input.seniority),
    comments: commentsToDaml(input.comments, 'convertibleIssuance.comments'),
  };

  validateCanonicalWriterInput('convertibleIssuance', 'TX_CONVERTIBLE_ISSUANCE', writerInput, 'convertibleIssuance');
  return result;
}
