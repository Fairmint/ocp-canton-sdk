import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { OcfWarrantIssuance, StockClassConversionRight, WarrantExerciseTrigger } from '../../../types/native';
import {
  cleanComments,
  dateStringToDAMLTime,
  monetaryToDaml,
  normalizeNumericString,
  optionalDateStringToDAMLTime,
  optionalString,
} from '../../../utils/typeConversions';
import {
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
  value: WarrantExerciseTrigger['type']
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

function requireStockClassTarget(right: StockClassConversionRight): string {
  if (!right.converts_to_stock_class_id) {
    throw new OcpValidationError(
      'warrantTrigger.conversion_right.converts_to_stock_class_id',
      'The current DAML stock-class right requires converts_to_stock_class_id',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
    );
  }
  return right.converts_to_stock_class_id;
}

function storageTrigger(
  trigger: WarrantExerciseTrigger,
  convertsToStockClassId: string
): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTrigger {
  const triggerFields = triggerFieldsToDaml(trigger, trigger.type, 'warrantIssuance.exercise_triggers[]');
  return {
    type_: triggerTypeToDaml(trigger.type),
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
  right: StockClassConversionRight
): Fairmint.OpenCapTable.Types.Conversion.OcfAnyConversionRight {
  const convertsToStockClassId = requireStockClassTarget(right);
  const mechanism = ratioMechanismToDaml(right.conversion_mechanism);
  return {
    tag: 'OcfRightStockClass',
    value: {
      type_: 'STOCK_CLASS_CONVERSION_RIGHT',
      conversion_mechanism: mechanism.conversion_mechanism,
      conversion_trigger: storageTrigger(trigger, convertsToStockClassId),
      converts_to_stock_class_id: convertsToStockClassId,
      ratio: mechanism.ratio,
      conversion_price: mechanism.conversion_price,
      converts_to_future_round: right.converts_to_future_round ?? null,
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
  trigger: WarrantExerciseTrigger
): Fairmint.OpenCapTable.Types.Conversion.OcfAnyConversionRight {
  const { conversion_right: right } = trigger;
  switch (right.type) {
    case 'WARRANT_CONVERSION_RIGHT':
      return {
        tag: 'OcfRightWarrant',
        value: {
          type_: 'WARRANT_CONVERSION_RIGHT',
          conversion_mechanism: warrantMechanismToDaml(right.conversion_mechanism),
          converts_to_future_round: right.converts_to_future_round ?? null,
          converts_to_stock_class_id: optionalString(right.converts_to_stock_class_id),
        },
      };
    case 'STOCK_CLASS_CONVERSION_RIGHT':
      return stockClassRightToDaml(trigger, right);
    default: {
      const unexpected: unknown = right;
      const type =
        typeof unexpected === 'object' && unexpected !== null && 'type' in unexpected
          ? String(unexpected.type)
          : String(unexpected);
      throw new OcpParseError(`Unknown warrant conversion right type: ${type}`, {
        source: 'conversion_right.type',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
      });
    }
  }
}

function triggerToDaml(trigger: WarrantExerciseTrigger): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTrigger {
  const triggerFields = triggerFieldsToDaml(trigger, trigger.type, 'warrantIssuance.exercise_triggers[]');
  return {
    type_: triggerTypeToDaml(trigger.type),
    trigger_id: trigger.trigger_id,
    conversion_right: conversionRightToDaml(trigger),
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
    exercise_price: input.exercise_price ? monetaryToDaml(input.exercise_price) : null,
    purchase_price: monetaryToDaml(input.purchase_price),
    exercise_triggers: input.exercise_triggers.map(triggerToDaml),
    warrant_expiration_date: optionalDateStringToDAMLTime(
      input.warrant_expiration_date,
      'warrantIssuance.warrant_expiration_date'
    ),
    vesting_terms_id: optionalString(input.vesting_terms_id),
    vestings: (input.vestings ?? [])
      .filter((vesting) => Number(normalizeNumericString(vesting.amount)) > 0)
      .map((vesting) => ({
        date: dateStringToDAMLTime(vesting.date, 'warrantIssuance.vestings[].date'),
        amount: normalizeNumericString(vesting.amount),
      })),
    comments: cleanComments(input.comments),
  };
}
