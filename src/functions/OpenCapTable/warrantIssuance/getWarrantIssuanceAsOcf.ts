import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type {
  ConversionTriggerType,
  Monetary,
  OcfWarrantIssuance,
  VestingSimple,
  WarrantConversionMechanism,
  WarrantConversionRight,
  WarrantExerciseTrigger,
  WarrantMechanismCustom,
  WarrantMechanismFixedAmount,
  WarrantMechanismPercentCapitalization,
  WarrantMechanismPpsBased,
  WarrantMechanismValuationBased,
  WarrantStockClassConversionRight,
  WarrantTriggerConversionRight,
} from '../../../types/native';
import {
  damlMonetaryToNative,
  damlMonetaryToNativeWithValidation,
  mapDamlTriggerTypeToOcf,
  normalizeNumericString,
} from '../../../utils/typeConversions';
import { readSingleContract } from '../shared/singleContractRead';

export interface GetWarrantIssuanceAsOcfParams extends GetByContractIdParams {}
export interface GetWarrantIssuanceAsOcfResult {
  warrantIssuance: OcfWarrantIssuance & { object_type: 'TX_WARRANT_ISSUANCE' };
  contractId: string;
}

// Helper functions for DAML to OCF conversion

function mapWarrantMechanism(m: unknown): WarrantConversionMechanism {
  if (!m || typeof m !== 'object') {
    throw new OcpValidationError('warrantMechanism', 'Invalid warrant mechanism: expected object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'object',
      receivedValue: m,
    });
  }
  const mObj = m as Record<string, unknown>;
  const tag = typeof mObj.tag === 'string' ? mObj.tag : typeof m === 'string' ? m : '';
  const value =
    'value' in mObj && typeof mObj.value === 'object' && mObj.value ? (mObj.value as Record<string, unknown>) : {};

  switch (tag) {
    case 'OcfWarrantMechanismPercentCapitalization':
      return {
        type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
        converts_to_percent: normalizeNumericString(
          typeof value.converts_to_percent === 'number'
            ? value.converts_to_percent.toString()
            : (() => {
                if (typeof value.converts_to_percent !== 'string') {
                  throw new OcpValidationError(
                    'warrantMechanism.converts_to_percent',
                    `converts_to_percent must be string or number, got ${typeof value.converts_to_percent}`,
                    {
                      code: OcpErrorCodes.INVALID_TYPE,
                      expectedType: 'string | number',
                      receivedValue: value.converts_to_percent,
                    }
                  );
                }
                return value.converts_to_percent;
              })()
        ),
        ...(value.capitalization_definition && typeof value.capitalization_definition === 'string'
          ? { capitalization_definition: value.capitalization_definition }
          : {}),
        ...(value.capitalization_definition_rules
          ? { capitalization_definition_rules: value.capitalization_definition_rules as Record<string, unknown> }
          : {}),
      } as WarrantMechanismPercentCapitalization;
    case 'OcfWarrantMechanismFixedAmount':
      return {
        type: 'FIXED_AMOUNT_CONVERSION',
        converts_to_quantity: normalizeNumericString(
          typeof value.converts_to_quantity === 'number'
            ? value.converts_to_quantity.toString()
            : (() => {
                if (typeof value.converts_to_quantity !== 'string') {
                  throw new OcpValidationError(
                    'warrantMechanism.converts_to_quantity',
                    `converts_to_quantity must be string or number, got ${typeof value.converts_to_quantity}`,
                    {
                      code: OcpErrorCodes.INVALID_TYPE,
                      expectedType: 'string | number',
                      receivedValue: value.converts_to_quantity,
                    }
                  );
                }
                return value.converts_to_quantity;
              })()
        ),
      } as WarrantMechanismFixedAmount;
    case 'OcfWarrantMechanismValuationBased': {
      const valuationAmount = damlMonetaryToNativeWithValidation(value.valuation_amount as Record<string, unknown>);
      if (typeof value.valuation_type !== 'string' || !value.valuation_type) {
        throw new OcpValidationError(
          'warrantMechanism.valuation_type',
          'Warrant valuation_type is required and must be a non-empty string',
          { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, expectedType: 'string', receivedValue: value.valuation_type }
        );
      }
      return {
        type: 'VALUATION_BASED_CONVERSION',
        valuation_type: value.valuation_type,
        ...(valuationAmount ? { valuation_amount: valuationAmount } : {}),
        ...(value.capitalization_definition && typeof value.capitalization_definition === 'string'
          ? { capitalization_definition: value.capitalization_definition }
          : {}),
        ...(value.capitalization_definition_rules
          ? { capitalization_definition_rules: value.capitalization_definition_rules as Record<string, unknown> }
          : {}),
      } as WarrantMechanismValuationBased;
    }
    case 'OcfWarrantMechanismPpsBased': {
      const discountAmount = damlMonetaryToNativeWithValidation(value.discount_amount as Record<string, unknown>);
      if (typeof value.description !== 'string' || !value.description) {
        throw new OcpValidationError(
          'warrantMechanism.description',
          'Warrant share price mechanism description is required and must be a non-empty string',
          { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, expectedType: 'string', receivedValue: value.description }
        );
      }
      return {
        type: 'PPS_BASED_CONVERSION',
        description: value.description,
        discount: Boolean(value.discount),
        ...(value.discount_percentage !== undefined &&
        value.discount_percentage !== null &&
        (typeof value.discount_percentage === 'number' || typeof value.discount_percentage === 'string')
          ? {
              discount_percentage: normalizeNumericString(
                typeof value.discount_percentage === 'number'
                  ? value.discount_percentage.toString()
                  : value.discount_percentage
              ),
            }
          : {}),
        ...(discountAmount ? { discount_amount: discountAmount } : {}),
      } as WarrantMechanismPpsBased;
    }
    case 'OcfWarrantMechanismCustom':
      if (typeof value.custom_conversion_description !== 'string' || !value.custom_conversion_description) {
        throw new OcpValidationError(
          'warrantMechanism.custom_conversion_description',
          'Warrant custom conversion description is required and must be a non-empty string',
          {
            code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
            expectedType: 'string',
            receivedValue: value.custom_conversion_description,
          }
        );
      }
      return {
        type: 'CUSTOM_CONVERSION',
        custom_conversion_description: value.custom_conversion_description,
      } as WarrantMechanismCustom;
    default:
      throw new OcpParseError(`Unknown warrant mechanism: ${tag}`, {
        source: 'warrantMechanism.tag',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

function mapWarrantRightValueToNative(value: Record<string, unknown>): WarrantConversionRight {
  const mech = mapWarrantMechanism(value.conversion_mechanism);
  return {
    type: 'WARRANT_CONVERSION_RIGHT',
    conversion_mechanism: mech,
    ...(typeof value.converts_to_future_round === 'boolean'
      ? { converts_to_future_round: value.converts_to_future_round }
      : {}),
    ...(typeof value.converts_to_stock_class_id === 'string' && value.converts_to_stock_class_id.length
      ? { converts_to_stock_class_id: value.converts_to_stock_class_id }
      : {}),
  };
}

function extractRatioFromStockClassDaml(raw: unknown): { numerator: string; denominator: string } | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  let val: unknown = raw;
  if ('tag' in (val as Record<string, unknown>)) {
    const tagged = val as { tag: string; value?: unknown };
    if (tagged.tag !== 'Some' || !tagged.value) return undefined;
    val = tagged.value;
  }
  const r = val as Record<string, unknown>;
  if (!('numerator' in r) || !('denominator' in r)) return undefined;
  const num = r.numerator;
  const den = r.denominator;
  if (num == null || den == null) return undefined;
  const numStr = typeof num === 'string' ? num : typeof num === 'number' ? num.toString() : null;
  const denStr = typeof den === 'string' ? den : typeof den === 'number' ? den.toString() : null;
  if (numStr === null || denStr === null) return undefined;
  return { numerator: normalizeNumericString(numStr), denominator: normalizeNumericString(denStr) };
}

function extractOptionalMonetaryFromDaml(raw: unknown): Monetary | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const rec = raw as Record<string, unknown>;
  if (rec.tag === 'Some' && rec.value && typeof rec.value === 'object') {
    return damlMonetaryToNative(rec.value as Parameters<typeof damlMonetaryToNative>[0]);
  }
  if ('amount' in rec && 'currency' in rec) {
    return damlMonetaryToNativeWithValidation(rec);
  }
  return undefined;
}

/** DAML JSON may encode enums as plain strings or `{ tag: "..." }`. */
function damlEnumTagString(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).tag === 'string') {
    return (raw as Record<string, unknown>).tag as string;
  }
  return '';
}

