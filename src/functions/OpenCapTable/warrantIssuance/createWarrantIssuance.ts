import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { OcfWarrantIssuance, StockClassConversionRight, WarrantExerciseTrigger } from '../../../types/native';
import {
  cleanComments,
  dateStringToDAMLTime,
  isRecord,
  monetaryToDaml,
  normalizeNumericString,
  optionalDateStringToDAMLTime,
  optionalString,
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

function triggerTypeToDaml(
  value: WarrantExerciseTrigger['type'],
  field = 'warrantIssuance.exercise_triggers[].type'
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
  throw new OcpValidationError(field, `Unknown warrant trigger type: ${String(value)}`, {
    code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
    expectedType:
      'AUTOMATIC_ON_CONDITION | AUTOMATIC_ON_DATE | ELECTIVE_IN_RANGE | ELECTIVE_ON_CONDITION | ELECTIVE_AT_WILL | UNSPECIFIED',
    receivedValue: value,
  });
}

function invalidQuantitySource(value: unknown): never {
  throw new OcpValidationError(
    'warrantIssuance.quantity_source',
    'Expected a canonical quantity source when provided; omit the property when absent (explicit null is invalid)',
    {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'QuantitySourceType or omitted property',
      receivedValue: value,
    }
  );
}

function quantitySourceToDaml(value: unknown): Fairmint.OpenCapTable.Types.Stock.OcfQuantitySourceType | null {
  if (value === undefined) return null;
  if (value === null) return invalidQuantitySource(value);
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
  }
  return invalidQuantitySource(value);
}

function requireStockClassTarget(right: StockClassConversionRight, field: string): string {
  const value: unknown = right.converts_to_stock_class_id;
  const expectedType = 'non-empty string';
  if (value === undefined || value === null) {
    throw new OcpValidationError(field, 'The current DAML stock-class right requires converts_to_stock_class_id', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType,
      receivedValue: value,
    });
  }
  if (typeof value !== 'string') {
    throw new OcpValidationError(field, 'converts_to_stock_class_id must be a non-empty string', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType,
      receivedValue: value,
    });
  }
  if (value.length === 0) {
    throw new OcpValidationError(field, 'converts_to_stock_class_id must be a non-empty string', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType,
      receivedValue: value,
    });
  }
  return value;
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

