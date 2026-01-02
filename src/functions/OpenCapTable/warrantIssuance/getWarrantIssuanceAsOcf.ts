import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { normalizeNumericString } from '../../../utils/typeConversions';

type ConversionTriggerType =
  | 'AUTOMATIC_ON_CONDITION'
  | 'AUTOMATIC_ON_DATE'
  | 'ELECTIVE_IN_RANGE'
  | 'ELECTIVE_ON_CONDITION'
  | 'ELECTIVE_AT_WILL'
  | 'UNSPECIFIED';

interface WarrantCustomMechanism {
  type: 'CUSTOM_CONVERSION';
  custom_conversion_description: string;
}

interface WarrantPercentCapMechanism {
  type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION';
  converts_to_percent: string;
  capitalization_definition?: string;
  capitalization_definition_rules?: Record<string, unknown>;
}

interface WarrantFixedAmountMechanism {
  type: 'FIXED_AMOUNT_CONVERSION';
  converts_to_quantity: string;
}

interface WarrantValuationBasedMechanism {
  type: 'VALUATION_BASED_CONVERSION';
  valuation_type?: string;
  valuation_amount?: { amount: string; currency: string };
  capitalization_definition?: string;
  capitalization_definition_rules?: Record<string, unknown>;
}

interface WarrantSharePriceBasedMechanism {
  type: 'SHARE_PRICE_BASED_CONVERSION';
  description?: string;
  discount: boolean;
  discount_percentage?: string;
  discount_amount?: { amount: string; currency: string };
}

type WarrantConversionMechanism =
  | WarrantCustomMechanism
  | WarrantPercentCapMechanism
  | WarrantFixedAmountMechanism
  | WarrantValuationBasedMechanism
  | WarrantSharePriceBasedMechanism;

interface WarrantConversionRight {
  type: 'WARRANT_CONVERSION_RIGHT';
  conversion_mechanism: WarrantConversionMechanism;
  converts_to_future_round?: boolean;
  converts_to_stock_class_id?: string;
}

interface ExerciseTrigger {
  type: ConversionTriggerType;
  trigger_id: string;
  conversion_right: WarrantConversionRight;
  nickname?: string;
  trigger_description?: string;
  trigger_date?: string;
  trigger_condition?: string;
}

export interface OcfWarrantIssuanceEvent {
  object_type: 'TX_WARRANT_ISSUANCE';
  id: string;
  date: string;
  security_id: string;
  custom_id: string;
  stakeholder_id: string;
  quantity?: string;
  exercise_price?: { amount: string; currency: string };
  purchase_price: { amount: string; currency: string };
  exercise_triggers: ExerciseTrigger[];
  quantity_source?:
    | 'HUMAN_ESTIMATED'
    | 'MACHINE_ESTIMATED'
    | 'UNSPECIFIED'
    | 'INSTRUMENT_FIXED'
    | 'INSTRUMENT_MAX'
    | 'INSTRUMENT_MIN';
  warrant_expiration_date?: string;
  vesting_terms_id?: string;
  security_law_exemptions: Array<{ description: string; jurisdiction: string }>;
  comments?: string[];
}

export interface GetWarrantIssuanceAsOcfParams {
  contractId: string;
}
export interface GetWarrantIssuanceAsOcfResult {
  event: OcfWarrantIssuanceEvent;
  contractId: string;
}

