import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfStockClass, StockClassConversionRight } from '../../../types';
import { validateStockClassData } from '../../../utils/entityValidators';
import { stockClassTypeToDaml } from '../../../utils/enumConversions';
import {
  cleanComments,
  damlMonetaryToNativeWithValidation,
  initialSharesAuthorizedToDaml,
  monetaryToDaml,
  normalizeNumericString,
  optionalDateStringToDAMLTime,
} from '../../../utils/typeConversions';
import {
  STOCK_CLASS_CONVERSION_STORAGE_DESCRIPTION,
  stockClassConversionStorageTriggerId,
} from './stockClassConversionStorage';

/**
 * Adapt the OCF/DAML v34 schema mismatch at the private storage boundary.
 *
 * Canonical OCF forbids a conversion_trigger on StockClassConversionRight,
 * while DAML v34 structurally requires one but never validates or consumes it.
 * Keep that artifact out of the public model and use one stable, inert value so
 * a future DAML change that starts interpreting it fails generated/LocalNet tests.
 */
function buildStorageOnlyStockClassTrigger(
  right: StockClassConversionRight,
  convertsToStockClassId: string,
  stockClassId: string,
  index: number
): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTrigger {
  return {
    conversion_right: {
      tag: 'OcfRightConvertible',
      value: {
        conversion_mechanism: {
          tag: 'OcfConvMechCustom',
          value: { custom_conversion_description: STOCK_CLASS_CONVERSION_STORAGE_DESCRIPTION },
        },
        type_: 'CONVERTIBLE_CONVERSION_RIGHT',
        converts_to_future_round: right.converts_to_future_round ?? null,
        converts_to_stock_class_id: convertsToStockClassId,
      },
    },
    trigger_id: stockClassConversionStorageTriggerId(stockClassId, index),
    type_: 'OcfTriggerTypeTypeUnspecified',
    end_date: null,
    nickname: null,
    start_date: null,
    trigger_condition: null,
    trigger_date: null,
    trigger_description: null,
  };
}

