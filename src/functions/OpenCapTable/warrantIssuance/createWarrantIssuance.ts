import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { Monetary } from '../../../types';
import {
  cleanComments,
  dateStringToDAMLTime,
  monetaryToDaml,
  normalizeNumericString,
  optionalString,
} from '../../../utils/typeConversions';

export interface SimpleVesting {
  date: string;
  amount: string;
}

type WarrantTriggerTypeInput =
  | 'AUTOMATIC_ON_CONDITION'
  | 'AUTOMATIC_ON_DATE'
  | 'ELECTIVE_AT_WILL'
  | 'ELECTIVE_ON_CONDITION'
  | 'ELECTIVE_IN_RANGE'
  | 'UNSPECIFIED';

type WarrantConversionMechanismInput =
  | { type: 'CUSTOM_CONVERSION'; custom_conversion_description: string }
  | {
      type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION';
      converts_to_percent: string;
      capitalization_definition?: string | null;
      capitalization_definition_rules?: Record<string, unknown> | null;
    }
  | { type: 'FIXED_AMOUNT_CONVERSION'; converts_to_quantity: string }
  | {
      type: 'VALUATION_BASED_CONVERSION';
      valuation_type: string;
      valuation_amount?: Monetary | null;
      capitalization_definition?: string | null;
      capitalization_definition_rules?: Record<string, unknown> | null;
    }
  | {
      type: 'SHARE_PRICE_BASED_CONVERSION';
      description: string;
      discount: boolean;
      discount_percentage?: string | null;
      discount_amount?: Monetary | null;
    };

export type WarrantExerciseTriggerInput =
  | WarrantTriggerTypeInput
  | {
      type: WarrantTriggerTypeInput;
      trigger_id?: string;
      nickname?: string;
      trigger_description?: string;
      trigger_date?: string; // YYYY-MM-DD or ISO datetime
      trigger_condition?: string;
      conversion_right?: {
        conversion_mechanism?: WarrantConversionMechanismInput;
        converts_to_future_round?: boolean;
        converts_to_stock_class_id?: string;
      };
    };

function normalizeTriggerType(t: WarrantTriggerTypeInput): WarrantTriggerTypeInput {
  return t;
}

function triggerTypeToDamlEnum(
  t: WarrantTriggerTypeInput
): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTriggerType {
  switch (t) {
    case 'AUTOMATIC_ON_DATE':
      return 'OcfTriggerTypeTypeAutomaticOnDate';
    case 'ELECTIVE_AT_WILL':
      return 'OcfTriggerTypeTypeElectiveAtWill';
    case 'ELECTIVE_ON_CONDITION':
      return 'OcfTriggerTypeTypeElectiveOnCondition';
    case 'ELECTIVE_IN_RANGE':
      return 'OcfTriggerTypeTypeElectiveInRange';
    case 'UNSPECIFIED':
      return 'OcfTriggerTypeTypeUnspecified';
    case 'AUTOMATIC_ON_CONDITION':
      return 'OcfTriggerTypeTypeAutomaticOnCondition';
    default: {
      const exhaustiveCheck: never = t;
      throw new OcpParseError(`Unknown warrant trigger type: ${exhaustiveCheck as string}`, {
        source: 'warrantTrigger.type',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}

function warrantMechanismToDamlVariant(
  m?: WarrantConversionMechanismInput
): Fairmint.OpenCapTable.Types.Conversion.OcfWarrantConversionMechanism {
  if (!m) {
    throw new OcpValidationError(
      'conversion_right.conversion_mechanism',
      'conversion_right.conversion_mechanism is required for warrant issuance',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
    );
  }
  switch (m.type) {
    case 'CUSTOM_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismCustom',
        value: { custom_conversion_description: m.custom_conversion_description },
      } as Fairmint.OpenCapTable.Types.Conversion.OcfWarrantConversionMechanism;
    case 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismPercentCapitalization',
        value: {
          converts_to_percent: m.converts_to_percent,
          capitalization_definition: optionalString(m.capitalization_definition),
          capitalization_definition_rules: (m.capitalization_definition_rules ??
            null) as Fairmint.OpenCapTable.Types.Conversion.OcfCapitalizationDefinitionRules | null,
        },
      } as Fairmint.OpenCapTable.Types.Conversion.OcfWarrantConversionMechanism;
    case 'FIXED_AMOUNT_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismFixedAmount',
        value: {
          converts_to_quantity: m.converts_to_quantity,
        },
      } as Fairmint.OpenCapTable.Types.Conversion.OcfWarrantConversionMechanism;
    case 'VALUATION_BASED_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismValuationBased',
        value: {
          valuation_type: m.valuation_type,
          valuation_amount: m.valuation_amount ? monetaryToDaml(m.valuation_amount) : null,
          capitalization_definition: optionalString(m.capitalization_definition),
          capitalization_definition_rules: (m.capitalization_definition_rules ??
            null) as Fairmint.OpenCapTable.Types.Conversion.OcfCapitalizationDefinitionRules | null,
        },
      } as Fairmint.OpenCapTable.Types.Conversion.OcfWarrantConversionMechanism;
    case 'SHARE_PRICE_BASED_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismSharePriceBased',
        value: {
          description: m.description,
          discount: m.discount,
          discount_percentage:
            m.discount_percentage === '' || m.discount_percentage == null
              ? null
              : normalizeNumericString(m.discount_percentage),
          discount_amount: m.discount_amount ? monetaryToDaml(m.discount_amount) : null,
        },
      } as Fairmint.OpenCapTable.Types.Conversion.OcfWarrantConversionMechanism;
  }
}