function mapStockClassWarrantRightFromDaml(value: Record<string, unknown>): WarrantStockClassConversionRight {
  const mechRaw = value.conversion_mechanism;
  const mechanismTag = damlEnumTagString(mechRaw);
  if (mechanismTag !== 'OcfConversionMechanismRatioConversion') {
    throw new OcpParseError(
      `Unsupported OcfRightStockClass.conversion_mechanism "${mechanismTag || 'unknown'}" on warrant issuance`,
      { source: 'warrantIssuance.conversion_right', code: OcpErrorCodes.UNKNOWN_ENUM_VALUE }
    );
  }

  const stockClassId = value.converts_to_stock_class_id;
  if (typeof stockClassId !== 'string' || !stockClassId.length) {
    throw new OcpValidationError(
      'warrantIssuance.conversion_right.converts_to_stock_class_id',
      'Stock class conversion right requires converts_to_stock_class_id',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, receivedValue: stockClassId }
    );
  }

  const ratio = extractRatioFromStockClassDaml(value.ratio);
  if (!ratio) {
    throw new OcpValidationError(
      'warrantIssuance.conversion_right.ratio',
      'OcfRightStockClass with ratio conversion requires ratio',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
    );
  }

  const conversion_price = extractOptionalMonetaryFromDaml(value.conversion_price);
  if (!conversion_price) {
    throw new OcpValidationError(
      'warrantIssuance.conversion_right.conversion_price',
      'OcfRightStockClass with ratio conversion requires conversion_price',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
    );
  }

  // rounding_type is not on OcfStockClassConversionRight in DAML (generated JS type has ratio +
  // conversion_price only for ratio mech). Match StockClass readback normalization in planSecurityAliases.
  const out: WarrantStockClassConversionRight = {
    type: 'STOCK_CLASS_CONVERSION_RIGHT',
    converts_to_stock_class_id: stockClassId,
    conversion_mechanism: {
      type: 'RATIO_CONVERSION',
      ratio,
      conversion_price,
      rounding_type: 'NORMAL',
    },
  };
  if (typeof value.converts_to_future_round === 'boolean') {
    out.converts_to_future_round = value.converts_to_future_round;
  }
  return out;
}

