import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { ConvertibleConversionTrigger, ConvertibleType, OcfConvertibleIssuance } from '../../../types/native';
import { parseConversionTriggerFields } from '../../../utils/conversionTriggers';
import {
  cleanComments,
  dateStringToDAMLTime,
  monetaryToDaml,
  optionalDateStringToDAMLTime,
  optionalString,
} from '../../../utils/typeConversions';
import { canonicalOptionalNumericToDaml, convertibleMechanismToDaml } from '../shared/conversionMechanisms';
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
  right: ConvertibleConversionTrigger['conversion_right']
): Fairmint.OpenCapTable.Types.Conversion.OcfConvertibleConversionRight {
  return {
    type_: 'CONVERTIBLE_CONVERSION_RIGHT',
    conversion_mechanism: convertibleMechanismToDaml(right.conversion_mechanism),
    converts_to_future_round: right.converts_to_future_round ?? null,
    converts_to_stock_class_id: optionalString(right.converts_to_stock_class_id),
  };
}

function triggerToDaml(
  trigger: ConvertibleConversionTrigger,
  index: number
): Fairmint.OpenCapTable.OCF.ConvertibleIssuance.OcfConvertibleConversionTrigger {
  const source = `convertibleIssuance.conversion_triggers.${index}`;
  const parsed = parseConversionTriggerFields(trigger, source);
  const triggerFields = triggerFieldsToDaml(parsed, parsed.type, source);

  return {
    type_: triggerTypeToDaml(parsed.type),
    trigger_id: parsed.trigger_id,
    conversion_right: conversionRightToDaml(parsed.conversion_right),
    nickname: optionalString(parsed.nickname),
    trigger_description: optionalString(parsed.trigger_description),
    ...triggerFields,
  };
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
    investment_amount: monetaryToDaml(input.investment_amount),
    convertible_type: convertibleTypeToDaml(input.convertible_type),
    conversion_triggers: input.conversion_triggers.map(triggerToDaml),
    pro_rata: canonicalOptionalNumericToDaml(input.pro_rata, 'convertibleIssuance.pro_rata'),
    seniority: input.seniority.toString(),
    comments: cleanComments(input.comments),
  };
}
