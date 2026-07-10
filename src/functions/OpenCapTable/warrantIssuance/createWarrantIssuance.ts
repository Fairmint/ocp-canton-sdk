import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type {
  OcfWarrantIssuance,
  QuantitySourceType,
  StockClassConversionRight,
  WarrantExerciseTrigger,
} from '../../../types/native';
import { parseConversionTriggerFields } from '../../../utils/conversionTriggers';
import {
  cleanComments,
  dateStringToDAMLTime,
  monetaryToDaml,
  normalizeNumericString,
  optionalString,
} from '../../../utils/typeConversions';
import { ratioMechanismToDaml, warrantMechanismToDaml } from '../shared/conversionMechanisms';

/** Strongly typed converter input; object_type is optional for direct helper use. */
export type WarrantIssuanceInput = Omit<OcfWarrantIssuance, 'object_type'> & {
  readonly object_type?: 'TX_WARRANT_ISSUANCE';
};

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

function quantitySourceToDaml(
  value: QuantitySourceType | undefined
): Fairmint.OpenCapTable.Types.Stock.OcfQuantitySourceType | null {
  if (value === undefined) return null;
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
  convertsToStockClassId: string,
  source: string
): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTrigger {
  const timing = triggerTimingToDaml(trigger, source);
  return {
    type_: triggerTypeToDaml(trigger.type),
    trigger_id: trigger.trigger_id,
    nickname: optionalString(trigger.nickname),
    trigger_description: optionalString(trigger.trigger_description),
    ...timing,
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
  source: string
): Fairmint.OpenCapTable.Types.Conversion.OcfAnyConversionRight {
  const convertsToStockClassId = requireStockClassTarget(right);
  const mechanism = ratioMechanismToDaml(right.conversion_mechanism);
  return {
    tag: 'OcfRightStockClass',
    value: {
      type_: 'STOCK_CLASS_CONVERSION_RIGHT',
      conversion_mechanism: mechanism.conversion_mechanism,
      conversion_trigger: storageTrigger(trigger, convertsToStockClassId, source),
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
  trigger: WarrantExerciseTrigger,
  source: string
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
      return stockClassRightToDaml(trigger, right, source);
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

function triggerTimingToDaml(trigger: WarrantExerciseTrigger, source: string) {
  switch (trigger.type) {
    case 'AUTOMATIC_ON_CONDITION':
    case 'ELECTIVE_ON_CONDITION':
      return {
        trigger_date: null,
        trigger_condition: trigger.trigger_condition,
        start_date: null,
        end_date: null,
      };
    case 'AUTOMATIC_ON_DATE':
      return {
        trigger_date: dateStringToDAMLTime(trigger.trigger_date, `${source}.trigger_date`),
        trigger_condition: null,
        start_date: null,
        end_date: null,
      };
    case 'ELECTIVE_IN_RANGE':
      return {
        trigger_date: null,
        trigger_condition: null,
        start_date: dateStringToDAMLTime(trigger.start_date, `${source}.start_date`),
        end_date: dateStringToDAMLTime(trigger.end_date, `${source}.end_date`),
      };
    case 'ELECTIVE_AT_WILL':
    case 'UNSPECIFIED':
      return {
        trigger_date: null,
        trigger_condition: null,
        start_date: null,
        end_date: null,
      };
  }
}

function triggerToDaml(
  trigger: WarrantExerciseTrigger,
  index: number
): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTrigger {
  const source = `warrantIssuance.exercise_triggers.${index}`;
  const parsed = parseConversionTriggerFields(trigger, source);
  return {
    type_: triggerTypeToDaml(parsed.type),
    trigger_id: parsed.trigger_id,
    conversion_right: conversionRightToDaml(parsed, source),
    nickname: optionalString(parsed.nickname),
    trigger_description: optionalString(parsed.trigger_description),
    ...triggerTimingToDaml(parsed, source),
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
    date: dateStringToDAMLTime(input.date),
    security_id: input.security_id,
    custom_id: input.custom_id,
    stakeholder_id: input.stakeholder_id,
    board_approval_date: input.board_approval_date ? dateStringToDAMLTime(input.board_approval_date) : null,
    stockholder_approval_date: input.stockholder_approval_date
      ? dateStringToDAMLTime(input.stockholder_approval_date)
      : null,
    consideration_text: optionalString(input.consideration_text),
    security_law_exemptions: input.security_law_exemptions,
    quantity: input.quantity === undefined ? null : normalizeNumericString(input.quantity),
    quantity_source: quantitySource,
    exercise_price: input.exercise_price ? monetaryToDaml(input.exercise_price) : null,
    purchase_price: monetaryToDaml(input.purchase_price),
    exercise_triggers: input.exercise_triggers.map(triggerToDaml),
    warrant_expiration_date: input.warrant_expiration_date ? dateStringToDAMLTime(input.warrant_expiration_date) : null,
    vesting_terms_id: optionalString(input.vesting_terms_id),
    vestings: (input.vestings ?? [])
      .filter((vesting) => Number(normalizeNumericString(vesting.amount)) > 0)
      .map((vesting) => ({
        date: dateStringToDAMLTime(vesting.date),
        amount: normalizeNumericString(vesting.amount),
      })),
    comments: cleanComments(input.comments),
  };
}