function mapAnyConversionRightFromDaml(r: unknown): WarrantTriggerConversionRight {
  if (!r || typeof r !== 'object') {
    throw new OcpValidationError('warrantRight', 'Invalid warrant conversion_right', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'object with tag and value',
      receivedValue: r,
    });
  }

  const variant = r as { tag?: string; value?: unknown };
  const { tag } = variant;
  const inner = variant.value;
  const value = typeof inner === 'object' && inner !== null ? (inner as Record<string, unknown>) : null;

  if (!tag || !value) {
    throw new OcpValidationError('warrantRight', 'Invalid warrant conversion_right: missing tag/value', {
      code: OcpErrorCodes.INVALID_TYPE,
      receivedValue: r,
    });
  }

  if (tag === 'OcfRightWarrant') {
    return mapWarrantRightValueToNative(value);
  }
  if (tag === 'OcfRightStockClass') {
    return mapStockClassWarrantRightFromDaml(value);
  }

  throw new OcpParseError(`Unknown warrant conversion_right tag: "${tag}"`, {
    source: 'conversion_right.tag',
    code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
  });
}

function mapQuantitySource(qs: unknown): OcfWarrantIssuance['quantity_source'] | undefined {
  if (!qs || typeof qs !== 'string') return undefined;
  if (qs.endsWith('HumanEstimated')) return 'HUMAN_ESTIMATED';
  if (qs.endsWith('MachineEstimated')) return 'MACHINE_ESTIMATED';
  if (qs.endsWith('InstrumentFixed')) return 'INSTRUMENT_FIXED';
  if (qs.endsWith('InstrumentMax')) return 'INSTRUMENT_MAX';
  if (qs.endsWith('InstrumentMin')) return 'INSTRUMENT_MIN';
  if (qs.endsWith('Unspecified')) return 'UNSPECIFIED';
  return undefined;
}

