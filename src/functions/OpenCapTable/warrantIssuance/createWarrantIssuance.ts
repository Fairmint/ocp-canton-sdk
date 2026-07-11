import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type {
  OcfWarrantIssuance,
  RatioConversionMechanism,
  WarrantConversionMechanism,
  WarrantExerciseTrigger,
} from '../../../types/native';
import {
  dateStringToDAMLTime,
  isRecord,
  monetaryToDaml,
  normalizeNumericString,
  optionalDateStringToDAMLTime,
} from '../../../utils/typeConversions';
import {
  canonicalOptionalBooleanToDaml,
  canonicalOptionalNumericToDaml,
  ratioMechanismToDaml,
  warrantMechanismToDaml,
} from '../shared/conversionMechanisms';
import { triggerFieldsToDaml } from '../shared/triggerFields';

/** Strongly typed converter input; object_type is optional for direct helper use. */
export type WarrantIssuanceInput = Omit<OcfWarrantIssuance, 'object_type'> & {
  readonly object_type?: 'TX_WARRANT_ISSUANCE';
};

/** Canonical warrant trigger discriminator accepted by the strongly typed writer. */
export type WarrantTriggerTypeInput = WarrantExerciseTrigger['type'];

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

function optionalArray(value: unknown, field: string): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw invalidType(field, 'array or omitted property', value);
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

function requiredDateToDaml(value: unknown, field: string): string {
  if (value === null || value === undefined) {
    throw requiredMissing(field, 'YYYY-MM-DD or RFC 3339 date-time string', value);
  }
  return dateStringToDAMLTime(value, field);
}

function requiredMonetaryToDaml(value: unknown, field: string): ReturnType<typeof monetaryToDaml> {
  const monetary = requireRecord(value, field);
  const amount = requireString(monetary.amount, `${field}.amount`);
  const currency = requireString(monetary.currency, `${field}.currency`);
  return monetaryToDaml({ amount, currency }, field);
}

function optionalMonetaryToDaml(value: unknown, field: string): ReturnType<typeof monetaryToDaml> | null {
  if (value === undefined) return null;
  if (!isRecord(value)) throw invalidType(field, 'Monetary object or omitted property', value);
  return requiredMonetaryToDaml(value, field);
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

function triggerTypeToDaml(
  value: unknown,
  field = 'warrantIssuance.exercise_triggers[].type'
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
      throw new OcpValidationError(field, `Unknown warrant trigger type: ${runtimeValue}`, {
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        expectedType:
          'AUTOMATIC_ON_CONDITION | AUTOMATIC_ON_DATE | ELECTIVE_IN_RANGE | ELECTIVE_ON_CONDITION | ELECTIVE_AT_WILL | UNSPECIFIED',
        receivedValue: value,
      });
  }
}

function quantitySourceToDaml(value: unknown): Fairmint.OpenCapTable.Types.Stock.OcfQuantitySourceType | null {
  const field = 'warrantIssuance.quantity_source';
  if (value === undefined) return null;
  if (value === null) {
    throw new OcpValidationError(
      field,
      'Expected a canonical quantity source when provided; omit the property when absent (explicit null is invalid)',
      {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'QuantitySourceType or omitted property',
        receivedValue: value,
      }
    );
  }
  if (typeof value !== 'string') {
    throw invalidType(field, 'QuantitySourceType or omitted property', value);
  }
  switch (value) {
    case 'HUMAN_ESTIMATED':
      return 'OcfQuantityHumanEstimated';
    case 'MACHINE_ESTIMATED':
      return 'OcfQuantityMachineEstimated';
    case 'UNSPECIFIED':
      return 'OcfQuantityUnspecified';
    case 'INSTRUMENT_FIXED':
      return 'OcfQuantityInstrumentFixed';
    case 'INSTRUMENT_MAX':
      return 'OcfQuantityInstrumentMax';
    case 'INSTRUMENT_MIN':
      return 'OcfQuantityInstrumentMin';
    default:
      throw new OcpValidationError(field, `Unknown warrant quantity source: ${value}`, {
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        expectedType: 'QuantitySourceType',
        receivedValue: value,
      });
  }
}