function storageTrigger(
  trigger: WarrantExerciseTrigger,
  convertsToStockClassId: string,
  source: string
): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTrigger {
  const triggerFields = triggerFieldsToDaml(trigger, trigger.type, source);
  return {
    type_: triggerTypeToDaml(trigger.type, `${source}.type`),
    trigger_id: trigger.trigger_id,
    nickname: optionalString(trigger.nickname),
    trigger_description: optionalString(trigger.trigger_description),
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
  trigger: WarrantExerciseTrigger,
  right: StockClassConversionRight,
  source: string,
  triggerSource: string
): Fairmint.OpenCapTable.Types.Conversion.OcfAnyConversionRight {
  const convertsToStockClassId = requireStockClassTarget(right, `${source}.converts_to_stock_class_id`);
  const mechanism = ratioMechanismToDaml(right.conversion_mechanism, `${source}.conversion_mechanism`);
  return {
    tag: 'OcfRightStockClass',
    value: {
      type_: 'STOCK_CLASS_CONVERSION_RIGHT',
      conversion_mechanism: mechanism.conversion_mechanism,
      conversion_trigger: storageTrigger(trigger, convertsToStockClassId, triggerSource),
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
  trigger: WarrantExerciseTrigger,
  source: string,
  triggerSource: string
): Fairmint.OpenCapTable.Types.Conversion.OcfAnyConversionRight {
  const runtimeRight: unknown = trigger.conversion_right;
  if (!isRecord(runtimeRight)) {
    throw new OcpParseError(`Unknown warrant conversion right type: ${String(runtimeRight)}`, {
      source: `${source}.type`,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }
  const { conversion_right: right } = trigger;
  switch (right.type) {
    case 'WARRANT_CONVERSION_RIGHT':
      return {
        tag: 'OcfRightWarrant',
        value: {
          type_: 'WARRANT_CONVERSION_RIGHT',
          conversion_mechanism: warrantMechanismToDaml(right.conversion_mechanism, `${source}.conversion_mechanism`),
          converts_to_future_round: canonicalOptionalBooleanToDaml(
            right.converts_to_future_round,
            `${source}.converts_to_future_round`
          ),
          converts_to_stock_class_id: optionalNonEmptyStringToDaml(
            right.converts_to_stock_class_id,
            `${source}.converts_to_stock_class_id`
          ),
        },
      };
    case 'STOCK_CLASS_CONVERSION_RIGHT':
      return stockClassRightToDaml(trigger, right, source, triggerSource);
    default: {
      const unexpected: unknown = right;
      const type =
        typeof unexpected === 'object' && unexpected !== null && 'type' in unexpected
          ? String(unexpected.type)
          : String(unexpected);
      throw new OcpParseError(`Unknown warrant conversion right type: ${type}`, {
        source: `${source}.type`,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
      });
    }
  }
}

function triggerToDaml(
  trigger: WarrantExerciseTrigger,
  index: number
): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTrigger {
  const source = `warrantIssuance.exercise_triggers.${index}`;
  const triggerFields = triggerFieldsToDaml(trigger, trigger.type, source);
  return {
    type_: triggerTypeToDaml(trigger.type, `${source}.type`),
    trigger_id: trigger.trigger_id,
    conversion_right: conversionRightToDaml(trigger, `${source}.conversion_right`, source),
    nickname: optionalString(trigger.nickname),
    trigger_description: optionalString(trigger.trigger_description),
    ...triggerFields,
  };
}

export function warrantIssuanceDataToDaml(
  input: WarrantIssuanceInput
): Fairmint.OpenCapTable.OCF.WarrantIssuance.WarrantIssuanceOcfData {
  const quantitySource = input.quantity
    ? quantitySourceToDaml(input.quantity_source ?? 'UNSPECIFIED')
    : quantitySourceToDaml(input.quantity_source);
  return {
    id: input.id,
    date: dateStringToDAMLTime(input.date, 'warrantIssuance.date'),
    security_id: input.security_id,
    custom_id: input.custom_id,
    stakeholder_id: input.stakeholder_id,
    board_approval_date: optionalDateStringToDAMLTime(input.board_approval_date, 'warrantIssuance.board_approval_date'),
    stockholder_approval_date: optionalDateStringToDAMLTime(
      input.stockholder_approval_date,
      'warrantIssuance.stockholder_approval_date'
    ),
    consideration_text: optionalString(input.consideration_text),
    security_law_exemptions: input.security_law_exemptions,
    quantity: canonicalOptionalNumericToDaml(input.quantity, 'warrantIssuance.quantity'),
    quantity_source: quantitySource,
    exercise_price: input.exercise_price
      ? monetaryToDaml(input.exercise_price, 'warrantIssuance.exercise_price')
      : null,
    purchase_price: monetaryToDaml(input.purchase_price, 'warrantIssuance.purchase_price'),
    exercise_triggers: input.exercise_triggers.map(triggerToDaml),
    warrant_expiration_date: optionalDateStringToDAMLTime(
      input.warrant_expiration_date,
      'warrantIssuance.warrant_expiration_date'
    ),
    vesting_terms_id: optionalString(input.vesting_terms_id),
    vestings: (input.vestings ?? []).map((vesting, index) => {
      const source = `warrantIssuance.vestings.${index}`;
      const amount = normalizeNumericString(vesting.amount, `${source}.amount`);
      if (Number(amount) <= 0) {
        throw new OcpValidationError(`${source}.amount`, 'DAML warrant vesting amounts must be positive (> 0)', {
          code: OcpErrorCodes.OUT_OF_RANGE,
          expectedType: 'positive numeric string (> 0)',
          receivedValue: vesting.amount,
        });
      }
      return { date: dateStringToDAMLTime(vesting.date, `${source}.date`), amount };
    }),
    comments: cleanComments(input.comments),
  };
}
