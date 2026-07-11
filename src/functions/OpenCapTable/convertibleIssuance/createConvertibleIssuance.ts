import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
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
  value: ConvertibleConversionTrigger['type']
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
  throw new OcpValidationError(
    'convertibleIssuance.conversion_triggers[].type',
    `Unknown conversion trigger type: ${String(value)}`,
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
  return {
    type_: 'CONVERTIBLE_CONVERSION_RIGHT',
    conversion_mechanism: convertibleMechanismToDaml(right.conversion_mechanism, `${source}.conversion_mechanism`),
    converts_to_future_round: canonicalOptionalBooleanToDaml(
      right.converts_to_future_round,
      `${source}.converts_to_future_round`
    ),
    converts_to_stock_class_id: canonicalOptionalTextToDaml(
      right.converts_to_stock_class_id,
      `${source}.converts_to_stock_class_id`
    ),
  };
}

function triggerToDaml(
  trigger: ConvertibleConversionTrigger,
  index: number
): Fairmint.OpenCapTable.OCF.ConvertibleIssuance.OcfConvertibleConversionTrigger {
  const source = `convertibleIssuance.conversion_triggers[${index}]`;
  const parsed = parseConversionTriggerFields(trigger, source);
  const triggerFields = triggerFieldsToDaml(parsed, parsed.type, source);

  return {
    type_: triggerTypeToDaml(parsed.type),
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
