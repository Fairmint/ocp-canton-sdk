import type { ConversionTrigger, OcfStockClass, StockClassConversionRight } from '../../../types';
import { validateStockClassData } from '../../../utils/entityValidators';
import { stockClassTypeToDaml } from '../../../utils/enumConversions';
import {
  cleanComments,
  dateStringToDAMLTime,
  initialSharesAuthorizedToDaml,
  monetaryToDaml,
  normalizeNumericString,
} from '../../../utils/typeConversions';

type StockClassTriggerType = ConversionTrigger | 'ELECTIVE_IN_RANGE' | 'UNSPECIFIED';

function triggerTypeToDamlEnum(t: StockClassTriggerType): string {
  switch (t) {
    case 'AUTOMATIC_ON_CONDITION':
      return 'OcfTriggerTypeTypeAutomaticOnCondition';
    case 'AUTOMATIC_ON_DATE':
      return 'OcfTriggerTypeTypeAutomaticOnDate';
    case 'ELECTIVE_AT_WILL':
      return 'OcfTriggerTypeTypeElectiveAtWill';
    case 'ELECTIVE_ON_CONDITION':
      return 'OcfTriggerTypeTypeElectiveOnCondition';
    case 'ELECTIVE_ON_DATE':
      return 'OcfTriggerTypeTypeElectiveOnDate';
    case 'ELECTIVE_IN_RANGE':
      return 'OcfTriggerTypeTypeElectiveInRange';
    case 'UNSPECIFIED':
      return 'OcfTriggerTypeTypeUnspecified';
    default: {
      const _exhaustive: never = t;
      throw new Error(`Unknown stock class conversion trigger type: ${_exhaustive as string}`);
    }
  }
}

function conversionMechanismToDaml(
  mechanism: string
):
  | 'OcfConversionMechanismRatioConversion'
  | 'OcfConversionMechanismPercentCapitalizationConversion'
  | 'OcfConversionMechanismFixedAmountConversion' {
  switch (mechanism) {
    case 'RATIO_CONVERSION':
      return 'OcfConversionMechanismRatioConversion';
    case 'PERCENT_CONVERSION':
      return 'OcfConversionMechanismPercentCapitalizationConversion';
    case 'FIXED_AMOUNT_CONVERSION':
      return 'OcfConversionMechanismFixedAmountConversion';
    default:
      throw new Error(`Unknown stock class conversion mechanism: ${mechanism}`);
  }
}

/**
 * Build an OcfConversionTrigger record for a stock class conversion right.
 *
 * DAML expects conversion_trigger to be a full OcfConversionTrigger record
 * (not a plain string). The trigger's conversion_right field uses the
 * OcfRightConvertible variant to avoid circular nesting with
 * OcfRightStockClass (which itself requires a conversion_trigger).
 */
function buildStockClassTrigger(
  right: StockClassConversionRight,
  stockClassId: string,
  index: number
): Record<string, unknown> {
  const triggerType = right.conversion_trigger as StockClassTriggerType;
  const typeEnum = triggerTypeToDamlEnum(triggerType);

  return {
    trigger_id: `${stockClassId}-trigger-${index}`,
    type_: typeEnum,
    conversion_right: {
      tag: 'OcfRightConvertible',
      value: {
        type_: right.type,
        conversion_mechanism: {
          tag: 'OcfConvMechCustom',
          value: { custom_conversion_description: 'Stock class conversion' },
        },
        converts_to_future_round: null,
        converts_to_stock_class_id: right.converts_to_stock_class_id,
      },
    },
    nickname: null,
    trigger_condition: null,
    trigger_date: null,
    trigger_description: null,
  };
}

/**
 * Convert native OcfStockClass to DAML StockClassOcfData format.
 *
 * @param stockClassData - Native stock class data
 * @returns DAML-formatted stock class data
 */
export function stockClassDataToDaml(stockClassData: OcfStockClass): Record<string, unknown> {
  validateStockClassData(stockClassData, 'stockClass');

  const d = stockClassData;
  return {
    id: d.id,
    name: d.name,
    class_type: stockClassTypeToDaml(d.class_type),
    default_id_prefix: d.default_id_prefix,
    initial_shares_authorized: initialSharesAuthorizedToDaml(d.initial_shares_authorized),
    votes_per_share: normalizeNumericString(d.votes_per_share),
    seniority: normalizeNumericString(d.seniority),
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    par_value: d.par_value ? monetaryToDaml(d.par_value) : null,
    price_per_share: d.price_per_share ? monetaryToDaml(d.price_per_share) : null,
    conversion_rights: (d.conversion_rights ?? []).map((right, index) => {
      const mechanism = conversionMechanismToDaml(right.conversion_mechanism);

      let ratio: { numerator: string; denominator: string } | null = null;
      if (right.ratio_numerator !== undefined && right.ratio_denominator !== undefined) {
        ratio = {
          numerator: normalizeNumericString(right.ratio_numerator),
          denominator: normalizeNumericString(right.ratio_denominator),
        };
      }

      return {
        type_: right.type,
        conversion_mechanism: mechanism,
        conversion_trigger: buildStockClassTrigger(right, d.id, index),
        converts_to_stock_class_id: right.converts_to_stock_class_id,
        ratio: ratio ? { tag: 'Some', value: ratio } : null,
        percent_of_capitalization:
          right.percent_of_capitalization !== undefined
            ? { tag: 'Some', value: normalizeNumericString(right.percent_of_capitalization) }
            : null,
        conversion_price: right.conversion_price
          ? { tag: 'Some', value: monetaryToDaml(right.conversion_price) }
          : null,
        reference_share_price: right.reference_share_price
          ? { tag: 'Some', value: monetaryToDaml(right.reference_share_price) }
          : null,
        reference_valuation_price_per_share: right.reference_valuation_price_per_share
          ? { tag: 'Some', value: monetaryToDaml(right.reference_valuation_price_per_share) }
          : null,
        discount_rate:
          right.discount_rate !== undefined
            ? { tag: 'Some', value: normalizeNumericString(right.discount_rate) }
            : null,
        valuation_cap: right.valuation_cap ? { tag: 'Some', value: monetaryToDaml(right.valuation_cap) } : null,
        floor_price_per_share: right.floor_price_per_share
          ? { tag: 'Some', value: monetaryToDaml(right.floor_price_per_share) }
          : null,
        ceiling_price_per_share: right.ceiling_price_per_share
          ? { tag: 'Some', value: monetaryToDaml(right.ceiling_price_per_share) }
          : null,
        custom_description: right.custom_description ? { tag: 'Some', value: right.custom_description } : null,
        expires_at: right.expires_at ? dateStringToDAMLTime(right.expires_at) : null,
      };
    }),
    liquidation_preference_multiple:
      d.liquidation_preference_multiple != null ? normalizeNumericString(d.liquidation_preference_multiple) : null,
    participation_cap_multiple:
      d.participation_cap_multiple != null ? normalizeNumericString(d.participation_cap_multiple) : null,
    comments: cleanComments(d.comments),
  };
}
