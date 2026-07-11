import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { OcfStockClass, StockClassConversionRight } from '../../../types';
import { validateStockClassData } from '../../../utils/entityValidators';
import { stockClassTypeToDaml } from '../../../utils/enumConversions';
import {
  cleanComments,
  initialSharesAuthorizedToDaml,
  monetaryToDaml,
  normalizeNumericString,
  optionalDateStringToDAMLTime,
} from '../../../utils/typeConversions';
import { ratioMechanismToDaml } from '../shared/conversionMechanisms';

/**
 * Build an OcfConversionTrigger record for a stock class conversion right.
 *
 * DAML requires a circular trigger record that OCF does not expose on a
 * StockClassConversionRight. Use an explicit unspecified trigger and a custom
 * convertible right solely as the generated contract's storage sentinel.
 */
function buildStockClassTrigger(
  convertsToStockClassId: string,
  stockClassId: string,
  index: number
): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTrigger {
  return {
    trigger_id: `default-${stockClassId}-${index}`,
    type_: 'OcfTriggerTypeTypeUnspecified',
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
    nickname: null,
    start_date: null,
    end_date: null,
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
export function stockClassDataToDaml(
  stockClassData: OcfStockClass
): Fairmint.OpenCapTable.OCF.StockClass.StockClassOcfData {
  validateStockClassData(stockClassData, 'stockClass');

  const d = stockClassData;
  return {
    id: d.id,
    name: d.name,
    class_type: stockClassTypeToDaml(d.class_type),
    default_id_prefix: d.default_id_prefix,
    initial_shares_authorized: initialSharesAuthorizedToDaml(
      d.initial_shares_authorized,
      'stockClass.initial_shares_authorized'
    ),
    votes_per_share: normalizeNumericString(d.votes_per_share, 'stockClass.votes_per_share'),
    seniority: normalizeNumericString(d.seniority, 'stockClass.seniority'),
    board_approval_date: optionalDateStringToDAMLTime(d.board_approval_date, 'stockClass.board_approval_date'),
    stockholder_approval_date: optionalDateStringToDAMLTime(
      d.stockholder_approval_date,
      'stockClass.stockholder_approval_date'
    ),
    par_value: d.par_value ? monetaryToDaml(d.par_value, 'stockClass.par_value') : null,
    price_per_share: d.price_per_share ? monetaryToDaml(d.price_per_share, 'stockClass.price_per_share') : null,
    conversion_rights: (d.conversion_rights ?? []).map((right, index) => {
      const field = `stockClass.conversion_rights.${index}`;
      const runtimeRight: unknown = right;
      const rightType =
        typeof runtimeRight === 'object' && runtimeRight !== null && 'type' in runtimeRight
          ? String(runtimeRight.type)
          : String(runtimeRight);
      if (
        typeof runtimeRight !== 'object' ||
        runtimeRight === null ||
        !('type' in runtimeRight) ||
        runtimeRight.type !== 'STOCK_CLASS_CONVERSION_RIGHT'
      ) {
        throw new OcpParseError(`Unknown stock-class conversion right type: ${rightType}`, {
          source: `${field}.type`,
          code: OcpErrorCodes.SCHEMA_MISMATCH,
        });
      }
      const convertsToStockClassId = requireStockClassTarget(right, `${field}.converts_to_stock_class_id`);
      const mechanism = ratioMechanismToDaml(right.conversion_mechanism, `${field}.conversion_mechanism`);

      return {
        type_: 'STOCK_CLASS_CONVERSION_RIGHT',
        conversion_mechanism: mechanism.conversion_mechanism,
        conversion_trigger: buildStockClassTrigger(convertsToStockClassId, d.id, index),
        converts_to_stock_class_id: convertsToStockClassId,
        ratio: mechanism.ratio,
        conversion_price: mechanism.conversion_price,
        converts_to_future_round:
          typeof right.converts_to_future_round === 'boolean' ? right.converts_to_future_round : null,
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
    }),
    liquidation_preference_multiple:
      d.liquidation_preference_multiple != null
        ? normalizeNumericString(d.liquidation_preference_multiple, 'stockClass.liquidation_preference_multiple')
        : null,
    participation_cap_multiple:
      d.participation_cap_multiple != null
        ? normalizeNumericString(d.participation_cap_multiple, 'stockClass.participation_cap_multiple')
        : null,
    comments: cleanComments(d.comments),
  };
}

function requireStockClassTarget(right: StockClassConversionRight, field: string): string {
  if (!right.converts_to_stock_class_id) {
    throw new OcpValidationError(field, 'The current DAML stock-class right requires converts_to_stock_class_id', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });
  }
  return right.converts_to_stock_class_id;
}
