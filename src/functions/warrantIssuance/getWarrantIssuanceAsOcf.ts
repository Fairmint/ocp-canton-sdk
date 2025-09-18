import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';

type ConversionTriggerType =
  | 'AUTOMATIC_ON_CONDITION'
  | 'AUTOMATIC_ON_DATE'
  | 'ELECTIVE_IN_RANGE'
  | 'ELECTIVE_ON_CONDITION'
  | 'ELECTIVE_AT_WILL'
  | 'UNSPECIFIED';

type WarrantCustomMechanism = {
  type: 'CUSTOM_CONVERSION';
  custom_conversion_description: string;
};

type WarrantPercentCapMechanism = {
  type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION';
  converts_to_percent: string;
  capitalization_definition?: string;
  capitalization_definition_rules?: any;
};

type WarrantFixedAmountMechanism = {
  type: 'FIXED_AMOUNT_CONVERSION';
  converts_to_quantity: string;
};

type WarrantValuationBasedMechanism = {
  type: 'VALUATION_BASED_CONVERSION';
  valuation_type?: string;
  valuation_amount?: { amount: string; currency: string };
  capitalization_definition?: string;
  capitalization_definition_rules?: any;
};

type WarrantSharePriceBasedMechanism = {
  type: 'SHARE_PRICE_BASED_CONVERSION';
  description?: string;
  discount: boolean;
  discount_percentage?: string;
  discount_amount?: { amount: string; currency: string };
};

type WarrantConversionMechanism =
  | WarrantCustomMechanism
  | WarrantPercentCapMechanism
  | WarrantFixedAmountMechanism
  | WarrantValuationBasedMechanism
  | WarrantSharePriceBasedMechanism;

type WarrantConversionRight = {
  type: 'WARRANT_CONVERSION_RIGHT';
  conversion_mechanism: WarrantConversionMechanism;
  converts_to_future_round?: boolean;
  converts_to_stock_class_id?: string;
};

type ExerciseTrigger = {
  type: ConversionTriggerType;
  trigger_id: string;
  conversion_right: WarrantConversionRight;
  nickname?: string;
  trigger_description?: string;
  trigger_date?: string;
  trigger_condition?: string;
};

export interface OcfWarrantIssuanceEvent {
  object_type: 'TX_WARRANT_ISSUANCE';
  id: string;
  date: string;
  security_id: string;
  custom_id: string;
  stakeholder_id: string;
  quantity: string;
  exercise_price: { amount: string; currency: string } | null;
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
  security_law_exemptions?: Array<{ description: string; jurisdiction: string }>;
  comments?: string[];
}

export interface GetWarrantIssuanceAsOcfParams { contractId: string }
export interface GetWarrantIssuanceAsOcfResult { event: OcfWarrantIssuanceEvent; contractId: string }