function stockClassConversionRightToDaml(
  right: StockClassConversionRight,
  stockClassId: string,
  index: number
): Fairmint.OpenCapTable.Types.Conversion.OcfStockClassConversionRight {
  const rawRight = right as unknown as Record<string, unknown>;
  if (rawRight.type !== 'STOCK_CLASS_CONVERSION_RIGHT') {
    throw new OcpValidationError(
      `stockClass.conversion_rights[${index}].type`,
      'Stock-class conversion rights require the exact OCF discriminator',
      {
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        expectedType: 'STOCK_CLASS_CONVERSION_RIGHT',
        receivedValue: rawRight.type,
      }
    );
  }

  const convertsToStockClassId = right.converts_to_stock_class_id;
  if (typeof convertsToStockClassId !== 'string' || convertsToStockClassId.length === 0) {
    throw new OcpValidationError(
      `stockClass.conversion_rights[${index}].converts_to_stock_class_id`,
      'The current DAML package requires a target stock class for every stock-class conversion right',
      {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        expectedType: 'non-empty string',
        receivedValue: convertsToStockClassId,
      }
    );
  }

  const mechanismPath = `stockClass.conversion_rights[${index}].conversion_mechanism`;
  const rawMechanism = rawRight.conversion_mechanism;
  if (rawMechanism === null || typeof rawMechanism !== 'object' || Array.isArray(rawMechanism)) {
    throw new OcpValidationError(mechanismPath, 'A ratio conversion mechanism is required', {
      code:
        rawMechanism === undefined || rawMechanism === null
          ? OcpErrorCodes.REQUIRED_FIELD_MISSING
          : OcpErrorCodes.INVALID_TYPE,
      expectedType: 'RatioConversionMechanism object',
      receivedValue: rawMechanism,
    });
  }
  const mechanism = rawMechanism as Record<string, unknown>;
  if (mechanism.type !== 'RATIO_CONVERSION') {
    throw new OcpValidationError(`${mechanismPath}.type`, 'Stock-class rights require a ratio conversion mechanism', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      expectedType: 'RATIO_CONVERSION',
      receivedValue: mechanism.type,
    });
  }

  const roundingPath = `${mechanismPath}.rounding_type`;
  if (mechanism.rounding_type !== 'NORMAL') {
    throw new OcpValidationError(
      roundingPath,
      'The current DAML package does not persist stock-class conversion rounding; only NORMAL round-trips losslessly',
      {
        code: OcpErrorCodes.INVALID_FORMAT,
        expectedType: 'NORMAL',
        receivedValue: mechanism.rounding_type,
      }
    );
  }

  const conversionPricePath = `${mechanismPath}.conversion_price`;
  const conversionPrice = damlMonetaryToNativeWithValidation(mechanism.conversion_price, conversionPricePath);
  if (conversionPrice === undefined) {
    throw new OcpValidationError(conversionPricePath, 'A conversion price is required', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'Monetary object',
      receivedValue: mechanism.conversion_price,
    });
  }

  const ratioPath = `${mechanismPath}.ratio`;
  const rawRatio = mechanism.ratio;
  if (rawRatio === null || typeof rawRatio !== 'object' || Array.isArray(rawRatio)) {
    throw new OcpValidationError(ratioPath, 'A conversion ratio is required', {
      code:
        rawRatio === undefined || rawRatio === null ? OcpErrorCodes.REQUIRED_FIELD_MISSING : OcpErrorCodes.INVALID_TYPE,
      expectedType: '{ numerator: string; denominator: string }',
      receivedValue: rawRatio,
    });
  }
  const ratio = rawRatio as Record<string, unknown>;
  const requireRatioPart = (field: 'numerator' | 'denominator'): string => {
    const value = ratio[field];
    const fieldPath = `${ratioPath}.${field}`;
    if (typeof value !== 'string') {
      throw new OcpValidationError(fieldPath, `Conversion ratio ${field} must be a decimal string`, {
        code: value === undefined || value === null ? OcpErrorCodes.REQUIRED_FIELD_MISSING : OcpErrorCodes.INVALID_TYPE,
        expectedType: 'decimal string',
        receivedValue: value,
      });
    }
    return normalizeNumericString(value, fieldPath);
  };
  const ratioNumerator = requireRatioPart('numerator');
  const ratioDenominator = requireRatioPart('denominator');

  return {
    conversion_mechanism: 'OcfConversionMechanismRatioConversion',
    conversion_trigger: buildStorageOnlyStockClassTrigger(right, convertsToStockClassId, stockClassId, index),
    converts_to_stock_class_id: convertsToStockClassId,
    type_: right.type,
    ceiling_price_per_share: null,
    conversion_price: monetaryToDaml(conversionPrice, conversionPricePath),
    converts_to_future_round: right.converts_to_future_round ?? null,
    custom_description: null,
    discount_rate: null,
    expires_at: null,
    floor_price_per_share: null,
    percent_of_capitalization: null,
    ratio: {
      numerator: ratioNumerator,
      denominator: ratioDenominator,
    },
    reference_share_price: null,
    reference_valuation_price_per_share: null,
    valuation_cap: null,
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
    initial_shares_authorized: initialSharesAuthorizedToDaml(d.initial_shares_authorized),
    votes_per_share: normalizeNumericString(d.votes_per_share),
    seniority: normalizeNumericString(d.seniority),
    board_approval_date: optionalDateStringToDAMLTime(d.board_approval_date, 'stockClass.board_approval_date'),
    stockholder_approval_date: optionalDateStringToDAMLTime(
      d.stockholder_approval_date,
      'stockClass.stockholder_approval_date'
    ),
    par_value: d.par_value ? monetaryToDaml(d.par_value) : null,
    price_per_share: d.price_per_share ? monetaryToDaml(d.price_per_share) : null,
    conversion_rights: (d.conversion_rights ?? []).map((right, index) =>
      stockClassConversionRightToDaml(right, d.id, index)
    ),
    liquidation_preference_multiple:
      d.liquidation_preference_multiple != null ? normalizeNumericString(d.liquidation_preference_multiple) : null,
    participation_cap_multiple:
      d.participation_cap_multiple != null ? normalizeNumericString(d.participation_cap_multiple) : null,
    comments: cleanComments(d.comments),
  };
}