/**
 * Converts DAML WarrantIssuance data to native OCF format.
 * Used by the dispatcher pattern in damlToOcf.ts.
 *
 * Optional fields must stay aligned with `warrantIssuanceDataToDaml` in `createWarrantIssuance.ts`:
 * replication compares raw DB OCF to Canton readback; missing optional keys cause false residual edits.
 */
export function damlWarrantIssuanceDataToNative(d: Record<string, unknown>): OcfWarrantIssuance {
  const exercise_triggers: WarrantExerciseTrigger[] = Array.isArray(d.exercise_triggers)
    ? (d.exercise_triggers as unknown[]).map((raw: unknown, idx: number) => {
        const r = (raw ?? {}) as Record<string, unknown>;
        const tag =
          typeof r.type_ === 'string'
            ? r.type_
            : typeof r.tag === 'string'
              ? r.tag
              : typeof raw === 'string'
                ? raw
                : '';
        const type: ConversionTriggerType = mapDamlTriggerTypeToOcf(tag);
        const trigger_id: string =
          typeof r.trigger_id === 'string' && r.trigger_id.length
            ? r.trigger_id
            : `${typeof d.id === 'string' ? d.id : ''}-warrant-trigger-${idx + 1}`;
        const nickname: string | undefined =
          typeof r.nickname === 'string' && r.nickname.length ? r.nickname : undefined;
        const trigger_description: string | undefined =
          typeof r.trigger_description === 'string' && r.trigger_description.length ? r.trigger_description : undefined;
        const trigger_date: string | undefined =
          typeof r.trigger_date === 'string' && r.trigger_date.length ? r.trigger_date.split('T')[0] : undefined;
        const trigger_condition: string | undefined =
          typeof r.trigger_condition === 'string' && r.trigger_condition.length ? r.trigger_condition : undefined;
        const start_date: string | undefined =
          typeof r.start_date === 'string' && r.start_date.length ? r.start_date.split('T')[0] : undefined;
        const end_date: string | undefined =
          typeof r.end_date === 'string' && r.end_date.length ? r.end_date.split('T')[0] : undefined;

        const conversion_right: WarrantTriggerConversionRight = mapAnyConversionRightFromDaml(r.conversion_right);

        const t: WarrantExerciseTrigger = {
          type,
          trigger_id,
          conversion_right,
          ...(nickname ? { nickname } : {}),
          ...(trigger_description ? { trigger_description } : {}),
          ...(trigger_date ? { trigger_date } : {}),
          ...(trigger_condition ? { trigger_condition } : {}),
          ...(start_date ? { start_date } : {}),
          ...(end_date ? { end_date } : {}),
        };
        return t;
      })
    : [];

  const exercise_price = d.exercise_price
    ? damlMonetaryToNativeWithValidation(d.exercise_price as Record<string, unknown>)
    : undefined;

  const purchase_price_obj = d.purchase_price as Record<string, unknown> | null | undefined;
  if (!purchase_price_obj) {
    throw new OcpValidationError('warrantIssuance.purchase_price', 'Missing required purchase_price', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });
  }
  const purchase_price = damlMonetaryToNativeWithValidation(purchase_price_obj);
  if (!purchase_price) {
    throw new OcpValidationError('warrantIssuance.purchase_price', 'Invalid purchase_price', {
      code: OcpErrorCodes.INVALID_FORMAT,
      receivedValue: purchase_price_obj,
    });
  }

  const comments = Array.isArray(d.comments) && d.comments.length > 0 ? (d.comments as string[]) : undefined;

  const vestings: VestingSimple[] | undefined =
    Array.isArray(d.vestings) && d.vestings.length > 0
      ? (d.vestings as Array<{ date: string; amount?: unknown }>).map((v) => {
          if (typeof v.amount !== 'string' && typeof v.amount !== 'number') {
            throw new OcpValidationError(
              'warrantIssuance.vestings.amount',
              `Must be string or number, got ${typeof v.amount}`,
              {
                code: OcpErrorCodes.INVALID_TYPE,
                expectedType: 'string | number',
                receivedValue: v.amount,
              }
            );
          }
          const amountStr = typeof v.amount === 'number' ? v.amount.toString() : v.amount;
          if (typeof v.date !== 'string' || !v.date) {
            throw new OcpValidationError('warrantIssuance.vestings.date', 'Required field is missing or invalid', {
              code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
              receivedValue: v.date,
            });
          }
          return {
            date: v.date.split('T')[0],
            amount: normalizeNumericString(amountStr),
          };
        })
      : undefined;

  // Validate required string fields
  if (typeof d.id !== 'string' || !d.id) {
    throw new OcpValidationError('warrantIssuance.id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.id,
    });
  }
  if (typeof d.date !== 'string' || !d.date) {
    throw new OcpValidationError('warrantIssuance.date', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.date,
    });
  }
  if (typeof d.security_id !== 'string' || !d.security_id) {
    throw new OcpValidationError('warrantIssuance.security_id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.security_id,
    });
  }
  if (typeof d.custom_id !== 'string' || !d.custom_id) {
    throw new OcpValidationError('warrantIssuance.custom_id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.custom_id,
    });
  }
  if (typeof d.stakeholder_id !== 'string' || !d.stakeholder_id) {
    throw new OcpValidationError('warrantIssuance.stakeholder_id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.stakeholder_id,
    });
  }

  return {
    id: d.id,
    date: d.date.split('T')[0],
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    ...(d.quantity !== null &&
    d.quantity !== undefined &&
    (typeof d.quantity === 'number' || typeof d.quantity === 'string')
      ? { quantity: normalizeNumericString(typeof d.quantity === 'number' ? d.quantity.toString() : d.quantity) }
      : {}),
    ...(exercise_price ? { exercise_price } : {}),
    purchase_price,
    exercise_triggers,
    // Include quantity_source only when DAML explicitly provides a mappable value.
    ...(() => {
      const mappedQuantitySource =
        d.quantity_source !== null && d.quantity_source !== undefined
          ? mapQuantitySource(d.quantity_source)
          : undefined;

      if (d.quantity_source !== null && d.quantity_source !== undefined && !mappedQuantitySource) {
        throw new OcpValidationError('warrantIssuance.quantity_source', 'Invalid quantity_source value', {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'known quantity source',
          receivedValue: d.quantity_source,
        });
      }

      if (mappedQuantitySource) {
        return { quantity_source: mappedQuantitySource };
      }
      return {};
    })(),
    ...(d.warrant_expiration_date
      ? { warrant_expiration_date: (d.warrant_expiration_date as string).split('T')[0] }
      : {}),
    ...(d.vesting_terms_id && typeof d.vesting_terms_id === 'string' ? { vesting_terms_id: d.vesting_terms_id } : {}),
    ...(d.board_approval_date && typeof d.board_approval_date === 'string'
      ? { board_approval_date: d.board_approval_date.split('T')[0] }
      : {}),
    ...(d.stockholder_approval_date && typeof d.stockholder_approval_date === 'string'
      ? { stockholder_approval_date: d.stockholder_approval_date.split('T')[0] }
      : {}),
    ...(typeof d.consideration_text === 'string' && d.consideration_text.length > 0
      ? { consideration_text: d.consideration_text }
      : {}),
    ...(vestings ? { vestings } : {}),
    security_law_exemptions: d.security_law_exemptions as Array<{
      description: string;
      jurisdiction: string;
    }>,
    ...(comments ? { comments } : {}),
  };
}

export async function getWarrantIssuanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetWarrantIssuanceAsOcfParams
): Promise<GetWarrantIssuanceAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getWarrantIssuanceAsOcf',
  });
  const arg = createArgument;
  if (!('issuance_data' in arg))
    throw new OcpParseError('Unexpected createArgument for WarrantIssuance', {
      source: 'WarrantIssuance.createArgument',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  const d = arg.issuance_data as Record<string, unknown>;

  const native = damlWarrantIssuanceDataToNative(d);

  const warrantIssuance = {
    object_type: 'TX_WARRANT_ISSUANCE' as const,
    ...native,
  };

  return { warrantIssuance, contractId: params.contractId };
}
