import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { ConvertibleConversionTrigger, ConvertibleType, OcfConvertibleIssuance } from '../../../types/native';
import {
  cleanComments,
  dateStringToDAMLTime,
  monetaryToDaml,
  optionalDateStringToDAMLTime,
  optionalString,
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

function convertibleTypeToDaml(value: ConvertibleType): Fairmint.OpenCapTable.Types.Conversion.OcfConvertibleType {
  switch (value) {
    case 'NOTE':
      return 'OcfConvertibleNote';
    case 'SAFE':
      return 'OcfConvertibleSafe';
    case 'CONVERTIBLE_SECURITY':
      return 'OcfConvertibleSecurity';
  }
  throw new OcpValidationError('convertibleIssuance.convertible_type', `Unknown convertible type: ${String(value)}`, {
    code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
    expectedType: 'NOTE | SAFE | CONVERTIBLE_SECURITY',
    receivedValue: value,
  });
}

function triggerTypeToDaml(
  value: ConvertibleConversionTrigger['type'],
  field = 'convertibleIssuance.conversion_triggers[].type'
): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTriggerType {
  switch (value) {
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
  }
  throw new OcpValidationError(field, `Unknown conversion trigger type: ${String(value)}`, {
    code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
    expectedType:
      'AUTOMATIC_ON_CONDITION | AUTOMATIC_ON_DATE | ELECTIVE_IN_RANGE | ELECTIVE_ON_CONDITION | ELECTIVE_AT_WILL | UNSPECIFIED',
    receivedValue: value,
  });
}

function conversionRightToDaml(
  right: ConvertibleConversionTrigger['conversion_right'],
  source: string
): Fairmint.OpenCapTable.Types.Conversion.OcfConvertibleConversionRight {
  const runtimeRight: unknown = right;
  const rightType =
    typeof runtimeRight === 'object' && runtimeRight !== null && 'type' in runtimeRight
      ? String(runtimeRight.type)
      : String(runtimeRight);
  if (
    typeof runtimeRight !== 'object' ||
    runtimeRight === null ||
    !('type' in runtimeRight) ||
    runtimeRight.type !== 'CONVERTIBLE_CONVERSION_RIGHT'
  ) {
    throw new OcpParseError(`Unknown convertible conversion right type: ${rightType}`, {
      source: `${source}.type`,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }
  return {
    type_: 'CONVERTIBLE_CONVERSION_RIGHT',
    conversion_mechanism: convertibleMechanismToDaml(right.conversion_mechanism, `${source}.conversion_mechanism`),
    converts_to_future_round: canonicalOptionalBooleanToDaml(
      right.converts_to_future_round,
      `${source}.converts_to_future_round`
    ),
    converts_to_stock_class_id: optionalNonEmptyStringToDaml(
      right.converts_to_stock_class_id,
      `${source}.converts_to_stock_class_id`
    ),
  };
}

function optionalNonEmptyStringToDaml(value: unknown, field: string): string | null {
  const expectedType = 'non-empty string or omitted property';
  if (value === undefined) return null;
  // The generated DAML validator rejects Some ""; report the exact OCF field instead of silently storing None.
  if (typeof value !== 'string') {
    throw new OcpValidationError(field, `${field} must be a non-empty string when provided`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType,
      receivedValue: value,
    });
  }
  if (value.length === 0) {
    throw new OcpValidationError(field, `${field} must be a non-empty string when provided`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType,
      receivedValue: value,
    });
  }
  return value;
}

function triggerToDaml(
  trigger: ConvertibleConversionTrigger,
  index: number
): Fairmint.OpenCapTable.OCF.ConvertibleIssuance.OcfConvertibleConversionTrigger {
  const source = `convertibleIssuance.conversion_triggers.${index}`;
  const triggerFields = triggerFieldsToDaml(trigger, trigger.type, source);
  return {
    type_: triggerTypeToDaml(trigger.type, `${source}.type`),
    trigger_id: trigger.trigger_id,
    conversion_right: conversionRightToDaml(trigger.conversion_right, `${source}.conversion_right`),
    nickname: optionalString(trigger.nickname),
    trigger_description: optionalString(trigger.trigger_description),
    ...triggerFields,
  };
}

function seniorityToDaml(value: unknown): string {
  const field = 'convertibleIssuance.seniority';
  const expectedType = 'safe integer number';
  if (value === null || value === undefined) {
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
  return {
    id: input.id,
    date: dateStringToDAMLTime(input.date, 'convertibleIssuance.date'),
    security_id: input.security_id,
    custom_id: input.custom_id,
    stakeholder_id: input.stakeholder_id,
    board_approval_date: optionalDateStringToDAMLTime(
      input.board_approval_date,
      'convertibleIssuance.board_approval_date'
    ),
    stockholder_approval_date: optionalDateStringToDAMLTime(
      input.stockholder_approval_date,
      'convertibleIssuance.stockholder_approval_date'
    ),
    consideration_text: optionalString(input.consideration_text),
    security_law_exemptions: input.security_law_exemptions,
    investment_amount: monetaryToDaml(input.investment_amount, 'convertibleIssuance.investment_amount'),
    convertible_type: convertibleTypeToDaml(input.convertible_type),
    conversion_triggers: input.conversion_triggers.map(triggerToDaml),
    pro_rata: canonicalOptionalNumericToDaml(input.pro_rata, 'convertibleIssuance.pro_rata'),
    seniority: seniorityToDaml(input.seniority),
    comments: cleanComments(input.comments),
  };
}