export async function getWarrantIssuanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetWarrantIssuanceAsOcfParams
): Promise<GetWarrantIssuanceAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  const created = res.created?.createdEvent;
  if (!created?.createArgument) throw new Error('Missing createArgument for WarrantIssuance');
  const arg = created.createArgument as Record<string, unknown>;
  if (!('issuance_data' in arg)) throw new Error('Unexpected createArgument for WarrantIssuance');
  const d = arg.issuance_data as Record<string, unknown>;

  const mapTagToType = (tag: string): ConversionTriggerType => {
    if (tag === 'OcfTriggerTypeTypeAutomaticOnDate') return 'AUTOMATIC_ON_DATE';
    if (tag === 'OcfTriggerTypeTypeElectiveInRange') return 'ELECTIVE_IN_RANGE';
    if (tag === 'OcfTriggerTypeTypeElectiveOnCondition') return 'ELECTIVE_ON_CONDITION';
    if (tag === 'OcfTriggerTypeTypeElectiveAtWill') return 'ELECTIVE_AT_WILL';
    if (tag === 'OcfTriggerTypeTypeUnspecified') return 'UNSPECIFIED';
    return 'AUTOMATIC_ON_CONDITION';
  };

  const mapMonetary = (
    m: Record<string, unknown> | null | undefined
  ): { amount: string; currency: string } | undefined => {
    if (!m) return undefined;
    
    // Validate amount exists and is string or number
    if (m.amount === undefined || m.amount === null) {
      throw new Error('Monetary amount is required but was undefined or null');
    }
    if (typeof m.amount !== 'string' && typeof m.amount !== 'number') {
      throw new Error(`Monetary amount must be string or number, got ${typeof m.amount}`);
    }
    
    // Validate currency exists and is string
    if (typeof m.currency !== 'string' || !m.currency) {
      throw new Error('Monetary currency is required and must be a non-empty string');
    }
    
    const amount = normalizeNumericString(typeof m.amount === 'number' ? m.amount.toString() : m.amount);
    return { amount, currency: m.currency };
  };

  const mapWarrantMechanism = (m: unknown): WarrantConversionMechanism => {
    if (!m || typeof m !== 'object') {
      throw new Error('Invalid warrant mechanism: expected object');
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
              ? String(value.converts_to_percent)
              : String(value.converts_to_percent)
          ),
          ...(value.capitalization_definition && typeof value.capitalization_definition === 'string'
            ? { capitalization_definition: value.capitalization_definition }
            : {}),
          ...(value.capitalization_definition_rules
            ? { capitalization_definition_rules: value.capitalization_definition_rules as Record<string, unknown> }
            : {}),
        } as WarrantPercentCapMechanism;
      case 'OcfWarrantMechanismFixedAmount':
        return {
          type: 'FIXED_AMOUNT_CONVERSION',
          converts_to_quantity: normalizeNumericString(
            typeof value.converts_to_quantity === 'number'
              ? String(value.converts_to_quantity)
              : String(value.converts_to_quantity)
          ),
        } as WarrantFixedAmountMechanism;
      case 'OcfWarrantMechanismValuationBased': {
        const valuationAmount = mapMonetary(value.valuation_amount as Record<string, unknown>);
        return {
          type: 'VALUATION_BASED_CONVERSION',
          valuation_type: String(value.valuation_type),
          ...(valuationAmount ? { valuation_amount: valuationAmount } : {}),
          ...(value.capitalization_definition && typeof value.capitalization_definition === 'string'
            ? { capitalization_definition: value.capitalization_definition }
            : {}),
          ...(value.capitalization_definition_rules
            ? { capitalization_definition_rules: value.capitalization_definition_rules as Record<string, unknown> }
            : {}),
        } as WarrantValuationBasedMechanism;
      }
      case 'OcfWarrantMechanismSharePriceBased': {
        const discountAmount = mapMonetary(value.discount_amount as Record<string, unknown>);
        return {
          type: 'SHARE_PRICE_BASED_CONVERSION',
          description: String(value.description),
          discount: Boolean(value.discount),
          ...(value.discount_percentage !== undefined &&
          value.discount_percentage !== null &&
          (typeof value.discount_percentage === 'number' || typeof value.discount_percentage === 'string')
            ? {
                discount_percentage: normalizeNumericString(
                  typeof value.discount_percentage === 'number'
                    ? String(value.discount_percentage)
                    : value.discount_percentage
                ),
              }
            : {}),
          ...(discountAmount ? { discount_amount: discountAmount } : {}),
        } as WarrantSharePriceBasedMechanism;
      }
      case 'OcfWarrantMechanismCustom':
        return {
          type: 'CUSTOM_CONVERSION',
          custom_conversion_description: String(value.custom_conversion_description),
        } as WarrantCustomMechanism;
      default:
        throw new Error(`Unknown warrant mechanism: ${tag}`);
    }
  };

  const mapAnyRightToWarrantRight = (r: unknown): WarrantConversionRight => {
    // r is expected to be variant { tag: 'OcfRightWarrant', value: {...} }
    if (!r || typeof r !== 'object' || !('value' in r)) {
      throw new Error('Invalid warrant right: expected object with value property');
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
  };

  const exercise_triggers: ExerciseTrigger[] = Array.isArray(d.exercise_triggers)
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
        const type: ConversionTriggerType = mapTagToType(String(tag));
        const trigger_id: string =
          typeof r.trigger_id === 'string' && r.trigger_id.length
            ? r.trigger_id
            : `${String(d.id)}-warrant-trigger-${idx + 1}`;
        const nickname: string | undefined =
          typeof r.nickname === 'string' && r.nickname.length ? r.nickname : undefined;
        const trigger_description: string | undefined =
          typeof r.trigger_description === 'string' && r.trigger_description.length ? r.trigger_description : undefined;
        const trigger_date: string | undefined =
          typeof r.trigger_date === 'string' && r.trigger_date.length ? r.trigger_date.split('T')[0] : undefined;
        const trigger_condition: string | undefined =
          typeof r.trigger_condition === 'string' && r.trigger_condition.length ? r.trigger_condition : undefined;

        const conversion_right: WarrantConversionRight = mapAnyRightToWarrantRight(r.conversion_right);

        const t: ExerciseTrigger = {
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

  const mapQuantitySource = (qs: unknown): OcfWarrantIssuanceEvent['quantity_source'] | undefined => {
    if (!qs || typeof qs !== 'string') return undefined;
    if (qs.endsWith('HumanEstimated')) return 'HUMAN_ESTIMATED';
    if (qs.endsWith('MachineEstimated')) return 'MACHINE_ESTIMATED';
    if (qs.endsWith('InstrumentFixed')) return 'INSTRUMENT_FIXED';
    if (qs.endsWith('InstrumentMax')) return 'INSTRUMENT_MAX';
    if (qs.endsWith('InstrumentMin')) return 'INSTRUMENT_MIN';
    if (qs.endsWith('Unspecified')) return 'UNSPECIFIED';
    return undefined;
  };

  const exercise_price = d.exercise_price ? mapMonetary(d.exercise_price as Record<string, unknown>) : undefined;

  const purchase_price_obj = d.purchase_price as Record<string, unknown> | null | undefined;
  if (!purchase_price_obj) {
    throw new Error('Missing required purchase_price');
  }
  const purchase_price = mapMonetary(purchase_price_obj);
  if (!purchase_price) {
    throw new Error('Invalid purchase_price');
  }

  const comments = Array.isArray(d.comments) && d.comments.length > 0 ? (d.comments as string[]) : undefined;

  const event: OcfWarrantIssuanceEvent = {
    object_type: 'TX_WARRANT_ISSUANCE',
    id: String(d.id),
    date: (d.date as string).split('T')[0],
    security_id: String(d.security_id),
    custom_id: String(d.custom_id),
    stakeholder_id: String(d.stakeholder_id),
    ...(d.quantity !== null &&
    d.quantity !== undefined &&
    (typeof d.quantity === 'number' || typeof d.quantity === 'string')
      ? { quantity: normalizeNumericString(typeof d.quantity === 'number' ? String(d.quantity) : d.quantity) }
      : {}),
    ...(exercise_price ? { exercise_price } : {}),
    purchase_price,
    exercise_triggers,
    // If quantity provided but quantity_source missing, default to UNSPECIFIED per schema
    ...(d.quantity !== null && d.quantity !== undefined
      ? { quantity_source: mapQuantitySource(d.quantity_source) ?? 'UNSPECIFIED' }
      : {}),
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

  return { event, contractId: params.contractId };
}