function buildWarrantRight(
  input: WarrantExerciseTriggerInput | undefined
): Fairmint.OpenCapTable.Types.Conversion.OcfAnyConversionRight {
  const details = typeof input === 'object' && 'conversion_right' in input ? input.conversion_right : undefined;
  const mechanism = warrantMechanismToDamlVariant(details?.conversion_mechanism);
  const converts_to_future_round =
    details && typeof details.converts_to_future_round === 'boolean' ? details.converts_to_future_round : null;
  const converts_to_stock_class_id = optionalString(details?.converts_to_stock_class_id);
  return {
    tag: 'OcfRightWarrant',
    value: {
      type_: 'WARRANT_CONVERSION_RIGHT',
      conversion_mechanism: mechanism,
      converts_to_future_round,
      converts_to_stock_class_id,
    },
  } as Fairmint.OpenCapTable.Types.Conversion.OcfAnyConversionRight;
}

function quantitySourceToDamlEnum(
  qs:
    | 'HUMAN_ESTIMATED'
    | 'MACHINE_ESTIMATED'
    | 'UNSPECIFIED'
    | 'INSTRUMENT_FIXED'
    | 'INSTRUMENT_MAX'
    | 'INSTRUMENT_MIN'
    | null
    | undefined
): Fairmint.OpenCapTable.Types.Stock.OcfQuantitySourceType | null {
  if (qs === undefined || qs === null) return null;
  switch (qs) {
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
    default: {
      const _exhaustiveCheck: never = qs;
      throw new OcpParseError(`Unknown quantity_source: ${String(qs)}`, {
        source: 'warrantIssuance.quantity_source',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}

function buildWarrantTrigger(t: WarrantExerciseTriggerInput, _index: number, _ocfId: string) {
  const normalized = typeof t === 'string' ? normalizeTriggerType(t) : normalizeTriggerType(t.type);
  const typeEnum = triggerTypeToDamlEnum(normalized);
  if (typeof t !== 'object' || !t.trigger_id) {
    throw new OcpValidationError(
      'warrantTrigger.trigger_id',
      'trigger_id is required for each warrant exercise trigger',
      {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      }
    );
  }
  const { trigger_id } = t;
  const nickname = typeof t.nickname === 'string' ? t.nickname : null;
  const trigger_description = typeof t.trigger_description === 'string' ? t.trigger_description : null;
  const trigger_dateStr = typeof t.trigger_date === 'string' ? t.trigger_date : undefined;
  const trigger_condition = typeof t.trigger_condition === 'string' ? t.trigger_condition : null;
  const conversion_right = buildWarrantRight(t);
  return {
    type_: typeEnum,
    trigger_id,
    nickname,
    trigger_description,
    conversion_right,
    trigger_date: trigger_dateStr ? dateStringToDAMLTime(trigger_dateStr) : null,
    trigger_condition,
  };
}

export function warrantIssuanceDataToDaml(d: {
  id: string;
  date: string;
  security_id: string;
  custom_id: string;
  stakeholder_id: string;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  consideration_text?: string;
  security_law_exemptions: Array<{ description: string; jurisdiction: string }>;
  quantity?: string;
  quantity_source?:
    | 'HUMAN_ESTIMATED'
    | 'MACHINE_ESTIMATED'
    | 'UNSPECIFIED'
    | 'INSTRUMENT_FIXED'
    | 'INSTRUMENT_MAX'
    | 'INSTRUMENT_MIN';
  exercise_price?: Monetary;
  purchase_price: Monetary;
  exercise_triggers: WarrantExerciseTriggerInput[];
  warrant_expiration_date?: string;
  vesting_terms_id?: string;
  vestings?: SimpleVesting[];
  comments?: string[];
}): Fairmint.OpenCapTable.OCF.WarrantIssuance.WarrantIssuanceOcfData {
  // Runtime truthiness check: DB JSONB may store quantity as explicit null or empty string
  // Must match the truthiness check used for the quantity field itself (d.quantity ? ... : null)
  const hasQuantity = Boolean(d.quantity);
  const quantitySourceDaml = hasQuantity
    ? quantitySourceToDamlEnum(d.quantity_source ?? 'UNSPECIFIED')
    : d.quantity_source
      ? quantitySourceToDamlEnum(d.quantity_source)
      : null;

  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    consideration_text: optionalString(d.consideration_text),
    security_law_exemptions: d.security_law_exemptions,
    quantity: d.quantity != null ? normalizeNumericString(d.quantity) : null,
    quantity_source: quantitySourceDaml ?? null,
    exercise_price: d.exercise_price ? monetaryToDaml(d.exercise_price) : null,
    purchase_price: monetaryToDaml(d.purchase_price),
    exercise_triggers: d.exercise_triggers.map((t, idx) => buildWarrantTrigger(t, idx, d.id)),
    warrant_expiration_date: d.warrant_expiration_date ? dateStringToDAMLTime(d.warrant_expiration_date) : null,
    vesting_terms_id: optionalString(d.vesting_terms_id),
    vestings: (d.vestings ?? [])
      .filter((v) => {
        // normalizeNumericString validates strict decimal format and rejects scientific notation
        const normalized = normalizeNumericString(v.amount);
        return parseFloat(normalized) > 0;
      })
      .map((v) => ({
        date: dateStringToDAMLTime(v.date),
        amount: normalizeNumericString(v.amount),
      })),
    comments: cleanComments(d.comments),
  };
}
