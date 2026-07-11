import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { ConvertibleConversionTrigger, OcfConvertibleIssuance } from '../../../types/native';
import {
  dateStringToDAMLTime,
  isRecord,
  monetaryToDaml,
  optionalDateStringToDAMLTime,
} from '../../../utils/typeConversions';
import {
  canonicalOptionalBooleanToDaml,
  canonicalOptionalNumericToDaml,
  convertibleMechanismToDaml,
} from '../shared/conversionMechanisms';
import { triggerFieldsToDaml } from '../shared/triggerFields';

/** Strongly typed converter input; object_type is optional for direct helper use. */
export type ConvertibleIssuanceInput = Omit<OcfConvertibleIssuance, 'object_type'> & {
  readonly object_type?: 'TX_CONVERTIBLE_ISSUANCE';
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

function requireArray(value: unknown, field: string): unknown[] {
  if (value === null || value === undefined) throw requiredMissing(field, 'array', value);
  if (!Array.isArray(value)) throw invalidType(field, 'array', value);
  return value;
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
  const amount = requireString(monetary.amount, `${field}.amount`);
  const currency = requireString(monetary.currency, `${field}.currency`);
  return monetaryToDaml({ amount, currency }, field);
}

function securityLawExemptionsToDaml(
  value: unknown,
  field: string
): Array<{ description: string; jurisdiction: string }> {
  return requireArray(value, field).map((entry, index) => {
    const source = `${field}.${index}`;
    const exemption = requireRecord(entry, source);
    return {
      description: requireString(exemption.description, `${source}.description`),
      jurisdiction: requireString(exemption.jurisdiction, `${source}.jurisdiction`),
    };
  });
}

function commentsToDaml(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw invalidType(field, 'array of non-empty strings or omitted property', value);
  return value.map((comment, index) => requireString(comment, `${field}.${index}`));
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
}

function triggerTypeToDaml(
  value: unknown,
  field = 'convertibleIssuance.conversion_triggers[].type'
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
}

function conversionRightToDaml(
  value: unknown,
  source: string
): Fairmint.OpenCapTable.Types.Conversion.OcfConvertibleConversionRight {
  const right = requireRecord(value, source);
  const rightType = requireString(right.type, `${source}.type`);
  if (rightType !== 'CONVERTIBLE_CONVERSION_RIGHT') {
    throw new OcpParseError(`Unknown convertible conversion right type: ${rightType}`, {
      source: `${source}.type`,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }
  return {
    type_: 'CONVERTIBLE_CONVERSION_RIGHT',
    conversion_mechanism: convertibleMechanismToDaml(
      right.conversion_mechanism as ConvertibleConversionTrigger['conversion_right']['conversion_mechanism'],
      `${source}.conversion_mechanism`
    ),
    converts_to_future_round: canonicalOptionalBooleanToDaml(
      right.converts_to_future_round,
      `${source}.converts_to_future_round`
    ),
    converts_to_stock_class_id: optionalTextToDaml(
      right.converts_to_stock_class_id,
      `${source}.converts_to_stock_class_id`
    ),
  };
}

function triggerToDaml(
  value: unknown,
  index: number
): Fairmint.OpenCapTable.OCF.ConvertibleIssuance.OcfConvertibleConversionTrigger {
  const source = `convertibleIssuance.conversion_triggers.${index}`;
  const trigger = requireRecord(value, source);
  const nativeType = requireString(trigger.type, `${source}.type`) as ConvertibleConversionTrigger['type'];
  const type = triggerTypeToDaml(nativeType, `${source}.type`);
  const triggerFields = triggerFieldsToDaml(trigger, nativeType, source);
  return {
    type_: type,
    trigger_id: requireString(trigger.trigger_id, `${source}.trigger_id`),
    conversion_right: conversionRightToDaml(trigger.conversion_right, `${source}.conversion_right`),
    nickname: optionalTextToDaml(trigger.nickname, `${source}.nickname`),
    trigger_description: optionalTextToDaml(trigger.trigger_description, `${source}.trigger_description`),
    ...triggerFields,
  };
}

function seniorityToDaml(value: unknown): string {
  const field = 'convertibleIssuance.seniority';
  const expectedType = 'safe integer number';
  if (value === null || value === undefined) throw requiredMissing(field, expectedType, value);
  if (typeof value !== 'number') throw invalidType(field, expectedType, value);
  if (!Number.isSafeInteger(value)) throw invalidFormat(field, expectedType, value);
  return value.toString();
}

export function convertibleIssuanceDataToDaml(
  input: ConvertibleIssuanceInput
): Fairmint.OpenCapTable.OCF.ConvertibleIssuance.ConvertibleIssuanceOcfData {
  const issuance = requireRecord(input, 'convertibleIssuance');
  if (issuance.object_type !== undefined && issuance.object_type !== 'TX_CONVERTIBLE_ISSUANCE') {
    throw new OcpValidationError('convertibleIssuance.object_type', 'Unexpected object_type', {
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      expectedType: 'TX_CONVERTIBLE_ISSUANCE or omitted property',
      receivedValue: issuance.object_type,
    });
  }
  const triggers = requireArray(issuance.conversion_triggers, 'convertibleIssuance.conversion_triggers');
  return {
    id: requireString(issuance.id, 'convertibleIssuance.id'),
    date: requiredDateToDaml(issuance.date, 'convertibleIssuance.date'),
    security_id: requireString(issuance.security_id, 'convertibleIssuance.security_id'),
    custom_id: requireString(issuance.custom_id, 'convertibleIssuance.custom_id'),
    stakeholder_id: requireString(issuance.stakeholder_id, 'convertibleIssuance.stakeholder_id'),
    board_approval_date: optionalDateStringToDAMLTime(
      issuance.board_approval_date,
      'convertibleIssuance.board_approval_date'
    ),
    stockholder_approval_date: optionalDateStringToDAMLTime(
      issuance.stockholder_approval_date,
      'convertibleIssuance.stockholder_approval_date'
    ),
    consideration_text: optionalTextToDaml(issuance.consideration_text, 'convertibleIssuance.consideration_text'),
    security_law_exemptions: securityLawExemptionsToDaml(
      issuance.security_law_exemptions,
      'convertibleIssuance.security_law_exemptions'
    ),
    investment_amount: requiredMonetaryToDaml(issuance.investment_amount, 'convertibleIssuance.investment_amount'),
    convertible_type: convertibleTypeToDaml(issuance.convertible_type),
    conversion_triggers: triggers.map(triggerToDaml),
    pro_rata: canonicalOptionalNumericToDaml(issuance.pro_rata, 'convertibleIssuance.pro_rata'),
    seniority: seniorityToDaml(issuance.seniority),
    comments: commentsToDaml(issuance.comments, 'convertibleIssuance.comments'),
  };
}