function requireStockClassTarget(value: unknown, field: string): string {
  return requireString(value, field);
}

function storageTrigger(
  trigger: Record<string, unknown>,
  triggerType: WarrantExerciseTrigger['type'],
  convertsToStockClassId: string,
  source: string
): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTrigger {
  const triggerFields = triggerFieldsToDaml(trigger, triggerType, source);
  return {
    type_: triggerTypeToDaml(triggerType, `${source}.type`),
    trigger_id: requireString(trigger.trigger_id, `${source}.trigger_id`),
    nickname: optionalTextToDaml(trigger.nickname, `${source}.nickname`),
    trigger_description: optionalTextToDaml(trigger.trigger_description, `${source}.trigger_description`),
    ...triggerFields,
    conversion_right: {
      tag: 'OcfRightConvertible',
      value: {
        type_: 'CONVERTIBLE_CONVERSION_RIGHT',
        conversion_mechanism: {
          tag: 'OcfConvMechCustom',
          value: { custom_conversion_description: 'Stock class conversion' },
        },
        converts_to_future_round: null,
        converts_to_stock_class_id: convertsToStockClassId,
      },
    },
  };
}

function stockClassRightToDaml(
  trigger: Record<string, unknown>,
  triggerType: WarrantExerciseTrigger['type'],
  right: Record<string, unknown>,
  source: string,
  triggerSource: string
): Fairmint.OpenCapTable.Types.Conversion.OcfAnyConversionRight {
  const convertsToStockClassId = requireStockClassTarget(
    right.converts_to_stock_class_id,
    `${source}.converts_to_stock_class_id`
  );
  const mechanism = ratioMechanismToDaml(
    right.conversion_mechanism as RatioConversionMechanism,
    `${source}.conversion_mechanism`
  );
  return {
    tag: 'OcfRightStockClass',
    value: {
      type_: 'STOCK_CLASS_CONVERSION_RIGHT',
      conversion_mechanism: mechanism.conversion_mechanism,
      conversion_trigger: storageTrigger(trigger, triggerType, convertsToStockClassId, triggerSource),
      converts_to_stock_class_id: convertsToStockClassId,
      ratio: mechanism.ratio,
      conversion_price: mechanism.conversion_price,
      converts_to_future_round: canonicalOptionalBooleanToDaml(
        right.converts_to_future_round,
        `${source}.converts_to_future_round`
      ),
      ceiling_price_per_share: null,
      custom_description: null,
      discount_rate: null,
      expires_at: null,
      floor_price_per_share: null,
      percent_of_capitalization: null,
      reference_share_price: null,
      reference_valuation_price_per_share: null,
      valuation_cap: null,
    },
  };
}

