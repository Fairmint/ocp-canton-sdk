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
      type: 'PPS_BASED_CONVERSION';
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
      start_date?: string; // YYYY-MM-DD or ISO datetime (ELECTIVE_IN_RANGE)
      end_date?: string; // YYYY-MM-DD or ISO datetime (ELECTIVE_IN_RANGE)
      conversion_right?: {
        type?: string;
        conversion_mechanism?: WarrantConversionMechanismInput | Record<string, unknown>;
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

function mapWarrantCapitalizationRules(
  rules: unknown
): Fairmint.OpenCapTable.Types.Conversion.OcfCapitalizationDefinitionRules | null {
  if (!rules || typeof rules !== 'object') return null;
  const r = rules as Record<string, unknown>;
  return {
    include_outstanding_shares: Boolean(r.include_outstanding_shares),
    include_outstanding_options: Boolean(r.include_outstanding_options),
    include_outstanding_unissued_options: Boolean(r.include_outstanding_unissued_options),
    include_this_security: Boolean(r.include_this_security),
    include_other_converting_securities: Boolean(r.include_other_converting_securities),
    include_option_pool_topup_for_promised_options: Boolean(r.include_option_pool_topup_for_promised_options),
    include_additional_option_pool_topup: Boolean(r.include_additional_option_pool_topup),
    include_new_money: Boolean(r.include_new_money),
  } as Fairmint.OpenCapTable.Types.Conversion.OcfCapitalizationDefinitionRules;
}

function warrantMechanismToDamlVariant(
  m?: WarrantConversionMechanismInput
): Fairmint.OpenCapTable.Types.Conversion.OcfWarrantConversionMechanism {
  if (m === undefined) {
    throw new OcpValidationError(
      'conversion_right.conversion_mechanism',
      'conversion_right.conversion_mechanism is required for warrant issuance',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
    );
  }
  const obj: Record<string, unknown> = m as Record<string, unknown>;
  const typeStr = (typeof obj.type === 'string' ? obj.type : '').toUpperCase();

  switch (typeStr) {
    case 'CUSTOM_CONVERSION': {
      const desc =
        (obj.custom_conversion_description as string) ||
        (obj.custom_description as string) ||
        (typeof obj.description === 'string' ? obj.description : '');
      if (!desc) {
        throw new OcpValidationError(
          'conversion_right.conversion_mechanism',
          'CUSTOM_CONVERSION requires custom_conversion_description',
          { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
        );
      }
      return {
        tag: 'OcfWarrantMechanismCustom',
        value: { custom_conversion_description: desc },
      } as Fairmint.OpenCapTable.Types.Conversion.OcfWarrantConversionMechanism;
    }
    case 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION': {
      const ctp = obj.converts_to_percent;
      if (ctp === undefined || ctp === null) {
        throw new OcpValidationError(
          'conversion_right.conversion_mechanism',
          'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION requires converts_to_percent',
          { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
        );
      }
      return {
        tag: 'OcfWarrantMechanismPercentCapitalization',
        value: {
          converts_to_percent: normalizeNumericString(typeof ctp === 'number' ? ctp : String(ctp as string | number)),
          capitalization_definition: optionalString(obj.capitalization_definition as string | undefined),
          capitalization_definition_rules: mapWarrantCapitalizationRules(obj.capitalization_definition_rules),
        },
      } as Fairmint.OpenCapTable.Types.Conversion.OcfWarrantConversionMechanism;
    }
    case 'FIXED_AMOUNT_CONVERSION': {
      const ctq = obj.converts_to_quantity;
      if (ctq === undefined || ctq === null) {
        throw new OcpValidationError(
          'conversion_right.conversion_mechanism',
          'FIXED_AMOUNT_CONVERSION requires converts_to_quantity',
          { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
        );
      }
      return {
        tag: 'OcfWarrantMechanismFixedAmount',
        value: {
          converts_to_quantity: normalizeNumericString(typeof ctq === 'number' ? ctq : String(ctq as string | number)),
        },
      } as Fairmint.OpenCapTable.Types.Conversion.OcfWarrantConversionMechanism;
    }
    case 'VALUATION_BASED_CONVERSION': {
      if (!obj.valuation_type || typeof obj.valuation_type !== 'string') {
        throw new OcpValidationError(
          'conversion_right.conversion_mechanism',
          'VALUATION_BASED_CONVERSION requires valuation_type',
          { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
        );
      }
      return {
        tag: 'OcfWarrantMechanismValuationBased',
        value: {
          valuation_type: obj.valuation_type,
          valuation_amount: obj.valuation_amount ? monetaryToDaml(obj.valuation_amount as Monetary) : null,
          capitalization_definition: optionalString(obj.capitalization_definition as string | undefined),
          capitalization_definition_rules: mapWarrantCapitalizationRules(obj.capitalization_definition_rules),
        },
      } as Fairmint.OpenCapTable.Types.Conversion.OcfWarrantConversionMechanism;
    }
    case 'PPS_BASED_CONVERSION': {
      if (typeof obj.description !== 'string' || !obj.description) {
        throw new OcpValidationError(
          'conversion_right.conversion_mechanism',
          'PPS_BASED_CONVERSION requires description',
          { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
        );
      }
      const dpct = obj.discount_percentage;
      return {
        tag: 'OcfWarrantMechanismPpsBased',
        value: {
          description: obj.description,
          discount: Boolean(obj.discount),
          discount_percentage:
            dpct === '' || dpct == null
              ? null
              : normalizeNumericString(typeof dpct === 'number' ? dpct : String(dpct as string | number)),
          discount_amount: obj.discount_amount ? monetaryToDaml(obj.discount_amount as Monetary) : null,
        },
      } as Fairmint.OpenCapTable.Types.Conversion.OcfWarrantConversionMechanism;
    }
    default:
      throw new OcpParseError(
        `Unknown warrant conversion_mechanism.type: "${typeStr || 'unknown'}" for WARRANT_CONVERSION_RIGHT`,
        { code: OcpErrorCodes.UNKNOWN_ENUM_VALUE }
      );
  }
}

/** Object-shaped warrant exercise trigger rows (excludes bare trigger-type strings). */
type WarrantExerciseTriggerObject = Exclude<WarrantExerciseTriggerInput, WarrantTriggerTypeInput>;

function warrantNestedConversionTrigger(
  t: WarrantExerciseTriggerObject & { trigger_id: string },
  converts_to_stock_class_id: string
): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTrigger {
  const normalized = normalizeTriggerType(t.type);
  const typeEnum = triggerTypeToDamlEnum(normalized);
  const trigger_dateStr = typeof t.trigger_date === 'string' ? t.trigger_date : undefined;
  return {
    type_: typeEnum,
    trigger_id: t.trigger_id,
    nickname: typeof t.nickname === 'string' ? t.nickname : null,
    trigger_description: typeof t.trigger_description === 'string' ? t.trigger_description : null,
    trigger_date: trigger_dateStr ? dateStringToDAMLTime(trigger_dateStr) : null,
    trigger_condition: typeof t.trigger_condition === 'string' ? t.trigger_condition : null,
    start_date: typeof t.start_date === 'string' && t.start_date ? dateStringToDAMLTime(t.start_date) : null,
    end_date: typeof t.end_date === 'string' && t.end_date ? dateStringToDAMLTime(t.end_date) : null,
    conversion_right: {
      tag: 'OcfRightConvertible',
      value: {
        type_: 'STOCK_CLASS_CONVERSION_RIGHT',
        conversion_mechanism: {
          tag: 'OcfConvMechCustom',
          value: { custom_conversion_description: 'Stock class conversion' },
        },
        converts_to_future_round: null,
        converts_to_stock_class_id,
      },
    },
  };
}

function parseStockClassRatioMechanismForWarrant(
  mechanism: unknown
): { ratio: Fairmint.OpenCapTable.Types.Stock.OcfRatio; conversion_price: Fairmint.OpenCapTable.Types.Monetary.OcfMonetary } {
  if (!mechanism || typeof mechanism !== 'object') {
    throw new OcpValidationError(
      'conversion_right.conversion_mechanism',
      'conversion_mechanism is required for STOCK_CLASS_CONVERSION_RIGHT',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
    );
  }
  const obj = mechanism as Record<string, unknown>;
  const mechType = (typeof obj.type === 'string' ? obj.type : '').toUpperCase();
  if (mechType !== 'RATIO_CONVERSION') {
    throw new OcpParseError(
      `Unsupported conversion_mechanism.type "${mechType || 'unknown'}" for STOCK_CLASS_CONVERSION_RIGHT on warrant — only RATIO_CONVERSION is supported`,
      { source: 'conversion_right.conversion_mechanism', code: OcpErrorCodes.UNKNOWN_ENUM_VALUE }
    );
  }
  const ratioRaw = obj.ratio;
  if (!ratioRaw || typeof ratioRaw !== 'object') {
    throw new OcpValidationError('conversion_right.conversion_mechanism.ratio', 'RATIO_CONVERSION requires ratio', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });
  }
  const r = ratioRaw as Record<string, unknown>;
  if (r.numerator == null || r.denominator == null) {
    throw new OcpValidationError(
      'conversion_right.conversion_mechanism.ratio',
      'ratio.numerator and ratio.denominator are required',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
    );
  }
  const conversionPriceRaw = obj.conversion_price;
  if (!conversionPriceRaw || typeof conversionPriceRaw !== 'object') {
    throw new OcpValidationError(
      'conversion_right.conversion_mechanism.conversion_price',
      'RATIO_CONVERSION requires conversion_price',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
    );
  }
  return {
    ratio: {
      numerator: normalizeNumericString(
        typeof r.numerator === 'number' ? r.numerator.toString() : String(r.numerator as string)
      ),
      denominator: normalizeNumericString(
        typeof r.denominator === 'number' ? r.denominator.toString() : String(r.denominator as string)
      ),
    },
    conversion_price: monetaryToDaml(conversionPriceRaw as Monetary),
  };
}

function buildWarrantStockClassConversionRight(
  exerciseTrigger: WarrantExerciseTriggerObject & { trigger_id: string },
  details: Record<string, unknown>
): Fairmint.OpenCapTable.Types.Conversion.OcfAnyConversionRight {
  const stockClassIdRaw = details.converts_to_stock_class_id;
  if (typeof stockClassIdRaw !== 'string' || !stockClassIdRaw.length) {
    throw new OcpValidationError(
      'conversion_right.converts_to_stock_class_id',
      'converts_to_stock_class_id is required for STOCK_CLASS_CONVERSION_RIGHT',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
    );
  }
  const { ratio, conversion_price } = parseStockClassRatioMechanismForWarrant(details.conversion_mechanism);
  const converts_to_future_round =
    typeof details.converts_to_future_round === 'boolean' ? details.converts_to_future_round : null;

  const value: Fairmint.OpenCapTable.Types.Conversion.OcfStockClassConversionRight = {
    type_: 'STOCK_CLASS_CONVERSION_RIGHT',
    conversion_mechanism: 'OcfConversionMechanismRatioConversion',
    conversion_trigger: warrantNestedConversionTrigger(exerciseTrigger, stockClassIdRaw),
    converts_to_stock_class_id: stockClassIdRaw,
    ratio,
    conversion_price,
    converts_to_future_round,
    ceiling_price_per_share: null,
    custom_description: null,
    discount_rate: null,
    expires_at: null,
    floor_price_per_share: null,
    percent_of_capitalization: null,
    reference_share_price: null,
    reference_valuation_price_per_share: null,
    valuation_cap: null,
  };

  return { tag: 'OcfRightStockClass', value };
}

function buildWarrantRight(
  exerciseTrigger: WarrantExerciseTriggerInput | undefined
): Fairmint.OpenCapTable.Types.Conversion.OcfAnyConversionRight {
  const detailsRaw =
    typeof exerciseTrigger === 'object' && 'conversion_right' in exerciseTrigger
      ? exerciseTrigger.conversion_right
      : undefined;

  const rightKind =
    detailsRaw !== undefined && typeof detailsRaw === 'object' && typeof detailsRaw.type === 'string'
      ? detailsRaw.type.toUpperCase()
      : undefined;

  if (
    typeof exerciseTrigger === 'object' &&
    'trigger_id' in exerciseTrigger &&
    typeof exerciseTrigger.trigger_id === 'string' &&
    exerciseTrigger.trigger_id &&
    rightKind === 'STOCK_CLASS_CONVERSION_RIGHT'
  ) {
    return buildWarrantStockClassConversionRight(
      exerciseTrigger as WarrantExerciseTriggerObject & { trigger_id: string },
      detailsRaw as Record<string, unknown>
    );
  }

  const details =
    typeof exerciseTrigger === 'object' && 'conversion_right' in exerciseTrigger
      ? exerciseTrigger.conversion_right
      : undefined;

  // Absent conversion_right.type or WARRANT_* → legacy warrant-shaped right

  if (rightKind !== undefined && rightKind !== 'WARRANT_CONVERSION_RIGHT') {
    throw new OcpParseError(`Unknown conversion_right.type: "${detailsRaw && typeof detailsRaw === 'object' && 'type' in detailsRaw ? String((detailsRaw as { type?: unknown }).type) : 'unknown'}"`, {
      source: 'conversion_right.type',
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
    });
  }

  const mechanism = warrantMechanismToDamlVariant(
    details?.conversion_mechanism as WarrantConversionMechanismInput | undefined
  );
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
  const start_date = typeof t === 'object' && t.start_date ? dateStringToDAMLTime(t.start_date) : null;
  const end_date = typeof t === 'object' && t.end_date ? dateStringToDAMLTime(t.end_date) : null;
  return {
    type_: typeEnum,
    trigger_id,
    nickname,
    trigger_description,
    conversion_right,
    trigger_date: trigger_dateStr ? dateStringToDAMLTime(trigger_dateStr) : null,
    trigger_condition,
    start_date,
    end_date,
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
