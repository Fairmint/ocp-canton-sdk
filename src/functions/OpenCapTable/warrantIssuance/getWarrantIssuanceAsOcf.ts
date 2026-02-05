import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type {
  ConversionTriggerType,
  OcfWarrantIssuance,
  WarrantConversionMechanism,
  WarrantConversionRight,
  WarrantExerciseTrigger,
  WarrantMechanismCustom,
  WarrantMechanismFixedAmount,
  WarrantMechanismPercentCapitalization,
  WarrantMechanismSharePriceBased,
  WarrantMechanismValuationBased,
} from '../../../types/native';
import {
  damlMonetaryToNativeWithValidation,
  mapDamlTriggerTypeToOcf,
  normalizeNumericString,
} from '../../../utils/typeConversions';

export interface GetWarrantIssuanceAsOcfParams {
  contractId: string;
}
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
    case 'OcfWarrantMechanismSharePriceBased': {
      const discountAmount = damlMonetaryToNativeWithValidation(value.discount_amount as Record<string, unknown>);
      if (typeof value.description !== 'string' || !value.description) {
        throw new OcpValidationError(
          'warrantMechanism.description',
          'Warrant share price mechanism description is required and must be a non-empty string',
          { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, expectedType: 'string', receivedValue: value.description }
        );
      }
      return {
        type: 'SHARE_PRICE_BASED_CONVERSION',
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
      } as WarrantMechanismSharePriceBased;
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

function mapAnyRightToWarrantRight(r: unknown): WarrantConversionRight {
  // r is expected to be variant { tag: 'OcfRightWarrant', value: {...} }
  if (!r || typeof r !== 'object' || !('value' in r)) {
    throw new OcpValidationError('warrantRight', 'Invalid warrant right: expected object with value property', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'object with value property',
      receivedValue: r,
    });
  }
  const rObj = r as { value: unknown };
  const value = typeof rObj.value === 'object' && rObj.value ? (rObj.value as Record<string, unknown>) : {};

  const mech = mapWarrantMechanism(value.conversion_mechanism);
  const right: WarrantConversionRight = {
    type: 'WARRANT_CONVERSION_RIGHT',
    conversion_mechanism: mech,
    ...(typeof value.converts_to_future_round === 'boolean'
      ? { converts_to_future_round: value.converts_to_future_round }
      : {}),
    ...(typeof value.converts_to_stock_class_id === 'string' && value.converts_to_stock_class_id.length
      ? { converts_to_stock_class_id: value.converts_to_stock_class_id }
      : {}),
  };
  return right;
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

        const conversion_right: WarrantConversionRight = mapAnyRightToWarrantRight(r.conversion_right);

        const t: WarrantExerciseTrigger = {
          type,
          trigger_id,
          conversion_right,
          ...(nickname ? { nickname } : {}),
          ...(trigger_description ? { trigger_description } : {}),
          ...(trigger_date ? { trigger_date } : {}),
          ...(trigger_condition ? { trigger_condition } : {}),
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
    // Include quantity_source based on quantity presence and DAML data.
    // When quantity is present: always include quantity_source (default UNSPECIFIED).
    // When quantity is absent: only include if DAML explicitly has a non-default value
    // (the OCF-to-DAML converter can set quantity_source independently of quantity).
    ...(() => {
      const mappedQuantitySource =
        d.quantity_source !== null && d.quantity_source !== undefined
          ? mapQuantitySource(d.quantity_source)
          : undefined;

      // Fail fast: if DAML has a quantity_source value but we can't map it, throw
      if (d.quantity_source !== null && d.quantity_source !== undefined && !mappedQuantitySource) {
        throw new OcpValidationError('warrantIssuance.quantity_source', 'Invalid quantity_source value', {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'known quantity source',
          receivedValue: d.quantity_source,
        });
      }

      if (d.quantity !== null && d.quantity !== undefined) {
        return { quantity_source: mappedQuantitySource ?? 'UNSPECIFIED' };
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
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  const created = res.created?.createdEvent;
  if (!created?.createArgument)
    throw new OcpContractError('Missing createArgument for WarrantIssuance', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  const arg = created.createArgument as Record<string, unknown>;
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