export async function getWarrantIssuanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetWarrantIssuanceAsOcfParams
): Promise<GetWarrantIssuanceAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  const created = res.created?.createdEvent;
  if (!created?.createArgument) throw new Error('Missing createArgument for WarrantIssuance');
  const arg = created.createArgument as any;
  if (!('issuance_data' in arg)) throw new Error('Unexpected createArgument for WarrantIssuance');
  const d = (arg as any).issuance_data;

  const mapTagToType = (tag: string): ConversionTriggerType => {
    if (tag === 'OcfTriggerTypeTypeAutomaticOnDate') return 'AUTOMATIC_ON_DATE';
    if (tag === 'OcfTriggerTypeTypeElectiveInRange') return 'ELECTIVE_IN_RANGE';
    if (tag === 'OcfTriggerTypeTypeElectiveOnCondition') return 'ELECTIVE_ON_CONDITION';
    if (tag === 'OcfTriggerTypeTypeElectiveAtWill') return 'ELECTIVE_AT_WILL';
    if (tag === 'OcfTriggerTypeTypeUnspecified') return 'UNSPECIFIED';
    return 'AUTOMATIC_ON_CONDITION';
  };

  const mapMonetary = (m: any | null | undefined): { amount: string; currency: string } | undefined => {
    if (!m) return undefined;
    const amount = typeof m.amount === 'number' ? String(m.amount) : m.amount;
    return { amount, currency: m.currency };
  };

  const mapWarrantMechanism = (m: any): WarrantConversionMechanism => {
    const tag = typeof m?.tag === 'string' ? m.tag : typeof m === 'string' ? m : '';
    const value = typeof m === 'object' && m && 'value' in m ? (m as any).value : {};
    switch (tag) {
      case 'OcfWarrantMechanismPercentCapitalization':
        return {
          type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
          converts_to_percent: typeof value.converts_to_percent === 'number' ? String(value.converts_to_percent) : value.converts_to_percent,
          ...(value.capitalization_definition ? { capitalization_definition: value.capitalization_definition } : {}),
          ...(value.capitalization_definition_rules ? { capitalization_definition_rules: value.capitalization_definition_rules } : {})
        } as WarrantPercentCapMechanism;
      case 'OcfWarrantMechanismFixedAmount':
        return {
          type: 'FIXED_AMOUNT_CONVERSION',
          converts_to_quantity: typeof value.converts_to_quantity === 'number' ? String(value.converts_to_quantity) : value.converts_to_quantity
        } as WarrantFixedAmountMechanism;
      case 'OcfWarrantMechanismValuationBased':
        return {
          type: 'VALUATION_BASED_CONVERSION',
          valuation_type: value.valuation_type,
          ...(value.valuation_amount ? { valuation_amount: mapMonetary(value.valuation_amount)! } : {}),
          ...(value.capitalization_definition ? { capitalization_definition: value.capitalization_definition } : {}),
          ...(value.capitalization_definition_rules ? { capitalization_definition_rules: value.capitalization_definition_rules } : {})
        } as WarrantValuationBasedMechanism;
      case 'OcfWarrantMechanismSharePriceBased':
        return {
          type: 'SHARE_PRICE_BASED_CONVERSION',
          description: value.description,
          discount: !!value.discount,
          ...(value.discount_percentage !== undefined && value.discount_percentage !== null
            ? { discount_percentage: typeof value.discount_percentage === 'number' ? String(value.discount_percentage) : value.discount_percentage }
            : {}),
          ...(value.discount_amount ? { discount_amount: mapMonetary(value.discount_amount)! } : {})
        } as WarrantSharePriceBasedMechanism;
      case 'OcfWarrantMechanismCustom':
      default:
        return {
          type: 'CUSTOM_CONVERSION',
          custom_conversion_description: value.custom_conversion_description || 'Custom'
        } as WarrantCustomMechanism;
    }
  };

  const mapAnyRightToWarrantRight = (r: any): WarrantConversionRight => {
    // r is expected to be variant { tag: 'OcfRightWarrant', value: {...} }
    const value = typeof r === 'object' && r && 'value' in r ? (r as any).value : {};
    const mech = mapWarrantMechanism(value.conversion_mechanism);
    const right: WarrantConversionRight = {
      type: 'WARRANT_CONVERSION_RIGHT',
      conversion_mechanism: mech,
      ...(typeof value.converts_to_future_round === 'boolean' ? { converts_to_future_round: value.converts_to_future_round } : {}),
      ...(typeof value.converts_to_stock_class_id === 'string' && value.converts_to_stock_class_id?.length
        ? { converts_to_stock_class_id: value.converts_to_stock_class_id }
        : {})
    };
    return right;
  };

  const exercise_triggers: ExerciseTrigger[] = Array.isArray(d.exercise_triggers)
    ? (d.exercise_triggers as any[]).map((raw: any, idx: number) => {
        const r = (raw ?? {}) as Record<string, any>;
        const tag = typeof r.type_ === 'string' ? r.type_ : (typeof r.tag === 'string' ? r.tag : (typeof raw === 'string' ? raw : ''));
        const type: ConversionTriggerType = mapTagToType(String(tag));
        const trigger_id: string = typeof r.trigger_id === 'string' && r.trigger_id.length ? r.trigger_id : `${d.ocf_id}-warrant-trigger-${idx + 1}`;
        const nickname: string | undefined = typeof r.nickname === 'string' && r.nickname.length ? r.nickname : undefined;
        const trigger_description: string | undefined = typeof r.trigger_description === 'string' && r.trigger_description.length ? r.trigger_description : undefined;
        const trigger_date: string | undefined = typeof r.trigger_date === 'string' && r.trigger_date.length ? (r.trigger_date as string).split('T')[0] : undefined;
        const trigger_condition: string | undefined = typeof r.trigger_condition === 'string' && r.trigger_condition.length ? r.trigger_condition : undefined;

        const conversion_right: WarrantConversionRight = mapAnyRightToWarrantRight(r.conversion_right);

        const t: ExerciseTrigger = {
          type,
          trigger_id,
          conversion_right,
          ...(nickname ? { nickname } : {}),
          ...(trigger_description ? { trigger_description } : {}),
          ...(trigger_date ? { trigger_date } : {}),
          ...(trigger_condition ? { trigger_condition } : {})
        };
        return t;
      })
    : [];

  const mapQuantitySource = (qs: any): OcfWarrantIssuanceEvent['quantity_source'] | undefined => {
    if (!qs) return undefined;
    const s = String(qs);
    if (s.endsWith('HumanEstimated')) return 'HUMAN_ESTIMATED';
    if (s.endsWith('MachineEstimated')) return 'MACHINE_ESTIMATED';
    if (s.endsWith('InstrumentFixed')) return 'INSTRUMENT_FIXED';
    if (s.endsWith('InstrumentMax')) return 'INSTRUMENT_MAX';
    if (s.endsWith('InstrumentMin')) return 'INSTRUMENT_MIN';
    if (s.endsWith('Unspecified')) return 'UNSPECIFIED';
    return undefined;
  };

  const event: OcfWarrantIssuanceEvent = {
    object_type: 'TX_WARRANT_ISSUANCE',
    id: d.ocf_id,
    date: (d.date as string).split('T')[0],
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    quantity: typeof d.quantity === 'number' ? String(d.quantity) : d.quantity,
    exercise_price: d.exercise_price
      ? { amount: typeof d.exercise_price.amount === 'number' ? String(d.exercise_price.amount) : d.exercise_price.amount, currency: d.exercise_price.currency }
      : null,
    purchase_price: { amount: typeof d.purchase_price.amount === 'number' ? String(d.purchase_price.amount) : d.purchase_price.amount, currency: d.purchase_price.currency },
    exercise_triggers,
    // If quantity provided but quantity_source missing, default to UNSPECIFIED per schema
    ...(d.quantity !== null && d.quantity !== undefined
      ? { quantity_source: mapQuantitySource(d.quantity_source) || 'UNSPECIFIED' }
      : {}),
    ...(d.warrant_expiration_date ? { warrant_expiration_date: (d.warrant_expiration_date as string).split('T')[0] } : {}),
    ...(d.vesting_terms_id ? { vesting_terms_id: d.vesting_terms_id } : {}),
    ...(Array.isArray(d.security_law_exemptions) && d.security_law_exemptions.length > 0
      ? { security_law_exemptions: d.security_law_exemptions as Array<{ description: string; jurisdiction: string }> }
      : {}),
    ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments } : {})
  };

  return { event, contractId: params.contractId };
}


