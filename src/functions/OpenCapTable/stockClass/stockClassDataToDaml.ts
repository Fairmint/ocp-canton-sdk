import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { OcfStockClass } from '../../../types';
import { validateStockClassData } from '../../../utils/entityValidators';
import { stockClassTypeToDaml } from '../../../utils/enumConversions';
import {
  initialSharesAuthorizedToDaml,
  monetaryToDaml,
  optionalDateStringToDAMLTime,
} from '../../../utils/typeConversions';
import { canonicalOptionalBooleanToDaml, ratioMechanismToDaml } from '../shared/conversionMechanisms';
import {
  assertCanonicalJsonGraph,
  assertExactObjectFields,
  assertNotRuntimeProxy,
  optionalStringArrayToDaml,
  requireDenseArray,
  requireMonetary,
  requireNonnegativeDecimal,
} from '../shared/ocfValues';

const ROOT_FIELDS = [
  'object_type',
  'id',
  'class_type',
  'default_id_prefix',
  'initial_shares_authorized',
  'name',
  'seniority',
  'votes_per_share',
  'comments',
  'conversion_rights',
  'board_approval_date',
  'liquidation_preference_multiple',
  'par_value',
  'participation_cap_multiple',
  'price_per_share',
  'stockholder_approval_date',
] as const;
const MONETARY_FIELDS = ['amount', 'currency'] as const;
const CONVERSION_RIGHT_FIELDS = [
  'type',
  'conversion_mechanism',
  'converts_to_stock_class_id',
  'converts_to_future_round',
] as const;

/** Guard the stock-class writer fields hardened by this conversion stack before schema/validator inspection. */
export function assertStockClassWriterProxyBoundary(value: unknown): void {
  assertCanonicalJsonGraph(value, 'stockClass');
}

function exactOptionalMonetary(value: unknown, field: string): ReturnType<typeof monetaryToDaml> | null {
  if (value === null || value === undefined) return null;
  assertNotRuntimeProxy(value, field, 'Monetary object');
  if (typeof value !== 'object' || Array.isArray(value)) return monetaryToDaml(requireMonetary(value, field));
  const monetary = value as Record<string, unknown>;
  assertExactObjectFields(monetary, MONETARY_FIELDS, field);
  return monetaryToDaml(requireMonetary(monetary, field));
}

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
  const runtimeStockClass: unknown = stockClassData;
  assertStockClassWriterProxyBoundary(runtimeStockClass);
  if (runtimeStockClass === null || typeof runtimeStockClass !== 'object' || Array.isArray(runtimeStockClass)) {
    throw new OcpValidationError('stockClass', 'stockClass must be a plain object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'plain OCF stock-class object',
      receivedValue: runtimeStockClass,
    });
  }
  assertExactObjectFields(runtimeStockClass as Record<string, unknown>, ROOT_FIELDS, 'stockClass');
  validateStockClassData(stockClassData, 'stockClass');

  const d = stockClassData;
  const conversionRights =
    d.conversion_rights === undefined ? [] : requireDenseArray(d.conversion_rights, 'stockClass.conversion_rights');
  return {
    id: d.id,
    name: d.name,
    class_type: stockClassTypeToDaml(d.class_type),
    default_id_prefix: d.default_id_prefix,
    initial_shares_authorized: initialSharesAuthorizedToDaml(
      d.initial_shares_authorized,
      'stockClass.initial_shares_authorized'
    ),
    votes_per_share: requireNonnegativeDecimal(d.votes_per_share, 'stockClass.votes_per_share'),
    seniority: requireNonnegativeDecimal(d.seniority, 'stockClass.seniority'),
    board_approval_date: optionalDateStringToDAMLTime(d.board_approval_date, 'stockClass.board_approval_date'),
    stockholder_approval_date: optionalDateStringToDAMLTime(
      d.stockholder_approval_date,
      'stockClass.stockholder_approval_date'
    ),
    par_value: exactOptionalMonetary(d.par_value, 'stockClass.par_value'),
    price_per_share: exactOptionalMonetary(d.price_per_share, 'stockClass.price_per_share'),
    conversion_rights: conversionRights.map((right, index) => {
      const field = `stockClass.conversion_rights.${index}`;
      const runtimeRight: unknown = right;
      assertNotRuntimeProxy(runtimeRight, field, 'StockClassConversionRight object');
      if (typeof runtimeRight !== 'object' || runtimeRight === null || Array.isArray(runtimeRight)) {
        throw new OcpParseError(`Unknown stock-class conversion right type: ${String(runtimeRight)}`, {
          source: `${field}.type`,
          code: OcpErrorCodes.SCHEMA_MISMATCH,
        });
      }
      const rightRecord = runtimeRight as Record<string, unknown>;
      assertExactObjectFields(rightRecord, CONVERSION_RIGHT_FIELDS, field);
      if (rightRecord.type !== 'STOCK_CLASS_CONVERSION_RIGHT') {
        const rawRightType = rightRecord.type;
        const rightType =
          rawRightType === null
            ? 'null'
            : typeof rawRightType === 'string' || typeof rawRightType === 'number' || typeof rawRightType === 'boolean'
              ? String(rawRightType)
              : typeof rawRightType;
        throw new OcpParseError(`Unknown stock-class conversion right type: ${rightType}`, {
          source: `${field}.type`,
          code: OcpErrorCodes.SCHEMA_MISMATCH,
        });
      }
      const typedRight = right as NonNullable<OcfStockClass['conversion_rights']>[number];
      const convertsToStockClassId = typedRight.converts_to_stock_class_id;
      const mechanism = ratioMechanismToDaml(typedRight.conversion_mechanism, `${field}.conversion_mechanism`);
      return {
        type_: 'STOCK_CLASS_CONVERSION_RIGHT',
        conversion_mechanism: mechanism.conversion_mechanism,
        conversion_trigger: buildStockClassTrigger(convertsToStockClassId, d.id, index),
        converts_to_stock_class_id: convertsToStockClassId,
        ratio: mechanism.ratio,
        conversion_price: mechanism.conversion_price,
        converts_to_future_round: canonicalOptionalBooleanToDaml(
          typedRight.converts_to_future_round,
          `${field}.converts_to_future_round`
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
      };
    }),
    liquidation_preference_multiple:
      d.liquidation_preference_multiple != null
        ? requireNonnegativeDecimal(d.liquidation_preference_multiple, 'stockClass.liquidation_preference_multiple')
        : null,
    participation_cap_multiple:
      d.participation_cap_multiple != null
        ? requireNonnegativeDecimal(d.participation_cap_multiple, 'stockClass.participation_cap_multiple')
        : null,
    comments: optionalStringArrayToDaml(d.comments, 'stockClass.comments'),
  };
}
