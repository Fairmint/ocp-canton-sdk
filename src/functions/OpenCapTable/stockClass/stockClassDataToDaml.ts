import type { OcfStockClass } from '../../../types';
import { validateStockClassData } from '../../../utils/entityValidators';
import { stockClassTypeToDaml } from '../../../utils/enumConversions';
import {
  cleanComments,
  dateStringToDAMLTime,
  initialSharesAuthorizedToDaml,
  monetaryToDaml,
} from '../../../utils/typeConversions';

/**
 * Convert native OcfStockClass to DAML StockClassOcfData format.
 *
 * Note: Return type is Record<string, unknown> because the conversion_rights
 * structure in the SDK differs from the current DAML schema, which uses nested
 * OcfConversionTrigger objects. This is tracked for future alignment.
 *
 * @param stockClassData - Native stock class data
 * @returns DAML-formatted stock class data
 */
export function stockClassDataToDaml(stockClassData: OcfStockClass): Record<string, unknown> {
  // Validate input data using the entity validator
  validateStockClassData(stockClassData, 'stockClass');

  const d = stockClassData;
  return {
    id: d.id,
    name: d.name,
    class_type: stockClassTypeToDaml(d.class_type),
    default_id_prefix: d.default_id_prefix,
    initial_shares_authorized: initialSharesAuthorizedToDaml(d.initial_shares_authorized),
    votes_per_share: typeof d.votes_per_share === 'number' ? d.votes_per_share.toString() : d.votes_per_share,
    seniority: typeof d.seniority === 'number' ? d.seniority.toString() : d.seniority,
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    par_value: d.par_value ? monetaryToDaml(d.par_value) : null,
    price_per_share: d.price_per_share ? monetaryToDaml(d.price_per_share) : null,
    conversion_rights: (d.conversion_rights ?? []).map((right) => {
      const mechanism:
        | 'OcfConversionMechanismRatioConversion'
        | 'OcfConversionMechanismPercentCapitalizationConversion'
        | 'OcfConversionMechanismFixedAmountConversion' =
        right.conversion_mechanism === 'RATIO_CONVERSION'
          ? 'OcfConversionMechanismRatioConversion'
          : right.conversion_mechanism === 'PERCENT_CONVERSION'
            ? 'OcfConversionMechanismPercentCapitalizationConversion'
            : 'OcfConversionMechanismFixedAmountConversion';

      const trigger:
        | 'OcfTriggerTypeAutomaticOnCondition'
        | 'OcfTriggerTypeAutomaticOnDate'
        | 'OcfTriggerTypeElectiveAtWill'
        | 'OcfTriggerTypeElectiveOnCondition' = (() => {
        switch (right.conversion_trigger) {
          case 'AUTOMATIC_ON_CONDITION':
            return 'OcfTriggerTypeAutomaticOnCondition';
          case 'AUTOMATIC_ON_DATE':
            return 'OcfTriggerTypeAutomaticOnDate';
          case 'ELECTIVE_AT_WILL':
            return 'OcfTriggerTypeElectiveAtWill';
          case 'ELECTIVE_ON_CONDITION':
            return 'OcfTriggerTypeElectiveOnCondition';
          case 'ELECTIVE_ON_DATE':
            return 'OcfTriggerTypeElectiveAtWill';
          default:
            return 'OcfTriggerTypeAutomaticOnCondition';
        }
      })();

      let ratio: { numerator: string; denominator: string } | null = null;
      const numerator = right.ratio_numerator ?? right.ratio;
      const denominator = right.ratio_denominator ?? (right.ratio !== undefined ? 1 : undefined);
      if (numerator !== undefined && denominator !== undefined) {
        ratio = {
          numerator: typeof numerator === 'number' ? numerator.toString() : String(numerator),
          denominator: typeof denominator === 'number' ? denominator.toString() : String(denominator),
        };
      }

      return {
        type_: right.type,
        conversion_mechanism: mechanism,
        conversion_trigger: trigger,
        converts_to_stock_class_id: right.converts_to_stock_class_id,
        ratio: ratio ? { tag: 'Some', value: ratio } : null,
        percent_of_capitalization:
          right.percent_of_capitalization !== undefined
            ? {
                tag: 'Some',
                value:
                  typeof right.percent_of_capitalization === 'number'
                    ? right.percent_of_capitalization.toString()
                    : String(right.percent_of_capitalization),
              }
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
            ? {
                tag: 'Some',
                value:
                  typeof right.discount_rate === 'number'
                    ? right.discount_rate.toString()
                    : String(right.discount_rate),
              }
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
    liquidation_preference_multiple: d.liquidation_preference_multiple
      ? typeof d.liquidation_preference_multiple === 'number'
        ? d.liquidation_preference_multiple.toString()
        : d.liquidation_preference_multiple
      : null,
    participation_cap_multiple: d.participation_cap_multiple
      ? typeof d.participation_cap_multiple === 'number'
        ? d.participation_cap_multiple.toString()
        : d.participation_cap_multiple
      : null,
    comments: cleanComments(d.comments),
  };
}