function conversionRightToDaml(
  trigger: Record<string, unknown>,
  triggerType: WarrantExerciseTrigger['type'],
  source: string,
  triggerSource: string
): Fairmint.OpenCapTable.Types.Conversion.OcfAnyConversionRight {
  const right = requireRecord(trigger.conversion_right, source);
  const rightType = requireString(right.type, `${source}.type`);
  switch (rightType) {
    case 'WARRANT_CONVERSION_RIGHT':
      return {
        tag: 'OcfRightWarrant',
        value: {
          type_: 'WARRANT_CONVERSION_RIGHT',
          conversion_mechanism: warrantMechanismToDaml(
            right.conversion_mechanism as WarrantConversionMechanism,
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
        },
      };
    case 'STOCK_CLASS_CONVERSION_RIGHT':
      return stockClassRightToDaml(trigger, triggerType, right, source, triggerSource);
    default:
      throw new OcpParseError(`Unknown warrant conversion right type: ${rightType}`, {
        source: `${source}.type`,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
      });
  }
}

function triggerToDaml(value: unknown, index: number): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTrigger {
  const source = `warrantIssuance.exercise_triggers.${index}`;
  const trigger = requireRecord(value, source);
  const nativeType = requireString(trigger.type, `${source}.type`) as WarrantExerciseTrigger['type'];
  const type = triggerTypeToDaml(nativeType, `${source}.type`);
  const triggerFields = triggerFieldsToDaml(trigger, nativeType, source);
  return {
    type_: type,
    trigger_id: requireString(trigger.trigger_id, `${source}.trigger_id`),
    conversion_right: conversionRightToDaml(trigger, nativeType, `${source}.conversion_right`, source),
    nickname: optionalTextToDaml(trigger.nickname, `${source}.nickname`),
    trigger_description: optionalTextToDaml(trigger.trigger_description, `${source}.trigger_description`),
    ...triggerFields,
  };
}

export function warrantIssuanceDataToDaml(
  input: WarrantIssuanceInput
): Fairmint.OpenCapTable.OCF.WarrantIssuance.WarrantIssuanceOcfData {
  const issuance = requireRecord(input, 'warrantIssuance');
  if (issuance.object_type !== undefined && issuance.object_type !== 'TX_WARRANT_ISSUANCE') {
    throw new OcpValidationError('warrantIssuance.object_type', 'Unexpected object_type', {
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      expectedType: 'TX_WARRANT_ISSUANCE or omitted property',
      receivedValue: issuance.object_type,
    });
  }
  const quantity = canonicalOptionalNumericToDaml(issuance.quantity, 'warrantIssuance.quantity');
  const quantitySource =
    quantity !== null && issuance.quantity_source === undefined
      ? quantitySourceToDaml('UNSPECIFIED')
      : quantitySourceToDaml(issuance.quantity_source);
  const triggers = requireArray(issuance.exercise_triggers, 'warrantIssuance.exercise_triggers');
  const vestings = optionalArray(issuance.vestings, 'warrantIssuance.vestings');

  return {
    id: requireString(issuance.id, 'warrantIssuance.id'),
    date: requiredDateToDaml(issuance.date, 'warrantIssuance.date'),
    security_id: requireString(issuance.security_id, 'warrantIssuance.security_id'),
    custom_id: requireString(issuance.custom_id, 'warrantIssuance.custom_id'),
    stakeholder_id: requireString(issuance.stakeholder_id, 'warrantIssuance.stakeholder_id'),
    board_approval_date: optionalDateStringToDAMLTime(
      issuance.board_approval_date,
      'warrantIssuance.board_approval_date'
    ),
    stockholder_approval_date: optionalDateStringToDAMLTime(
      issuance.stockholder_approval_date,
      'warrantIssuance.stockholder_approval_date'
    ),
    consideration_text: optionalTextToDaml(issuance.consideration_text, 'warrantIssuance.consideration_text'),
    security_law_exemptions: securityLawExemptionsToDaml(
      issuance.security_law_exemptions,
      'warrantIssuance.security_law_exemptions'
    ),
    quantity,
    quantity_source: quantitySource,
    exercise_price: optionalMonetaryToDaml(issuance.exercise_price, 'warrantIssuance.exercise_price'),
    purchase_price: requiredMonetaryToDaml(issuance.purchase_price, 'warrantIssuance.purchase_price'),
    exercise_triggers: triggers.map(triggerToDaml),
    warrant_expiration_date: optionalDateStringToDAMLTime(
      issuance.warrant_expiration_date,
      'warrantIssuance.warrant_expiration_date'
    ),
    vesting_terms_id: optionalTextToDaml(issuance.vesting_terms_id, 'warrantIssuance.vesting_terms_id'),
    vestings: vestings.map((value, index) => {
      const source = `warrantIssuance.vestings.${index}`;
      const vesting = requireRecord(value, source);
      const rawAmount = requireString(vesting.amount, `${source}.amount`);
      const amount = normalizeNumericString(rawAmount, `${source}.amount`);
      if (Number(amount) <= 0) {
        throw new OcpValidationError(`${source}.amount`, 'DAML warrant vesting amounts must be positive (> 0)', {
          code: OcpErrorCodes.OUT_OF_RANGE,
          expectedType: 'positive numeric string (> 0)',
          receivedValue: vesting.amount,
        });
      }
      return { date: requiredDateToDaml(vesting.date, `${source}.date`), amount };
    }),
    comments: commentsToDaml(issuance.comments, 'warrantIssuance.comments'),
  };
}
